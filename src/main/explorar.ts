import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rm } from 'fs/promises'
import { join } from 'path'
import {
  EXTRAS_TIPOS,
  TIPOS_CONTEUDO,
  TIPOS_POR_FONTE,
  type DestinoProjeto,
  type DetalhesProjeto,
  type EstadoInstalacao,
  type FiltrosExplorar,
  type InfoServidor,
  type OpcoesExplorar,
  type Progresso,
  type ResultadoExplorar,
  type TipoConteudo
} from '../shared/tipos'
import { gravarComSeguranca, gravarPropriedades, lerArquivoPropriedades } from './config'
import { ErroApp } from './erros'
import {
  ambienteDe,
  destinoDe,
  facetsExplorar,
  pastaNoPacote,
  tipoDasCategorias
} from './explorarRegras'
import type { ArquivoIndice } from './modpackRegras'
import * as modrinth from './modrinth'
import { LOADERS, instalarPlano, planejarInstalacao, registrosDoApp } from './mods'
import { compatibilidade, modDeShader } from './compatRegras'
import { ehMaisNova, escolherVersao, nomeSeguro, urlDoModrinth } from './modsRegras'
import { nivelDoMundo } from './mundo'
import { baixar, type Checksum } from './rede'
import * as cf from './curseforge'
import {
  buscarCF,
  buscarHangar,
  datapackCF,
  detalhesCF,
  detalhesHangar,
  opcoesCF,
  opcoesHangar
} from './explorarFontes'
import { FONTES, NOMES_FONTES, downloadPermitido, type Fonte } from '../shared/fontes'
import { removerArquivo } from './removidos'
import { pedidosDaPagina, tamanhoValido } from '../shared/paginaRegras'
import { t as tx } from '../shared/i18n'
import { registrarErro } from './registroErros'

// Aba Explorar da tela Mods (Fase 23): todos os tipos de conteúdo do Modrinth.
// Mods e plugins do servidor seguem pelo mods.ts (Fase 16). Este arquivo cuida do resto:
// datapacks (pasta do mundo ativo), resource pack do servidor (server.properties) e o que é só
// do jogador (shaders, resource packs e mods), que vai para o Pacote pros amigos — nunca para
// a pasta do servidor.

// O que o Explorar instalou, na pasta do servidor.
const ARQUIVO = 'hubsquare-explorar.json'
const ZIP = /\.zip$/i

interface Salvo {
  projetoId: string
  versaoId: string
  titulo: string
  data: string // date_published da versão, para saber se há uma mais nova
  arquivo: string
  versao?: string // version_number (desde a Fase 23.2)
  instalado?: string // ISO, quando o app instalou (desde a Fase 23.2)
  fonte?: Fonte // sem valor: Modrinth (datapacks do CurseForge desde a Fase 24)
}

export interface EstadoExplorar {
  datapacks: (Salvo & { mundo: string })[]
  amigos: (Salvo & {
    tipo: TipoConteudo
    sha1: string
    sha512: string
    url: string
    tamanho: number
  })[]
  resourcePack: (Salvo & { url: string; sha1: string }) | null
}

export async function lerEstado(info: InfoServidor): Promise<EstadoExplorar> {
  try {
    const d = JSON.parse(await readFile(join(info.pasta, ARQUIVO), 'utf8'))
    return {
      datapacks: Array.isArray(d.datapacks) ? d.datapacks : [],
      amigos: Array.isArray(d.amigos) ? d.amigos : [],
      resourcePack: d.resourcePack ?? null
    }
  } catch {
    return { datapacks: [], amigos: [], resourcePack: null }
  }
}

let cadeia: Promise<unknown> = Promise.resolve()

// Uma mudança de cada vez no hubsquare-explorar.json.
function editar<T>(info: InfoServidor, mudar: (e: EstadoExplorar) => Promise<T>): Promise<T> {
  const resultado = cadeia.then(async () => {
    const estado = await lerEstado(info)
    const valor = await mudar(estado)
    await gravarComSeguranca(join(info.pasta, ARQUIVO), JSON.stringify(estado, null, 2))
    return valor
  })
  cadeia = resultado.catch(() => {}) // a fila só não pode parar; quem esperou a tarefa recebe o erro
  return resultado
}

// ---------- Validação do que vem da tela ----------

function exigirId(id: unknown): string {
  if (typeof id === 'string' && /^[\w-]{1,64}$/.test(id)) return id
  throw new ErroApp(tx('p.explorar.projetoInvalidoEscolhaUmDa'))
}

