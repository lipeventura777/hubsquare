import { copyFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

// O Paper (26.x) guarda as configurações de geração do mundo (seed e dimensões) dentro da pasta de
// cada dimensão. O jogo original, o Fabric, o Forge e o NeoForge procuram em data/minecraft/ e,
// sem achar, param com "Overworld settings missing". Testado em tests/mundoPaper.test.ts.
const DO_PAPER = join(
  'dimensions',
  'minecraft',
  'overworld',
  'data',
  'minecraft',
  'world_gen_settings.dat'
)
const PADRAO = join('data', 'minecraft', 'world_gen_settings.dat')

// Copia (sem apagar nada) para onde os outros softwares procuram. Devolve true se copiou.
export async function prepararMundoDoPaper(pastaDoMundo: string): Promise<boolean> {
  const origem = join(pastaDoMundo, DO_PAPER)
  const destino = join(pastaDoMundo, PADRAO)
  if (!existsSync(origem) || existsSync(destino)) return false
  await mkdir(join(pastaDoMundo, 'data', 'minecraft'), { recursive: true })
  await copyFile(origem, destino)
  return true
}
