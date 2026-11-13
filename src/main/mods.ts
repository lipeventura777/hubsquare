import { createHash, randomUUID } from 'crypto'
import { createReadStream, existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, rm, stat } from 'fs/promises'
import { join } from 'path'
import {
  EXTRAS_TIPOS,
  NOMES_TIPOS,
  type AcaoPendente,
  type ArquivoManual,
  type AtualizacaoMod,
  type InfoServidor,
  type ItemPlano,
  type ListaMods,
  type ModInstalado,
  type PerfilMods,
  type PlanoMods,
  type VersoesDoMod,
  type Progresso,
  type TipoId
} from '../shared/tipos'
import { pastaBackups, tar } from './backup'
import { gravarComSeguranca } from './config'
import { ErroApp, detalhar } from './erros'
import * as modrinth from './modrinth'
import { ehMaisNova, escolherVersao, nomeSeguro, soDoJogador, urlDoModrinth } from './modsRegras'
import { baixar } from './rede'
import { guardarArquivo } from './removidos'
import { editarOrganizacao, idDoMod, lerOrganizacao } from './organizacao'
import { copyFile } from 'fs/promises'
import { dentroDe } from './mundo'
import {
  arquivosCFQueServem,
  ehManual,
  itemCF,
  itemHangar,
  montarCurseForge,
  montarHangar,
  novaCF,
  novaHangar,
  type Montado
} from './modsFontes'
import * as cf from './curseforge'
import * as hangar from './hangar'
import { hangarServe } from './fontesRegras'
import type { Checksum } from './rede'
import type { Fonte } from '../shared/fontes'
import {
  aoLigar,
  comServidorDesligado,
  esperarTarefas,
  eventos,
  registrarNoConsole
} from './servidor'
import { comPastaLivre, pastaLivre } from './pastaLivre'
import { registrarPendencias } from './downloadsManuais'

// Tela Mods: mods (Fabric/Forge/NeoForge) e plugins (Paper), só do Modrinth.
// Toda mudança vira uma "pendência" gravada no servsquare-mods.json. Com o servidor desligado,
// ela é aplicada na hora; ligado, espera o próximo ligar (os .jar abertos pelo Java ficam travados).

// Lista dos mods instalados pelo app (id, versão, hash), usada também pelas Fases 17 e 18.
const ARQUIVO_LISTA = 'servsquare-mods.json'
// Downloads já conferidos esperam aqui até serem aplicados.
const ESPERA = '.servsquare-mods-pendentes'
const DESATIVADO = '.disabled'
const MAX_PROJETOS = 40 // trava contra dependências em loop

// Paper roda plugins feitos para Spigot e Bukkit também.
export const LOADERS: Partial<Record<TipoId, string[]>> = {
  paper: ['paper', 'spigot', 'bukkit'],
  fabric: ['fabric'],
  forge: ['forge'],
  neoforge: ['neoforge']
}

interface Contexto {
  extras: 'mods' | 'plugins'
  pasta: string // pasta mods/plugins
  loaders: string[]
  versao: string
  nome: string // "Fabric 26.3"
  jogador: boolean // instalação do PlaySquare (Fase P3): mods só do jogador também entram
}

export interface RegistroMod {
  projetoId: string // no CurseForge e no Hangar, o número do projeto
  versaoId: string // no CurseForge, o id do arquivo; no Hangar, o id da versão
  arquivo: string
  sha1: string
  sha512?: string // só o Modrinth dá
  titulo: string
  versao: string
  icone: string | null
  fonte?: 'curseforge' | 'hangar' // sem valor: Modrinth (Fase 16)
}

interface Pendente {
  acao: AcaoPendente
  pasta: 'mods' | 'plugins'
  arquivo: string
  registro?: RegistroMod // só em "instalar"
  lixeira?: boolean // "remover" pela aba Instalados: vai para Removidos recentemente (7 dias)
  titulo?: string
}

interface Lista {
  itens: RegistroMod[]
  pendentes: Pendente[]
}

function contexto(info: InfoServidor): Contexto {
  const extras = EXTRAS_TIPOS[info.tipo]
  if (!extras) {
    throw new ErroApp(
      `O ${NOMES_TIPOS[info.tipo]} não aceita mods nem plugins. Troque o software na tela Software.`
    )
  }
  return {
    extras,
    pasta: join(info.pasta, extras),
    loaders: LOADERS[info.tipo] ?? [info.tipo],
    versao: info.versao,
    nome: `${NOMES_TIPOS[info.tipo]} ${info.versao}`,
    jogador: !!info.jogador
  }
}

async function lerLista(info: InfoServidor): Promise<Lista> {
  try {
    const dado = JSON.parse(await readFile(join(info.pasta, ARQUIVO_LISTA), 'utf8'))
    return {
      itens: Array.isArray(dado.itens) ? dado.itens : [],
      pendentes: Array.isArray(dado.pendentes) ? dado.pendentes : []
    }
  } catch {
    return { itens: [], pendentes: [] }
  }
}

function gravarLista(info: InfoServidor, lista: Lista): Promise<void> {
  return gravarComSeguranca(join(info.pasta, ARQUIVO_LISTA), JSON.stringify(lista, null, 2))
}

// ---------- Fila: uma mudança de cada vez ----------

let cadeia: Promise<unknown> = Promise.resolve()

function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = cadeia.then(tarefa)
  cadeia = resultado.catch(() => {})
  return resultado
}

// Anota a mudança e, com o servidor desligado, já aplica (travando o botão Ligar enquanto isso).
function mudar(info: InfoServidor, preparar: (lista: Lista) => Promise<void>): Promise<void> {
  return enfileirar(async () => {
    const lista = await lerLista(info)
    await preparar(lista)
    await gravarLista(info, lista)
    // Se o servidor ligou no meio do download, a mudança só espera o próximo ligar.
    if (pastaLivre(info)) await comPastaLivre(info, () => aplicar(info)).catch(() => {})
  })
}

