import { app, dialog, nativeImage, protocol, type BrowserWindow } from 'electron'
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, open, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  arquivoDoProtocolo,
  motivoRecusa,
  nomeValido,
  PROTOCOLO_FUNDO,
  tamanhoReduzido,
  tipoDaImagem,
  urlDoFundo
} from '../shared/fundoRegras'
import type { ImagemFundo } from '../shared/tipos'
import { ErroApp } from './erros'
import { t } from '../shared/i18n'

// Fundos personalizados (Fase V4). As imagens escolhidas são copiadas para a pasta de dados
// (fundos/<hash do conteúdo>.<tipo>): a mesma imagem não duplica e a original pode sumir. A tela
// só as vê pelo protocolo hubsquare-fundo://, que entrega arquivos SÓ dessa pasta.

export const pastaFundos = (): string => join(app.getPath('userData'), 'fundos')

const TIPO_MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const

// Antes do app ficar pronto (o Electron exige): o esquema é seguro, com CORS (a tela lê as cores
// da imagem para o contraste) e sem acesso a mais nada.
export function registrarEsquemaFundo(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROTOCOLO_FUNDO,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

export function servirFundos(): void {
  protocol.handle(PROTOCOLO_FUNDO, async (pedido) => {
    const nome = arquivoDoProtocolo(pedido.url)
    if (!nome) return new Response('', { status: 404 })
    try {
      const dados = await readFile(join(pastaFundos(), nome))
      const tipo = tipoDaImagem(dados)
      if (!tipo) return new Response('', { status: 404 })
      return new Response(new Uint8Array(dados), {
        headers: {
          'Content-Type': TIPO_MIME[tipo],
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'max-age=31536000, immutable' // o nome é o hash: nunca muda
        }
      })
    } catch {
      return new Response('', { status: 404 })
    }
  })
}

// Copia uma imagem para a pasta de fundos e devolve o nome guardado. Confere o tipo pelos bytes
// e o tamanho; imagens com mais de 2560px no lado maior são reduzidas.
export async function guardarImagem(origem: string): Promise<string> {
  let tamanho: number
  try {
    const s = await stat(origem)
    if (!s.isFile()) throw new Error('não é arquivo')
    tamanho = s.size
  } catch {
    throw new ErroApp(t('p.fundos.naoAcheiEsseArquivoEscolha'))
  }
  // Os bytes do começo bastam para recusar sem ler um arquivo enorme.
  const cabeca = Buffer.alloc(16)
  const f = await open(origem, 'r')
  try {
    await f.read(cabeca, 0, 16, 0)
  } finally {
    await f.close()
  }
  const motivo = motivoRecusa(cabeca, tamanho)
  if (motivo) throw new ErroApp(motivo)

  const original = await readFile(origem)
  const hash = createHash('sha256').update(original).digest('hex')
  let tipo = tipoDaImagem(original)!
  let dados: Buffer = original
  const img = nativeImage.createFromBuffer(original)
  const { width, height } = img.getSize()
  // shortcut: um WEBP que o nativeImage não abre vai sem reduzir; trocar por outro decodificador se aparecer WEBP gigante.
  const novo = img.isEmpty() ? null : tamanhoReduzido(width, height)
  if (novo) {
    const menor = img.resize({ width: novo.largura, height: novo.altura, quality: 'best' })
    dados = tipo === 'jpg' ? menor.toJPEG(90) : menor.toPNG()
    if (tipo === 'webp') tipo = 'png' // o nativeImage não grava WEBP
  }
  const nome = `${hash}.${tipo}`
  await mkdir(pastaFundos(), { recursive: true })
  if (!existsSync(join(pastaFundos(), nome))) await writeFile(join(pastaFundos(), nome), dados)
  return nome
}

export async function escolherImagem(janela: BrowserWindow | null): Promise<string | null> {
  const opcoes = {
    title: t('p.fundos.escolhaUmaImagemDeFundo'),
    properties: ['openFile' as const],
    filters: [{ name: t('p.fundos.imagensPngJpgWebp'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const origem = escolha.filePaths[0]
  if (escolha.canceled || !origem) return null
  return guardarImagem(origem)
}

// Imagem arrastada para o banner: o caminho vem da tela (webUtils), então tudo é conferido aqui.
export async function guardarImagemArrastada(caminho: unknown): Promise<string> {
  if (typeof caminho !== 'string' || !caminho)
    throw new ErroApp(t('p.fundos.solteUmArquivoDeImagem'))
  return guardarImagem(caminho)
}

// "Minhas imagens": as guardadas, mais novas primeiro, com onde cada uma está em uso.
export async function listarImagens(usos: Map<string, string[]>): Promise<ImagemFundo[]> {
  const nomes = (await readdir(pastaFundos()).catch(() => [] as string[])).filter(nomeValido)
  const lista = await Promise.all(
    nomes.map(async (nome) => ({
      nome,
      url: urlDoFundo(nome),
      quando: (await stat(join(pastaFundos(), nome)).catch(() => null))?.mtimeMs ?? 0,
      usadaEm: usos.get(nome) ?? []
    }))
  )
  return lista
    .sort((a, b) => b.quando - a.quando)
    .map((i) => ({ nome: i.nome, url: i.url, usadaEm: i.usadaEm }))
}

export async function apagarArquivoDeImagem(nome: unknown): Promise<string> {
  if (!nomeValido(nome)) throw new ErroApp(t('p.fundos.essaImagemNaoExisteMais'))
  await rm(join(pastaFundos(), nome), { force: true })
  return nome
}

// Avisos da migração (imagem antiga que sumiu): a tela pede uma vez e mostra dentro do app.
const avisos: string[] = []
export const avisarFundo = (texto: string): void => void avisos.push(texto)
export const pegarAvisosDeFundo = (): string[] => avisos.splice(0)
