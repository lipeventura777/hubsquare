import { existsSync } from 'fs'
import { mkdir, rename } from 'fs/promises'
import { isAbsolute, join, relative } from 'path'
import { lerArquivoPropriedades } from './config'
import { ErroApp } from './erros'

export function dentroDe(pasta: string, caminho: string): boolean {
  const r = relative(pasta, caminho)
  return r === '' || (!r.startsWith('..') && !isAbsolute(r))
}

// Nome da pasta do mundo ativo (level-name do server.properties).
export async function nivelDoMundo(pasta: string): Promise<string> {
  const nivel = (await lerArquivoPropriedades(pasta)).get('level-name') || 'world'
  if (/[\\/:*?"<>|]/.test(nivel) || nivel === '.' || nivel === '..') {
    throw new ErroApp(
      `O nome do mundo no server.properties ("${nivel}") não é um nome de pasta válido. Corrija o level-name e tente de novo.`
    )
  }
  return nivel
}

// O Paper separa o Nether e o End em pastas próprias; o Vanilla guarda tudo na primeira.
export function pastasDoMundo(nivel: string): string[] {
  return [nivel, `${nivel}_nether`, `${nivel}_the_end`]
}

// Move o mundo ativo para "mundos-antigos" (nunca apaga).
export async function guardarMundoAtual(pasta: string, nivel: string): Promise<void> {
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-')
  const antigos = join(pasta, 'mundos-antigos', `${nivel}-${carimbo}`)
  for (const nome of pastasDoMundo(nivel)) {
    if (!existsSync(join(pasta, nome))) continue
    await mkdir(antigos, { recursive: true })
    await rename(join(pasta, nome), join(antigos, nome))
  }
}