async function aplicar(info: InfoServidor): Promise<void> {
  const lista = await lerLista(info)
  if (!lista.pendentes.length) return
  const sobraram: Pendente[] = []
  for (const p of lista.pendentes) {
    try {
      await aplicarUma(info, lista, p)
    } catch (e) {
      registrarNoConsole(`[ServSquare] Não consegui mudar ${p.arquivo}: ${detalhar(e)}`)
      // Uma instalação sem o arquivo baixado não tem como dar certo depois.
      if (p.acao !== 'instalar' || existsSync(join(info.pasta, ESPERA, p.arquivo))) sobraram.push(p)
    }
  }
  lista.pendentes = sobraram
  await gravarLista(info, lista)
  if (!sobraram.some((p) => p.acao === 'instalar')) {
    await rm(join(info.pasta, ESPERA), { recursive: true, force: true })
  }
}

async function aplicarUma(info: InfoServidor, lista: Lista, p: Pendente): Promise<void> {
  if (!nomeSeguro(p.arquivo) || (p.pasta !== 'mods' && p.pasta !== 'plugins')) return
  const destino = join(info.pasta, p.pasta, p.arquivo)
  switch (p.acao) {
    case 'instalar': {
      await mkdir(join(info.pasta, p.pasta), { recursive: true })
      await rm(destino + DESATIVADO, { force: true })
      await rename(join(info.pasta, ESPERA, p.arquivo), destino)
      const r = p.registro
      if (r) {
        lista.itens = lista.itens.filter(
          (i) => i.projetoId !== r.projetoId && i.arquivo !== r.arquivo
        )
        lista.itens.push(r)
      }
      break
    }
    case 'ativar':
      if (existsSync(destino + DESATIVADO)) await rename(destino + DESATIVADO, destino)
      break
    case 'desativar':
      if (existsSync(destino)) await rename(destino, destino + DESATIVADO)
      break
    case 'remover':
      if (p.lixeira) {
        for (const nome of [p.arquivo, p.arquivo + DESATIVADO]) {
          if (existsSync(join(info.pasta, p.pasta, nome)))
            await guardarArquivo(info, `${p.pasta}/${nome}`, {
              titulo: p.titulo ?? p.arquivo,
              categoria: 'extras'
            })
        }
      } else {
        await rm(destino, { force: true })
        await rm(destino + DESATIVADO, { force: true })
      }
      lista.itens = lista.itens.filter((i) => i.arquivo !== p.arquivo)
      break
  }
}

// Reiniciar = desligar + ligar: as pendências entram antes de o Java abrir.
aoLigar((info) => (EXTRAS_TIPOS[info.tipo] ? enfileirar(() => aplicar(info)) : Promise.resolve()))

// Ao desligar, os .jar destravam: aplica as mudanças (ex.: "Será removido ao desligar").
// Espera o backup que começa no mesmo momento terminar.
eventos.on('desligou', ({ info }) => {
  if (!EXTRAS_TIPOS[info.tipo]) return
  setImmediate(() => {
    void esperarTarefas()
      .then(() => enfileirar(() => comServidorDesligado(() => aplicar(info))))
      .catch(() => {}) // ligou de novo antes: o aoLigar aplica
  })
})

// ---------- Pasta mods/plugins ----------

interface ArquivoNaPasta {
  nome: string // sem .disabled
  ativo: boolean
  caminho: string
}

async function lerPasta(ctx: Contexto): Promise<ArquivoNaPasta[]> {
  let itens
  try {
    itens = await readdir(ctx.pasta, { withFileTypes: true })
  } catch {
    return [] // a pasta ainda não existe
  }
  return itens.flatMap((i) => {
    if (!i.isFile()) return []
    const ativo = !i.name.endsWith(DESATIVADO)
    const nome = ativo ? i.name : i.name.slice(0, -DESATIVADO.length)
    return nomeSeguro(nome) ? [{ nome, ativo, caminho: join(ctx.pasta, i.name) }] : []
  })
}

export function sha1(caminho: string): Promise<string> {
  return new Promise((resolver, falhar) => {
    const hash = createHash('sha1')
    createReadStream(caminho)
      .on('error', falhar)
      .on('data', (d) => hash.update(d))
      .on('end', () => resolver(hash.digest('hex')))
  })
}

interface Identificado extends ArquivoNaPasta {
  sha1: string
  tamanho?: number
  data?: string
  versao?: modrinth.Versao
  projeto?: modrinth.Projeto
}

// Descobre no Modrinth de que projeto e versão é cada arquivo, pelo hash.
async function identificar(
  arquivos: ArquivoNaPasta[]
): Promise<{ itens: Identificado[]; semInternet: boolean }> {
  const itens: Identificado[] = await Promise.all(
    arquivos.map(async (a) => {
      const s = await stat(a.caminho)
      return { ...a, sha1: await sha1(a.caminho), tamanho: s.size, data: s.mtime.toISOString() }
    })
  )
  try {
    const versoes = await modrinth.porHash(itens.map((i) => i.sha1))
    const projetos = await modrinth.projetos([
      ...new Set(Object.values(versoes).map((v) => v.project_id))
    ])
    for (const i of itens) {
      i.versao = versoes[i.sha1]
      i.projeto = i.versao && projetos.get(i.versao.project_id)
    }
    return { itens, semInternet: false }
  } catch {
    return { itens, semInternet: true }
  }
}

