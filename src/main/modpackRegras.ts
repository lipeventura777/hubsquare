import type { TipoId } from '../shared/tipos'
import { versaoLoaderValida } from './tipos/versoesLoader'
import { caminhoSeguro } from './zipSeguro'

// Regras dos modpacks (.mrpack) sem rede nem arquivos. Testadas em tests/modpackRegras.test.ts.
// Formato: support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack

export interface ArquivoIndice {
  path: string
  hashes: { sha1: string; sha512: string }
  env?: { client?: string; server?: string } // required, optional, unsupported
  downloads: string[]
  fileSize: number
}

export interface Indice {
  formatVersion: number
  game: string
  versionId: string
  name: string
  summary?: string
  files: ArquivoIndice[]
  dependencies: Record<string, string>
}

// Chave do loader no índice para cada tipo do app.
export const CHAVE_LOADER: Partial<Record<TipoId, string>> = {
  fabric: 'fabric-loader',
  forge: 'forge',
  neoforge: 'neoforge'
}

const DOMINIOS = new Set([
  'cdn.modrinth.com',
  'github.com',
  'raw.githubusercontent.com',
  'gitlab.com'
])

// Downloads só por HTTPS dos domínios que o Modrinth aceita em packs.
export function downloadPermitido(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && DOMINIOS.has(u.hostname)
  } catch {
    return false
  }
}

// Caminho de arquivo do pack: relativo, sem "..", sem letra de disco e sem ":" (fluxos do NTFS).
export function caminhoDoPack(caminho: unknown): caminho is string {
  return (
    typeof caminho === 'string' &&
    caminho.length > 0 &&
    caminho.length <= 300 &&
    caminhoSeguro(caminho) &&
    !caminho.includes(':') &&
    !caminho.startsWith('\\') &&
    !caminho.endsWith('/')
  )
}

// Lê e confere o modrinth.index.json. Lança Error com a frase para o usuário.
export function lerIndice(texto: string): Indice {
  let dado: Indice
  try {
    dado = JSON.parse(texto)
  } catch {
    throw new Error('O arquivo do modpack está estragado (o índice não é um JSON válido).')
  }
  if (dado?.game !== 'minecraft' || dado.formatVersion !== 1) {
    throw new Error('Esse arquivo não é um modpack do Minecraft no formato do Modrinth.')
  }
  if (typeof dado.dependencies?.minecraft !== 'string' || !Array.isArray(dado.files)) {
    throw new Error('O modpack não diz qual versão do Minecraft usa.')
  }
  for (const f of dado.files) {
    if (!caminhoDoPack(f?.path)) {
      throw new Error(`O modpack tem um arquivo com caminho perigoso: ${String(f?.path)}`)
    }
    if (
      !/^[0-9a-f]{40}$/i.test(f.hashes?.sha1 ?? '') ||
      !/^[0-9a-f]{128}$/i.test(f.hashes?.sha512 ?? '')
    ) {
      throw new Error(`O modpack não traz os hashes de ${f.path}.`)
    }
  }
  return dado
}

// Loader e versão do loader exigidos pelo pack.
export function loaderDoIndice(dependencias: Record<string, string>): {
  tipo: TipoId
  versaoLoader: string
} {
  if (dependencias['quilt-loader']) {
    throw new Error(
      'Esse modpack usa o Quilt, que o HubSquare ainda não aceita. Escolha um pack para Fabric, Forge ou NeoForge.'
    )
  }
  for (const [tipo, chave] of Object.entries(CHAVE_LOADER) as [TipoId, string][]) {
    const versao = dependencias[chave]
    if (versao !== undefined) {
      if (!versaoLoaderValida(versao))
        throw new Error(`A versão do ${chave} no modpack é inválida.`)
      return { tipo, versaoLoader: versao }
    }
  }
  throw new Error(
    'Esse modpack não usa Fabric, Forge nem NeoForge, então o app não consegue montar o servidor.'
  )
}

// O servidor baixa tudo que não for marcado como "não roda no servidor".
export function vaiProServidor(f: ArquivoIndice): boolean {
  return f.env?.server !== 'unsupported'
}

export function ehMod(caminho: string): boolean {
  return /^mods\/[^/]+\.jar$/i.test(caminho)
}

// RAM pelo tamanho do pack: até 50 mods 4 GB, até 150 mods 6 GB, acima disso 8 GB.
export function sugerirRam(mods: number, maximo: number): { gb: number; explicacao: string } {
  const ideal = mods <= 50 ? 4 : mods <= 150 ? 6 : 8
  const gb = Math.max(1, Math.min(ideal, maximo))
  const base = `Este pack tem ${mods} ${mods === 1 ? 'mod' : 'mods'}, então sugerimos ${ideal} GB de RAM.`
  return {
    gb,
    explicacao:
      gb < ideal
        ? `${base} Seu PC só deixa usar ${gb} GB, então o servidor pode ficar lento.`
        : base
  }
}

