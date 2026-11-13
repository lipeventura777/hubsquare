import { app, dialog, type BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, join, relative } from 'path'
import {
  NOMES_TIPOS,
  type AnaliseModpack,
  type ArquivoManual,
  type AtualizacaoModpack,
  type EscolhaConflito,
  type InfoServidor,
  type PacoteAmigos,
  type PlanoAtualizacaoModpack,
  type Progresso,
  type ResultadoBuscaModpacks,
  type TipoId
} from '../shared/tipos'
import { compararVersoes } from '../shared/versoes'
import { compactarMundo, pastaBackups, tar as tarCriar } from './backup'
import { gravarComSeguranca, gravarPropriedades, limitesRam } from './config'
import { ErroApp, detalhar } from './erros'
import { nomeLimpo } from './nomeRegras'
import { TAR, tar, temAtalho } from './importarZip'
import { Cancelado, limitarProgresso, rodarFila } from './filaDownloads'
import { apagarEmTrabalhador, hashEmTrabalhador } from './hashTrabalhador'
import * as modrinth from './modrinth'
import {
  CHAVE_LOADER,
  caminhoDoPack,
  compararPack,
  downloadPermitido,
  ehMod,
  lerIndice,
  licencaDoMod,
  licencaPermite,
  loaderDoIndice,
  precisaNoJogador,
  soDoServidorFabric,
  sugerirRam,
  vaiProServidor,
  type ArquivoIndice,
  type Comparacao,
  type Indice,
  type NoDisco
} from './modpackRegras'
import { arquivoPareceDoMod, modsFaltando } from './consertoRegras'
import { metaDoJar } from './metaJar'
import { sha1 } from './mods'
import { manualCF } from './modsFontes'
import { lerGuardados, registrarPendencias } from './downloadsManuais'
import { ehMaisNova, escolherVersao, nomeSeguro, urlDoModrinth } from './modsRegras'
import { javaDaVersao } from './mojang'
import { nivelDoMundo, pastasDoMundo } from './mundo'
import { extrasDosAmigos } from './explorar'
import { baixar } from './rede'
import * as cf from './curseforge'
import { escolherArquivoCF, loaderDoManifest, soDoClienteCF } from './fontesRegras'
import { downloadPermitido as downloadDaFonte, imagemPermitida, type Fonte } from '../shared/fontes'
import {
  aceitarEula,
  aoFalharAoLigar,
  atualizarInfo,
  comServidorDesligado,
  instalarJarEJava,
  lerEstado,
  pastaServidores,
  validarNome
} from './servidor'
import { ARQUIVO_INFO, registrar } from './servidores'
import { maisNovaEstavel } from './tipos/fabric'
import { argsDoRunBat } from './tipos/versoesLoader'

// Modpacks no formato do Modrinth (.mrpack): criar servidor, atualizar o pack e gerar o
// "Pacote pros amigos". O pack original fica guardado na pasta do servidor para as Fases 17 e 18.

const ESTADO = 'servsquare-modpack.json' // índice do pack + hash do que ele pôs no servidor
const COPIA = 'servsquare-modpack.mrpack'
const LOADERS_MODRINTH = ['fabric', 'forge', 'neoforge']
const DOWNLOADS_JUNTOS = 6

type AoProgredir = (p: Progresso) => void

interface EstadoPack {
  indice: Indice
  geridos: Record<string, string> // caminho → SHA-1 do que o pack pôs no servidor
}

// ---------- Abrir um .mrpack ----------

interface PackAberto {
  pasta: string // onde o .mrpack foi extraído (temporária)
  indice: Indice
}

// ---------- Cancelar e avisos (correção: instalação de modpacks) ----------

// Só uma instalação de modpack por vez; o botão Cancelar da tela para a que está rodando.
let controle: AbortController | null = null

export function cancelarModpack(): void {
  controle?.abort()
}

