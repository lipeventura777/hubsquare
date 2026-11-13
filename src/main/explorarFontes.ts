import { imagemPermitida } from '../shared/fontes'
import {
  EXTRAS_TIPOS,
  type DependenciaProjeto,
  type DestinoProjeto,
  type DetalhesProjeto,
  type EstadoInstalacao,
  type FiltrosExplorar,
  type InfoServidor,
  type OpcoesExplorar,
  type ResultadoExplorar,
  type TipoConteudo,
  type VersaoProjeto
} from '../shared/tipos'
import * as cf from './curseforge'
import { ErroApp } from './erros'
import { destinoDe } from './explorarRegras'
import {
  ETIQUETA_LOADER_CF,
  LOADER_CF,
  escolherArquivoCF,
  hangarServe,
  soDoClienteCF
} from './fontesRegras'
import * as hangar from './hangar'
import * as modrinth from './modrinth'
import { registrosDoApp } from './mods'
import { arquivoCF } from './modsFontes'

// Explorar no CurseForge e no Hangar (Fase 24). O resto (Modrinth) fica no explorar.ts.
// Nada do CurseForge é guardado: tudo vem da API na hora (termos da API).

type Frase = (
  d: DestinoProjeto,
  t: TipoConteudo,
  info: InfoServidor,
  motivo?: string
) => Promise<string>

// Mesmas chaves de ordenação do Modrinth, traduzidas para cada fonte.
const ORDEM_CF: Record<string, number> = {
  relevance: 2, // Popularity
  downloads: 6, // TotalDownloads
  follows: 12, // Rating
  newest: 11, // ReleasedDate
  updated: 3 // LastUpdated
}
const ORDEM_HANGAR: Record<string, string> = {
  relevance: '-recent_downloads',
  downloads: '-downloads',
  follows: '-stars',
  newest: '-newest',
  updated: '-updated'
}

const classeCF = (t: TipoConteudo): number => {
  if (t === 'mod' || t === 'modpack' || t === 'plugin' || t === 'datapack') return cf.CLASSES[t]
  throw new ErroApp('O CurseForge, aqui no app, só tem mods, plugins, modpacks e datapacks.')
}

// ---------- Opções e busca ----------

export async function opcoesCF(t: TipoConteudo): Promise<OpcoesExplorar> {
  const [categorias, versoes] = await Promise.all([
    cf.categorias(classeCF(t)),
    modrinth.versoesDoJogo()
  ])
  return {
    versoes: versoes.filter((v) => v.version_type === 'release').map((v) => v.version),
    categorias: categorias
      .map((c) => ({ nome: String(c.id), rotulo: c.name, grupo: 'categories' }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo))
  }
}

export async function opcoesHangar(): Promise<OpcoesExplorar> {
  const versoes = await modrinth.versoesDoJogo()
  return {
    versoes: versoes.filter((v) => v.version_type === 'release').map((v) => v.version),
    categorias: hangar.CATEGORIAS_HANGAR.map((nome) => ({ nome, grupo: 'categories' }))
  }
}

// O "esconder instalados" é feito aqui (essas APIs não filtram por id).
export async function buscarCF(
  f: FiltrosExplorar,
  instalados: Set<string>,
  info: InfoServidor
): Promise<ResultadoExplorar> {
  const loader = f.loader === 'servidor' ? info.tipo : f.loader // "fabric", "forge"...
  const r = await cf.buscar({
    classId: classeCF(f.tipo),
    termo: f.termo,
    versao: f.versao,
    loader: f.tipo === 'mod' || f.tipo === 'modpack' ? (LOADER_CF[loader ?? ''] ?? null) : null,
    categoria: f.categorias[0] ? Number(f.categorias[0]) || null : null,
    ordem: ORDEM_CF[f.ordem] ?? 2,
    indice: Math.min(f.offset, 9_950),
    limite: 24
  })
  return {
    total: r.total,
    itens: r.itens
      .filter((m) => !(f.esconderInstalados && instalados.has(String(m.id))))
      .map((m) => ({
        fonte: 'curseforge' as const,
        id: String(m.id),
        titulo: m.name,
        autor: m.authors[0]?.name ?? '',
        descricao: m.summary,
        downloads: m.downloadCount,
        seguidores: m.thumbsUpCount ?? 0,
        icone: imagemPermitida(m.logo?.thumbnailUrl) ? m.logo!.thumbnailUrl : null,
        categorias: m.categories.map((c) => c.name),
        ambiente: null,
        instalado: instalados.has(String(m.id))
      }))
  }
}