// ---------- Atualizar o pack ----------

// No disco: o SHA-1 do arquivo, null (não existe) ou "desativado" (o usuário renomeou para .disabled).
export type NoDisco = string | null | 'desativado'

export interface Conflito {
  caminho: string
  motivo: string
}

export interface Comparacao {
  escrever: string[] // arquivo novo do pack, ou que o usuário não mexeu
  apagar: string[] // o pack novo não usa mais e o usuário não mexeu
  conflitos: Conflito[] // o app pergunta: manter o do usuário ou usar o do pack
}

// `antigos` e `novos`: caminho → SHA-1 dos arquivos que o pack põe no servidor (downloads e
// overrides). Arquivos que o pack nunca teve (mods à parte, mundo) não aparecem e não são tocados.
export function compararPack(
  antigos: Record<string, string>,
  novos: Record<string, string>,
  disco: (caminho: string) => NoDisco,
  protegido: (caminho: string) => boolean
): Comparacao {
  const r: Comparacao = { escrever: [], apagar: [], conflitos: [] }
  for (const [caminho, hashNovo] of Object.entries(novos)) {
    if (protegido(caminho)) continue
    const atual = disco(caminho)
    const antigo = antigos[caminho]
    if (atual === hashNovo) continue
    if (atual === 'desativado') r.conflitos.push({ caminho, motivo: 'Você desativou este mod.' })
    else if (atual === null || atual === antigo) r.escrever.push(caminho)
    else
      r.conflitos.push({
        caminho,
        motivo: antigo ? 'Você mudou este arquivo.' : 'Já existe um arquivo seu com esse nome.'
      })
  }
  for (const [caminho, hashAntigo] of Object.entries(antigos)) {
    if (caminho in novos || protegido(caminho)) continue
    const atual = disco(caminho)
    if (atual === null || atual === 'desativado') continue
    if (atual === hashAntigo) r.apagar.push(caminho)
    else
      r.conflitos.push({
        caminho,
        motivo: 'O pack novo não usa mais este arquivo, mas você mudou ele.'
      })
  }
  return r
}

// ---------- Pacote pros amigos ----------

const PRECISA: Record<string, 'required' | 'optional' | null> = {
  client_and_server: 'required',
  client_only: 'required',
  client_only_server_optional: 'required',
  singleplayer_only: 'required',
  server_only: null,
  dedicated_server_only: null,
  server_only_client_optional: 'optional',
  client_or_server: 'optional',
  client_or_server_prefers_both: 'optional',
  unknown: 'required'
}

// O jogador precisa deste mod no jogo? Na dúvida, sim (é melhor sobrar do que não conseguir entrar).
export function precisaNoJogador(
  environment?: string[] | null,
  clientSide?: string
): 'required' | 'optional' | null {
  const valores = environment?.length
    ? environment.map((e) => (e in PRECISA ? PRECISA[e] : 'required'))
    : [clientSide === 'unsupported' ? null : clientSide === 'optional' ? 'optional' : 'required']
  if (valores.includes('required')) return 'required'
  return valores.includes('optional') ? 'optional' : null
}

// Licença lida de dentro do .jar (fabric.mod.json ou mods.toml).
export function licencaDoMod(texto: string, formato: 'json' | 'toml'): string | null {
  if (formato === 'json') {
    try {
      const lic = JSON.parse(texto).license
      return Array.isArray(lic) ? lic.join(' OR ') : typeof lic === 'string' ? lic : null
    } catch {
      return null
    }
  }
  return texto.match(/^\s*license\s*=\s*["']([^"'\r\n]+)["']/m)?.[1] ?? null
}

// fabric.mod.json com "environment": "server": o mod não vai para o jogo.
export function soDoServidorFabric(texto: string): boolean {
  try {
    return JSON.parse(texto).environment === 'server'
  } catch {
    return false
  }
}

// Só licenças abertas conhecidas deixam incluir o arquivo no pacote; o resto é "baixe manualmente".
export function licencaPermite(licenca: string | null): boolean {
  if (!licenca) return false
  const l = licenca.toUpperCase()
  if (/ALL RIGHTS RESERVED|\bARR\b|PROPRIETARY|CUSTOM|-NC\b|-ND\b|NON-?COMMERCIAL/.test(l)) {
    return false
  }
  return /\b(MIT|APACHE|BSD|ISC|ZLIB|MPL|L?GPL|AGPL|CC0|UNLICENSE|CC-BY|EPL|WTFPL|0BSD)\b/.test(l)
}