// Roda `fn` com um sinal de cancelar. Cancelado vira um erro marcado (a tela não mostra como falha).
export async function comCancelar<T>(fn: (sinal: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController()
  controle = c
  try {
    return await fn(c.signal)
  } catch (e) {
    if (c.signal.aborted || e instanceof Cancelado) {
      throw new ErroApp('Instalação cancelada. Nada ficou pela metade.', '', { cancelado: true })
    }
    throw e
  } finally {
    if (controle === c) controle = null
  }
}

const parar = (sinal?: AbortSignal): void => {
  if (sinal?.aborted) throw new Cancelado()
}

// Lista o que tem no pack (tar.exe do Windows, sem extrair), recusando caminhos que saem da
// pasta e conferindo que o índice esperado existe.
async function listarPack(arquivo: string, indiceEsperado: string): Promise<string[]> {
  let entradas: string[]
  try {
    entradas = (await tar(['-tf', arquivo])).split(/\r?\n/).filter(Boolean)
  } catch (e) {
    throw new ErroApp(
      'Não consegui abrir esse modpack. Confira se o arquivo não está corrompido.',
      detalhar(e)
    )
  }
  const perigosas = entradas.filter((e) => !caminhoDoPack(e.replace(/\/$/, '')))
  if (perigosas.length) {
    throw new ErroApp(
      'Esse modpack tem arquivos que tentam sair da pasta, então ele não foi aberto. Use um pack de fonte confiável.',
      perigosas.slice(0, 20).join('\n')
    )
  }
  if (!entradas.includes(indiceEsperado)) {
    throw new ErroApp(
      `Esse arquivo não é um modpack que o app conhece (falta o ${indiceEsperado}).`
    )
  }
  return entradas.filter((e) => !e.endsWith('/'))
}

// Lê um arquivo de dentro do pack sem extrair o resto (o índice tem poucos MB; o pack, vários GB).
function lerDoPack(arquivo: string, membro: string): Promise<string> {
  return new Promise((resolver, falhar) => {
    const filho = spawn(TAR, ['-xOf', arquivo, membro], { windowsHide: true })
    const partes: Buffer[] = []
    let tamanho = 0
    filho.stdout.on('data', (d: Buffer) => {
      tamanho += d.length
      if (tamanho > 64 * 1024 * 1024)
        filho.kill() // índice gigante: não é um pack de verdade
      else partes.push(d)
    })
    filho.on('error', falhar)
    filho.on('close', (c) =>
      c === 0
        ? resolver(Buffer.concat(partes).toString('utf8'))
        : falhar(
            new ErroApp(`Não consegui ler o ${membro} do modpack.`, `tar saiu com código ${c}`)
          )
    )
  })
}

// Extrai o pack no tar.exe do Windows: outro processo, em streaming (nada do pack passa pela
// memória do app). Conta os arquivos para a tela e para no Cancelar.
async function extrair(
  arquivo: string,
  pasta: string,
  total: number,
  aoProgredir: AoProgredir,
  sinal?: AbortSignal
): Promise<void> {
  parar(sinal)
  await mkdir(pasta, { recursive: true })
  await new Promise<void>((resolver, falhar) => {
    const filho = spawn(TAR, ['-xvf', arquivo, '-C', pasta], { windowsHide: true, signal: sinal })
    let feitos = 0
    let fim = ''
    let erros = ''
    filho.stderr.setEncoding('utf8')
    filho.stderr.on('data', (d: string) => {
      const linhas = (fim + d).split(/\r?\n/)
      fim = linhas.pop() ?? ''
      for (const l of linhas) {
        if (l.startsWith('x ')) feitos++
        else erros = (erros + l + '\n').slice(-4000)
      }
      aoProgredir({
        etapa: `Extraindo o modpack: ${feitos} de ${total} arquivos`,
        recebido: feitos,
        total
      })
    })
    filho.on('error', (e) => falhar(sinal?.aborted ? new Cancelado() : e))
    filho.on('close', (c) =>
      sinal?.aborted
        ? falhar(new Cancelado())
        : c === 0
          ? resolver()
          : falhar(
              new ErroApp(
                'Não consegui extrair esse modpack.',
                `tar saiu com código ${c}\n${erros}`
              )
            )
    )
  })
}

// Abre um pack (.mrpack) inteiro numa pasta temporária, recusando atalhos, e lê o índice.
export async function abrirPack(
  arquivo: string,
  aoProgredir: AoProgredir = () => {},
  sinal?: AbortSignal
): Promise<PackAberto> {
  const entradas = await listarPack(arquivo, 'modrinth.index.json')
  const pasta = join(tmpdir(), `servsquare-mrpack-${randomUUID()}`)
  try {
    await extrairSeguro(arquivo, pasta, entradas.length, aoProgredir, sinal)
    return { pasta, indice: lerIndice(await readFile(join(pasta, 'modrinth.index.json'), 'utf8')) }
  } catch (e) {
    await apagarEmTrabalhador(pasta)
    if (e instanceof ErroApp || e instanceof Cancelado) throw e
    throw new ErroApp(
      e instanceof Error ? e.message : 'Não consegui ler esse modpack.',
      detalhar(e)
    )
  }
}

// Extrai e recusa packs com atalhos (links) dentro. Se der errado, nada fica na pasta.
async function extrairSeguro(
  arquivo: string,
  pasta: string,
  total: number,
  aoProgredir: AoProgredir,
  sinal?: AbortSignal
): Promise<void> {
  try {
    await extrair(arquivo, pasta, total, aoProgredir, sinal)
    if (await temAtalho(pasta)) {
      throw new ErroApp(
        'Esse modpack tem atalhos (links) dentro, e por segurança o app não aceita.'
      )
    }
  } catch (e) {
    await apagarEmTrabalhador(pasta)
    throw e
  }
}

// Arquivos das pastas de overrides, na ordem: as últimas ganham (overrides < server-overrides).
async function arquivosDeOverrides(pack: string, pastas: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  for (const nome of pastas) {
    const base = join(pack, nome)
    if (!existsSync(base)) continue
    for (const item of await readdir(base, { recursive: true, withFileTypes: true })) {
      if (!item.isFile()) continue
      const absoluto = join(item.parentPath, item.name)
      const caminho = relative(base, absoluto).replace(/\\/g, '/')
      if (caminhoDoPack(caminho)) mapa.set(caminho, absoluto)
    }
  }
  return mapa
}

// Copia os overrides para a pasta nova, com o SHA-1 de cada um calculado num worker (milhares de
// arquivos de vários GB não passam pela thread principal). Avisa "X de Y" e para no Cancelar.
async function copiarOverrides(
  overrides: Map<string, string>,
  destino: string,
  aoProgredir: AoProgredir,
  sinal?: AbortSignal
): Promise<Record<string, string>> {
  const geridos: Record<string, string> = {}
  let feitos = 0
  for (const [caminho, origem] of overrides) {
    parar(sinal)
    await mkdir(dirname(join(destino, caminho)), { recursive: true })
    await copyFile(origem, join(destino, caminho))
    geridos[caminho] = await hashEmTrabalhador(origem)
    aoProgredir({
      etapa: `Copiando as configurações do modpack: ${++feitos} de ${overrides.size} arquivos`,
      recebido: feitos,
      total: overrides.size
    })
  }
  return geridos
}

// Cópia grande (o .mrpack guardado): copyFile do sistema (rápido, fora da thread principal), com
// o progresso lido do tamanho do arquivo novo. Cancelar apaga a cópia pela metade.
async function copiarGrande(
  origem: string,
  destino: string,
  etapa: string,
  aoProgredir: AoProgredir,
  sinal?: AbortSignal
): Promise<void> {
  parar(sinal)
  const total = (await stat(origem)).size
  const relogio = setInterval(() => {
    stat(destino)
      .then((t) => aoProgredir({ etapa, recebido: t.size, total }))
      .catch(() => {})
  }, 500)
  try {
    aoProgredir({ etapa, recebido: 0, total })
    await copyFile(origem, destino)
  } finally {
    clearInterval(relogio)
  }
  if (sinal?.aborted) {
    await rm(destino, { force: true })
    throw new Cancelado()
  }
}

// ---------- Downloads do pack ----------

// Cada arquivo baixado fica primeiro num cache pelo hash (pasta de dados), já conferido. Se a
// instalação falhar, for cancelada ou o app fechar, o que já baixou não é baixado de novo.
const pastaCache = (): string => join(app.getPath('userData'), 'cache-modpacks')
const HEX = /^[0-9a-f]{40,128}$/i

function hashDe(f: ArquivoIndice): { algoritmo: 'sha512' | 'sha1'; valor: string } {
  return f.hashes.sha512
    ? { algoritmo: 'sha512', valor: f.hashes.sha512.toLowerCase() }
    : { algoritmo: 'sha1', valor: f.hashes.sha1.toLowerCase() }
}

// Depois que a instalação deu certo: tira do cache o que ela usou e o que tem mais de 7 dias.
export async function limparCacheDe(arquivos: ArquivoIndice[]): Promise<void> {
  for (const f of arquivos) {
    const { valor } = hashDe(f)
    if (HEX.test(valor)) await rm(join(pastaCache(), valor), { force: true }).catch(() => {})
  }
  const limite = Date.now() - 7 * 24 * 3600_000
  for (const n of await readdir(pastaCache()).catch(() => [] as string[])) {
    const t = await stat(join(pastaCache(), n)).catch(() => null)
    if (t && t.mtimeMs < limite) await rm(join(pastaCache(), n), { force: true }).catch(() => {})
  }
}

// Baixa os arquivos do índice: no máximo 6 ao mesmo tempo, 3 tentativas com espera crescente,
// hash conferido (num worker) e Cancelar. Os que falharem vão juntos no erro (`falhas`).
export async function baixarArquivos(
  arquivos: ArquivoIndice[],
  destino: string,
  aoProgredir: AoProgredir,
  fonte: Fonte = 'modrinth',
  sinal?: AbortSignal
): Promise<void> {
  const avisar = limitarProgresso(aoProgredir)
  const total = arquivos.reduce((s, f) => s + (f.fileSize || 0), 0)
  let feitos = 0
  let bytes = 0
  avisar({ etapa: `Baixando 0 de ${arquivos.length} arquivos`, recebido: 0, total })
  const falhas = await rodarFila(
    arquivos,
    async (f, s) => {
      await baixarUm(f, join(destino, f.path), fonte, s)
      bytes += f.fileSize || 0
      avisar({
        etapa: `Baixando ${++feitos} de ${arquivos.length} arquivos: ${basename(f.path)}`,
        recebido: bytes,
        total
      })
    },
    { simultaneos: DOWNLOADS_JUNTOS, tentativas: 3, sinal }
  )
  if (falhas.length) {
    throw new ErroApp(
      `${falhas.length} de ${arquivos.length} arquivos não baixaram, mesmo tentando 3 vezes. Confira sua internet e clique em "Tentar de novo só os que falharam": o que já baixou não é baixado de novo.`,
      falhas.map((x) => `${x.item.path}\n${detalhar(x.erro)}`).join('\n\n'),
      { falhas: falhas.map((x) => x.item.path) }
    )
  }
}

async function baixarUm(
  f: ArquivoIndice,
  destino: string,
  fonte: Fonte,
  sinal?: AbortSignal
): Promise<void> {
  // Packs do CurseForge baixam do CDN do CurseForge (e só o que o autor deixou).
  const urls = f.downloads.filter((u) =>
    fonte === 'curseforge' ? downloadDaFonte(u, 'curseforge') : downloadPermitido(u)
  )
  if (!urls.length) {
    throw new ErroApp(
      `O arquivo ${f.path} do modpack não vem de um site aceito (Modrinth, GitHub ou GitLab).`
    )
  }
  const { algoritmo, valor } = hashDe(f)
  const confere = async (c: string): Promise<boolean> =>
    (await hashEmTrabalhador(c, algoritmo).catch(() => '')) === valor
  await mkdir(pastaCache(), { recursive: true })
  // Hash estranho (pack mal feito): baixa num nome próprio, sem reaproveitar.
  const cache = join(pastaCache(), HEX.test(valor) ? valor : randomUUID())
  if (!(existsSync(cache) && (await confere(cache)))) {
    let erro: unknown = null
    for (const url of urls) {
      try {
        await baixar(url, cache, undefined, f.path, () => {}, sinal)
        if (await confere(cache)) {
          erro = null
          break
        }
        await rm(cache, { force: true })
        erro = new ErroApp(
          'O arquivo baixado veio corrompido. Tente de novo.',
          `${url}\n${algoritmo} esperado: ${valor}`
        )
      } catch (e) {
        erro = e
      }
    }
    if (erro) throw erro
  }
  await mkdir(dirname(destino), { recursive: true })
  await copyFile(cache, destino)
}

// ---------- Procurar e analisar ----------

export async function buscarModpacks(
  termo: unknown,
  offset: unknown
): Promise<ResultadoBuscaModpacks> {
  const texto = typeof termo === 'string' ? termo.trim().slice(0, 100) : ''
  const inicio = Number.isInteger(offset) && (offset as number) >= 0 ? (offset as number) : 0
  const r = await modrinth.buscar(
    texto,
    [['project_type:modpack'], LOADERS_MODRINTH.map((l) => `categories:${l}`)],
    inicio,
    20
  )
  return {
    total: r.total_hits,
    itens: r.hits.map((h) => ({
      id: h.project_id,
      titulo: h.title,
      autor: h.author,
      descricao: h.description,
      downloads: h.downloads,
      icone: h.icon_url || null,
      // Só versões "1.21.1"/"26.3" (sem snapshots), a mais nova primeiro.
      versaoJogo:
        (h.versions ?? [])
          .filter((v) => /^\d+(\.\d+)+$/.test(v))
          .sort((a, b) => compararVersoes(b, a))[0] ?? null,
      loaders: (h.categories ?? []).filter((c): c is TipoId => LOADERS_MODRINTH.includes(c))
    }))
  }
}

interface Analise {
  indice: Indice
  entradas: string[] // arquivos dentro do pack (lidos sem extrair)
  pastasOverrides: string[] // pastas do pack que vão para o servidor (overrides, server-overrides)
  extraido: string | null // pack extraído (só ao criar; reaproveitado ao tentar de novo)
  arquivo: string // o .mrpack
  temporario: string | null // pasta do download, quando veio do Modrinth
  tipo: TipoId
  versaoJogo: string
  versaoLoader: string
  ram: number
  origem: { projetoId: string; versaoId: string; fonte: Fonte } | null
  manuais: ArquivoManual[] // CurseForge: o autor não deixa outros apps baixarem
}

// shortcut: análises não usadas ficam na pasta temporária do Windows até ele limpar.
const analises = new Map<string, Analise>()

// Analisar não extrai o pack: só lista e lê o índice (um pack de 3 GB abre em segundos).
async function analisar(
  arquivo: string,
  temporario: string | null,
  origem: Analise['origem'],
  icone: string | null
): Promise<AnaliseModpack> {
  const entradas = await listarPack(arquivo, 'modrinth.index.json')
  let indice: Indice
  try {
    indice = lerIndice(await lerDoPack(arquivo, 'modrinth.index.json'))
  } catch (e) {
    if (e instanceof ErroApp) throw e
    throw new ErroApp((e as Error).message, detalhar(e))
  }
  return analisarPack(
    { indice, entradas, pastasOverrides: ['overrides', 'server-overrides'] },
    arquivo,
    temporario,
    origem,
    icone,
    []
  )
}

async function analisarPack(
  pack: Pick<Analise, 'indice' | 'entradas' | 'pastasOverrides'>,
  arquivo: string,
  temporario: string | null,
  origem: Analise['origem'],
  icone: string | null,
  manuais: ArquivoManual[]
): Promise<AnaliseModpack> {
  {
    const { indice } = pack
    const { tipo, versaoLoader } = (() => {
      try {
        return loaderDoIndice(indice.dependencies)
      } catch (e) {
        throw new ErroApp((e as Error).message)
      }
    })()
    const versaoJogo = indice.dependencies.minecraft
    await javaDaVersao(versaoJogo) // confere que a versão existe na Mojang
    const doServidor = indice.files.filter(vaiProServidor)
    // Mods nos overrides, pela lista de dentro do pack (sem extrair).
    const nosOverrides = new Set<string>()
    for (const pasta of pack.pastasOverrides)
      for (const e of pack.entradas)
        if (e.startsWith(`${pasta}/`)) nosOverrides.add(e.slice(pasta.length + 1))
    const mods =
      doServidor.filter((f) => ehMod(f.path)).length + [...nosOverrides].filter(ehMod).length
    const ram = sugerirRam(mods, limitesRam().max)
    const token = randomUUID()
    analises.set(token, {
      ...pack,
      extraido: null,
      arquivo,
      temporario,
      tipo,
      versaoJogo,
      versaoLoader,
      ram: ram.gb,
      origem,
      manuais
    })
    return {
      token,
      nome: indice.name,
      versaoPack: indice.versionId,
      resumo: indice.summary ?? null,
      icone,
      versaoJogo,
      tipo,
      versaoLoader,
      mods,
      manuais,
      arquivos: doServidor.length,
      tamanho: doServidor.reduce((s, f) => s + (f.fileSize || 0), 0),
      ram,
      nomeSugerido: nomeLimpo(indice.name) || 'Servidor do modpack'
    }
  }
}

// Baixa a versão escolhida (ou a mais nova) de um modpack do Modrinth.
export async function baixarPack(
  projetoId: string,
  versao: modrinth.Versao | undefined,
  aoProgredir: AoProgredir,
  sinal?: AbortSignal
): Promise<{ arquivo: string; temporario: string; versao: modrinth.Versao }> {
  const v = versao ?? escolherVersao(await modrinth.versoes(projetoId, LOADERS_MODRINTH))
  if (!v) throw new ErroApp('Esse modpack não tem versão para Fabric, Forge ou NeoForge.')
  const f = v.files.find((x) => x.primary) ?? v.files[0]
  if (!f || !urlDoModrinth(f.url) || !f.filename.endsWith('.mrpack')) {
    throw new ErroApp('Esse modpack não tem um arquivo .mrpack que o app aceite.')
  }
  const temporario = join(tmpdir(), `servsquare-baixando-${randomUUID()}`)
  await mkdir(temporario, { recursive: true })
  const arquivo = join(temporario, 'pack.mrpack')
  try {
    await baixar(
      f.url,
      arquivo,
      { algoritmo: 'sha512', valor: f.hashes.sha512 },
      `Baixando o modpack ${v.version_number}`,
      limitarProgresso(aoProgredir),
      sinal
    )
  } catch (e) {
    await rm(temporario, { recursive: true, force: true })
    throw e
  }
  return { arquivo, temporario, versao: v }
}

export async function analisarDoModrinth(
  projetoId: unknown,
  aoProgredir: AoProgredir
): Promise<AnaliseModpack> {
  if (typeof projetoId !== 'string' || !/^[\w-]{1,64}$/.test(projetoId)) {
    throw new ErroApp('Modpack inválido. Escolha um da lista.')
  }
  return comCancelar(async (sinal) => {
    const { arquivo, temporario, versao } = await baixarPack(
      projetoId,
      undefined,
      aoProgredir,
      sinal
    )
    const icone =
      (await modrinth.projetos([projetoId]).catch(() => new Map())).get(projetoId)?.icon_url ?? null
    try {
      return await analisar(
        arquivo,
        temporario,
        { projetoId, versaoId: versao.id, fonte: 'modrinth' },
        icone
      )
    } catch (e) {
      await rm(temporario, { recursive: true, force: true })
      throw e
    }
  })
}

// Modpack do CurseForge (Fase 24): baixa o pack (se o autor deixa), lê o manifest.json e monta
// o mesmo índice do Modrinth. Cada mod segue a permissão do autor; o que não pode ser baixado
// vai para a lista "Baixe pelo site". Recursos do jogador (resource packs, shaders) ficam fora.
export async function analisarDoCurseForge(
  projetoId: unknown,
  aoProgredir: AoProgredir
): Promise<AnaliseModpack> {
  if (typeof projetoId !== 'string' || !/^\d{1,12}$/.test(projetoId)) {
    throw new ErroApp('Modpack inválido. Escolha um da lista.')
  }
  const id = Number(projetoId)
  const [m, arquivos] = await Promise.all([cf.mod(id), cf.arquivos(id, null, null)])
  const pack = escolherArquivoCF(arquivos, null, null)
  if (!pack) throw new ErroApp('Esse modpack não tem arquivo para baixar.')
  const sha1Pack = cf.sha1Do(pack)
  if (!cf.podeBaixar(m, pack) || !downloadDaFonte(pack.downloadUrl, 'curseforge') || !sha1Pack) {
    throw new ErroApp(
      'O autor desse modpack não deixa outros apps baixarem. Na página dele, baixe o "Server Pack" e use "Importar de arquivo .zip".',
      cf.paginaDoArquivo(m, pack.id) ?? undefined
    )
  }
  return comCancelar(async (sinal) => {
    const temporario = join(tmpdir(), `servsquare-baixando-${randomUUID()}`)
    await mkdir(temporario, { recursive: true })
    const arquivo = join(temporario, 'pack.zip')
    try {
      await baixar(
        pack.downloadUrl!,
        arquivo,
        { algoritmo: 'sha1', valor: sha1Pack },
        `Baixando o modpack ${pack.displayName}`,
        limitarProgresso(aoProgredir),
        sinal
      )
      const manuais: ArquivoManual[] = []
      // Como no .mrpack: só a lista e o manifest.json, sem extrair o pack.
      const entradas = await listarPack(arquivo, 'manifest.json')
      let manifest: Record<string, unknown>
      try {
        manifest = JSON.parse(await lerDoPack(arquivo, 'manifest.json'))
      } catch (e) {
        throw new ErroApp('O manifest.json desse modpack está estragado.', detalhar(e))
      }
      // O CurseForge deixa o pack escolher o nome da pasta de configurações.
      const over =
        typeof manifest.overrides === 'string' && /^[\w.-]{1,64}$/.test(manifest.overrides)
          ? manifest.overrides
          : 'overrides'
      aoProgredir({ etapa: 'Lendo a lista de mods do modpack', recebido: 0, total: 0 })
      const indice = await indiceDoManifest(manifest, m, manuais)
      const icone = imagemPermitida(m.logo?.thumbnailUrl) ? m.logo!.thumbnailUrl : null
      return await analisarPack(
        { indice, entradas, pastasOverrides: [over] },
        arquivo,
        temporario,
        { projetoId, versaoId: String(pack.id), fonte: 'curseforge' },
        icone,
        manuais
      )
    } catch (e) {
      await rm(temporario, { recursive: true, force: true })
      throw e
    }
  })
}

async function indiceDoManifest(
  manifest: Record<string, unknown>,
  m: cf.ModCF,
  manuais: ArquivoManual[]
): Promise<Indice> {
  const mc = (manifest.minecraft ?? {}) as { version?: unknown; modLoaders?: { id?: unknown }[] }
  if (manifest.manifestType !== 'minecraftModpack' || typeof mc.version !== 'string') {
    throw new ErroApp('O manifest.json desse modpack não é de um modpack de Minecraft.')
  }
  let loader: { tipo: TipoId; versao: string }
  try {
    loader = loaderDoManifest(mc.modLoaders)
  } catch (e) {
    throw new ErroApp((e as Error).message)
  }
  const pedidos = (Array.isArray(manifest.files) ? manifest.files : []).filter(
    (f): f is { projectID: number; fileID: number; required?: boolean } =>
      Number.isInteger(f?.projectID) && Number.isInteger(f?.fileID) && f.required !== false
  )
  const arquivos: cf.ArquivoCF[] = []
  for (let i = 0; i < pedidos.length; i += 50) {
    arquivos.push(...(await cf.arquivosPorIds(pedidos.slice(i, i + 50).map((f) => f.fileID))))
  }
  const ids = [...new Set(arquivos.map((a) => a.modId))]
  const mods = new Map<number, cf.ModCF>()
  for (let i = 0; i < ids.length; i += 50) {
    for (const [k, v] of await cf.mods(ids.slice(i, i + 50))) mods.set(k, v)
  }
  const files: ArquivoIndice[] = []
  for (const a of arquivos) {
    const dono = mods.get(a.modId)
    // Só mods vão para o servidor (resource packs e shaders do pack são do jogador).
    if (dono && dono.classId !== cf.CLASSES.mod) continue
    if (soDoClienteCF(a.gameVersions)) continue
    const sha1 = cf.sha1Do(a)
    if (
      !dono ||
      !cf.podeBaixar(dono, a) ||
      !sha1 ||
      !downloadDaFonte(a.downloadUrl, 'curseforge')
    ) {
      manuais.push(manualCF(dono, dono?.name ?? a.displayName, a))
      continue
    }
    if (!nomeSeguro(a.fileName)) continue
    files.push({
      path: `mods/${a.fileName}`,
      hashes: { sha1, sha512: '' },
      env: { client: 'required', server: 'required' },
      downloads: [a.downloadUrl!],
      fileSize: a.fileLength
    })
  }
  const chave = CHAVE_LOADER[loader.tipo]
  if (!chave) throw new ErroApp('O app ainda não instala esse loader.')
  return {
    formatVersion: 1,
    game: 'minecraft',
    versionId: typeof manifest.version === 'string' ? manifest.version : 'curseforge',
    name: typeof manifest.name === 'string' ? manifest.name : m.name,
    summary: m.summary,
    files,
    dependencies: { minecraft: mc.version, [chave]: loader.versao }
  }
}

export async function analisarDeArquivo(
  janela: BrowserWindow | null
): Promise<AnaliseModpack | null> {
  const opcoes = {
    title: 'Escolha o modpack (.mrpack)',
    properties: ['openFile' as const],
    filters: [{ name: 'Modpack do Modrinth', extensions: ['mrpack'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const arquivo = escolha.filePaths[0]
  if (escolha.canceled || !arquivo) return null
  return analisar(arquivo, null, null, null)
}

// ---------- Criar o servidor ----------

let criando = false

export async function criarDeModpack(
  pedido: unknown,
  aoProgredir: AoProgredir
): Promise<InfoServidor> {
  if (criando) throw new ErroApp('Já tem um servidor sendo criado. Espere terminar.')
  const { token, nome: nomeBruto, aceitouEula } = (pedido ?? {}) as Record<string, unknown>
  const a = typeof token === 'string' ? analises.get(token) : undefined
  if (!a) throw new ErroApp('Escolha o modpack de novo.')
  if (aceitouEula !== true) {
    throw new ErroApp('Você precisa marcar que aceita o EULA do Minecraft para criar o servidor.')
  }
  const nome = validarNome(nomeBruto)
  const pasta = join(pastaServidores(), nome)
  if (existsSync(pasta))
    throw new ErroApp(`Já existe uma pasta chamada "${nome}". Escolha outro nome.`)

  criando = true
  // Tudo acontece numa pasta provisória; só no fim ela vira a pasta do servidor. Cancelar ou
  // falhar apaga a provisória: nada fica pela metade (os downloads ficam no cache, já conferidos).
  const provisoria = join(pastaServidores(), `.modpack-${randomUUID()}`)
  try {
    return await comCancelar(async (sinal) => {
      const avisar = limitarProgresso(aoProgredir)
      // O pack só é extraído agora (a análise não extrai). Ao tentar de novo, reaproveita.
      if (!a.extraido || !existsSync(a.extraido)) {
        const pastaPack = join(tmpdir(), `servsquare-mrpack-${randomUUID()}`)
        await extrairSeguro(a.arquivo, pastaPack, a.entradas.length, avisar, sinal)
        a.extraido = pastaPack
      }
      await mkdir(provisoria, { recursive: true })
      const { java, versaoLoader } = await instalarJarEJava(
        provisoria,
        a.tipo,
        a.versaoJogo,
        avisar,
        a.versaoLoader
      )
      parar(sinal)
      const doServidor = a.indice.files.filter(vaiProServidor)
      await baixarArquivos(doServidor, provisoria, avisar, a.origem?.fonte, sinal)

      const overrides = await arquivosDeOverrides(a.extraido, a.pastasOverrides)
      const geridos: Record<string, string> = {}
      for (const f of doServidor) geridos[f.path] = f.hashes.sha1.toLowerCase()
      Object.assign(geridos, await copiarOverrides(overrides, provisoria, avisar, sinal))

      await aceitarEula(provisoria) // só chega aqui com a caixa do EULA marcada
      // Whitelist ligada por padrão, como em todo servidor novo do app.
      await gravarPropriedades(provisoria, { 'white-list': 'true', 'enforce-whitelist': 'true' })
      const doCurseForge = a.origem?.fonte === 'curseforge'
      // CurseForge: os termos da API não deixam guardar dados dela; fica só o que foi instalado.
      await gravarEstado(provisoria, {
        indice: doCurseForge ? { ...a.indice, files: [] } : a.indice,
        geridos
      })
      if (!doCurseForge) {
        await copiarGrande(
          a.arquivo,
          join(provisoria, COPIA),
          'Guardando uma cópia do modpack no servidor',
          avisar,
          sinal
        )
      }
      parar(sinal)

      const modpack = {
        ...(doCurseForge && { fonte: 'curseforge' as const }),
        nome: a.indice.name,
        versao: a.indice.versionId,
        projetoId: a.origem?.projetoId ?? null,
        versaoId: a.origem?.versaoId ?? null
      }
      const info = {
        nome,
        tipo: a.tipo,
        versao: a.versaoJogo,
        java,
        versaoLoader,
        ram: a.ram,
        javaOtimizado: true,
        modpack
      }
      // Gravado por último: a pasta só conta como servidor quando tudo acima deu certo.
      // Daqui em diante não dá mais para cancelar.
      await writeFile(join(provisoria, ARQUIVO_INFO), JSON.stringify(info, null, 2))
      await rename(provisoria, pasta)
      const id = await registrar(
        { nome, pasta, tipo: a.tipo, versao: a.versaoJogo },
        lerEstado() === 'desligado'
      )
      analises.delete(token as string)
      await limparAnalise(a)
      await limparCacheDe(doServidor)
      // Fase D: o que o autor não deixa baixar abre a janela Downloads necessários.
      await registrarPendencias({ ...info, id, pasta }, a.manuais).catch(() => {})
      return { ...info, id, pasta }
    })
  } catch (e) {
    // Cancelou: o pack extraído pela metade também sai (a análise continua valendo).
    if ((e as ErroApp).cancelado && a.extraido) {
      await apagarEmTrabalhador(a.extraido).catch(() => {})
      a.extraido = null
    }
    throw e
  } finally {
    criando = false
    await apagarEmTrabalhador(provisoria).catch(() => {})
  }
}

// O usuário saiu da tela sem criar: apaga o que a análise deixou na pasta temporária.
export async function descartarAnalise(token: unknown): Promise<void> {
  const a = typeof token === 'string' ? analises.get(token) : undefined
  if (!a || criando) return
  analises.delete(token as string)
  await limparAnalise(a)
}

async function limparAnalise(a: Analise): Promise<void> {
  if (a.extraido) await apagarEmTrabalhador(a.extraido).catch(() => {})
  if (a.temporario) await rm(a.temporario, { recursive: true, force: true }).catch(() => {})
}

async function gravarEstado(pasta: string, estado: EstadoPack): Promise<void> {
  await gravarComSeguranca(join(pasta, ESTADO), JSON.stringify(estado))
}

async function lerEstadoPack(info: InfoServidor): Promise<EstadoPack | null> {
  try {
    const dado = JSON.parse(await readFile(join(info.pasta, ESTADO), 'utf8')) as EstadoPack
    return dado?.indice && dado.geridos ? dado : null
  } catch {
    return null
  }
}

// Packs que marcam como "só do jogador" um mod que outro mod do servidor exige (ex.: o
// COBBLEVERSE com o athena e o fusion): o servidor fecha ao ligar dizendo o id que falta.
// Baixa do próprio índice do pack os candidatos pelo nome e fica só com os de id confirmado.
aoFalharAoLigar(async (info, linhas) => {
  const ids = modsFaltando(linhas).map((m) => m.id)
  const estado = ids.length ? await lerEstadoPack(info) : null
  if (!estado) return []
  const candidatos = estado.indice.files.filter(
    (f) =>
      !vaiProServidor(f) &&
      ehMod(f.path) &&
      !existsSync(join(info.pasta, f.path)) &&
      ids.some((id) => arquivoPareceDoMod(f.path, id))
  )
  if (!candidatos.length) return []
  await baixarArquivos(candidatos, info.pasta, () => {}, info.modpack?.fonte)
  const postos: string[] = []
  for (const f of candidatos) {
    const meta = await metaDoJar(join(info.pasta, f.path))
    if (meta?.ids.some((id) => ids.includes(id.toLowerCase()))) {
      estado.geridos[f.path] = f.hashes.sha1
      postos.push(basename(f.path))
    } else await rm(join(info.pasta, f.path), { force: true })
  }
  await limparCacheDe(candidatos)
  if (!postos.length) return []
  await gravarEstado(info.pasta, estado)
  return [
    `O modpack marcou como "só do jogador" mods que o servidor precisa. Instalados no servidor: ${postos.join(', ')}.`
  ]
})

// ---------- Atualizar o pack ----------

async function versaoNovaDoPack(
  info: InfoServidor
): Promise<{ atual: modrinth.Versao; nova: modrinth.Versao } | null> {
  const mp = info.modpack
  // Packs do CurseForge: o app não atualiza (crie um servidor novo com a versão nova).
  if (!mp?.projetoId || !mp.versaoId || mp.fonte === 'curseforge') return null
  const [atual, versoes] = await Promise.all([
    modrinth.versao(mp.versaoId),
    modrinth.versoes(mp.projetoId, [info.tipo], info.versao)
  ])
  const nova = escolherVersao(versoes)
  return nova && ehMaisNova(nova, atual) ? { atual, nova } : null
}

export async function verificarAtualizacaoModpack(
  info: InfoServidor
): Promise<AtualizacaoModpack | null> {
  const r = await versaoNovaDoPack(info)
  return r && info.modpack
    ? {
        nome: info.modpack.nome,
        versaoAtual: r.atual.version_number,
        versaoNova: r.nova.version_number
      }
    : null
}

interface PlanoInterno {
  pasta: string
  aberto: PackAberto
  arquivo: string
  temporario: string
  versaoId: string
  versaoLoader: string
  novos: Record<string, string>
  overrides: Map<string, string>
  comparacao: Comparacao
}

const planos = new Map<string, PlanoInterno>()

async function noDisco(pasta: string, caminho: string): Promise<NoDisco> {
  const alvo = join(pasta, caminho)
  if (existsSync(alvo)) return sha1(alvo)
  return existsSync(`${alvo}.disabled`) ? 'desativado' : null
}

export async function planejarAtualizacaoModpack(
  info: InfoServidor,
  aoProgredir: AoProgredir
): Promise<PlanoAtualizacaoModpack> {
  const estado = await lerEstadoPack(info)
  if (!estado || !info.modpack?.projetoId) {
    throw new ErroApp(
      'Não achei os dados do modpack deste servidor, então não dá para atualizar por aqui.'
    )
  }
  const r = await versaoNovaDoPack(info)
  if (!r) throw new ErroApp('O modpack já está na versão mais nova.')
  const { arquivo, temporario } = await baixarPack(info.modpack.projetoId, r.nova, aoProgredir)
  let aberto: PackAberto | undefined
  try {
    aberto = await abrirPack(arquivo)
    let loader: { tipo: TipoId; versaoLoader: string }
    try {
      loader = loaderDoIndice(aberto.indice.dependencies)
    } catch (e) {
      throw new ErroApp((e as Error).message)
    }
    if (loader.tipo !== info.tipo || aberto.indice.dependencies.minecraft !== info.versao) {
      throw new ErroApp(
        `A versão nova do pack usa ${NOMES_TIPOS[loader.tipo]} ${aberto.indice.dependencies.minecraft}. Para ela, crie um servidor novo a partir do modpack.`
      )
    }
    aoProgredir({ etapa: 'Comparando com o que está no servidor', recebido: 0, total: 0 })
    const overrides = await arquivosDeOverrides(aberto.pasta, ['overrides', 'server-overrides'])
    const novos: Record<string, string> = {}
    for (const f of aberto.indice.files.filter(vaiProServidor))
      novos[f.path] = f.hashes.sha1.toLowerCase()
    for (const [caminho, origem] of overrides) novos[caminho] = await sha1(origem)

    const disco = new Map<string, NoDisco>()
    for (const c of new Set([...Object.keys(novos), ...Object.keys(estado.geridos)])) {
      disco.set(c, await noDisco(info.pasta, c))
    }
    // O mundo nunca é tocado ao atualizar, nem os arquivos do app.
    const mundo = new Set(pastasDoMundo(await nivelDoMundo(info.pasta)).map((p) => p.toLowerCase()))
    const protegido = (c: string): boolean =>
      mundo.has(c.split('/')[0].toLowerCase()) || /^servsquare|^\.servsquare|^eula\.txt$/i.test(c)
    const comparacao = compararPack(estado.geridos, novos, (c) => disco.get(c) ?? null, protegido)

    const token = randomUUID()
    planos.set(token, {
      pasta: info.pasta,
      aberto,
      arquivo,
      temporario,
      versaoId: r.nova.id,
      versaoLoader: loader.versaoLoader,
      novos,
      overrides,
      comparacao
    })
    return {
      token,
      versaoNova: r.nova.version_number,
      escrever: comparacao.escrever.length,
      apagar: comparacao.apagar.length,
      conflitos: comparacao.conflitos,
      trocaLoader: loader.versaoLoader !== info.versaoLoader ? loader.versaoLoader : null
    }
  } catch (e) {
    if (aberto) await apagarEmTrabalhador(aberto.pasta)
    await rm(temporario, { recursive: true, force: true })
    throw e
  }
}

export async function atualizarModpack(
  info: InfoServidor,
  token: unknown,
  escolhas: unknown,
  aoProgredir: AoProgredir
): Promise<void> {
  const plano = typeof token === 'string' ? planos.get(token) : undefined
  if (!plano || plano.pasta !== info.pasta) throw new ErroApp('Clique em Atualizar de novo.')
  const lista = (escolhas ?? {}) as Record<string, unknown>
  const escolha = (c: string): EscolhaConflito => (lista[c] === 'pack' ? 'pack' : 'meu')

  await comServidorDesligado(async () => {
    planos.delete(token as string)
    const { comparacao, novos } = plano
    const doPack = plano.comparacao.conflitos.filter((c) => escolha(c.caminho) === 'pack')
    const escrever = [
      ...comparacao.escrever,
      ...doPack.filter((c) => c.caminho in novos).map((c) => c.caminho)
    ]
    const apagar = [
      ...comparacao.apagar,
      ...doPack.filter((c) => !(c.caminho in novos)).map((c) => c.caminho)
    ]

    // Backup antes de tudo: o mundo e o resto do servidor (mods, configs).
    aoProgredir({ etapa: 'Fazendo backup do mundo', recebido: 0, total: 0 })
    try {
      await compactarMundo(info, undefined, 'modpack')
      await backupDoServidor(info)
    } catch (e) {
      throw new ErroApp(
        'Não consegui fazer o backup antes de atualizar, então nada foi mudado. Tente de novo.',
        detalhar(e)
      )
    }

    let versaoLoader = info.versaoLoader
    if (plano.versaoLoader !== info.versaoLoader) {
      versaoLoader = (
        await instalarJarEJava(info.pasta, info.tipo, info.versao, aoProgredir, plano.versaoLoader)
      ).versaoLoader
    }

    // Baixa e copia tudo numa pasta de espera; só depois mexe no servidor.
    const espera = join(info.pasta, '.servsquare-atualizando')
    await rm(espera, { recursive: true, force: true })
    const paraEscrever = new Set(escrever)
    const downloads = plano.aberto.indice.files.filter(
      (f) => vaiProServidor(f) && paraEscrever.has(f.path)
    )
    await baixarArquivos(downloads, espera, aoProgredir)
    for (const [caminho, origem] of plano.overrides) {
      if (!paraEscrever.has(caminho) || existsSync(join(espera, caminho))) continue
      await mkdir(dirname(join(espera, caminho)), { recursive: true })
      await copyFile(origem, join(espera, caminho))
    }

    aoProgredir({ etapa: 'Aplicando a versão nova do pack', recebido: 0, total: 0 })
    for (const caminho of escrever) {
      const alvo = join(info.pasta, caminho)
      await mkdir(dirname(alvo), { recursive: true })
      await rm(`${alvo}.disabled`, { force: true })
      await rename(join(espera, caminho), alvo)
    }
    for (const caminho of apagar) await rm(join(info.pasta, caminho), { force: true })
    await rm(espera, { recursive: true, force: true })

    await gravarEstado(info.pasta, { indice: plano.aberto.indice, geridos: novos })
    await copyFile(plano.arquivo, join(info.pasta, COPIA))
    await limparCacheDe(downloads)
    await atualizarInfo(info, {
      versaoLoader,
      modpack: { ...info.modpack!, versao: plano.aberto.indice.versionId, versaoId: plano.versaoId }
    })
  }).finally(async () => {
    await apagarEmTrabalhador(plano.aberto.pasta).catch(() => {})
    await rm(plano.temporario, { recursive: true, force: true }).catch(() => {})
  })
}

// Backup de tudo menos o mundo (que tem o backup dele) e o que o loader recria; guarda os 3 últimos.
async function backupDoServidor(info: InfoServidor): Promise<void> {
  const fora = new Set(
    [
      ...pastasDoMundo(await nivelDoMundo(info.pasta)),
      'libraries',
      'logs',
      'crash-reports',
      'cache'
    ].map((p) => p.toLowerCase())
  )
  const itens = (await readdir(info.pasta)).filter(
    (n) => !fora.has(n.toLowerCase()) && !n.startsWith('.servsquare')
  )
  if (!itens.length) return
  const pasta = join(pastaBackups(info), 'modpack')
  await mkdir(pasta, { recursive: true })
  await tarCriar([
    '-a',
    '-c',
    '-f',
    join(pasta, `${new Date().toISOString().replace(/[:.]/g, '-')}.zip`),
    '-C',
    info.pasta,
    ...itens
  ])
  const antigos = (await readdir(pasta))
    .filter((n) => n.endsWith('.zip'))
    .sort()
    .slice(0, -3)
  for (const n of antigos) await rm(join(pasta, n), { force: true })
}

// ---------- Pacote pros amigos ----------

// Para servidores de antes da Fase 17, que não guardavam a versão do loader.
export async function descobrirVersaoLoader(info: InfoServidor): Promise<string> {
  if (info.versaoLoader) return info.versaoLoader
  if (info.tipo === 'fabric') return maisNovaEstavel('loader') // o Fabric aceita loader mais novo
  const bat = await readFile(join(info.pasta, 'run.bat'), 'utf8').catch(() => '')
  const pasta = argsDoRunBat(bat)?.split(/[\\/]/).slice(-2, -1)[0]
  // Forge: "1.20.1-47.2.0"; NeoForge: "21.1.77".
  const versao = info.tipo === 'forge' ? pasta?.replace(`${info.versao}-`, '') : pasta
  if (!versao)
    throw new ErroApp(
      'Não consegui descobrir a versão do loader. Reinstale o loader na tela Software e tente de novo.'
    )
  return versao
}

async function lerDoJar(jar: string, membro: string): Promise<string | null> {
  return tar(['-xOf', jar, membro]).catch(() => null)
}

export async function gerarPacoteAmigos(
  info: InfoServidor,
  janela: BrowserWindow | null
): Promise<PacoteAmigos | null> {
  const chave = CHAVE_LOADER[info.tipo]
  // Shaders, resource packs e mods só do jogador escolhidos no Explorar (Fase 23).
  const extras = await extrasDosAmigos(info)
  if (!chave && !extras.length) {
    throw new ErroApp(
      info.tipo === 'paper'
        ? 'No Paper, os plugins ficam só no servidor: seus amigos entram com o jogo normal, sem instalar nada. Para mandar shaders ou resource packs, adicione pelo Explorar.'
        : 'O Vanilla não usa mods: seus amigos entram com o jogo normal. Para mandar shaders ou resource packs, adicione pelo Explorar.'
    )
  }
  const opcoes = {
    title: 'Salvar o Pacote pros amigos',
    defaultPath: join(app.getPath('downloads'), `${info.nome} - amigos.mrpack`),
    filters: [{ name: 'Modpack do Modrinth', extensions: ['mrpack'] }]
  }
  const escolha = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (escolha.canceled || !escolha.filePath) return null

  const montagem = join(tmpdir(), `servsquare-amigos-${randomUUID()}`)
  try {
    const { arquivos, semModrinth, manuais, somados } = await montarPacoteAmigos(
      info,
      montagem,
      false
    )
    // O tar escolhe o formato pela extensão: monta como .zip e depois copia com o nome .mrpack.
    const zip = join(montagem, '..', `${basename(montagem)}.zip`)
    const conteudo = ['modrinth.index.json', 'overrides', 'client-overrides'].filter((n) =>
      existsSync(join(montagem, n))
    )
    await tarCriar(['-a', '-c', '-f', zip, '-C', montagem, ...conteudo])
    await copyFile(zip, escolha.filePath)
    await rm(zip, { force: true })
    return {
      arquivo: basename(escolha.filePath),
      mods: arquivos.length - somados + semModrinth.length,
      semModrinth,
      manuais,
      extras: somados
    }
  } finally {
    await apagarEmTrabalhador(montagem).catch(() => {})
  }
}

export interface MontagemAmigos {
  arquivos: ArquivoIndice[] // o que se baixa (índice do .mrpack)
  semModrinth: string[]
  manuais: string[] // mods sem licença aberta: ficam de fora do pacote
  baixadosAMao: ArquivoManual[] // Fase D: baixados à mão; o amigo baixa pela página oficial
  somados: number // extras do Explorar
}

// Monta em `montagem` o que o jogador precisa: modrinth.index.json + overrides do pack original.
// `local`: é a instalação do próprio PC (PlaySquare). Aí os mods sem licença aberta também vão,
// copiados da pasta do servidor, porque nada sai deste computador.
export async function montarPacoteAmigos(
  info: InfoServidor,
  montagem: string,
  local: boolean
): Promise<MontagemAmigos> {
  const chave = CHAVE_LOADER[info.tipo]
  const extras = await extrasDosAmigos(info)
  const versaoLoader = chave ? await descobrirVersaoLoader(info) : null
  await mkdir(montagem, { recursive: true })
  // Configurações e arquivos do pack original para o jogador (overrides + client-overrides).
  const original = existsSync(join(info.pasta, COPIA))
    ? await abrirPack(join(info.pasta, COPIA)).catch(() => null)
    : null
  if (original) {
    for (const p of ['overrides', 'client-overrides']) {
      if (existsSync(join(original.pasta, p)))
        await cp(join(original.pasta, p), join(montagem, p), { recursive: true })
    }
    await apagarEmTrabalhador(original.pasta)
  }

  // Mods ativos do servidor: os do Modrinth entram como link; os outros, só com licença aberta.
  const pastaMods = join(info.pasta, 'mods')
  const jars =
    chave && existsSync(pastaMods)
      ? (await readdir(pastaMods)).filter((n) => /\.jar$/i.test(n))
      : []
  const hashes = await Promise.all(jars.map((j) => sha1(join(pastaMods, j))))
  const versoes = await modrinth.porHash(hashes)
  const projetos = await modrinth.projetos([
    ...new Set(Object.values(versoes).map((v) => v.project_id))
  ])
  const arquivos: ArquivoIndice[] = []
  const semModrinth: string[] = []
  const manuais: string[] = []
  const baixadosAMao: ArquivoManual[] = []
  const guardados = await lerGuardados()
  for (const [i, jar] of jars.entries()) {
    const v = versoes[hashes[i]]
    const arq = v?.files.find((f) => f.hashes.sha1 === hashes[i])
    if (v && arq) {
      const p = projetos.get(v.project_id)
      const precisa = precisaNoJogador(p?.environment, p?.client_side)
      if (!precisa) continue // só do servidor
      arquivos.push({
        path: `mods/${jar}`,
        hashes: { sha1: arq.hashes.sha1, sha512: arq.hashes.sha512 },
        env: { client: precisa, server: 'required' },
        downloads: [arq.url],
        fileSize: arq.size
      })
      continue
    }
    // Já veio no pack original: entra pelos overrides dele.
    if (
      existsSync(join(montagem, 'overrides', 'mods', jar)) ||
      existsSync(join(montagem, 'client-overrides', 'mods', jar))
    )
      continue
    // Fase D: baixado à mão pela página oficial. Nunca sai deste PC, seja qual for a licença.
    const g = guardados[hashes[i]]
    if (g && !local) {
      manuais.push(jar)
      baixadosAMao.push({
        titulo: g.titulo,
        url: g.url,
        arquivo: jar,
        tamanho: g.tamanho,
        sha1: hashes[i],
        md5: g.md5
      })
      continue
    }
    const caminho = join(pastaMods, jar)
    const fabricJson = await lerDoJar(caminho, 'fabric.mod.json')
    if (fabricJson && soDoServidorFabric(fabricJson)) continue
    const toml =
      (await lerDoJar(caminho, 'META-INF/neoforge.mods.toml')) ??
      (await lerDoJar(caminho, 'META-INF/mods.toml'))
    const licenca = fabricJson
      ? licencaDoMod(fabricJson, 'json')
      : toml
        ? licencaDoMod(toml, 'toml')
        : null
    if (local || licencaPermite(licenca)) {
      await mkdir(join(montagem, 'overrides', 'mods'), { recursive: true })
      await copyFile(caminho, join(montagem, 'overrides', 'mods', jar))
      semModrinth.push(jar)
    } else manuais.push(jar)
  }

  // Mods só do jogador que o pack original recomenda (o servidor nunca baixou).
  const estado = await lerEstadoPack(info)
  for (const f of estado?.indice.files ?? []) {
    if (f.env?.server !== 'unsupported' || f.env.client === 'unsupported') continue
    if (!arquivos.some((a) => a.hashes.sha1 === f.hashes.sha1 || a.path === f.path))
      arquivos.push(f)
  }

  let somados = 0
  for (const f of extras) {
    if (arquivos.some((a) => a.hashes.sha1 === f.hashes.sha1 || a.path === f.path)) continue
    arquivos.push(f)
    somados++
  }

  const indice: Indice = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: `servsquare-${new Date().toISOString().slice(0, 10)}`,
    name: `${info.nome} (amigos)`,
    summary: `Mods para entrar no servidor ${info.nome}. Gerado pelo ServSquare.`,
    files: arquivos,
    dependencies:
      chave && versaoLoader
        ? { minecraft: info.versao, [chave]: versaoLoader }
        : { minecraft: info.versao }
  }
  await writeFile(join(montagem, 'modrinth.index.json'), JSON.stringify(indice, null, 2))
  return { arquivos, semModrinth, manuais, baixadosAMao, somados }
}