export async function listarInstalados(info: InfoServidor): Promise<ListaMods> {
  const ctx = contexto(info)
  // Sobrou alguma mudança de quando o servidor estava ligado (ex.: o app fechou): aplica agora.
  if (pastaLivre(info)) {
    await enfileirar(() => comPastaLivre(info, () => aplicar(info))).catch(() => {})
  }
  const lista = await lerLista(info)
  const { itens, semInternet } = await identificar(await lerPasta(ctx))
  const porHash = new Map(lista.itens.map((r) => [r.sha1, r]))
  const porArquivo = new Map(lista.itens.filter((r) => r.fonte).map((r) => [r.arquivo, r]))

  const resultado: ModInstalado[] = itens.map((i) => {
    // Sem internet, o que o app instalou ainda tem nome. Veio do CurseForge ou do Hangar: vale o
    // registro (o mesmo arquivo pode estar também no Modrinth).
    const r = porHash.get(i.sha1) ?? porArquivo.get(i.nome)
    const m = r?.fonte ? undefined : i
    return {
      arquivo: i.nome,
      ativo: i.ativo,
      projetoId: m?.versao?.project_id ?? r?.projetoId ?? null,
      titulo: m?.projeto?.title ?? r?.titulo ?? i.nome,
      versao: m?.versao?.version_number ?? r?.versao ?? null,
      icone: m?.projeto?.icon_url ?? r?.icone ?? null,
      fonte: r?.fonte ?? (m?.versao || r ? 'modrinth' : 'manual'),
      pendente: null,
      tamanho: i.tamanho ?? null,
      data: i.data ?? null,
      dependencias: (m?.versao?.dependencies ?? []).flatMap((d) =>
        d.dependency_type === 'required' && d.project_id ? [d.project_id] : []
      ),
      versaoId: m?.versao?.id ?? r?.versaoId ?? null,
      jogos: m?.versao?.game_versions ?? [],
      incompativeis: (m?.versao?.dependencies ?? []).flatMap((d) =>
        d.dependency_type === 'incompatible' && d.project_id ? [d.project_id] : []
      ),
      soDoJogador: m?.projeto ? soDoJogador(m.projeto.environment, m.projeto.server_side) : false,
      categorias: m?.projeto?.categories ?? []
    }
  })
  for (const p of lista.pendentes.filter((p) => p.pasta === ctx.extras)) {
    const item = resultado.find((m) => m.arquivo === p.arquivo)
    if (item) item.pendente = p.acao
    else if (p.acao === 'instalar' && p.registro) {
      const r = p.registro
      resultado.push({
        arquivo: r.arquivo,
        ativo: true,
        projetoId: r.projetoId,
        titulo: r.titulo,
        versao: r.versao,
        icone: r.icone,
        fonte: r.fonte ?? 'modrinth',
        pendente: 'instalar',
        tamanho: null,
        data: null,
        dependencias: [],
        versaoId: r.versaoId,
        jogos: [],
        incompativeis: [],
        soDoJogador: false,
        categorias: []
      })
    }
  }
  resultado.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
  return { itens: resultado, pendentes: lista.pendentes.length, semInternet }
}

// ---------- Planejar e instalar ----------

export interface ItemInterno extends ItemPlano {
  url: string
  checksum: Checksum
  registro: RegistroMod
}

interface PlanoInterno {
  pasta: string // pasta do servidor
  ctx: Contexto
  itens: ItemInterno[]
  antes: Pendente[] // ex.: remover a versão antiga numa atualização
  depois: Pendente[] // ex.: manter desativado o que estava desativado
  backup: boolean
  manuais?: ArquivoManual[] // Fase D: vão para o assistente de downloads ao instalar
}

const planos = new Map<string, PlanoInterno>()

// A partir dos projetos pedidos, escolhe as versões e junta as dependências obrigatórias.
async function montar(
  ctx: Contexto,
  inicio: { projetoId: string; versao?: modrinth.Versao }[],
  jaInstalados: Set<string>
): Promise<{ itens: ItemInterno[]; avisos: string[]; problemas: string[] }> {
  const escolhas = new Map<string, { versao: modrinth.Versao; dependencia: boolean }>()
  const semVersao: string[] = []
  const fila = inicio.map((i) => ({ ...i, dependencia: false }))
  while (fila.length && escolhas.size < MAX_PROJETOS) {
    const item = fila.shift()!
    if (escolhas.has(item.projetoId) || semVersao.includes(item.projetoId)) continue
    const versao =
      item.versao ?? escolherVersao(await modrinth.versoes(item.projetoId, ctx.loaders, ctx.versao))
    if (!versao) {
      semVersao.push(item.projetoId)
      continue
    }
    escolhas.set(item.projetoId, { versao, dependencia: item.dependencia })
    for (const d of versao.dependencies) {
      if (d.dependency_type !== 'required') continue
      const id =
        d.project_id ?? (d.version_id ? (await modrinth.versao(d.version_id)).project_id : null)
      if (id && !jaInstalados.has(id)) fila.push({ projetoId: id, dependencia: true })
    }
  }

  const projetos = await modrinth.projetos([...escolhas.keys(), ...semVersao])
  const titulo = (id: string): string => projetos.get(id)?.title ?? id
  const avisos: string[] = []
  const problemas = semVersao.map((id) => `"${titulo(id)}" não tem versão para ${ctx.nome}.`)
  const itens: ItemInterno[] = []
  for (const [projetoId, { versao, dependencia }] of escolhas) {
    const projeto = projetos.get(projetoId)
    if (projeto && !ctx.jogador && soDoJogador(projeto.environment, projeto.server_side)) {
      avisos.push(
        `"${titulo(projetoId)}" é só do jogador: funciona no jogo de cada um, não no servidor. Ele não vai ser instalado.`
      )
      continue
    }
    const arquivo = versao.files.find((f) => f.primary) ?? versao.files[0]
    if (!arquivo || !nomeSeguro(arquivo.filename) || !urlDoModrinth(arquivo.url)) {
      problemas.push(`"${titulo(projetoId)}" tem um arquivo que o app não aceita.`)
      continue
    }
    itens.push({
      titulo: titulo(projetoId),
      versao: versao.version_number,
      arquivo: arquivo.filename,
      tamanho: arquivo.size,
      dependencia,
      url: arquivo.url,
      checksum: { algoritmo: 'sha512', valor: arquivo.hashes.sha512 },
      registro: {
        projetoId,
        versaoId: versao.id,
        arquivo: arquivo.filename,
        sha1: arquivo.hashes.sha1,
        sha512: arquivo.hashes.sha512,
        titulo: titulo(projetoId),
        versao: versao.version_number,
        icone: projeto?.icon_url ?? null
      }
    })
  }
  return { itens, avisos, problemas }
}

async function projetosInstalados(ctx: Contexto, info: InfoServidor): Promise<Set<string>> {
  const { itens } = await identificar(await lerPasta(ctx))
  const lista = await lerLista(info)
  return new Set([
    ...itens.flatMap((i) => (i.versao ? [i.versao.project_id] : [])),
    ...lista.itens.map((i) => i.projetoId),
    ...lista.pendentes.flatMap((p) => (p.registro ? [p.registro.projetoId] : []))
  ])
}