// Projetos do CurseForge e do Hangar são números.
function exigirNumero(id: unknown): number {
  if (typeof id === 'string' && /^\d{1,12}$/.test(id)) return Number(id)
  throw new ErroApp(tx('p.explorar.projetoInvalidoEscolhaUmDa'))
}

function exigirTipo(tipo: unknown): TipoConteudo {
  if (TIPOS_CONTEUDO.includes(tipo as TipoConteudo)) return tipo as TipoConteudo
  throw new ErroApp(tx('p.explorar.tipoDeConteudoInvalidoEscolha'))
}

const ORDENS = ['relevance', 'downloads', 'follows', 'newest', 'updated']
const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' && /^[\w.+-]{1,40}$/.test(v) ? v.slice(0, max) : null

function exigirFonte(fonte: unknown): Fonte {
  if (FONTES.includes(fonte as Fonte)) return fonte as Fonte
  throw new ErroApp(tx('p.explorar.fonteInvalidaEscolhaModrinthCurseforge'))
}

function lerFiltros(f: unknown): FiltrosExplorar {
  const x = (f ?? {}) as Record<string, unknown>
  const fonte = exigirFonte(x.fonte ?? 'modrinth')
  const tipo = exigirTipo(x.tipo)
  if (!TIPOS_POR_FONTE[fonte].includes(tipo)) {
    throw new ErroApp(tx('p.explorar.oNaoTemEsseTipo', { v: NOMES_FONTES[fonte] }))
  }
  return {
    fonte,
    tipo,
    termo: typeof x.termo === 'string' ? x.termo.trim().slice(0, 100) : '',
    versao: texto(x.versao, 40),
    loader: texto(x.loader, 40),
    categorias: Array.isArray(x.categorias)
      ? x.categorias.flatMap((c) => texto(c, 40) ?? []).slice(0, 10)
      : [],
    ambiente: ['servidor', 'jogador', 'ambos'].includes(x.ambiente as string)
      ? (x.ambiente as FiltrosExplorar['ambiente'])
      : null,
    codigoAberto: x.codigoAberto === true,
    esconderInstalados: x.esconderInstalados === true,
    ordem: ORDENS.includes(x.ordem as string) ? (x.ordem as FiltrosExplorar['ordem']) : 'relevance',
    pagina: Number.isInteger(x.pagina) && (x.pagina as number) >= 1 ? (x.pagina as number) : 1,
    tamanho: tamanhoValido(x.tamanho)
  }
}

// ---------- Loaders de cada tipo ----------

const ehDeMods = (info: InfoServidor): boolean => EXTRAS_TIPOS[info.tipo] === 'mods'

// O loader "do servidor" no filtro.
function loadersDoServidor(tipo: TipoConteudo, info: InfoServidor): string[] {
  if (tipo === 'mod' || tipo === 'modpack') return ehDeMods(info) ? [info.tipo] : []
  if (tipo === 'plugin') return info.tipo === 'paper' ? (LOADERS.paper ?? []) : []
  return []
}

// Loaders das versões que servem para o servidor ativo.
function loadersDasVersoes(tipo: TipoConteudo, info: InfoServidor): string[] {
  if (tipo === 'mod' || tipo === 'plugin') {
    return destinoDe(tipo, null, info.tipo, !!info.jogador).destino === 'incompativel'
      ? []
      : (LOADERS[info.tipo] ?? [])
  }
  if (tipo === 'datapack') return ['datapack']
  if (tipo === 'resourcepack') return ['minecraft']
  return [] // shaders (qualquer um) e modpacks
}

// ---------- Opções e busca ----------

