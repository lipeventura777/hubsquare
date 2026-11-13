import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Prova do isolamento: fotografa as pastas REAIS do app (data e tamanho, 3 níveis) antes da
// rodada e confere depois. Se algum teste tocar nelas, a rodada inteira falha.

const RESULTADOS = join(__dirname, '..', '..', '.teste', 'resultados')
const FOTO = join(RESULTADOS, 'pastas-reais-antes.json')

export function pastasReais(): string[] {
  const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  return [
    join(appData, 'ServSquare'),
    join(homedir(), 'Documents', 'ServSquare'),
    join(appData, '.minecraft')
  ]
}

function fotografar(): Record<string, string> {
  const foto: Record<string, string> = {}
  const andar = (p: string, nivel: number): void => {
    const s = statSync(p)
    foto[p] = `${s.mtimeMs}|${s.size}`
    if (!s.isDirectory() || nivel === 0) return
    for (const f of readdirSync(p)) {
      try {
        andar(join(p, f), nivel - 1)
      } catch {
        // arquivo travado ou sumiu no meio: não conta
      }
    }
  }
  for (const r of pastasReais()) if (existsSync(r)) andar(r, 3)
  return foto
}

export function guardarFoto(): void {
  mkdirSync(RESULTADOS, { recursive: true })
  writeFileSync(FOTO, JSON.stringify(fotografar()))
}

// Lista o que mudou (vazia = intacto).
export function diferencas(): string[] {
  const antes = JSON.parse(readFileSync(FOTO, 'utf8')) as Record<string, string>
  const depois = fotografar()
  const caminhos = new Set([...Object.keys(antes), ...Object.keys(depois)])
  return [...caminhos].filter((c) => antes[c] !== depois[c])
}