// "fonte:id" do que o app instalou, para não repetir dependências do CurseForge e do Hangar.
async function instaladosPorFonte(info: InfoServidor): Promise<Set<string>> {
  return new Set((await registrosDoApp(info)).map((r) => `${r.fonte}:${r.projetoId}`))
}

export async function planejarInstalacao(
  info: InfoServidor,
  projetoId: unknown,
  fonte: unknown = 'modrinth'
): Promise<PlanoMods> {
  const ctx = contexto(info)
  const id = typeof projetoId === 'string' ? projetoId : ''
  const valido =
    fonte === 'modrinth'
      ? /^[\w-]{1,64}$/.test(id)
      : /^\d{1,12}$/.test(id) && (fonte === 'curseforge' || fonte === 'hangar')
  if (!valido) throw new ErroApp('Projeto inválido. Escolha um da lista.')
  const { itens, avisos, problemas, manuais } =
    fonte === 'curseforge'
      ? await montarCurseForge(info, Number(id), await instaladosPorFonte(info))
      : fonte === 'hangar'
        ? await montarHangar(info, Number(id), await instaladosPorFonte(info))
        : {
            ...(await montar(ctx, [{ projetoId: id }], await projetosInstalados(ctx, info))),
            manuais: []
          }
  if (!itens.length && !avisos.length && !problemas.length && !manuais.length) {
    throw new ErroApp(`Esse projeto não tem versão para ${ctx.nome}. Procure outro.`)
  }
  const token = randomUUID()
  planos.set(token, {
    pasta: info.pasta,
    ctx,
    itens,
    antes: [],
    depois: [],
    backup: false,
    manuais
  })
  return {
    token,
    itens: itens.map(({ titulo, versao, arquivo, tamanho, dependencia }) => ({
      titulo,
      versao,
      arquivo,
      tamanho,
      dependencia
    })),
    avisos,
    problemas,
    manuais
  }
}

export async function instalarPlano(
  info: InfoServidor,
  token: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  const plano = typeof token === 'string' ? planos.get(token) : undefined
  if (!plano || plano.pasta !== info.pasta) {
    throw new ErroApp('Essa lista de instalação expirou. Clique em Instalar de novo.')
  }
  planos.delete(token as string)
  await executar(info, plano, aoProgredir)
}

async function executar(
  info: InfoServidor,
  plano: PlanoInterno,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  const manuais = plano.manuais ?? []
  if (!plano.itens.length && !manuais.length) throw new ErroApp('Nada para instalar.')
  if (plano.itens.length) await executarItens(info, plano, aoProgredir)
  // Fase D: o que o autor não deixa baixar vai para a janela Downloads necessários.
  if (manuais.length) await registrarPendencias(info, manuais)
}

async function executarItens(
  info: InfoServidor,
  plano: PlanoInterno,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  await mudar(info, async (lista) => {
    if (plano.backup) await backupDaPasta(info, plano.ctx, aoProgredir)
    await mkdir(join(info.pasta, ESPERA), { recursive: true })
    for (const item of plano.itens) {
      const destino = join(info.pasta, ESPERA, item.arquivo)
      await baixar(
        item.url,
        destino,
        item.checksum,
        `Baixando ${item.titulo} ${item.versao}`,
        aoProgredir
      )
      if (!item.registro.sha1) item.registro.sha1 = await sha1(destino)
    }
    lista.pendentes.push(
      ...plano.antes,
      ...plano.itens.map((item) => ({
        acao: 'instalar' as const,
        pasta: plano.ctx.extras,
        arquivo: item.arquivo,
        registro: item.registro
      })),
      ...plano.depois
    )
  })
}

