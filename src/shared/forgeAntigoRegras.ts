import { compararVersoes } from './versoes'

// Fase F1: Forge de 1.7.10 até antes da 1.12.2. Os instaladores dessas versões não têm
// --installClient e o nome no maven às vezes tem um sufixo (ex.: 1.7.10-10.13.4.1614-1.7.10).
// Pesquisa e plano em docs/forge-antigo.md; testado em tests/forgeAntigoRegras.test.ts.

export const FORGE_MAIS_ANTIGO = '1.7.10'
const MAVEN = 'https://maven.minecraftforge.net/'
const MOJANG = 'https://libraries.minecraft.net/'
// Só os dois sites oficiais (o Forge antigo também usava files.minecraftforge.net/maven).
const BASES: Record<string, string> = {
  'https://maven.minecraftforge.net/': MAVEN,
  'http://maven.minecraftforge.net/': MAVEN,
  'https://files.minecraftforge.net/maven/': MAVEN,
  'http://files.minecraftforge.net/maven/': MAVEN,
  'https://libraries.minecraft.net/': MOJANG
}

// O 1.12.2 em diante usa o instalador novo (fluxo de sempre).
export const ehForgeAntigo = (mc: string): boolean =>
  compararVersoes(mc, FORGE_MAIS_ANTIGO) >= 0 && compararVersoes(mc, '1.12.2') < 0

// Abaixo do 1.7.10 o app não tem um caminho confiável: continua recusado.
export const forgeSemSuporte = (loader: string, mc: string): boolean =>
  loader === 'forge' && compararVersoes(mc, FORGE_MAIS_ANTIGO) < 0

// As versões listadas no maven-metadata.xml do Forge.
export function versoesDoMetadata(xml: string): string[] {
  return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1].trim())
}

// O nome do build no maven: "<mc>-<forge>" ou com um sufixo ("-1.7.10"). null: não existe.
export function nomeNoMaven(versoes: string[], mc: string, forge: string): string | null {
  const base = `${mc}-${forge}`
  return versoes.find((v) => v === base) ?? versoes.find((v) => v.startsWith(`${base}-`)) ?? null
}

export const urlDoMaven = (nome: string, tipo: 'installer' | 'universal'): string =>
  `${MAVEN}net/minecraftforge/forge/${nome}/forge-${nome}-${tipo}.jar`

export interface BibliotecaAntiga {
  nome: string // "grupo:artefato:versão"
  caminho: string // em .minecraft/libraries
  url: string // só nos dois sites oficiais
  sha1s: string[] // do install_profile.json (para quando o site não tem o .sha1)
}

export interface PerfilAntigo {
  id: string // a versão no launcher (ex.: 1.7.10-Forge10.13.4.1614-1.7.10)
  versionInfo: Record<string, unknown>
  bibliotecas: BibliotecaAntiga[]
}

const parte = /^[\w.+-]{1,80}$/
const seguro = (s: string): boolean => parte.test(s) && !s.includes('..')

function caminhoMaven(nome: string): string {
  const pedacos = nome.split(':')
  if (pedacos.length !== 3 || !pedacos.every(seguro)) {
    throw new Error(`biblioteca com nome estranho: ${nome}`)
  }
  const [grupo, artefato, versao] = pedacos
  return `${grupo.replace(/\./g, '/')}/${artefato}/${versao}/${artefato}-${versao}.jar`
}

// Lê o install_profile.json de um instalador antigo. O Forge em si (sem endereço próprio: no
// maven só existe o "-universal.jar") passa a apontar para o universal do build `nomeMaven`.
export function lerPerfilAntigo(texto: string, nomeMaven: string): PerfilAntigo {
  const perfil = JSON.parse(texto) as { versionInfo?: Record<string, unknown> }
  const v = perfil.versionInfo
  if (!v || typeof v.id !== 'string' || !seguro(v.id) || !Array.isArray(v.libraries)) {
    throw new Error('install_profile.json sem versionInfo')
  }
  if (typeof v.inheritsFrom !== 'string' || typeof v.mainClass !== 'string') {
    throw new Error('versionInfo sem inheritsFrom ou mainClass')
  }
  const bibliotecas = (v.libraries as Record<string, unknown>[]).map((l): BibliotecaAntiga => {
    if (typeof l.name !== 'string') throw new Error('biblioteca sem nome')
    const caminho = caminhoMaven(l.name)
    const sha1s = Array.isArray(l.checksums)
      ? l.checksums.filter((c): c is string => typeof c === 'string' && /^[0-9a-f]{40}$/i.test(c))
      : []
    if (l.name === `net.minecraftforge:forge:${nomeMaven}`) {
      return { nome: l.name, caminho, url: urlDoMaven(nomeMaven, 'universal'), sha1s }
    }
    const base = BASES[typeof l.url === 'string' ? l.url : MOJANG]
    if (!base) throw new Error(`biblioteca fora dos sites oficiais: ${l.name} (${String(l.url)})`)
    return { nome: l.name, caminho, url: base + caminho, sha1s }
  })
  if (!bibliotecas.some((b) => b.nome === `net.minecraftforge:forge:${nomeMaven}`)) {
    throw new Error('install_profile.json sem a biblioteca do Forge')
  }
  return { id: v.id, versionInfo: v, bibliotecas }
}

// O JSON da versão no formato que o launcher oficial confere (downloads com sha1 e tamanho) e
// sempre com o Java 8 da Mojang ("jre-legacy"), que é o que essas versões pedem.
export function montarVersaoCliente(
  perfil: PerfilAntigo,
  conferidas: Map<string, { sha1: string; tamanho: number }>
): Record<string, unknown> {
  const libraries = perfil.bibliotecas.map((b) => {
    const c = conferidas.get(b.nome)
    if (!c) throw new Error(`biblioteca não conferida: ${b.nome}`)
    return {
      name: b.nome,
      downloads: { artifact: { path: b.caminho, url: b.url, sha1: c.sha1, size: c.tamanho } }
    }
  })
  return {
    ...perfil.versionInfo,
    libraries,
    javaVersion: { component: 'jre-legacy', majorVersion: 8 }
  }
}
