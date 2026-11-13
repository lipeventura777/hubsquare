import { buscarBytes, buscarJson } from './rede'

// API do Hangar (hangar.papermc.io), o repositório de plugins do PaperMC. Leitura sem chave.
// Algumas versões não têm arquivo no Hangar, só um link externo: essas viram "Baixe pelo site".

const API = 'https://hangar.papermc.io/api/v1'

export const CATEGORIAS_HANGAR = [
  'admin_tools',
  'chat',
  'dev_tools',
  'economy',
  'gameplay',
  'games',
  'protection',
  'role_playing',
  'world_management',
  'misc'
]

export interface ProjetoHangar {
  id: number
  name: string
  namespace: { owner: string; slug: string }
  stats: { downloads: number; stars: number }
  category: string
  description: string
  lastUpdated: string
  avatarUrl: string | null
  settings?: {
    links?: { links?: { name: string; url: string }[] }[]
    license?: { name: string | null; url: string | null; type: string | null }
  }
}

export interface VersaoHangar {
  id: number
  name: string
  createdAt: string
  description: string | null
  channel: { name: string }
  downloads: Record<
    string,
    | {
        fileInfo: { name: string; sizeBytes: number; sha256Hash: string } | null
        externalUrl: string | null
        downloadUrl: string | null
      }
    | undefined
  >
  pluginDependencies: Record<
    string,
    | { name: string; projectId: number | null; required: boolean; externalUrl: string | null }[]
    | undefined
  >
  platformDependencies: Record<string, string[] | undefined>
}

const get = <T>(caminho: string): Promise<T> => buscarJson<T>(`${API}${caminho}`)

export async function buscar(p: {
  termo: string
  versao: string | null
  categoria: string | null
  ordem: string
  offset: number
  limite: number
}): Promise<{ itens: ProjetoHangar[]; total: number }> {
  const q = new URLSearchParams({
    platform: 'PAPER',
    sort: p.ordem,
    limit: String(p.limite),
    offset: String(p.offset)
  })
  if (p.termo) q.set('q', p.termo)
  if (p.versao) q.set('version', p.versao)
  if (p.categoria) q.set('category', p.categoria)
  const r = await get<{ pagination: { count: number }; result: ProjetoHangar[] }>(`/projects?${q}`)
  return { itens: r.result, total: r.pagination.count }
}

// `id`: número do projeto (o Hangar aceita no lugar do nome).
export const projeto = (id: string | number): Promise<ProjetoHangar> =>
  get(`/projects/${encodeURIComponent(String(id))}`)

export async function versoes(id: string | number): Promise<VersaoHangar[]> {
  const r = await get<{ result: VersaoHangar[] }>(
    `/projects/${encodeURIComponent(String(id))}/versions?platform=PAPER&limit=50`
  )
  return r.result
}

// Página principal do projeto, em markdown.
export async function pagina(slug: string): Promise<string> {
  return (await buscarBytes(`${API}/pages/main/${encodeURIComponent(slug)}`)).toString('utf8')
}

export const linkDoProjeto = (p: ProjetoHangar): string =>
  `https://hangar.papermc.io/${encodeURIComponent(p.namespace.owner)}/${encodeURIComponent(p.namespace.slug)}`