// Backup da pasta mods/plugins antes de atualizar; guarda os 5 últimos.
async function backupDaPasta(
  info: InfoServidor,
  ctx: Contexto,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  if (!existsSync(ctx.pasta)) return
  aoProgredir({ etapa: `Fazendo backup da pasta ${ctx.extras}`, recebido: 0, total: 0 })
  const pasta = join(pastaBackups(info), ctx.extras)
  try {
    await mkdir(pasta, { recursive: true })
    const nome = `${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
    await tar(['-a', '-c', '-f', join(pasta, nome), '-C', info.pasta, ctx.extras])
    const antigos = (await readdir(pasta))
      .filter((n) => n.endsWith('.zip'))
      .sort()
      .slice(0, -5)
    for (const n of antigos) await rm(join(pasta, n), { force: true })
  } catch (e) {
    throw new ErroApp(
      `Não consegui fazer o backup da pasta ${ctx.extras}, então nada foi mudado. Tente de novo.`,
      detalhar(e)
    )
  }
}

// ---------- Ativar, desativar e remover ----------

async function exigirArquivo(info: InfoServidor, ctx: Contexto, arquivo: unknown): Promise<string> {
  if (nomeSeguro(arquivo)) {
    const naPasta = (await lerPasta(ctx)).some((a) => a.nome === arquivo)
    const pendente = (await lerLista(info)).pendentes.some((p) => p.arquivo === arquivo)
    if (naPasta || pendente) return arquivo
  }
  throw new ErroApp(`Não encontrei esse arquivo na pasta ${ctx.extras}. Atualize a lista.`)
}

export async function alternarMod(
  info: InfoServidor,
  arquivo: unknown,
  ativo: unknown
): Promise<void> {
  const ctx = contexto(info)
  const nome = await exigirArquivo(info, ctx, arquivo)
  // PlaySquare: o que o servidor exige fica ligado (a sincronização poria de volta, de todo jeito).
  if (ativo !== true && info.jogador?.obrigatorios.includes(`${ctx.extras}/${nome}`)) {
    throw new ErroApp('Esse mod veio do servidor e é obrigatório para entrar nele.')
  }
  await mudar(info, async (lista) => {
    // Clicar de novo antes de aplicar só desfaz a mudança anotada.
    const i = lista.pendentes.findIndex(
      (p) => p.arquivo === nome && (p.acao === 'ativar' || p.acao === 'desativar')
    )
    if (i >= 0) lista.pendentes.splice(i, 1)
    else
      lista.pendentes.push({
        acao: ativo === true ? 'ativar' : 'desativar',
        pasta: ctx.extras,
        arquivo: nome
      })
  })
}

// A tela pede confirmação antes de chamar. Com o servidor ligado, o arquivo sai ao desligar.
// O arquivo vai para Removidos recentemente (7 dias). Devolve true se ficou para depois.
export async function removerMod(
  info: InfoServidor,
  arquivo: unknown,
  titulo?: string
): Promise<boolean> {
  const ctx = contexto(info)
  const nome = await exigirArquivo(info, ctx, arquivo)
  const naPasta = (await lerPasta(ctx)).some((a) => a.nome === nome)
  await mudar(info, async (lista) => {
    lista.pendentes = lista.pendentes.filter((p) => p.arquivo !== nome)
    // Instalação que ainda nem entrou na pasta: basta cancelar.
    if (naPasta)
      lista.pendentes.push({
        acao: 'remover',
        pasta: ctx.extras,
        arquivo: nome,
        lixeira: true,
        titulo
      })
    else await rm(join(info.pasta, ESPERA, nome), { force: true })
  })
  return (await lerLista(info)).pendentes.some((p) => p.acao === 'remover' && p.arquivo === nome)
}

// "Desfazer" de uma remoção que ainda espera o servidor desligar.
export async function cancelarRemocaoMod(info: InfoServidor, arquivo: string): Promise<boolean> {
  return enfileirar(async () => {
    const lista = await lerLista(info)
    const antes = lista.pendentes.length
    lista.pendentes = lista.pendentes.filter(
      (p) => !(p.acao === 'remover' && p.arquivo === arquivo)
    )
    if (lista.pendentes.length === antes) return false
    await gravarLista(info, lista)
    return true
  })
}

// ---------- Atualizações ----------

interface AtualizacaoInterna extends AtualizacaoMod {
  ativo: boolean
  projetoId: string
  nova?: modrinth.Versao // Modrinth
  item?: ItemInterno // CurseForge e Hangar: já pronto para baixar
}

async function procurarAtualizacoes(
  info: InfoServidor,
  ctx: Contexto
): Promise<AtualizacaoInterna[]> {
  const lista = await lerLista(info)
  const comPendencia = new Set(lista.pendentes.map((p) => p.arquivo))
  // O que veio do CurseForge ou do Hangar é conferido lá, não no Modrinth.
  const deOutraFonte = new Map(lista.itens.filter((r) => r.fonte).map((r) => [r.arquivo, r]))
  const naPasta = (await lerPasta(ctx)).filter((a) => !comPendencia.has(a.nome))
  const { itens, semInternet } = await identificar(naPasta.filter((a) => !deOutraFonte.has(a.nome)))
  if (semInternet) {
    throw new ErroApp('Não consegui falar com o Modrinth. Confira sua internet e tente de novo.')
  }
  // "Travar versão" (Fase 25): esses não aparecem como atualização.
  const travados = new Set((await lerOrganizacao(info)).travados)
  const outras: AtualizacaoInterna[] = []
  for (const a of naPasta) {
    const r = deOutraFonte.get(a.nome)
    if (!r?.fonte || travados.has(`${r.fonte}:${r.projetoId}`)) continue
    // Sem chave do CurseForge (ou sem internet), aquele item só fica sem verificar.
    const nova = await (r.fonte === 'curseforge' ? novaCF : novaHangar)(
      info,
      r.projetoId,
      r.versaoId
    ).catch(() => null)
    if (!nova) continue
    outras.push({
      arquivo: a.nome,
      ativo: a.ativo,
      projetoId: r.projetoId,
      titulo: r.titulo,
      icone: r.icone,
      versaoAtual: r.versao,
      versaoNova: 'item' in nova ? nova.item.versao : nova.versao,
      fonte: r.fonte,
      manual: 'manual' in nova ? nova.manual.url : null,
      item: 'item' in nova ? nova.item : undefined
    })
  }
  const conhecidos = itens.filter(
    (i) => i.versao && !travados.has(`modrinth:${i.versao.project_id}`)
  )
  const hashes = conhecidos.map((i) => i.sha1)
  // Prefere as versões "release"; quem só tem beta/alpha usa a mais nova delas.
  const releases = await modrinth.atualizacoes(hashes, ctx.loaders, ctx.versao, ['release'])
  const faltam = hashes.filter((h) => !releases[h])
  const semRelease = await modrinth.atualizacoes(faltam, ctx.loaders, ctx.versao)
  const doModrinth = conhecidos.flatMap((i) => {
    const nova = releases[i.sha1] ?? semRelease[i.sha1]
    if (!nova || !i.versao || !ehMaisNova(nova, i.versao)) return []
    return [
      {
        arquivo: i.nome,
        ativo: i.ativo,
        projetoId: i.versao.project_id,
        titulo: i.projeto?.title ?? i.nome,
        icone: i.projeto?.icon_url ?? null,
        versaoAtual: i.versao.version_number,
        versaoNova: nova.version_number,
        fonte: 'modrinth' as const,
        manual: null,
        nova
      }
    ]
  })
  return [...doModrinth, ...outras]
}

export async function listarAtualizacoes(info: InfoServidor): Promise<AtualizacaoMod[]> {
  return (await procurarAtualizacoes(info, contexto(info))).map(
    ({ arquivo, titulo, icone, versaoAtual, versaoNova, fonte, manual }) => ({
      arquivo,
      titulo,
      icone,
      versaoAtual,
      versaoNova,
      fonte,
      manual
    })
  )
}

// Sem `arquivos`, atualiza todos.
export async function atualizarMods(
  info: InfoServidor,
  arquivos: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  const ctx = contexto(info)
  const pedidos = Array.isArray(arquivos) ? new Set(arquivos.filter((n) => nomeSeguro(n))) : null
  // "Baixe pelo site" fica de fora: o app não baixa esses arquivos.
  const escolhidas = (await procurarAtualizacoes(info, ctx)).filter(
    (a) => (!pedidos || pedidos.has(a.arquivo)) && !a.manual
  )
  if (!escolhidas.length) throw new ErroApp('Não há atualização para aplicar. Atualize a lista.')

  const doModrinth = escolhidas.flatMap((a) =>
    a.nova ? [{ projetoId: a.projetoId, versao: a.nova }] : []
  )
  const { itens: novosModrinth, problemas } = doModrinth.length
    ? await montar(ctx, doModrinth, await projetosInstalados(ctx, info))
    : { itens: [], problemas: [] }
  if (problemas.length) throw new ErroApp(problemas.join(' '))
  const itens = [...novosModrinth, ...escolhidas.flatMap((a) => (a.item ? [a.item] : []))]
  const novos = new Map(itens.map((i) => [i.registro.projetoId, i.arquivo]))
  // Fase 25: cada um guarda a versão de agora, para dar para voltar.
  for (const a of escolhidas) await guardarAnterior(info, a.arquivo).catch(() => {})
  await executar(
    info,
    {
      pasta: info.pasta,
      ctx,
      itens,
      // O arquivo antigo sai antes; se o novo tiver o mesmo nome, ele entra por cima.
      antes: escolhidas
        .filter((a) => novos.has(a.projetoId))
        .map((a) => ({ acao: 'remover', pasta: ctx.extras, arquivo: a.arquivo })),
      depois: escolhidas.flatMap((a) => {
        const arquivo = novos.get(a.projetoId)
        return !a.ativo && arquivo
          ? [{ acao: 'desativar' as const, pasta: ctx.extras, arquivo }]
          : []
      }),
      backup: true
    },
    aoProgredir
  )
}

// ---------- Fase D: downloads manuais ----------

// Arquivo baixado à mão (hash já conferido): entra pela mesma fila das instalações, então com o
// servidor ligado ele espera o desligar, como qualquer mod novo.
export async function instalarBaixado(
  info: InfoServidor,
  origem: string,
  registro: RegistroMod
): Promise<void> {
  const ctx = contexto(info)
  if (!nomeSeguro(registro.arquivo)) throw new ErroApp('Nome de arquivo inválido.')
  await mudar(info, async (lista) => {
    await mkdir(join(info.pasta, ESPERA), { recursive: true })
    await copyFile(origem, join(info.pasta, ESPERA, registro.arquivo))
    lista.pendentes.push({
      acao: 'instalar',
      pasta: ctx.extras,
      arquivo: registro.arquivo,
      registro
    })
  })
}

// O mesmo arquivo (nome e hash) já está na pasta mods/plugins?
export async function jaTemArquivo(
  info: InfoServidor,
  arquivo: string,
  hash: string
): Promise<boolean> {
  const caminho = join(contexto(info).pasta, arquivo)
  return nomeSeguro(arquivo) && existsSync(caminho) && (await sha1(caminho)) === hash
}

// ---------- Para outras telas (ex.: Desempenho e Explorar) ----------

// O que o app instalou (ou vai instalar ao reiniciar), sem ler os arquivos da pasta.
export async function registrosDoApp(
  info: InfoServidor
): Promise<{ projetoId: string; versaoId: string; arquivo: string; fonte: Fonte }[]> {
  const lista = await lerLista(info)
  return [
    ...lista.itens.filter(
      (i) => !lista.pendentes.some((p) => p.acao === 'remover' && p.arquivo === i.arquivo)
    ),
    ...lista.pendentes.flatMap((p) => (p.acao === 'instalar' && p.registro ? [p.registro] : []))
  ].map((r) => ({ ...r, fonte: r.fonte ?? 'modrinth' }))
}

export type EstadoProjeto = 'ausente' | 'pendente' | 'instalado' | 'desativado'

// Situação de um projeto do Modrinth na pasta mods/plugins. Sem registro do app (instalado à mão),
// procura pelo nome do arquivo.
export async function estadoDoProjeto(
  info: InfoServidor,
  projetoId: string,
  nomeDoArquivo: RegExp
): Promise<EstadoProjeto> {
  const ctx = contexto(info)
  const lista = await lerLista(info)
  if (lista.pendentes.some((p) => p.acao === 'instalar' && p.registro?.projetoId === projetoId)) {
    return 'pendente'
  }
  const arquivos = await lerPasta(ctx)
  const registro = lista.itens.find((i) => i.projetoId === projetoId)
  const achado =
    arquivos.find((a) => a.nome === registro?.arquivo) ??
    arquivos.find((a) => nomeDoArquivo.test(a.nome))
  if (!achado) return 'ausente'
  return achado.ativo ? 'instalado' : 'desativado'
}

// ---------- Versões, perfis e lista de mods (Fase 25) ----------

function pastaAnteriores(info: InfoServidor, idMod: string): string {
  return join(pastaBackups(info), 'mods-anteriores', idMod.replace(/[^\w.-]/g, '_'))
}

async function modDoArquivo(info: InfoServidor, arquivo: unknown): Promise<ModInstalado> {
  const m = (await listarInstalados(info)).itens.find((x) => x.arquivo === arquivo)
  if (!m || m.pendente === 'instalar') {
    throw new ErroApp('Não encontrei esse arquivo na pasta. Atualize a lista.')
  }
  return m
}

const idDe = (m: ModInstalado): string => idDoMod(m.fonte, m.projetoId, m.arquivo)

// Guarda uma cópia do arquivo de agora (a "versão anterior"); só a última fica.
export async function guardarAnterior(info: InfoServidor, arquivo: string): Promise<void> {
  const ctx = contexto(info)
  const m = await modDoArquivo(info, arquivo)
  const naPasta = (await lerPasta(ctx)).find((a) => a.nome === arquivo)
  if (!naPasta) return
  const id = idDe(m)
  const pasta = pastaAnteriores(info, id)
  if (!dentroDe(pastaBackups(info), pasta)) return
  await rm(pasta, { recursive: true, force: true })
  await mkdir(pasta, { recursive: true })
  await copyFile(naPasta.caminho, join(pasta, arquivo))
  const registro = (await lerLista(info)).itens.find((r) => r.arquivo === arquivo) ?? null
  await editarOrganizacao(info, (o) => {
    o.anteriores[id] = {
      arquivo,
      versao: m.versao,
      versaoId: m.versaoId,
      registro,
      quando: new Date().toISOString()
    }
  })
}

export async function versoesDoMod(info: InfoServidor, arquivo: unknown): Promise<VersoesDoMod> {
  const ctx = contexto(info)
  const m = await modDoArquivo(info, arquivo)
  const id = idDe(m)
  const o = await lerOrganizacao(info)
  let versoes: VersoesDoMod['versoes'] = []
  if (m.projetoId && m.fonte === 'modrinth') {
    versoes = (await modrinth.versoes(m.projetoId, ctx.loaders, ctx.versao))
      .filter((v) => !v.status || v.status === 'listed')
      .sort((a, b) => Date.parse(b.date_published) - Date.parse(a.date_published))
      .map((v) => ({
        id: v.id,
        nome: v.version_number,
        data: v.date_published,
        tipo: v.version_type,
        atual: v.id === m.versaoId
      }))
  } else if (m.projetoId && m.fonte === 'curseforge') {
    versoes = (await arquivosCFQueServem(info, Number(m.projetoId))).map((a) => ({
      id: String(a.id),
      nome: a.displayName,
      data: a.fileDate,
      tipo: a.releaseType === 1 ? 'release' : a.releaseType === 2 ? 'beta' : 'alpha',
      atual: String(a.id) === m.versaoId
    }))
  } else if (m.projetoId && m.fonte === 'hangar') {
    versoes = (await hangar.versoes(m.projetoId))
      .filter((v) => hangarServe(v.platformDependencies.PAPER, info.versao))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((v) => ({
        id: String(v.id),
        nome: v.name,
        data: v.createdAt,
        tipo: v.channel.name.toLowerCase() === 'release' ? 'release' : 'beta',
        atual: String(v.id) === m.versaoId
      }))
  }
  return {
    idMod: id,
    versoes: versoes.slice(0, 30),
    travado: o.travados.includes(id),
    anterior: o.anteriores[id]?.versao ?? (o.anteriores[id] ? 'a anterior' : null)
  }
}

// Instala outra versão do mesmo mod (a de agora vira a "anterior").
export async function trocarVersao(
  info: InfoServidor,
  arquivo: unknown,
  versaoId: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  const ctx = contexto(info)
  const m = await modDoArquivo(info, arquivo)
  if (typeof versaoId !== 'string' || !/^[\w-]{1,64}$/.test(versaoId) || !m.projetoId) {
    throw new ErroApp('Versão inválida. Escolha uma da lista.')
  }
  if (versaoId === m.versaoId) throw new ErroApp('Essa já é a versão instalada.')
  let itens: ItemInterno[]
  if (m.fonte === 'modrinth') {
    const v = await modrinth.versao(versaoId)
    if (v.project_id !== m.projetoId) throw new ErroApp('Essa versão é de outro projeto.')
    const r = await montar(
      ctx,
      [{ projetoId: m.projetoId, versao: v }],
      await projetosInstalados(ctx, info)
    )
    if (r.problemas.length) throw new ErroApp(r.problemas.join(' '))
    itens = r.itens
  } else if (m.fonte === 'curseforge') {
    const [mod, a] = await Promise.all([
      cf.mod(Number(m.projetoId)),
      cf.arquivo(Number(m.projetoId), Number(versaoId))
    ])
    if (!cf.podeBaixar(mod, a)) {
      throw new ErroApp(
        'O autor não deixa outros apps baixarem essa versão. Baixe pelo site.',
        cf.paginaDoArquivo(mod, a.id) ?? undefined
      )
    }
    const item = itemCF(mod, a, false)
    if (!item) throw new ErroApp('Essa versão tem um arquivo que o app não aceita.')
    itens = [item]
  } else if (m.fonte === 'hangar') {
    const [p, versoes] = await Promise.all([
      hangar.projeto(m.projetoId),
      hangar.versoes(m.projetoId)
    ])
    const v = versoes.find((x) => String(x.id) === versaoId)
    const x = v && itemHangar(p, v, false)
    if (!x) throw new ErroApp('Não achei essa versão no Hangar.')
    if (ehManual(x)) throw new ErroApp('Essa versão só tem link externo. Baixe pelo site.', x.url)
    itens = [x]
  } else throw new ErroApp('Mods instalados à mão não têm outras versões para escolher.')
  await guardarAnterior(info, m.arquivo)
  const novo = itens.find((i) => i.registro.projetoId === m.projetoId)?.arquivo
  await executar(
    info,
    {
      pasta: info.pasta,
      ctx,
      itens,
      antes: [{ acao: 'remover', pasta: ctx.extras, arquivo: m.arquivo }],
      depois: !m.ativo && novo ? [{ acao: 'desativar', pasta: ctx.extras, arquivo: novo }] : [],
      backup: false // a versão de agora já foi guardada como "anterior"
    },
    aoProgredir
  )
}

// Correção "versão incompatível": a versão compatível mais nova.
export async function trocarParaCompativel(
  info: InfoServidor,
  arquivo: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  const v = (await versoesDoMod(info, arquivo)).versoes.find((x) => !x.atual)
  if (!v) {
    throw new ErroApp(
      `Não achei versão desse mod para ${contexto(info).nome}. Desative ou remova o mod.`
    )
  }
  await trocarVersao(info, arquivo, v.id, aoProgredir)
}

// Volta para a versão guardada na última atualização (e trava, para não atualizar de novo).
export async function voltarVersao(info: InfoServidor, arquivo: unknown): Promise<void> {
  const ctx = contexto(info)
  const m = await modDoArquivo(info, arquivo)
  const id = idDe(m)
  const ant = (await lerOrganizacao(info)).anteriores[id]
  const copia = ant && join(pastaAnteriores(info, id), ant.arquivo)
  if (!ant || !nomeSeguro(ant.arquivo) || !copia || !existsSync(copia)) {
    throw new ErroApp('Não há versão anterior guardada desse mod.')
  }
  await mkdir(join(info.pasta, ESPERA), { recursive: true })
  const espera = join(info.pasta, ESPERA, ant.arquivo)
  await copyFile(copia, espera)
  await guardarAnterior(info, m.arquivo) // a de agora vira a anterior (troca)
  const r = ant.registro as RegistroMod | null
  const registro =
    r && typeof r.projetoId === 'string' ? { ...r, sha1: await sha1(espera) } : undefined
  await mudar(info, async (lista) => {
    lista.pendentes = lista.pendentes.filter(
      (p) => p.arquivo !== m.arquivo && p.arquivo !== ant.arquivo
    )
    lista.pendentes.push(
      { acao: 'remover', pasta: ctx.extras, arquivo: m.arquivo },
      { acao: 'instalar', pasta: ctx.extras, arquivo: ant.arquivo, registro },
      ...(!m.ativo ? [{ acao: 'desativar' as const, pasta: ctx.extras, arquivo: ant.arquivo }] : [])
    )
  })
  await editarOrganizacao(info, (o) => {
    if (!o.travados.includes(id)) o.travados.push(id)
  })
}

// ---------- Perfis ----------

const NOME_PERFIL = /^[\p{L}\p{N} _.-]{1,32}$/u

export async function listarPerfis(info: InfoServidor): Promise<PerfilMods[]> {
  return (await lerOrganizacao(info)).perfis.map((p) => ({
    nome: p.nome,
    ativos: p.ativos.length,
    criado: p.criado
  }))
}

export async function salvarPerfil(info: InfoServidor, nome: unknown): Promise<void> {
  const n = typeof nome === 'string' ? nome.trim() : ''
  if (!NOME_PERFIL.test(n))
    throw new ErroApp('Use até 32 letras, números ou espaços no nome do perfil.')
  const ativos = (await listarInstalados(info)).itens
    .filter((m) => m.ativo && m.pendente !== 'instalar')
    .map(idDe)
  await editarOrganizacao(info, (o) => {
    o.perfis = [
      ...o.perfis.filter((p) => p.nome !== n),
      { nome: n, ativos, criado: new Date().toISOString() }
    ]
  })
}

export async function apagarPerfil(info: InfoServidor, nome: unknown): Promise<void> {
  await editarOrganizacao(info, (o) => {
    o.perfis = o.perfis.filter((p) => p.nome !== nome)
  })
}

// Só com o servidor desligado: liga os mods do perfil e desliga o resto.
export async function aplicarPerfil(
  info: InfoServidor,
  nome: unknown
): Promise<{ mudados: number; faltam: number }> {
  if (!pastaLivre(info)) throw new ErroApp('Desligue o servidor para trocar de perfil.')
  const perfil = (await lerOrganizacao(info)).perfis.find((p) => p.nome === nome)
  if (!perfil) throw new ErroApp('Esse perfil não existe mais. Atualize a lista.')
  const quer = new Set(perfil.ativos)
  const mods = (await listarInstalados(info)).itens.filter((m) => m.pendente !== 'instalar')
  let mudados = 0
  for (const m of mods) {
    const deveFicar = quer.has(idDe(m))
    if (m.ativo === deveFicar) continue
    await alternarMod(info, m.arquivo, deveFicar)
    mudados++
  }
  const presentes = new Set(mods.map(idDe))
  return { mudados, faltam: perfil.ativos.filter((id) => !presentes.has(id)).length }
}

// ---------- Correção "dependência faltando" e importação ----------

// O id do mod (do .jar) costuma ser o mesmo nome curto (slug) do projeto no Modrinth.
export async function planejarPorModId(info: InfoServidor, modId: unknown): Promise<PlanoMods> {
  const id = typeof modId === 'string' ? modId.toLowerCase() : ''
  if (!/^[a-z0-9_.-]{1,64}$/.test(id)) throw new ErroApp('Dependência inválida.')
  for (const slug of [...new Set([id, id.replace(/_/g, '-')])]) {
    const p = await modrinth.projeto(slug).catch(() => null)
    if (p) return planejarInstalacao(info, p.id, 'modrinth')
  }
  throw new ErroApp(
    `Não achei "${id}" no Modrinth. Procure pelo nome no Explorar (Modrinth ou CurseForge).`
  )
}

// Vários projetos de uma vez (lista importada). Problemas viram avisos: o resto instala.
export async function planejarVarios(
  info: InfoServidor,
  pedidos: { fonte: string; projetoId: string }[]
): Promise<PlanoMods | null> {
  const ctx = contexto(info)
  const ja = await instaladosPorFonte(info)
  const faltam = pedidos.filter((p) => !ja.has(`${p.fonte}:${p.projetoId}`))
  if (!faltam.length) return null
  const partes: Montado[] = []
  const modrinthIds = faltam.filter(
    (p) => p.fonte === 'modrinth' && /^[\w-]{1,64}$/.test(p.projetoId)
  )
  if (modrinthIds.length) {
    const r = await montar(
      ctx,
      modrinthIds.map((p) => ({ projetoId: p.projetoId })),
      await projetosInstalados(ctx, info)
    )
    partes.push({ ...r, manuais: [] })
  }
  for (const p of faltam.filter((x) => x.fonte !== 'modrinth' && /^\d{1,12}$/.test(x.projetoId))) {
    try {
      partes.push(
        p.fonte === 'curseforge'
          ? await montarCurseForge(info, Number(p.projetoId), ja)
          : await montarHangar(info, Number(p.projetoId), ja)
      )
    } catch (e) {
      partes.push({
        itens: [],
        avisos: [`${p.fonte} ${p.projetoId}: ${detalhar(e)}`],
        problemas: [],
        manuais: []
      })
    }
  }
  const vistos = new Set<string>()
  const itens = partes
    .flatMap((x) => x.itens)
    .filter((i) => {
      const k = `${i.registro.fonte ?? 'modrinth'}:${i.registro.projetoId}`
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
  const token = randomUUID()
  const manuais = partes.flatMap((x) => x.manuais)
  planos.set(token, {
    pasta: info.pasta,
    ctx,
    itens,
    antes: [],
    depois: [],
    backup: false,
    manuais
  })
  return {
    token,
    itens: itens.map(({ titulo, versao, arquivo, tamanho, dependencia }) => ({
      titulo,
      versao,
      arquivo,
      tamanho,
      dependencia
    })),
    avisos: [...partes.flatMap((x) => x.avisos), ...partes.flatMap((x) => x.problemas)],
    problemas: [],
    manuais
  }
}
