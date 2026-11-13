import { clipboard, ClipboardItem, nativeImage, shell } from 'electron'
import { existsSync } from 'fs'
import { readdir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import type { Captura } from '../shared/tipos'
import { ErroApp } from './erros'

// Capturas de tela do PlaySquare (Fase P5): os prints (F2) da pasta screenshots de cada
// instalação. Só lê, copia, abre a pasta e manda para a Lixeira (sempre com confirmação na tela).

export interface PastaDePrints {
  instalacaoId: string
  nome: string
  pasta: string // pasta da instalação
}

const PRINT = /^[\w .,()+-]{1,120}\.png$/i
const MAX = 300

function caminhoDoPrint(p: PastaDePrints, nome: unknown): string {
  const n = typeof nome === 'string' ? basename(nome) : ''
  if (!PRINT.test(n)) throw new ErroApp('Esse print não existe mais. Atualize a galeria.')
  const caminho = join(p.pasta, 'screenshots', n)
  if (!existsSync(caminho)) throw new ErroApp('Esse print não existe mais. Atualize a galeria.')
  return caminho
}

// Os mais novos primeiro, de todas as instalações (ou de uma só).
export async function listarCapturas(pastas: PastaDePrints[]): Promise<Captura[]> {
  const todos: { p: PastaDePrints; nome: string; quando: number }[] = []
  for (const p of pastas) {
    const dir = join(p.pasta, 'screenshots')
    const nomes = (await readdir(dir).catch(() => [] as string[])).filter((n) => PRINT.test(n))
    for (const nome of nomes) {
      const s = await stat(join(dir, nome)).catch(() => null)
      if (s?.isFile()) todos.push({ p, nome, quando: s.mtimeMs })
    }
  }
  todos.sort((a, b) => b.quando - a.quando)
  const lista: Captura[] = []
  for (const { p, nome, quando } of todos.slice(0, MAX)) {
    const imagem = nativeImage.createFromPath(join(p.pasta, 'screenshots', nome))
    if (imagem.isEmpty()) continue
    lista.push({
      instalacaoId: p.instalacaoId,
      instalacao: p.nome,
      nome,
      data: new Date(quando).toISOString(),
      miniatura: `data:image/jpeg;base64,${imagem.resize({ width: 360, quality: 'good' }).toJPEG(70).toString('base64')}`
    })
  }
  return lista
}

// Visualização grande (limitada a 1920 de largura, para não pesar na tela).
export function capturaGrande(p: PastaDePrints, nome: unknown): string {
  const imagem = nativeImage.createFromPath(caminhoDoPrint(p, nome))
  if (imagem.isEmpty()) throw new ErroApp('Não consegui abrir esse print.')
  const { width } = imagem.getSize()
  const final = width > 1920 ? imagem.resize({ width: 1920, quality: 'best' }) : imagem
  return `data:image/jpeg;base64,${final.toJPEG(90).toString('base64')}`
}

export async function copiarCaptura(p: PastaDePrints, nome: unknown): Promise<void> {
  const png = await readFile(caminhoDoPrint(p, nome))
  await clipboard.write([
    new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })
  ])
}

export function mostrarCapturaNaPasta(p: PastaDePrints, nome: unknown): void {
  shell.showItemInFolder(caminhoDoPrint(p, nome))
}

// A tela já confirmou. Vai para a Lixeira, de onde dá para recuperar.
export async function apagarCaptura(p: PastaDePrints, nome: unknown): Promise<void> {
  try {
    await shell.trashItem(caminhoDoPrint(p, nome))
  } catch (e) {
    if (e instanceof ErroApp) throw e
    throw new ErroApp('Não consegui mandar o print para a Lixeira.', String(e))
  }
}

export function caminhoDaCaptura(p: PastaDePrints, nome: unknown): string {
  return caminhoDoPrint(p, nome)
}
