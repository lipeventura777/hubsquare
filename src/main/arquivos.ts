import { dialog, type BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { copyFile, cp, lstat, mkdir, readFile, readdir, rename, rm, stat } from 'fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'path'
import {
  EXTENSOES_TEXTO,
  LIMITE_TEXTO,
  type InfoServidor,
  type ItemArquivo,
  type ListaArquivos
} from '../shared/tipos'
import { CaminhoRecusado, caminhoNoServidor, relativoAoServidor } from './caminhoServidor'
import { gravarComSeguranca } from './config'
import { ErroApp, detalhar } from './erros'
import { nivelDoMundo, pastasDoMundo } from './mundo'
import { lerEstado } from './servidor'
import { ARQUIVO_INFO } from './servidores'

// Tela Arquivos (DESIGN.md, 6.22). Todo caminho vindo da tela passa por caminhoNoServidor:
// nada aqui lê, grava, apaga ou renomeia fora da pasta do servidor ativo.

async function caminho(info: InfoServidor, valor: unknown): Promise<string> {
  try {
    return await caminhoNoServidor(info.pasta, valor)
  } catch (e) {
    if (!(e instanceof CaminhoRecusado)) throw e
    throw new ErroApp(
      'Esse caminho fica fora da pasta do servidor (ou tem um nome que o Windows não aceita), então o app não abre.',
      `${String(valor)}\n${e.message}`
    )
  }
}

function nomeSimples(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim() || /[\\/]/.test(valor)) {
    throw new ErroApp('Digite só o nome, sem barras.')
  }
  return valor.trim()
}

// Com o servidor ligado, as pastas do mundo ativo não podem sumir nem mudar de nome.
// O servsquare.json nunca: sem ele o app não reconhece o servidor.
async function protegido(info: InfoServidor, alvo: string): Promise<boolean> {
  if (dirname(alvo) !== resolve(info.pasta)) return false
  const nome = basename(alvo).toLowerCase()
  if (nome === ARQUIVO_INFO) return true
  if (lerEstado() === 'desligado') return false
  const nivel = await nivelDoMundo(info.pasta)
  return pastasDoMundo(nivel).some((p) => p.toLowerCase() === nome)
}

async function exigirLivre(info: InfoServidor, alvo: string): Promise<void> {
  if (alvo === resolve(info.pasta)) throw new ErroApp('A pasta do servidor não pode ser mudada.')
  if (await protegido(info, alvo)) {
    throw new ErroApp(
      basename(alvo).toLowerCase() === ARQUIVO_INFO
        ? 'Esse arquivo é do ServSquare e não pode ser apagado nem renomeado.'
        : 'Essa é a pasta do mundo que está rodando. Desligue o servidor e tente de novo.'
    )
  }
}

const ehTexto = (nome: string): boolean => EXTENSOES_TEXTO.includes(extname(nome).toLowerCase())

export async function listarArquivos(info: InfoServidor, valor: unknown): Promise<ListaArquivos> {
  const pasta = await caminho(info, valor)
  let nomes: string[]
  try {
    nomes = await readdir(pasta)
  } catch (e) {
    throw new ErroApp('Não consegui abrir essa pasta. Ela pode ter sido apagada.', detalhar(e))
  }
  const itens: ItemArquivo[] = []
  for (const nome of nomes) {
    const alvo = join(pasta, nome)
    const s = await lstat(alvo).catch(() => null)
    if (!s) continue
    itens.push({
      nome,
      pasta: s.isDirectory(),
      tamanho: s.isDirectory() ? 0 : s.size,
      data: s.mtime.toISOString(),
      protegido: await protegido(info, alvo)
    })
  }
  itens.sort((a, b) => Number(b.pasta) - Number(a.pasta) || a.nome.localeCompare(b.nome))
  return { caminho: relativoAoServidor(info.pasta, pasta), itens }
}

export async function lerArquivoTexto(info: InfoServidor, valor: unknown): Promise<string> {
  const arquivo = await caminho(info, valor)
  if (!ehTexto(arquivo)) throw new ErroApp('O editor só abre arquivos de texto de configuração.')
  const s = await stat(arquivo)
  if (s.size > LIMITE_TEXTO) {
    throw new ErroApp(
      'Esse arquivo passa de 1 MB, grande demais para o editor. Baixe e abra fora do app.'
    )
  }
  return readFile(arquivo, 'utf8')
}