export async function buscarHangar(
  f: FiltrosExplorar,
  instalados: Set<string>
): Promise<ResultadoExplorar> {
  if (f.tipo !== 'plugin') throw new ErroApp('O Hangar só tem plugins para Paper.')
  const r = await hangar.buscar({
    termo: f.termo,
    versao: f.versao,
    categoria: f.categorias[0] ?? null,
    ordem: ORDEM_HANGAR[f.ordem] ?? '-recent_downloads',
    offset: f.offset,
    limite: 24
  })
  return {
    total: r.total,
    itens: r.itens
      .filter((p) => !(f.esconderInstalados && instalados.has(String(p.id))))
      .map((p) => ({
        fonte: 'hangar' as const,
        id: String(p.id),
        titulo: p.name,
        autor: p.namespace.owner,
        descricao: p.description,
        downloads: p.stats.downloads,
        seguidores: p.stats.stars,
        icone: imagemPermitida(p.avatarUrl) ? p.avatarUrl : null,
        categorias: [p.category],
        ambiente: null,
        instalado: instalados.has(String(p.id))
      }))
  }
}

// ---------- Detalhes ----------

const https = (url: string | null | undefined): url is string => !!url?.startsWith('https://')

// Ids de arquivo/versão dessas fontes só crescem: id maior = mais novo.
function estadoPorId(
  instaladoId: string | undefined,
  novoId: number | undefined
): EstadoInstalacao {
  if (instaladoId === undefined) return 'instalar'
  return novoId !== undefined && novoId > Number(instaladoId) ? 'atualizar' : 'instalado'
}

const NOMES_TIPO_CF: Record<number, string> = { 1: 'release', 2: 'beta', 3: 'alpha' }

