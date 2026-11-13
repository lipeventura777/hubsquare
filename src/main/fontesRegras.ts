// Regras do CurseForge e do Hangar sem rede (testadas em tests/fontesRegras.test.ts).
import type { TipoId } from '../shared/tipos'

// ---------- CurseForge ----------

// ModLoaderType da API do CurseForge.
export const LOADER_CF: Partial<Record<string, number>> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6
}

// Nome que o CurseForge põe em gameVersions de cada arquivo.
export const ETIQUETA_LOADER_CF: Partial<Record<TipoId, string>> = {
  forge: 'Forge',
  fabric: 'Fabric',
  neoforge: 'NeoForge'
}

// Loader do manifest.json de um modpack do CurseForge, ex.: "forge-47.2.0", "neoforge-21.1.77".
export function loaderDoManifest(modLoaders: { id?: unknown; primary?: unknown }[] | undefined): {
  tipo: TipoId
  versao: string
} {
  const lista = Array.isArray(modLoaders) ? modLoaders : []
  const id = String((lista.find((l) => l?.primary) ?? lista[0])?.id ?? '')
  const m = id.match(/^(forge|neoforge|fabric)-([\w.+-]{1,60})$/i)
  if (!m) {
    throw new Error(
      id
        ? `O modpack usa o loader "${id}", que o app ainda não instala (só Forge, NeoForge e Fabric).`
        : 'O modpack não diz qual loader usa.'
    )
  }
  return { tipo: m[1].toLowerCase() as TipoId, versao: m[2] }
}

// O CurseForge marca alguns arquivos com "Client" e/ou "Server" em gameVersions.
export function soDoClienteCF(gameVersions: string[]): boolean {
  return gameVersions.includes('Client') && !gameVersions.includes('Server')
}

interface ArquivoCF {
  id: number
  fileDate: string
  releaseType: number // 1 release, 2 beta, 3 alpha
  gameVersions: string[]
  isAvailable?: boolean
  isServerPack?: boolean
}

// Arquivo que serve para uma das versões do jogo (e o loader, se tiver); o mais novo, preferindo
// release. Plugins Bukkit costumam marcar só a família (1.21): passe as duas.
export function escolherArquivoCF<A extends ArquivoCF>(
  arquivos: A[],
  versoes: string[] | null,
  loader: string | null
): A | undefined {
  const servem = arquivos
    .filter((a) => a.isAvailable !== false && !a.isServerPack)
    .filter((a) => !versoes || a.gameVersions.some((v) => versoes.includes(v)))
    .filter((a) => !loader || a.gameVersions.includes(loader))
    .sort((a, b) => Date.parse(b.fileDate) - Date.parse(a.fileDate))
  return servem.find((a) => a.releaseType === 1) ?? servem[0]
}

// ---------- Hangar ----------

// "1.21.4" → "1.21"; "26.3" → "26.3".
export const familia = (v: string): string => v.split('.').slice(0, 2).join('.')

// O Hangar lista as versões do Paper que o autor marcou; uma da mesma família (1.21.x) também vale.
export function hangarServe(versoes: string[] | undefined, versao: string): boolean {
  const lista = versoes ?? []
  return lista.includes(versao) || lista.some((v) => familia(v) === familia(versao))
}

interface VersaoHangar {
  createdAt: string
  channel: { name: string }
  platformDependencies: Record<string, string[] | undefined>
}

export function escolherVersaoHangar<V extends VersaoHangar>(
  versoes: V[],
  versao: string
): V | undefined {
  const servem = versoes
    .filter((v) => hangarServe(v.platformDependencies.PAPER, versao))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return servem.find((v) => v.channel.name.toLowerCase() === 'release') ?? servem[0]
}