// Devolve true quando o servidor está ligado: a mudança só vale depois de reiniciar.
export async function salvarArquivoTexto(
  info: InfoServidor,
  valor: unknown,
  texto: unknown
): Promise<boolean> {
  const arquivo = await caminho(info, valor)
  if (!ehTexto(arquivo)) throw new ErroApp('O editor só salva arquivos de texto de configuração.')
  if (typeof texto !== 'string' || Buffer.byteLength(texto) > LIMITE_TEXTO) {
    throw new ErroApp('O texto passa de 1 MB, grande demais para o editor.')
  }
  if (!existsSync(arquivo)) throw new ErroApp('Esse arquivo não existe mais. Atualize a lista.')
  await gravarComSeguranca(arquivo, texto)
  return lerEstado() !== 'desligado'
}

export async function renomearArquivo(
  info: InfoServidor,
  valor: unknown,
  novoNome: unknown
): Promise<void> {
  const alvo = await caminho(info, valor)
  await exigirLivre(info, alvo)
  const nome = nomeSimples(novoNome)
  const destino = await caminho(info, relativoAoServidor(info.pasta, join(dirname(alvo), nome)))
  if (existsSync(destino) && destino.toLowerCase() !== alvo.toLowerCase()) {
    throw new ErroApp(`Já existe "${nome}" nesta pasta. Escolha outro nome.`)
  }
  try {
    await rename(alvo, destino)
  } catch (e) {
    throw new ErroApp(
      'Não consegui renomear. Se o servidor estiver usando esse arquivo, desligue e tente de novo.',
      detalhar(e)
    )
  }
}

export async function criarPasta(info: InfoServidor, valor: unknown, nome: unknown): Promise<void> {
  const pai = await caminho(info, valor)
  const destino = await caminho(info, relativoAoServidor(info.pasta, join(pai, nomeSimples(nome))))
  if (existsSync(destino)) throw new ErroApp('Já existe algo com esse nome nesta pasta.')
  await mkdir(destino)
}

// A confirmação fica na tela; aqui só confere que o caminho é permitido.
export async function apagarArquivo(info: InfoServidor, valor: unknown): Promise<void> {
  const alvo = await caminho(info, valor)
  await exigirLivre(info, alvo)
  try {
    await rm(alvo, { recursive: true })
  } catch (e) {
    throw new ErroApp(
      'Não consegui apagar. Se o servidor estiver usando esse arquivo, desligue e tente de novo.',
      detalhar(e)
    )
  }
}

// Salva uma cópia onde o usuário escolher. Devolve false se ele cancelar.
export async function baixarArquivo(
  info: InfoServidor,
  valor: unknown,
  janela: BrowserWindow | null
): Promise<boolean> {
  const arquivo = await caminho(info, valor)
  if (!(await stat(arquivo)).isFile()) throw new ErroApp('Só dá para baixar arquivos, não pastas.')
  const opcoes = { title: 'Salvar cópia', defaultPath: basename(arquivo) }
  const escolha = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (escolha.canceled || !escolha.filePath) return false
  await copyFile(arquivo, escolha.filePath)
  return true
}

// Arquivos e pastas arrastados do Windows para dentro de uma pasta do servidor.
// Nunca substitui: se já existir algo com o mesmo nome, recusa.
export async function enviarArquivos(
  info: InfoServidor,
  valor: unknown,
  origens: unknown
): Promise<void> {
  const pasta = await caminho(info, valor)
  const lista = Array.isArray(origens) ? origens : []
  if (!lista.length || !lista.every((o) => typeof o === 'string' && isAbsolute(o))) {
    throw new ErroApp('Arraste arquivos do Windows para a lista.')
  }
  const destinos = await Promise.all(
    (lista as string[]).map(async (o) => ({
      origem: o,
      destino: await caminho(info, relativoAoServidor(info.pasta, join(pasta, basename(o))))
    }))
  )
  const repetidos = destinos.filter((d) => existsSync(d.destino)).map((d) => basename(d.destino))
  if (repetidos.length) {
    throw new ErroApp(
      `Já existe nesta pasta: ${repetidos.join(', ')}. Apague ou renomeie antes de enviar de novo.`
    )
  }
  for (const { origem, destino } of destinos) {
    try {
      await cp(origem, destino, { recursive: true, errorOnExist: true, force: false })
    } catch (e) {
      throw new ErroApp(`Não consegui copiar "${basename(origem)}".`, detalhar(e))
    }
  }
}