export async function detalhesCF(
  info: InfoServidor,
  id: number,
  t: TipoConteudo,
  frase: Frase,
  datapacks: { projetoId: string; versaoId: string; fonte?: string }[]
): Promise<DetalhesProjeto> {
  classeCF(t)
  const m = await cf.mod(id)
  const corpo = await cf.descricao(id).catch(() => m.summary)
  // Modpack: qualquer arquivo; o resto: só os que servem para o servidor ativo.
  const todos =
    t === 'modpack'
      ? (await cf.arquivos(id, null, null)).filter((a) => !a.isServerPack)
      : await cf.arquivos(
          id,
          t === 'plugin' ? null : info.versao,
          t === 'mod' ? (LOADER_CF[info.tipo] ?? null) : null
        )
  const etiqueta = t === 'mod' ? (ETIQUETA_LOADER_CF[info.tipo] ?? null) : null
  const servem = todos
    .filter((a) => a.isAvailable !== false)
    .filter((a) => t === 'modpack' || !etiqueta || a.gameVersions.includes(etiqueta))
    .sort((a, b) => Date.parse(b.fileDate) - Date.parse(a.fileDate))
  const escolhida =
    t === 'mod' || t === 'plugin'
      ? await arquivoCF(info, id)
      : escolherArquivoCF(servem, t === 'modpack' ? null : [info.versao], null)

  const ambiente = escolhida && soDoClienteCF(escolhida.gameVersions) ? 'jogador' : null
  let { destino, motivo } = destinoDe(t, ambiente, info.tipo, !!info.jogador)
  // O Pacote pros amigos (.mrpack) só aceita links do Modrinth.
  if (destino === 'amigos') {
    destino = 'incompativel'
    motivo =
      'É só do jogador, e o Pacote pros amigos só aceita arquivos do Modrinth. Baixe pelo site e mande para os amigos.'
  }

  let situacao: EstadoInstalacao = 'instalar'
  let arquivo: string | null = null
  if (destino === 'servidor') {
    const r = (await registrosDoApp(info)).find(
      (x) => x.fonte === 'curseforge' && x.projetoId === String(id)
    )
    arquivo = r?.arquivo ?? null
    situacao = estadoPorId(r?.versaoId, escolhida?.id)
  } else if (destino === 'datapack') {
    const d = datapacks.find((x) => x.fonte === 'curseforge' && x.projetoId === String(id))
    situacao = estadoPorId(d?.versaoId, escolhida?.id)
  }

  const deps = (escolhida?.dependencies ?? []).filter(
    (d) => d.relationType === 3 || d.relationType === 2
  )
  const modsDeps = await cf.mods([...new Set(deps.map((d) => d.modId))]).catch(() => new Map())
  const lista = servem.slice(0, 10)
  const notas = await Promise.all(lista.map((a) => cf.notas(id, a.id).catch(() => null)))

  return {
    fonte: 'curseforge',
    id: String(m.id),
    slug: m.slug,
    tipo: t,
    titulo: m.name,
    descricao: m.summary,
    corpo,
    icone: imagemPermitida(m.logo?.thumbnailUrl) ? m.logo!.thumbnailUrl : null,
    galeria: m.screenshots
      .filter((g) => imagemPermitida(g.url))
      .map((g) => ({ url: g.url, titulo: g.title, descricao: g.description })),
    // A API do CurseForge não informa a licença.
    licenca: {
      id: '',
      nome: 'Veja na página do projeto',
      url: https(m.links.websiteUrl) ? m.links.websiteUrl : null
    },
    links: [
      ['sourceUrl', 'Código-fonte'],
      ['wikiUrl', 'Wiki'],
      ['issuesUrl', 'Relatar problemas'],
      ['websiteUrl', 'Página no CurseForge']
    ].flatMap(([campo, rotulo]) => {
      const url = m.links[campo as keyof cf.ModCF['links']]
      return https(url) ? [{ rotulo, url }] : []
    }),
    downloads: m.downloadCount,
    seguidores: m.thumbsUpCount ?? 0,
    ambiente,
    versoes: lista.map((a, i): VersaoProjeto => ({
      id: String(a.id),
      nome: a.displayName,
      numero: a.displayName,
      tipo: NOMES_TIPO_CF[a.releaseType] ?? 'release',
      data: a.fileDate,
      jogos: a.gameVersions.filter((v) => /^\d/.test(v)),
      loaders: a.gameVersions.filter((v) => !/^\d/.test(v)).map((v) => v.toLowerCase()),
      changelog: notas[i]?.slice(0, 20_000) ?? null
    })),
    dependencias: deps.flatMap((d): DependenciaProjeto[] => {
      const dm = modsDeps.get(d.modId)
      return dm
        ? [
            {
              id: String(dm.id),
              titulo: dm.name,
              icone: imagemPermitida(dm.logo?.thumbnailUrl) ? dm.logo.thumbnailUrl : null,
              obrigatoria: d.relationType === 3
            }
          ]
        : []
    }),
    destino,
    frase: await frase(destino, t, info, motivo),
    estado: situacao,
    noPacote: false,
    obrigatorio: false,
    arquivo,
    // O autor não deixa outros apps baixarem: só o link da página do arquivo.
    baixarPeloSite:
      escolhida && destino !== 'incompativel' && !cf.podeBaixar(m, escolhida)
        ? cf.paginaDoArquivo(m, escolhida.id)
        : null
  }
}