export async function opcoesExplorar(tipo: unknown, fonte: unknown): Promise<OpcoesExplorar> {
  const t = exigirTipo(tipo)
  const f = exigirFonte(fonte ?? 'modrinth')
  if (f === 'curseforge') return opcoesCF(t)
  if (f === 'hangar') return opcoesHangar()
  const [categorias, versoes] = await Promise.all([modrinth.categorias(), modrinth.versoesDoJogo()])
  const deTipo = tipoDasCategorias(t)
  return {
    versoes: versoes.filter((v) => v.version_type === 'release').map((v) => v.version),
    categorias: categorias
      .filter((c) => c.project_type === deTipo)
      .map((c) => ({ nome: c.name, grupo: c.header }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nome.localeCompare(b.nome))
  }
}

// Projetos que o app já pôs no servidor, no mundo ou no Pacote pros amigos.
async function instalados(
  info: InfoServidor,
  tipo: TipoConteudo,
  fonte: Fonte
): Promise<Set<string>> {
  const estado = await lerEstado(info)
  // O Pacote pros amigos e o resource pack do servidor são só do Modrinth.
  const ids = new Set(
    fonte === 'modrinth' ? estado.amigos.filter((a) => a.tipo === tipo).map((a) => a.projetoId) : []
  )
  if ((tipo === 'mod' || tipo === 'plugin') && EXTRAS_TIPOS[info.tipo]) {
    for (const r of await registrosDoApp(info)) if (r.fonte === fonte) ids.add(r.projetoId)
  }
  if (tipo === 'datapack') {
    const nivel = await nivelDoMundo(info.pasta).catch(() => null)
    for (const d of estado.datapacks) {
      if (
        (d.fonte ?? 'modrinth') === fonte &&
        d.mundo === nivel &&
        existsSync(join(info.pasta, d.mundo, 'datapacks', d.arquivo))
      )
        ids.add(d.projetoId)
    }
  }
  if (tipo === 'resourcepack' && estado.resourcePack && fonte === 'modrinth')
    ids.add(estado.resourcePack.projetoId)
  return ids
}

let buscaAtual: AbortController | null = null

export async function buscarExplorar(
  info: InfoServidor,
  filtros: unknown
): Promise<ResultadoExplorar> {
  const f = lerFiltros(filtros)
  // Fase V9: uma busca nova cancela os pedidos da anterior que ainda não chegaram.
  buscaAtual?.abort()
  const controle = new AbortController()
  buscaAtual = controle
  const ids = await instalados(info, f.tipo, f.fonte)
  // Só a página aberta: um pedido, ou mais se o tamanho passa do máximo da API.
  const pedidos = pedidosDaPagina(f.fonte, f.pagina, f.tamanho)
  if (f.fonte === 'curseforge') return buscarCF(f, ids, info, pedidos, controle.signal)
  if (f.fonte === 'hangar') return buscarHangar(f, ids, pedidos, controle.signal)
  const facets = facetsExplorar(f, loadersDoServidor(f.tipo, info), [...ids])
  const partes = await Promise.all(
    pedidos.map((p) =>
      modrinth.buscar(f.termo, facets, p.offset, p.limit, f.ordem, controle.signal)
    )
  )
  return {
    total: partes[0]?.total_hits ?? 0,
    itens: partes
      .flatMap((r) => r.hits)
      .map((h) => ({
        fonte: 'modrinth' as const,
        id: h.project_id,
        titulo: h.title,
        autor: h.author,
        descricao: h.description,
        downloads: h.downloads,
        seguidores: h.follows ?? 0,
        icone: h.icon_url || null,
        // Loaders aparecem no filtro; aqui ficam só as categorias.
        categorias: (h.display_categories ?? h.categories ?? []).filter(
          (c) => !LOADERS_TODOS.has(c)
        ),
        ambiente: ambienteDe(h.environment, h.server_side, h.client_side),
        instalado: ids.has(h.project_id)
      }))
  }
}

const LOADERS_TODOS = new Set([
  'fabric',
  'forge',
  'neoforge',
  'quilt',
  'paper',
  'spigot',
  'bukkit',
  'purpur',
  'folia',
  'datapack',
  'minecraft',
  'iris',
  'optifine',
  'canvas',
  'vanilla',
  'velocity',
  'bungeecord',
  'waterfall',
  'sponge'
])

// ---------- Detalhes ----------

const versaoBasica = (s: Salvo): { id: string; version_type: string; date_published: string } => ({
  id: s.versaoId,
  version_type: 'release',
  date_published: s.data
})

function comparar(salvo: Salvo | undefined, nova: modrinth.Versao | undefined): EstadoInstalacao {
  if (!salvo) return 'instalar'
  return nova && ehMaisNova(nova, versaoBasica(salvo)) ? 'atualizar' : 'instalado'
}

export async function fraseDe(
  destino: DestinoProjeto,
  tipo: TipoConteudo,
  info: InfoServidor,
  motivo?: string
): Promise<string> {
  if (info.jogador) {
    switch (destino) {
      case 'servidor':
        return tx('p.explorar.vaiParaAPastaMods', { nome: info.nome })
      case 'amigos':
        return tx('p.explorar.vaiParaAPastaDa', {
          pastaNoPacote: pastaNoPacote(tipo),
          nome: info.nome
        })
      case 'modpack':
        return tx('p.explorar.criaUmaInstalacaoNovaCom')
      default:
        return motivo ?? tx('p.explorar.naoServeParaEstaInstalacao')
    }
  }
  switch (destino) {
    case 'servidor':
      return tx('p.explorar.vaiParaAPastaDo', { v: EXTRAS_TIPOS[info.tipo], nome: info.nome })
    case 'datapack': {
      const nivel = await nivelDoMundo(info.pasta).catch(() => 'world')
      return tx('p.explorar.vaiParaAPastaDatapacks', { nivel })
    }
    case 'resourcepack':
      return tx('p.explorar.comoResourcePackDoServidor')
    case 'amigos':
      return tipo === 'shader'
        ? tx('p.explorar.oServidorNaoUsaShaders')
        : tx('p.explorar.eSoDoJogadorO')
    case 'modpack':
      return tx('p.explorar.criaUmServidorNovoCom')
    case 'incompativel':
      return motivo ?? tx('p.explorar.naoServeParaEsteServidor')
  }
}

const ROTULOS_LINKS = () =>
  [
    ['source_url', tx('p.explorar.codigoFonte')],
    ['wiki_url', tx('p.explorar.wiki')],
    ['discord_url', tx('p.explorar.discordDoProjeto')],
    ['issues_url', tx('p.explorar.relatarProblemas')]
  ] as const

function ehHttps(url: string | null): url is string {
  try {
    return !!url && new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export async function detalhesProjeto(
  info: InfoServidor,
  id: unknown,
  tipo: unknown,
  fonte: unknown = 'modrinth'
): Promise<DetalhesProjeto> {
  const t = exigirTipo(tipo)
  const f = exigirFonte(fonte)
  if (f !== 'modrinth') {
    const n = exigirNumero(id)
    if (f === 'hangar') return detalhesHangar(info, n, fraseDe)
    return detalhesCF(info, n, t, fraseDe, (await lerEstado(info)).datapacks)
  }
  const p = await modrinth.projeto(exigirId(id))
  const ambiente = ambienteDe(p.environment, p.server_side, p.client_side)
  const { destino, motivo } = destinoDe(t, ambiente, info.tipo, !!info.jogador)
  const loaders = destino === 'amigos' && t === 'mod' ? [info.tipo] : loadersDasVersoes(t, info)
  const lista = (
    await modrinth.versoes(p.id, loaders, t === 'modpack' ? undefined : info.versao, true)
  )
    .filter((v) => !v.status || v.status === 'listed')
    .sort((a, b) => Date.parse(b.date_published) - Date.parse(a.date_published))
  const escolhida = escolherVersao(lista)

  // Dependências da versão que vai ser instalada.
  const deps = (escolhida?.dependencies ?? []).filter(
    (d) => d.project_id && (d.dependency_type === 'required' || d.dependency_type === 'optional')
  )
  const projetosDeps = await modrinth.projetos([...new Set(deps.map((d) => d.project_id!))])

  const estado = await lerEstado(info)
  const noPacote = estado.amigos.find((a) => a.projetoId === p.id)
  let situacao: EstadoInstalacao = 'instalar'
  let arquivo: string | null = null
  if (destino === 'servidor') {
    const r = (await registrosDoApp(info)).find((i) => i.projetoId === p.id)
    if (r) {
      arquivo = r.arquivo
      const atual = r.versaoId === escolhida?.id ? escolhida : await modrinth.versao(r.versaoId)
      situacao = escolhida && atual && ehMaisNova(escolhida, atual) ? 'atualizar' : 'instalado'
    }
  } else if (destino === 'datapack') {
    const nivel = await nivelDoMundo(info.pasta).catch(() => null)
    const d = estado.datapacks.find(
      (x) =>
        x.projetoId === p.id &&
        x.mundo === nivel &&
        existsSync(join(info.pasta, x.mundo, 'datapacks', x.arquivo))
    )
    situacao = comparar(d, escolhida)
  } else if (destino === 'resourcepack') {
    const rp = estado.resourcePack?.projetoId === p.id ? estado.resourcePack : undefined
    situacao = comparar(rp, escolhida)
  } else if (destino === 'amigos') situacao = comparar(noPacote, escolhida)

  const obrigatorio =
    estado.resourcePack?.projetoId === p.id &&
    (await lerArquivoPropriedades(info.pasta)).get('require-resource-pack') === 'true'

  return {
    fonte: 'modrinth',
    baixarPeloSite: null,
    id: p.id,
    slug: p.slug,
    tipo: t,
    titulo: p.title,
    descricao: p.description,
    corpo: p.body ?? '',
    icone: p.icon_url || null,
    // A tela só carrega imagens do CDN do Modrinth.
    galeria: [...(p.gallery ?? [])]
      .sort((a, b) => a.ordering - b.ordering)
      .filter((g) => urlDoModrinth(g.url))
      .map((g) => ({ url: g.url, titulo: g.title, descricao: g.description })),
    licenca: { id: p.license.id, nome: p.license.name, url: p.license.url },
    links: ROTULOS_LINKS().flatMap(([campo, rotulo]) => {
      const url = p[campo]
      return ehHttps(url) ? [{ rotulo, url }] : []
    }),
    downloads: p.downloads,
    seguidores: p.followers,
    ambiente,
    versoes: lista.slice(0, 20).map((v) => ({
      id: v.id,
      nome: v.name ?? v.version_number,
      numero: v.version_number,
      tipo: v.version_type,
      data: v.date_published,
      jogos: v.game_versions ?? [],
      loaders: v.loaders ?? [],
      changelog: v.changelog ? v.changelog.slice(0, 20_000) : null
    })),
    dependencias: deps.flatMap((d) => {
      const dp = projetosDeps.get(d.project_id!)
      return dp
        ? [
            {
              id: dp.id,
              titulo: dp.title,
              icone: dp.icon_url || null,
              obrigatoria: d.dependency_type === 'required'
            }
          ]
        : []
    }),
    destino,
    frase: await fraseDe(destino, t, info, motivo),
    compat: info.jogador ? await compatNoJogo(info, t, ambiente, p.title, escolhida) : undefined,
    estado: situacao,
    noPacote: !!noPacote,
    obrigatorio,
    arquivo
  }
}

// ---------- Escolher o arquivo ----------

async function versaoParaServidor(
  id: string,
  loaders: string[],
  info: InfoServidor,
  extensao: RegExp
): Promise<{ versao: modrinth.Versao; arquivo: modrinth.ArquivoVersao; titulo: string }> {
  const versao = escolherVersao(await modrinth.versoes(id, loaders, info.versao))
  const titulo = (await modrinth.projetos([id])).get(id)?.title ?? id
  if (!versao) {
    throw new ErroApp(tx('p.explorar.naoTemVersaoParaO', { titulo, versao: info.versao }))
  }
  const candidatos = versao.files.filter((f) => extensao.test(f.filename))
  const arquivo = candidatos.find((f) => f.primary) ?? candidatos[0]
  if (!arquivo || !nomeSeguro(arquivo.filename, extensao) || !urlDoModrinth(arquivo.url)) {
    throw new ErroApp(tx('p.explorar.temUmArquivoQueO', { titulo }))
  }
  return { versao, arquivo, titulo }
}

const salvo = (
  id: string,
  titulo: string,
  v: modrinth.Versao,
  a: modrinth.ArquivoVersao
): Salvo => ({
  projetoId: id,
  versaoId: v.id,
  titulo,
  data: v.date_published,
  arquivo: a.filename,
  versao: v.version_number,
  instalado: new Date().toISOString()
})

// ---------- Datapacks ----------

export async function instalarDatapack(
  info: InfoServidor,
  id: unknown,
  fonte: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<void> {
  const f = exigirFonte(fonte ?? 'modrinth')
  let projetoId: string
  let novo: Salvo
  let url: string
  let checksum: Checksum
  if (f === 'curseforge') {
    const { m, a } = await datapackCF(info, exigirNumero(id))
    const sha1 = cf.sha1Do(a)
    if (!a.downloadUrl || !downloadPermitido(a.downloadUrl, 'curseforge') || !sha1)
      throw new ErroApp(tx('p.explorar.temUmArquivoQueO2', { name: m.name }))
    if (!nomeSeguro(a.fileName, ZIP))
      throw new ErroApp(tx('p.explorar.naoEUmDatapackEm', { name: m.name }))
    projetoId = String(m.id)
    url = a.downloadUrl
    checksum = { algoritmo: 'sha1', valor: sha1 }
    novo = {
      projetoId,
      versaoId: String(a.id),
      titulo: m.name,
      data: a.fileDate,
      arquivo: a.fileName,
      versao: a.displayName,
      instalado: new Date().toISOString(),
      fonte: 'curseforge'
    }
  } else if (f === 'modrinth') {
    projetoId = exigirId(id)
    const { versao, arquivo, titulo } = await versaoParaServidor(projetoId, ['datapack'], info, ZIP)
    url = arquivo.url
    checksum = { algoritmo: 'sha512', valor: arquivo.hashes.sha512 }
    novo = salvo(projetoId, titulo, versao, arquivo)
  } else throw new ErroApp(tx('p.explorar.oHangarNaoTemDatapacks'))
  const mundo = await nivelDoMundo(info.pasta)
  const pasta = join(info.pasta, mundo, 'datapacks')
  await mkdir(pasta, { recursive: true })
  await baixar(
    url,
    join(pasta, novo.arquivo),
    checksum,
    `Baixando ${novo.titulo} ${novo.versao}`,
    aoProgredir,
    undefined,
    novo.titulo
  )
  const mesmo = (d: Salvo & { mundo: string }): boolean =>
    d.projetoId === projetoId && d.mundo === mundo && (d.fonte ?? 'modrinth') === f
  await editar(info, async (e) => {
    // Atualização: a versão antiga sai (se o nome do arquivo mudou).
    for (const velho of e.datapacks.filter(mesmo)) {
      if (velho.arquivo !== novo.arquivo && nomeSeguro(velho.arquivo, ZIP))
        await rm(join(pasta, velho.arquivo), { force: true })
    }
    e.datapacks = e.datapacks.filter((d) => !mesmo(d))
    e.datapacks.push({ ...novo, mundo })
  })
}

// Com o servidor ligado, espera ele desligar; o arquivo vai para Removidos recentemente.
export async function removerDatapack(info: InfoServidor, id: unknown): Promise<boolean> {
  const projetoId = exigirId(id)
  const mundo = await nivelDoMundo(info.pasta)
  let agendado = false
  for (const d of (await lerEstado(info)).datapacks) {
    if (d.projetoId !== projetoId || d.mundo !== mundo || !nomeSeguro(d.arquivo, ZIP)) continue
    if (!existsSync(join(info.pasta, mundo, 'datapacks', d.arquivo))) continue
    agendado =
      (await removerArquivo(info, `${mundo}/datapacks/${d.arquivo}`, {
        titulo: d.titulo,
        categoria: 'datapack'
      })) || agendado
  }
  return agendado
}

// ---------- Resource pack do servidor ----------

// Grava a URL oficial do Modrinth e o SHA-1 no server.properties.
export async function usarResourcePack(
  info: InfoServidor,
  id: unknown,
  obrigatorio: unknown
): Promise<void> {
  const projetoId = exigirId(id)
  const { versao, arquivo, titulo } = await versaoParaServidor(projetoId, ['minecraft'], info, ZIP)
  await editar(info, async (e) => {
    await gravarPropriedades(info.pasta, {
      'resource-pack': arquivo.url,
      'resource-pack-sha1': arquivo.hashes.sha1,
      'require-resource-pack': String(obrigatorio === true)
    })
    e.resourcePack = {
      ...salvo(projetoId, titulo, versao, arquivo),
      url: arquivo.url,
      sha1: arquivo.hashes.sha1
    }
  })
}

// O que havia antes, para o "Desfazer".
export interface ResourcePackAnterior {
  propriedades: Record<string, string>
  registro: EstadoExplorar['resourcePack']
}

const CHAVES_RP = ['resource-pack', 'resource-pack-sha1', 'require-resource-pack']

export async function pararResourcePack(info: InfoServidor): Promise<ResourcePackAnterior> {
  return editar(info, async (e) => {
    const atuais = await lerArquivoPropriedades(info.pasta)
    const anterior = {
      propriedades: Object.fromEntries(CHAVES_RP.map((c) => [c, atuais.get(c) ?? ''])),
      registro: e.resourcePack
    }
    await gravarPropriedades(info.pasta, {
      'resource-pack': '',
      'resource-pack-sha1': '',
      'require-resource-pack': 'false'
    })
    e.resourcePack = null
    return anterior
  })
}

export async function restaurarResourcePack(info: InfoServidor, dados: unknown): Promise<void> {
  const d = dados as ResourcePackAnterior
  const url = d?.propriedades?.['resource-pack']
  // Só devolve um link https (o que o app gravou ou o que estava lá antes).
  if (typeof url !== 'string' || (url && !ehHttps(url))) {
    throw new ErroApp(tx('p.explorar.naoDeuParaRestaurarEsse'))
  }
  await editar(info, async (e) => {
    await gravarPropriedades(
      info.pasta,
      Object.fromEntries(CHAVES_RP.map((c) => [c, String(d.propriedades[c] ?? '')]))
    )
    e.resourcePack = d.registro ?? null
  })
}

// ---------- Pacote pros amigos ----------

export async function adicionarAosAmigos(
  info: InfoServidor,
  id: unknown,
  tipo: unknown
): Promise<void> {
  const projetoId = exigirId(id)
  const t = exigirTipo(tipo)
  if (t !== 'shader' && t !== 'resourcepack' && t !== 'mod') {
    throw new ErroApp(tx('p.explorar.soShadersResourcePacksE'))
  }
  if (t === 'mod') {
    // Mods que rodam no servidor vão para a pasta mods (e entram no pacote por lá).
    const p = await modrinth.projeto(projetoId)
    if (
      destinoDe(
        'mod',
        ambienteDe(p.environment, p.server_side, p.client_side),
        info.tipo,
        !!info.jogador
      ).destino !== 'amigos'
    ) {
      throw new ErroApp(tx('p.explorar.esteModRodaNoServidor'))
    }
  }
  const loaders = t === 'mod' ? [info.tipo] : t === 'resourcepack' ? ['minecraft'] : []
  const { versao, arquivo, titulo } = await versaoParaServidor(
    projetoId,
    loaders,
    info,
    t === 'mod' ? /\.jar$/i : ZIP
  )
  const deps = await dependenciasDoPack(info, t, versao)
  await editar(info, async (e) => {
    e.amigos = e.amigos.filter((a) => a.projetoId !== projetoId)
    e.amigos.push({
      ...salvo(projetoId, titulo, versao, arquivo),
      tipo: t,
      sha1: arquivo.hashes.sha1,
      sha512: arquivo.hashes.sha512,
      url: arquivo.url,
      tamanho: arquivo.size
    })
  })
  if (info.jogador) {
    const registro = (await lerEstado(info)).amigos.find((a) => a.projetoId === projetoId)!
    await baixarParaJogo(info, registro)
    const doShader = t === 'shader' ? modDeShader(info.tipo) : null
    await garantirModsNoJogo(info, [...deps, ...(doShader ? [doShader.id] : [])])
  } else {
    // Pacote pros amigos: mods só do jogador que o pack exige vão junto (ex.: os do Fresh Animations).
    for (const d of deps)
      await adicionarAosAmigos(info, d, 'mod').catch(
        registrarErro('explorar.ts', 'pôr a dependência no Pacote pros amigos')
      )
  }
}

// Mods que um resource pack ou shader exige (dependências obrigatórias da versão escolhida).
async function dependenciasDoPack(
  info: InfoServidor,
  tipo: TipoConteudo,
  versao: modrinth.Versao
): Promise<string[]> {
  if (tipo === 'mod' || !EXTRAS_TIPOS[info.tipo] || EXTRAS_TIPOS[info.tipo] !== 'mods') return []
  const ids = versao.dependencies
    .filter((d) => d.dependency_type === 'required' && d.project_id)
    .map((d) => d.project_id!)
  if (!ids.length) return []
  const projetos = await modrinth.projetos(ids).catch(() => new Map())
  return ids.filter((id) => projetos.get(id)?.project_type === 'mod')
}

// Baixa para a pasta certa da instalação, conferindo o hash.
async function baixarParaJogo(
  info: InfoServidor,
  a: EstadoExplorar['amigos'][number]
): Promise<void> {
  const extensao = a.tipo === 'mod' ? /\.jar$/i : ZIP
  if (!nomeSeguro(a.arquivo, extensao) || !urlDoModrinth(a.url)) {
    throw new ErroApp(tx('p.explorar.temUmArquivoQueO', { titulo: a.titulo }))
  }
  const pasta = join(info.pasta, pastaNoPacote(a.tipo))
  await mkdir(pasta, { recursive: true })
  await baixar(
    a.url,
    join(pasta, a.arquivo),
    { algoritmo: 'sha512', valor: a.sha512 },
    a.titulo,
    () => {},
    undefined,
    a.titulo
  )
}

// Iris/Oculus para shaders e os mods que um pack exige: instala o que falta, com dependências.
async function garantirModsNoJogo(info: InfoServidor, ids: string[]): Promise<void> {
  if (!ids.length) return
  const naPasta = existsSync(join(info.pasta, 'mods'))
    ? (await readdir(join(info.pasta, 'mods'))).map((n) => n.toLowerCase())
    : []
  const registros = await registrosDoApp(info)
  for (const ref of ids) {
    const p = await modrinth.projeto(ref)
    if (registros.some((r) => r.projetoId === p.id)) continue
    if (naPasta.some((n) => n.startsWith(p.slug.toLowerCase()))) continue // posto à mão
    const plano = await planejarInstalacao(info, p.id, 'modrinth')
    if (!plano.itens.length) {
      throw new ErroApp(tx('p.explorar.oQueEPrecisoPara', { title: p.title }))
    }
    await instalarPlano(info, plano.token, () => {})
  }
}

async function compatNoJogo(
  info: InfoServidor,
  tipo: TipoConteudo,
  ambiente: ReturnType<typeof ambienteDe>,
  titulo: string,
  escolhida: modrinth.Versao | undefined
): Promise<DetalhesProjeto['compat']> {
  const j = info.jogador!
  const arquivo = escolhida?.files.find((f) => f.primary) ?? escolhida?.files[0]
  const caminho = arquivo ? `${pastaNoPacote(tipo)}/${arquivo.filename}` : ''
  const naPasta = existsSync(join(info.pasta, 'mods'))
    ? await readdir(join(info.pasta, 'mods'))
    : []
  return compatibilidade({
    tipo,
    ambiente,
    loader: info.tipo,
    versao: info.versao,
    temVersao: !!escolhida,
    jogador: j,
    noServidor: !!caminho && j.doServidor.includes(caminho),
    nomes: [arquivo?.filename ?? '', titulo],
    temModDeShader: naPasta.some((n) => /^(iris|oculus)/i.test(n) && n.endsWith('.jar'))
  })
}

// Devolve o que saiu, para o "Desfazer".
export async function removerDosAmigos(
  info: InfoServidor,
  id: unknown
): Promise<EstadoExplorar['amigos'][number] | null> {
  const projetoId = exigirId(id)
  return editar(info, async (e) => {
    const saiu = e.amigos.find((a) => a.projetoId === projetoId) ?? null
    e.amigos = e.amigos.filter((a) => a.projetoId !== projetoId)
    // No jogo do jogador, o arquivo sai junto (o Desfazer baixa de novo, com o hash conferido).
    if (saiu && info.jogador && nomeSeguro(saiu.arquivo, saiu.tipo === 'mod' ? /\.jar$/i : ZIP)) {
      await rm(join(info.pasta, pastaNoPacote(saiu.tipo), saiu.arquivo), { force: true })
    }
    return saiu
  })
}

export async function restaurarAmigo(info: InfoServidor, dados: unknown): Promise<void> {
  const a = dados as EstadoExplorar['amigos'][number]
  if (!a || typeof a.projetoId !== 'string' || !urlDoModrinth(a.url)) {
    throw new ErroApp(tx('p.explorar.naoDeuParaDevolverEsse'))
  }
  await editar(info, async (e) => {
    e.amigos = [...e.amigos.filter((x) => x.projetoId !== a.projetoId), a]
  })
  if (info.jogador) await baixarParaJogo(info, a)
}

// Arquivos extras do .mrpack dos amigos (Fase 17), cada um na pasta certa.
export async function extrasDosAmigos(info: InfoServidor): Promise<ArquivoIndice[]> {
  const { amigos } = await lerEstado(info)
  return amigos.flatMap((a) => {
    const extensao = a.tipo === 'mod' ? /\.jar$/i : ZIP
    if (!nomeSeguro(a.arquivo, extensao) || !urlDoModrinth(a.url)) return []
    // Mods do jogador num servidor que mudou para Paper/Vanilla não servem mais.
    if (a.tipo === 'mod' && !ehDeMods(info)) return []
    return [
      {
        path: `${pastaNoPacote(a.tipo)}/${a.arquivo}`,
        hashes: { sha1: a.sha1, sha512: a.sha512 },
        // Shaders e resource packs o amigo pode desligar ao importar.
        env: { client: a.tipo === 'mod' ? 'required' : 'optional', server: 'unsupported' },
        downloads: [a.url],
        fileSize: a.tamanho
      }
    ]
  })
}
