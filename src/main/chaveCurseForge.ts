import { readFileSync } from 'fs'
import { join } from 'path'

// Chave da API do CurseForge (Fase L1): a chave oficial do app entra só no build, pelo segredo
// CURSEFORGE_API_KEY do GitHub, que o electron.vite.config.ts troca em __CHAVE_CURSEFORGE__ na
// hora de compilar. Nunca fica no repositório. Sem ela, o CurseForge aparece como "em breve".
declare const __CHAVE_CURSEFORGE__: string

// Testes (HUBSQUARE_DADOS): uma chave de mentira no arquivo chave-curseforge-teste.txt da pasta do
// teste faz o papel da chave do build, sem compilar de novo.
function chaveDeTeste(): string {
  const pasta = process.env.HUBSQUARE_DADOS
  if (!pasta) return ''
  try {
    return readFileSync(join(pasta, 'chave-curseforge-teste.txt'), 'utf8').trim()
  } catch {
    return '' // teste sem CurseForge
  }
}

export async function lerChave(): Promise<string | null> {
  return __CHAVE_CURSEFORGE__ || chaveDeTeste() || null
}

export async function temChave(): Promise<boolean> {
  return (await lerChave()) !== null
}
