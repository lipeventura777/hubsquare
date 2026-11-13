import { buscarJson } from './rede'
import { lerChave } from './chaveCurseForge'
import { ErroApp } from './erros'

// API do CurseForge (docs.curseforge.com/rest-api), com a chave do próprio usuário.
// Termos (3rd Party API Terms): não guardar nem fazer cache de dados da API. Por isso nada daqui
// é salvo, exceto o id do projeto e do arquivo que o app instalou (para achar atualizações).
// Arquivos só são baixados quando o autor permite (allowModDistribution e downloadUrl).

const API = 'https://api.curseforge.com/v1'
export const JOGO = 432 // Minecraft

// Classes do Minecraft no CurseForge (ids fixos da plataforma).
export const CLASSES = {
  mod: 6,
  modpack: 4471,
  plugin: 5, // Bukkit Plugins
  datapack: 6945
} as const

export interface ArquivoCF {
  id: number
  modId: number
  displayName: string
  fileName: string
  releaseType: number
  fileDate: string
  fileLength: number
  downloadUrl: string | null // null quando o autor não deixa outros apps baixarem
  gameVersions: string[]
  hashes: { value: string; algo: number }[] // algo 1 = SHA-1
  dependencies: { modId: number; relationType: number }[] // 3 = obrigatória, 2 = opcional
  isAvailable?: boolean
  isServerPack?: boolean
}

export interface ModCF {
  id: number
  classId: number | null
  name: string
  slug: string
  summary: string
  downloadCount: number
  thumbsUpCount?: number
  links: {
    websiteUrl: string | null
    wikiUrl: string | null
    issuesUrl: string | null
    sourceUrl: string | null
  }
  logo: { thumbnailUrl: string | null } | null
  screenshots: { title: string | null; description: string | null; url: string }[]
  authors: { name: string }[]
  categories: { id: number; slug: string; name: string }[]
  allowModDistribution: boolean | null
  dateModified: string
}

async function chave(): Promise<string> {
  const c = await lerChave()
  if (!c) {
    throw new ErroApp('Para usar o CurseForge, cole a sua chave da API em Opções › Integrações.')
  }
  return c
}

async function pedir<T>(
  caminho: string,
  opcoes: { corpo?: unknown; chave?: string } = {}
): Promise<T> {
  const r = await buscarJson<{ data: T }>(`${API}${caminho}`, {
    method: opcoes.corpo ? 'POST' : 'GET',
    headers: {
      'x-api-key': opcoes.chave ?? (await chave()),
      Accept: 'application/json',
      ...(opcoes.corpo ? { 'Content-Type': 'application/json' } : {})
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined
  })
  return r.data
}

// Usado só para conferir a chave antes de guardar.
export async function chaveFunciona(c: string): Promise<boolean> {
  return pedir(`/games/${JOGO}`, { chave: c })
    .then(() => true)
    .catch(() => false)
}

export async function buscar(p: {
  classId: number
  termo: string
  versao: string | null
  loader: number | null
  categoria: number | null
  ordem: number
  indice: number
  limite: number
}): Promise<{ itens: ModCF[]; total: number }> {
  const q = new URLSearchParams({
    gameId: String(JOGO),
    classId: String(p.classId),
    sortField: String(p.ordem),
    sortOrder: p.ordem === 4 ? 'asc' : 'desc', // nome em ordem alfabética
    index: String(p.indice),
    pageSize: String(p.limite)
  })
  if (p.termo) q.set('searchFilter', p.termo)
  if (p.versao) q.set('gameVersion', p.versao)
  // A API só aceita o loader junto com a versão do jogo.
  if (p.loader !== null && p.versao) q.set('modLoaderType', String(p.loader))
  if (p.categoria) q.set('categoryId', String(p.categoria))
  const r = await buscarJson<{ data: ModCF[]; pagination: { totalCount: number } }>(
    `${API}/mods/search?${q}`,
    { headers: { 'x-api-key': await chave(), Accept: 'application/json' } }
  )
  // A API não passa de 10.000 resultados (índice + página).
  return { itens: r.data, total: Math.min(r.pagination.totalCount, 10_000) }
}

export const mod = (id: number): Promise<ModCF> => pedir(`/mods/${id}`)

export async function mods(ids: number[]): Promise<Map<number, ModCF>> {
  if (!ids.length) return new Map()
  const lista = await pedir<ModCF[]>('/mods', { corpo: { modIds: ids } })
  return new Map(lista.map((m) => [m.id, m]))
}

// HTML do autor; a tela sanitiza antes de mostrar.
export const descricao = (id: number): Promise<string> => pedir(`/mods/${id}/description`)

export async function arquivos(
  modId: number,
  versao: string | null,
  loader: number | null
): Promise<ArquivoCF[]> {
  const q = new URLSearchParams({ pageSize: '50' })
  if (versao) q.set('gameVersion', versao)
  if (loader !== null) q.set('modLoaderType', String(loader))
  return pedir(`/mods/${modId}/files?${q}`)
}

export async function arquivosPorIds(ids: number[]): Promise<ArquivoCF[]> {
  if (!ids.length) return []
  return pedir('/mods/files', { corpo: { fileIds: ids } })
}

export const arquivo = (modId: number, fileId: number): Promise<ArquivoCF> =>
  pedir(`/mods/${modId}/files/${fileId}`)

export const notas = (modId: number, fileId: number): Promise<string> =>
  pedir(`/mods/${modId}/files/${fileId}/changelog`)

export async function categorias(classId: number): Promise<{ id: number; name: string }[]> {
  const lista = await pedir<
    { id: number; name: string; classId: number | null; isClass?: boolean }[]
  >(`/categories?gameId=${JOGO}&classId=${classId}`)
  return lista.filter((c) => !c.isClass).map(({ id, name }) => ({ id, name }))
}

export const sha1Do = (a: ArquivoCF): string | undefined =>
  a.hashes.find((h) => h.algo === 1)?.value.toLowerCase()

// Página do arquivo no site, para o "Baixe pelo site".
export function paginaDoArquivo(m: Pick<ModCF, 'links'>, fileId?: number): string | null {
  const base = m.links.websiteUrl
  if (!base?.startsWith('https://')) return null
  return fileId ? `${base.replace(/\/$/, '')}/files/${fileId}` : base
}

// O autor deixa outros apps baixarem? (allowModDistribution falso ou sem downloadUrl: não.)
export function podeBaixar(
  m: Pick<ModCF, 'allowModDistribution'>,
  a: Pick<ArquivoCF, 'downloadUrl'>
): boolean {
  return m.allowModDistribution !== false && !!a.downloadUrl
}
