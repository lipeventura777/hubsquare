// Regras da aba Instalados sem rede nem arquivos (testadas em tests/instaladosRegras.test.ts).
import type { FonteInstalado } from '../shared/tipos'

export const DIAS_NOS_REMOVIDOS = 7

export function vencido(quando: string, agora: number): boolean {
  const t = Date.parse(quando)
  return !Number.isFinite(t) || agora - t > DIAS_NOS_REMOVIDOS * 24 * 60 * 60 * 1000
}

export interface Metadados {
  nome: string | null
  versao: string | null
  fonte: FonteInstalado
}

// shortcut: a fonte de um arquivo fora do Modrinth é adivinhada pelos links que o autor pôs no
// .jar (sem as APIs do CurseForge e do Hangar); sem link conhecido, fica "manual".
export function fonteDosLinks(links: (string | null | undefined)[]): FonteInstalado {
  const texto = links.filter(Boolean).join(' ').toLowerCase()
  if (texto.includes('hangar.papermc.io')) return 'hangar'
  if (/curseforge\.com|dev\.bukkit\.org|bukkit\.org/.test(texto)) return 'curseforge'
  return 'manual'
}

// Versões como "${file.jarVersion}" são trocadas na compilação; se sobraram, não servem.
const limpa = (v: string | null | undefined): string | null =>
  v && !v.includes('${') ? v.trim().slice(0, 80) || null : null

const campoToml = (texto: string, campo: string): string | null =>
  texto.match(new RegExp(`^\\s*${campo}\\s*=\\s*["']([^"'\\n]*)["']`, 'm'))?.[1] ?? null

const campoYaml = (texto: string, campo: string): string | null =>
  texto
    .match(new RegExp(`^${campo}\\s*:\\s*(.+)$`, 'm'))?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '') ?? null

// Nome, versão e fonte a partir do fabric.mod.json, do mods.toml (Forge/NeoForge) ou do
// plugin.yml (Paper/Spigot), o que o .jar tiver.
export function metadadosDoJar(arquivos: {
  fabric?: string | null
  toml?: string | null
  plugin?: string | null
}): Metadados {
  if (arquivos.fabric) {
    try {
      const d = JSON.parse(arquivos.fabric)
      const c = d.contact ?? {}
      return {
        nome: limpa(d.name ?? d.id),
        versao: limpa(d.version),
        fonte: fonteDosLinks([c.homepage, c.sources, c.issues])
      }
    } catch {
      // fabric.mod.json quebrado: tenta os outros
    }
  }
  if (arquivos.toml) {
    const t = arquivos.toml
    return {
      nome: limpa(campoToml(t, 'displayName') ?? campoToml(t, 'modId')),
      versao: limpa(campoToml(t, 'version')),
      fonte: fonteDosLinks([campoToml(t, 'displayURL'), campoToml(t, 'issueTrackerURL')])
    }
  }
  if (arquivos.plugin) {
    const t = arquivos.plugin
    return {
      nome: limpa(campoYaml(t, 'name')),
      versao: limpa(campoYaml(t, 'version')),
      fonte: fonteDosLinks([campoYaml(t, 'website')])
    }
  }
  return { nome: null, versao: null, fonte: 'manual' }
}
