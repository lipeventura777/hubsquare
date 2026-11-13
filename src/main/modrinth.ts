import { buscarJson } from './rede'

// API v2 do Modrinth (docs.modrinth.com/api). Regras: User-Agent que identifica o app com
// contato, e no máximo 300 pedidos por minuto (o app faz poucos, sempre em lote).
const API = 'https://api.modrinth.com/v2'

// O User-Agent vem de rede.ts (o mesmo do app inteiro).
function cabecalhos(): Record<string, string> {
  return { 'Content-Type': 'application/json' }
}

function get<T>(caminho: string, parametros: Record<string, string> = {}): Promise<T> {
  const consulta = new URLSearchParams(parametros).toString()
  return buscarJson<T>(`${API}${caminho}${consulta ? `?${consulta}` : ''}`, {
    headers: cabecalhos()
  })
}

function post<T>(caminho: string, corpo: unknown): Promise<T> {
  return buscarJson<T>(`${API}${caminho}`, {
    method: 'POST',
    headers: cabecalhos(),
    body: JSON.stringify(corpo)
  })
}

export interface ArquivoVersao {
  hashes: { sha1: string; sha512: string }
  url: string
  filename: string
  primary: boolean
  size: number
}

export interface Versao {
  id: string
  project_id: string
  version_number: string
  version_type: string // release, beta, alpha
  status?: string
  date_published: string
  name?: string
  game_versions?: string[]
  loaders?: string[]
  changelog?: string | null // só com include_changelog
  files: ArquivoVersao[]
  dependencies: {
    project_id: string | null
    version_id: string | null
    dependency_type: string // required, optional, incompatible, embedded
  }[]
}

export interface Projeto {
  id: string
  title: string
  icon_url: string | null
  environment?: string[]
  server_side?: string // antigo, substituído por environment
  client_side?: string
  categories?: string[]
}

export interface ResultadoBuscaApi {
  hits: {
    project_id: string
    title: string
    author: string
    description: string
    downloads: number
    follows?: number
    icon_url: string | null
    environment?: string[]
    server_side?: string
    client_side?: string
    display_categories?: string[]
    versions?: string[] // versões do Minecraft
    categories?: string[] // inclui os loaders
  }[]
  total_hits: number
}

// Sem `ordem`: relevância quando há texto, senão os mais baixados.
export function buscar(
  termo: string,
  facets: string[][],
  offset: number,
  limite: number,
  ordem?: string
): Promise<ResultadoBuscaApi> {
  return get('/search', {
    query: termo,
    facets: JSON.stringify(facets),
    index: ordem ?? (termo ? 'relevance' : 'downloads'),
    offset: String(offset),
    limit: String(limite)
  })
}

// Sem `jogo` (ou sem `loaders`), não filtra por versão do Minecraft (ou por loader).
export function versoes(
  projetoId: string,
  loaders: string[],
  jogo?: string,
  changelog = false
): Promise<Versao[]> {
  return get(`/project/${encodeURIComponent(projetoId)}/version`, {
    ...(loaders.length && { loaders: JSON.stringify(loaders) }),
    ...(jogo && { game_versions: JSON.stringify([jogo]) }),
    include_changelog: String(changelog)
  })
}

export interface ProjetoCompleto extends Projeto {
  slug: string
  project_type: string
  description: string
  body: string
  downloads: number
  followers: number
  license: { id: string; name: string; url: string | null }
  gallery: { url: string; title: string | null; description: string | null; ordering: number }[]
  source_url: string | null
  wiki_url: string | null
  discord_url: string | null
  issues_url: string | null
}

export function projeto(id: string): Promise<ProjetoCompleto> {
  return get(`/project/${encodeURIComponent(id)}`)
}

// Etiquetas mudam pouco: guarda na memória enquanto o app está aberto.
let categoriasEmCache: Promise<{ name: string; project_type: string; header: string }[]> | null =
  null
let versoesEmCache: Promise<{ version: string; version_type: string }[]> | null = null

export function categorias(): Promise<{ name: string; project_type: string; header: string }[]> {
  categoriasEmCache ??= get<{ name: string; project_type: string; header: string }[]>(
    '/tag/category'
  ).catch((e) => {
    categoriasEmCache = null
    throw e
  })
  return categoriasEmCache
}

export function versoesDoJogo(): Promise<{ version: string; version_type: string }[]> {
  versoesEmCache ??= get<{ version: string; version_type: string }[]>('/tag/game_version').catch(
    (e) => {
      versoesEmCache = null
      throw e
    }
  )
  return versoesEmCache
}

export function versao(id: string): Promise<Versao> {
  return get(`/version/${encodeURIComponent(id)}`)
}

export async function projetos(ids: string[]): Promise<Map<string, Projeto>> {
  if (!ids.length) return new Map()
  const lista = await get<Projeto[]>('/projects', { ids: JSON.stringify(ids) })
  return new Map(lista.map((p) => [p.id, p]))
}

// Versão de cada arquivo pelo SHA-1 (arquivos que não são do Modrinth não aparecem).
export async function porHash(hashes: string[]): Promise<Record<string, Versao>> {
  if (!hashes.length) return {}
  return post('/version_files', { hashes, algorithm: 'sha1' })
}

// Versão compatível mais nova de cada arquivo.
export async function atualizacoes(
  hashes: string[],
  loaders: string[],
  jogo: string,
  tipos?: string[]
): Promise<Record<string, Versao>> {
  if (!hashes.length) return {}
  return post('/version_files/update', {
    hashes,
    algorithm: 'sha1',
    loaders,
    game_versions: [jogo],
    ...(tipos && { version_types: tipos })
  })
}
