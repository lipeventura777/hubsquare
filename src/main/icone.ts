import { readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type { InfoServidor } from '../shared/tipos'
import { ErroApp } from './erros'

// Ícone do servidor (Opções › Gerais): o server-icon.png de 64×64 que o jogo mostra na lista.
// O recorte é feito na tela; aqui só confere e grava.
const ARQUIVO = 'server-icon.png'
const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// PNG de 64×64: assinatura certa e o IHDR dizendo 64 de largura e de altura.
export function pngDe64(dados: Buffer): boolean {
  return (
    dados.length > 33 &&
    dados.length < 512 * 1024 &&
    dados.subarray(0, 8).equals(ASSINATURA) &&
    dados.toString('latin1', 12, 16) === 'IHDR' &&
    dados.readUInt32BE(16) === 64 &&
    dados.readUInt32BE(20) === 64
  )
}

// Data URL do ícone, ou null se o servidor não tem (ou o arquivo não serve para o jogo).
export async function lerIcone(pasta: string): Promise<string | null> {
  const dados = await readFile(join(pasta, ARQUIVO)).catch(() => null)
  return dados && pngDe64(dados) ? `data:image/png;base64,${dados.toString('base64')}` : null
}

export async function salvarIcone(info: InfoServidor, dataUrl: unknown): Promise<string> {
  const base64 =
    typeof dataUrl === 'string'
      ? dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)?.[1]
      : undefined
  const dados = base64 ? Buffer.from(base64, 'base64') : null
  if (!dados || !pngDe64(dados))
    throw new ErroApp('A imagem não ficou com 64×64. Escolha a imagem de novo.')
  await writeFile(join(info.pasta, ARQUIVO), dados)
  return `data:image/png;base64,${dados.toString('base64')}`
}

// A tela pede confirmação antes de chamar.
export async function removerIcone(info: InfoServidor): Promise<void> {
  await rm(join(info.pasta, ARQUIVO), { force: true })
}
