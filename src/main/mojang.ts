import { ErroApp } from './erros'
import { buscarJson } from './rede'

const MANIFESTO = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

interface Manifesto {
  versions: { id: string; type: string; url: string }[]
}

export interface VersaoMojang {
  javaVersion?: { majorVersion: number }
  downloads: {
    server?: { url: string; sha1: string }
    client?: { url: string; sha1: string; size: number }
  }
  assetIndex?: { url: string }
}

// shortcut: a lista é lida uma vez por sessão; versões novas aparecem ao reabrir o app.
let manifesto: Manifesto | undefined

async function lerManifesto(): Promise<Manifesto> {
  return (manifesto ??= await buscarJson<Manifesto>(MANIFESTO))
}

// Versões release, da mais nova para a mais antiga.
export async function versoesRelease(): Promise<string[]> {
  return (await lerManifesto()).versions.filter((v) => v.type === 'release').map((v) => v.id)
}

export async function detalhesVersao(id: string): Promise<VersaoMojang> {
  const versao = (await lerManifesto()).versions.find((v) => v.id === id)
  if (!versao) throw new ErroApp(`Não encontrei a versão ${id}. Escolha outra versão da lista.`)
  return buscarJson<VersaoMojang>(versao.url)
}

export async function javaDaVersao(id: string): Promise<number> {
  // Versões muito antigas não informam o Java; todas rodam no Java 8.
  return (await detalhesVersao(id)).javaVersion?.majorVersion ?? 8
}
