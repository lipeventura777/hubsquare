import { stat } from 'fs/promises'
import { tar } from './importarZip'
import { lerMetaJar, type MetaJar } from './modsProblemas'

// Dados de dentro de cada .jar (id, dependências, versões aceitas...), para os problemas, o
// travamento e os configs (Fase 25). Fica na memória enquanto o arquivo não mudar.

const MEMBROS = {
  fabric: 'fabric.mod.json',
  neoToml: 'META-INF/neoforge.mods.toml',
  toml: 'META-INF/mods.toml',
  plugin: 'plugin.yml',
  paperPlugin: 'paper-plugin.yml'
} as const

const cache = new Map<string, MetaJar | null>()

export async function metaDoJar(caminho: string): Promise<MetaJar | null> {
  const s = await stat(caminho).catch(() => null)
  if (!s) return null
  const chave = `${caminho}|${s.size}|${s.mtimeMs}`
  if (cache.has(chave)) return cache.get(chave)!
  let meta: MetaJar | null
  try {
    // Lista o .jar uma vez e só extrai os arquivos que existem.
    const entradas = new Set((await tar(['-tf', caminho])).split(/\r?\n/))
    const lidos: Partial<Record<keyof typeof MEMBROS, string | null>> = {}
    for (const [k, membro] of Object.entries(MEMBROS) as [keyof typeof MEMBROS, string][]) {
      if (entradas.has(membro)) lidos[k] = await tar(['-xOf', caminho, membro]).catch(() => null)
    }
    meta = lerMetaJar(lidos)
  } catch {
    meta = null // .jar quebrado: fica sem dados
  }
  if (cache.size > 2000) cache.clear()
  cache.set(chave, meta)
  return meta
}
