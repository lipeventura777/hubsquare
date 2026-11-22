import { app, dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { homedir, tmpdir } from 'os'
import { basename, join, relative } from 'path'
import type {
  AnaliseHubserver,
  ArquivoManual,
  InfoServidor,
  PreviaPassar,
  Progresso
} from '../shared/tipos'
import { compactarMundo, protegerBackup, tar as tarCriar } from './backup'
import { gravarPropriedades, lerArquivoPropriedades } from './config'
import { lerGuardados, registrarPendencias } from './downloadsManuais'
import { ErroApp, detalhar } from './erros'
import { limitarProgresso } from './filaDownloads'
import { tar, temAtalho } from './importarZip'
import { baixarArquivos, limparCacheDe } from './modpacks'
import { downloadPermitido, type ArquivoIndice } from './modpackRegras'
import * as modrinth from './modrinth'
import { sha1 } from './mods'
import {
  acharMesmo,
  ARQUIVOS_DO_PACOTE,
  CHAVES_LIMPAS,
  entradaAceita,
  EXCLUIR_SEMPRE,
  INDICE_HUBSERVER,
  PASTA_FUNDO_HUBSERVER,
  limparPropriedades,
  motivoParaFicar,
  motivoSemAtualizar,
  nomeDoAmigo,
  PASTAS_DE_CONFIG,
  TEXTO,
  validarPacote,
  type PacoteServidor
} from './passarRegras'
import {
  aceitarEula,
  atualizarInfo,
  comServidorDesligado,
  instalarJarEJava,
  lerEstado,
  pastaServidores,
  validarNome,
  validarVersao
} from './servidor'
import { guardarImagem, pastaFundos } from './fundos'
import type { FundoServidor } from '../shared/fundoRegras'
import { acharItem, ARQUIVO_INFO, lerIndice, lerInfo, registrar } from './servidores'
import { t } from '../shared/i18n'
import { registrarErro } from './registroErros'

// Passar o servidor (Fase M7). "Passar para outro amigo" gera um .hubserver (zip) com o mundo,
// as configurações e as listas de jogadores, e os mods só como link oficial + hash. Nada de .jar,
// segredos, convite, túnel, PIN, chave do CurseForge, caminhos deste PC ou backups. Quem recebe
// cria o servidor (loader, Java e mods baixados como sempre) ou, se é o mesmo servidor (mesmo id
// fixo), atualiza o seu com backup antes.

export const idFixoDe = (info: InfoServidor): string => info.idFixo ?? info.id

// ---------- O que vai no pacote ----------

interface Conteudo {
  itens: string[] // da raiz da pasta do servidor (mundos, arquivos e pastas de config)
  excluir: string[] // arquivos de config que ficam (segredo ou caminho deste PC)
  fica: string[]
  tamanho: number
}

async function tamanhoDe(caminho: string): Promise<number> {
  const s = await stat(caminho)
  if (!s.isDirectory()) return s.size
  let total = 0
  for (const item of await readdir(caminho, { recursive: true, withFileTypes: true })) {
    if (item.isFile())
      total += (await stat(join(item.parentPath, item.name)).catch(() => null))?.size ?? 0
  }
  return total
}

async function listarConteudo(info: InfoServidor): Promise<Conteudo> {
  const caminhos = [homedir(), info.pasta, app.getPath('documents'), app.getPath('userData')]
  const itens: string[] = []
  const excluir: string[] = []
  const fica: string[] = []
  let tamanho = 0
  for (const d of await readdir(info.pasta, { withFileTypes: true })) {
    const caminho = join(info.pasta, d.name)
    if (d.isDirectory() && existsSync(join(caminho, 'level.dat'))) {
      itens.push(d.name) // um mundo (também os do Nether e do End no Paper)
      tamanho += await tamanhoDe(caminho)
    } else if (d.isFile() && ARQUIVOS_DO_PACOTE.includes(d.name)) {
      itens.push(d.name)
      tamanho += (await stat(caminho)).size
    } else if (d.isDirectory() && PASTAS_DE_CONFIG.includes(d.name)) {
      let algum = false
      for (const f of await readdir(caminho, { recursive: true, withFileTypes: true })) {
        if (!f.isFile()) continue
        const absoluto = join(f.parentPath, f.name)
        const rel = relative(info.pasta, absoluto).replace(/\\/g, '/')
        if (/\.(jar|exe|dll|bat|cmd|ps1|sh)$/i.test(f.name)) continue // vão como link (ou não vão)
        const s = await stat(absoluto)
        const texto =
          TEXTO.test(f.name) && s.size <= 2 * 1024 * 1024 ? await readFile(absoluto, 'utf8') : null
        const motivo = motivoParaFicar(rel, texto, caminhos)
        if (motivo) {
          excluir.push(rel)
          fica.push(`${rel} (${motivo})`)
        } else {
          algum = true
          tamanho += s.size
        }
      }
      if (algum) itens.push(d.name)
    }
  }
  return { itens, excluir, fica, tamanho }
}

// Mods e plugins ativos: os do Modrinth vão como link + hash; os baixados à mão, só com a
// página oficial; o resto vira aviso para o novo dono.
async function modsDoPacote(
  info: InfoServidor
): Promise<Pick<PacoteServidor, 'mods' | 'manuais' | 'semLink'>> {
  const jars: string[] = []
  for (const pasta of ['mods', 'plugins']) {
    if (!existsSync(join(info.pasta, pasta))) continue
    for (const n of await readdir(join(info.pasta, pasta)))
      if (/\.jar$/i.test(n)) jars.push(`${pasta}/${n}`)
  }
  const mods: ArquivoIndice[] = []
  const manuais: ArquivoManual[] = []
  const semLink: string[] = []
  if (!jars.length) return { mods, manuais, semLink }
  const hashes = await Promise.all(jars.map((j) => sha1(join(info.pasta, j))))
  let versoes: Awaited<ReturnType<typeof modrinth.porHash>>
  try {
    versoes = await modrinth.porHash(hashes)
  } catch (e) {
    throw new ErroApp(t('p.passarServidor.naoConseguiConferirOsMods'), detalhar(e))
  }
  const guardados = await lerGuardados()
  for (const [i, path] of jars.entries()) {
    const arq = versoes[hashes[i]]?.files.find((f) => f.hashes.sha1 === hashes[i])
    if (arq && downloadPermitido(arq.url)) {
      mods.push({
        path,
        hashes: { sha1: arq.hashes.sha1, sha512: arq.hashes.sha512 },
        downloads: [arq.url],
        fileSize: arq.size
      })
      continue
    }
    const g = guardados[hashes[i]]
    if (g) {
      manuais.push({
        titulo: g.titulo,
        url: g.url,
        arquivo: basename(path),
        tamanho: g.tamanho,
        sha1: hashes[i],
        md5: g.md5
      })
    } else semLink.push(basename(path))
  }
  return { mods, manuais, semLink }
}

const FICA_SEMPRE = (): string[] => [
  t('p.passarServidor.osJarDoServidorDos'),
  t('p.passarServidor.copiasDeSegurancaRegistrosLogs'),
  t('p.passarServidor.convitePedidosParaEntrarE'),
  t('p.passarServidor.pinDoCelularEChave'),
  t('p.passarServidor.arquivosBaixadosAMaoO'),
  t('p.passarServidor.doServerPropertiesASenha')
]

export async function previaPassar(info: InfoServidor): Promise<PreviaPassar> {
  const [c, m] = await Promise.all([listarConteudo(info), modsDoPacote(info)])
  return {
    tamanho: c.tamanho,
    vai: c.itens,
    fica: [...FICA_SEMPRE(), ...c.fica],
    mods: m.mods.length,
    manuais: m.manuais.length,
    semLink: m.semLink
  }
}

// Gera o .hubserver (servidor desligado). Depois, o servidor fica marcado "Com <nome> desde <data>".
export async function passarServidor(
  info: InfoServidor,
  para: unknown,
  janela: BrowserWindow | null
): Promise<{ arquivo: string; tamanho: number } | null> {
  let com: string
  try {
    com = nomeDoAmigo(para)
  } catch (e) {
    throw new ErroApp((e as Error).message)
  }
  if (lerEstado() !== 'desligado') throw new ErroApp(t('p.passarServidor.desligueOServidorAntesDe'))
  const opcoes = {
    title: t('p.passarServidor.salvarOServidorParaPassar'),
    defaultPath: join(app.getPath('downloads'), `${info.nome}.hubserver`),
    filters: [{ name: t('p.passarServidor.servidorDoHubsquare'), extensions: ['hubserver'] }]
  }
  const escolha = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (escolha.canceled || !escolha.filePath) return null
  const destino = escolha.filePath

  return comServidorDesligado(async () => {
    const [conteudo, mods] = await Promise.all([listarConteudo(info), modsDoPacote(info)])
    const idFixo = idFixoDe(info)
    const pacote: PacoteServidor = {
      formato: 1,
      idFixo,
      nome: info.nome,
      tipo: info.tipo,
      versao: info.versao,
      versaoLoader: info.versaoLoader ?? null,
      ram: info.ram,
      pvp: info.pvp,
      javaOtimizado: info.javaOtimizado,
      javaDosMods: info.javaDosMods,
      ...mods,
      geradoEm: new Date().toISOString(),
      fundo: info.fundo
    }
    // Fase V10: a imagem do fundo vai junto (se ela ainda existir neste PC).
    const imagemFundo =
      info.fundo?.tipo === 'imagem' ? join(pastaFundos(), info.fundo.imagem) : null
    const montagem = join(tmpdir(), `hubsquare-hubserver-${randomUUID()}`)
    const zip = `${montagem}.zip` // o tar escolhe o formato pela extensão
    try {
      await mkdir(montagem, { recursive: true })
      await writeFile(join(montagem, INDICE_HUBSERVER), JSON.stringify(pacote, null, 2))
      const soltos = [INDICE_HUBSERVER]
      if (imagemFundo && existsSync(imagemFundo)) {
        await mkdir(join(montagem, PASTA_FUNDO_HUBSERVER))
        await copyFile(imagemFundo, join(montagem, PASTA_FUNDO_HUBSERVER, basename(imagemFundo)))
        soltos.push(PASTA_FUNDO_HUBSERVER)
      }
      if (conteudo.itens.includes('server.properties')) {
        const texto = await readFile(join(info.pasta, 'server.properties'), 'utf8')
        await writeFile(join(montagem, 'server.properties'), limparPropriedades(texto))
        soltos.push('server.properties')
      }
      const daPasta = conteudo.itens.filter((i) => i !== 'server.properties')
      await tarCriar([
        '-a',
        '-c',
        '-f',
        zip,
        ...[...EXCLUIR_SEMPRE, ...conteudo.excluir].flatMap((p) => ['--exclude', p]),
        '-C',
        montagem,
        ...soltos,
        ...(daPasta.length ? ['-C', info.pasta, ...daPasta] : [])
      ])
      await copyFile(zip, destino)
    } catch (e) {
      throw new ErroApp(t('p.passarServidor.naoConseguiGerarOArquivo'), detalhar(e))
    } finally {
      await rm(montagem, { recursive: true, force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
      await rm(zip, { force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
    }
    await atualizarInfo(info, { idFixo, emprestado: { com, desde: new Date().toISOString() } })
    return { arquivo: basename(destino), tamanho: (await stat(destino)).size }
  })
}

// ---------- Receber ----------

const analisados = new Map<
  string,
  { arquivo: string; pacote: PacoteServidor; mesmo: string | null }
>()

async function listarEntradas(arquivo: string): Promise<string[]> {
  let entradas: string[]
  try {
    entradas = (await tar(['-tf', arquivo])).split(/\r?\n/).filter(Boolean)
  } catch (e) {
    throw new ErroApp(t('p.passarServidor.naoConseguiAbrirEsseArquivo'), detalhar(e))
  }
  const recusadas = entradas.filter((e) => !entradaAceita(e))
  if (recusadas.length) {
    throw new ErroApp(
      t('p.passarServidor.esseArquivoTemProgramasMods'),
      recusadas.slice(0, 20).join('\n')
    )
  }
  if (!entradas.includes(INDICE_HUBSERVER)) {
    throw new ErroApp(t('p.passarServidor.esseArquivoNaoEUm'))
  }
  return entradas
}

export async function analisarHubserver(
  janela: BrowserWindow | null
): Promise<AnaliseHubserver | null> {
  const opcoes = {
    title: t('p.passarServidor.escolhaOArquivoHubserver'),
    properties: ['openFile' as const],
    filters: [{ name: t('p.passarServidor.servidorDoHubsquare'), extensions: ['hubserver'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const arquivo = escolha.filePaths[0]
  if (escolha.canceled || !arquivo) return null
  await listarEntradas(arquivo)
  let pacote: PacoteServidor
  try {
    pacote = validarPacote(JSON.parse(await tar(['-xOf', arquivo, INDICE_HUBSERVER])))
  } catch (e) {
    throw new ErroApp(
      e instanceof SyntaxError
        ? t('p.passarServidor.oHubserverJsonDesseArquivo')
        : (e as Error).message,
      detalhar(e)
    )
  }
  const locais: { id: string; nome: string; idFixo: string; info: InfoServidor }[] = []
  for (const item of (await lerIndice()).servidores) {
    const info = await lerInfo(item)
    if (info) locais.push({ id: item.id, nome: info.nome, idFixo: idFixoDe(info), info })
  }
  const mesmo = acharMesmo(pacote.idFixo, locais)
  const token = randomUUID()
  analisados.set(token, { arquivo, pacote, mesmo: mesmo?.id ?? null })
  return {
    token,
    arquivo: basename(arquivo),
    nome: pacote.nome,
    tipo: pacote.tipo,
    versao: pacote.versao,
    mods: pacote.mods.length,
    manuais: pacote.manuais.length,
    semLink: pacote.semLink,
    mesmo: mesmo && {
      id: mesmo.id,
      nome: mesmo.nome,
      motivoSemAtualizar: motivoSemAtualizar(mesmo.info, pacote)
    }
  }
}

// Extrai numa pasta temporária (o zip é conferido de novo: pode ter mudado desde a análise).
async function extrair(arquivo: string): Promise<string> {
  await listarEntradas(arquivo)
  const pasta = join(tmpdir(), `hubsquare-hubserver-${randomUUID()}`)
  await mkdir(pasta, { recursive: true })
  try {
    await tar(['-xf', arquivo, '-C', pasta])
    if (await temAtalho(pasta)) {
      throw new ErroApp(t('p.passarServidor.esseArquivoTemAtalhosLinks'))
    }
    return pasta
  } catch (e) {
    await rm(pasta, { recursive: true, force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
    if (e instanceof ErroApp) throw e
    throw new ErroApp(t('p.passarServidor.naoConseguiAbrirEsseArquivo2'), detalhar(e))
  }
}

let recebendo = false

export async function receberHubserver(
  pedido: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  const { token, modo, nome, aceitouEula } = (pedido ?? {}) as Record<string, unknown>
  const a = typeof token === 'string' ? analisados.get(token) : undefined
  if (!a) throw new ErroApp(t('p.passarServidor.escolhaOArquivoHubserverDe'))
  if (modo !== 'novo' && modo !== 'copia' && modo !== 'atualizar') {
    throw new ErroApp(t('p.passarServidor.escolhaOQueFazerCom'))
  }
  // Com o mesmo servidor aqui, só atualizar ou cópia (nunca dois servidores com o mesmo id).
  if ((modo === 'novo' && a.mesmo) || (modo === 'atualizar' && !a.mesmo)) {
    throw new ErroApp(t('p.passarServidor.escolhaDeNovoOQue'))
  }
  if (recebendo) throw new ErroApp(t('p.passarServidor.jaTemUmServidorSendo'))
  recebendo = true
  try {
    const info =
      modo === 'atualizar'
        ? await atualizarMeu(a.mesmo!, a.arquivo, a.pacote, aoProgredir)
        : await criarDoPacote(a.pacote, a.arquivo, modo, nome, aceitouEula, aoProgredir)
    analisados.delete(token as string)
    return info
  } finally {
    recebendo = false
  }
}

// Fase V10: o fundo que veio no pacote. A imagem entra na pasta de fundos deste PC pelo mesmo
// caminho de qualquer imagem (tipo pelos bytes, até 25 MB); sem ela, "Igual ao app".
async function fundoRecebido(
  p: PacoteServidor,
  extraido: string
): Promise<FundoServidor | undefined> {
  if (p.fundo?.tipo !== 'imagem') return p.fundo
  const arquivo = join(extraido, PASTA_FUNDO_HUBSERVER, p.fundo.imagem)
  if (!existsSync(arquivo)) return undefined
  const nome = await guardarImagem(arquivo).catch(() => null)
  return nome ? { ...p.fundo, imagem: nome } : undefined
}

async function criarDoPacote(
  p: PacoteServidor,
  arquivo: string,
  modo: 'novo' | 'copia',
  nomeBruto: unknown,
  aceitouEula: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  if (aceitouEula !== true) {
    throw new ErroApp(t('p.passarServidor.vocePrecisaMarcarQueAceita'))
  }
  const nome = validarNome(nomeBruto)
  const pasta = join(pastaServidores(), nome)
  if (existsSync(pasta)) throw new ErroApp(t('p.passarServidor.jaExisteUmaPastaChamada', { nome }))
  const versao = await validarVersao(p.tipo, p.versao)
  const avisar = limitarProgresso(aoProgredir)
  // Tudo numa pasta provisória; só no fim ela vira a pasta do servidor.
  const provisoria = join(pastaServidores(), `.recebendo-${randomUUID()}`)
  let extraido: string | null = null
  try {
    avisar({ etapa: t('p.passarServidor.abrindoOArquivo'), recebido: 0, total: 0 })
    extraido = await extrair(arquivo)
    await mkdir(provisoria, { recursive: true })
    for (const n of await readdir(extraido)) {
      if (n !== INDICE_HUBSERVER && n !== PASTA_FUNDO_HUBSERVER)
        await rename(join(extraido, n), join(provisoria, n))
    }
    const fundo = await fundoRecebido(p, extraido)
    const { java, versaoLoader } = await instalarJarEJava(
      provisoria,
      p.tipo,
      versao,
      avisar,
      p.versaoLoader ?? undefined
    )
    await baixarArquivos(p.mods, provisoria, avisar)
    await aceitarEula(provisoria) // só chega aqui com a caixa do EULA marcada
    if (!existsSync(join(provisoria, 'server.properties'))) {
      await gravarPropriedades(provisoria, { 'white-list': 'true', 'enforce-whitelist': 'true' })
    }
    const info = {
      nome,
      tipo: p.tipo,
      versao,
      java,
      versaoLoader,
      ram: p.ram,
      pvp: p.pvp,
      javaOtimizado: p.javaOtimizado,
      javaDosMods: p.javaDosMods,
      // Cópia: outro servidor, com id próprio (ele não atualiza nem é atualizado pelo original).
      idFixo: modo === 'novo' ? p.idFixo : randomUUID(),
      fundo
    }
    await writeFile(join(provisoria, ARQUIVO_INFO), JSON.stringify(info, null, 2))
    await rename(provisoria, pasta)
    const id = await registrar({ nome, pasta, tipo: p.tipo, versao }, lerEstado() === 'desligado')
    await limparCacheDe(p.mods).catch(() => {}) // cache de downloads; tenta de novo na próxima limpeza
    await registrarPendencias({ ...info, id, pasta }, p.manuais).catch(
      registrarErro('passarServidor.ts', 'registrar os downloads manuais do servidor recebido')
    )
    return { ...info, id, pasta }
  } finally {
    await rm(provisoria, { recursive: true, force: true }).catch(
      registrarErro('passarServidor.ts', 'apagar a pasta provisória do servidor recebido')
    )
    if (extraido) await rm(extraido, { recursive: true, force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
  }
}

// "Atualizar o meu servidor com este mundo": backup protegido antes de trocar qualquer coisa.
async function atualizarMeu(
  id: string,
  arquivo: string,
  p: PacoteServidor,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  const item = await acharItem(id)
  const info = item ? await lerInfo(item) : null
  if (!info) throw new ErroApp(t('p.passarServidor.esseServidorNaoEstaMais'))
  const motivo = motivoSemAtualizar(info, p)
  if (motivo) throw new ErroApp(motivo)
  const avisar = limitarProgresso(aoProgredir)
  return comServidorDesligado(async () => {
    avisar({ etapa: t('p.passarServidor.abrindoOArquivo'), recebido: 0, total: 0 })
    const extraido = await extrair(arquivo)
    try {
      const itens = (await readdir(extraido)).filter(
        (n) => n !== INDICE_HUBSERVER && n !== PASTA_FUNDO_HUBSERVER
      )
      avisar({ etapa: t('p.passarServidor.fazendoOBackupDoSeu'), recebido: 0, total: 0 })
      let backup: string | null
      try {
        backup = await compactarMundo(info, undefined, 'atualizar', itens)
        if (backup) await protegerBackup(info, backup, true)
      } catch (e) {
        throw new ErroApp(t('p.passarServidor.naoConseguiFazerOBackup'), detalhar(e))
      }
      avisar({ etapa: t('p.passarServidor.trocandoOMundo'), recebido: 0, total: 0 })
      for (const n of itens) {
        const origem = join(extraido, n)
        const destino = join(info.pasta, n)
        if (n === 'server.properties') {
          // Os valores deste PC (senha do RCON, IP) ficam; o resto vem do arquivo.
          const props = await lerArquivoPropriedades(extraido)
          for (const k of CHAVES_LIMPAS) props.delete(k)
          await gravarPropriedades(info.pasta, Object.fromEntries(props))
        } else if (PASTAS_DE_CONFIG.includes(n)) {
          // Configurações: só por cima (o que ficou só aqui, como segredos, continua).
          await cp(origem, destino, { recursive: true, force: true })
        } else {
          await rm(destino, { recursive: true, force: true })
          await rename(origem, destino)
        }
      }
      // Mods que o amigo pôs e este servidor não tem: baixados pelos links oficiais.
      const faltam = p.mods.filter((f) => !existsSync(join(info.pasta, f.path)))
      await baixarArquivos(faltam, info.pasta, avisar)
      await limparCacheDe(faltam).catch(() => {}) // cache de downloads; tenta de novo na próxima limpeza
      const novo: InfoServidor = { ...info, idFixo: idFixoDe(info), emprestado: undefined }
      await atualizarInfo(info, { idFixo: novo.idFixo, emprestado: undefined })
      await registrarPendencias(novo, p.manuais).catch(
        registrarErro('passarServidor.ts', 'registrar os downloads manuais do servidor atualizado')
      )
      return novo
    } finally {
      await rm(extraido, { recursive: true, force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
    }
  })
}

export async function infoPorId(id: unknown): Promise<InfoServidor> {
  const item = await acharItem(id)
  const info = item ? await lerInfo(item) : null
  if (!info) throw new ErroApp(t('p.passarServidor.esseServidorNaoEstaMais'))
  return info
}