export async function detalhesHangar(
  info: InfoServidor,
  id: number,
  frase: Frase
): Promise<DetalhesProjeto> {
  const [p, versoes] = await Promise.all([hangar.projeto(id), hangar.versoes(id)])
  const corpo = await hangar.pagina(p.namespace.slug).catch(() => p.description)
  const servem = versoes
    .filter((v) => hangarServe(v.platformDependencies.PAPER, info.versao))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const escolhida = servem.find((v) => v.channel.name.toLowerCase() === 'release') ?? servem[0]
  const { destino, motivo } = destinoDe('plugin', null, info.tipo, !!info.jogador)

  const r =
    destino === 'servidor' && EXTRAS_TIPOS[info.tipo]
      ? (await registrosDoApp(info)).find((x) => x.fonte === 'hangar' && x.projetoId === String(id))
      : undefined
  const deps = escolhida?.pluginDependencies.PAPER ?? []
  const projetosDeps = await Promise.all(
    deps.map((d) => (d.projectId !== null ? hangar.projeto(d.projectId).catch(() => null) : null))
  )
  const dl = escolhida?.downloads.PAPER
  const licenca = p.settings?.license

  return {
    fonte: 'hangar',
    id: String(p.id),
    slug: `${p.namespace.owner}/${p.namespace.slug}`,
    tipo: 'plugin',
    titulo: p.name,
    descricao: p.description,
    corpo,
    icone: imagemPermitida(p.avatarUrl) ? p.avatarUrl : null,
    galeria: [],
    licenca: {
      id: licenca?.type ?? '',
      nome: licenca?.name || licenca?.type || 'Não informada',
      url: https(licenca?.url) ? licenca!.url : null
    },
    links: [
      ...(p.settings?.links ?? [])
        .flatMap((g) => g.links ?? [])
        .flatMap((l) => (https(l.url) ? [{ rotulo: l.name, url: l.url }] : [])),
      { rotulo: 'Página no Hangar', url: hangar.linkDoProjeto(p) }
    ],
    downloads: p.stats.downloads,
    seguidores: p.stats.stars,
    ambiente: null,
    versoes: servem.slice(0, 20).map((v) => ({
      id: String(v.id),
      nome: v.name,
      numero: v.name,
      tipo: v.channel.name.toLowerCase() === 'release' ? 'release' : 'beta',
      data: v.createdAt,
      jogos: v.platformDependencies.PAPER ?? [],
      loaders: ['paper'],
      changelog: v.description ? v.description.slice(0, 20_000) : null
    })),
    dependencias: deps.map((d, i) => {
      const dp = projetosDeps[i]
      return {
        id: String(d.projectId ?? d.name),
        titulo: dp?.name ?? d.name,
        icone: dp && imagemPermitida(dp.avatarUrl) ? dp.avatarUrl : null,
        obrigatoria: d.required
      }
    }),
    destino,
    frase: await frase(destino, 'plugin', info, motivo),
    estado: estadoPorId(r?.versaoId, escolhida?.id),
    noPacote: false,
    obrigatorio: false,
    arquivo: r?.arquivo ?? null,
    baixarPeloSite:
      escolhida && destino === 'servidor' && (!dl?.downloadUrl || !dl.fileInfo)
        ? https(dl?.externalUrl)
          ? dl!.externalUrl
          : hangar.linkDoProjeto(p)
        : null
  }
}

// Datapack do CurseForge que serve no mundo ativo (só se o autor deixa baixar).
export async function datapackCF(
  info: InfoServidor,
  id: number
): Promise<{ m: cf.ModCF; a: cf.ArquivoCF }> {
  const [m, lista] = await Promise.all([cf.mod(id), cf.arquivos(id, info.versao, null)])
  const a = escolherArquivoCF(lista, [info.versao], null)
  if (!a) throw new ErroApp(`"${m.name}" não tem versão para o Minecraft ${info.versao}.`)
  if (!cf.podeBaixar(m, a)) {
    throw new ErroApp(
      `O autor de "${m.name}" não deixa outros apps baixarem esse arquivo. Baixe pelo site e coloque na pasta datapacks do mundo.`,
      cf.paginaDoArquivo(m, a.id) ?? undefined
    )
  }
  return { m, a }
}
