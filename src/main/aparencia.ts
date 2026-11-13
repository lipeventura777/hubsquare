import { app, dialog, nativeImage, nativeTheme, type BrowserWindow } from 'electron'
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import { BIOMAS, type Aparencia, type Bioma, type Screenshot } from '../shared/tipos'
import { migrarAparencia } from './aparenciaRegras'
import { MODOS_ANIMACAO, type ModoAnimacao } from '../shared/animacaoRegras'
import { gravarComSeguranca, lerTexto } from './config'
import { ErroApp } from './erros'

// Preferências de aparência do app (bioma, cores, vidro, imagem de fundo), na pasta de dados.
const TIPOS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}
const LIMITE_BYTES = 15 * 1024 * 1024
const MAX_SCREENSHOTS = 24

const arquivo = (): string => join(app.getPath('userData'), 'aparencia.json')
const pastaFundos = (): string => join(app.getPath('userData'), 'fundos')
// Onde o Minecraft guarda os prints (F2). Ele não separa por mundo.
const pastaScreenshots = (): string => join(app.getPath('appData'), '.minecraft', 'screenshots')

export async function lerAparencia(): Promise<Aparencia> {
  const texto = await lerTexto(arquivo())
  const salvo = texto ? (JSON.parse(texto) as Record<string, unknown>) : {}
  const { aparencia, migrou } = migrarAparencia(salvo, nativeTheme.shouldUseDarkColors)
  // Arquivo de antes da Fase V1: grava a migração uma vez, para o bioma não mudar depois.
  if (texto && migrou) await gravar(aparencia)
  return aparencia
}

async function gravar(aparencia: Aparencia): Promise<void> {
  await gravarComSeguranca(arquivo(), JSON.stringify(aparencia, null, 2))
}

// Menus, barras de rolagem e campos nativos seguem o bioma: só o Dia claro é claro.
export function aplicarTema(bioma: Bioma): void {
  nativeTheme.themeSource = bioma === 'diaClaro' ? 'light' : 'dark'
}

export async function salvarAparencia(valor: unknown): Promise<Aparencia> {
  const v = (valor ?? {}) as Record<string, unknown>
  if (!BIOMAS.includes(v.bioma as Bioma)) throw new ErroApp('Escolha um bioma da lista.')
  for (const cor of [v.destaque, v.destaquePlay]) {
    if (cor !== null && (typeof cor !== 'string' || !/^#[0-9a-f]{6}$/i.test(cor))) {
      throw new ErroApp('Cor de destaque inválida.')
    }
  }
  if (typeof v.vidroLeve !== 'boolean') throw new ErroApp('Escolha se o vidro fica leve ou não.')
  if (v.animacaoFundo !== undefined && !MODOS_ANIMACAO.includes(v.animacaoFundo as ModoAnimacao)) {
    throw new ErroApp('Escolha uma opção de animação do fundo.')
  }
  if (typeof v.particulasSobreImagem !== 'boolean') {
    throw new ErroApp('Escolha se as partículas aparecem sobre a sua imagem.')
  }
  if (typeof v.escurecimento !== 'number' || !(v.escurecimento >= 0 && v.escurecimento <= 0.9)) {
    throw new ErroApp('O escurecimento precisa ficar entre 0% e 90%.')
  }
  if (typeof v.reduzirAnimacoes !== 'boolean') {
    throw new ErroApp('Escolha se as animações ficam reduzidas ou não.')
  }
  if (typeof v.fundoEmTodoApp !== 'boolean') {
    throw new ErroApp('Escolha se a imagem fica em todo o app ou só no banner.')
  }
  const bioma = v.bioma as Bioma
  const nova: Aparencia = {
    ...(await lerAparencia()),
    // O tema antigo acompanha o bioma, para uma versão antiga do app abrir parecida.
    tema: bioma === 'diaClaro' ? 'claro' : 'escuro',
    bioma,
    vidroLeve: v.vidroLeve,
    animacaoFundo: v.animacaoFundo as ModoAnimacao | undefined,
    particulasSobreImagem: v.particulasSobreImagem,
    destaque: v.destaque as string | null,
    destaquePlay: v.destaquePlay as string | null,
    escurecimento: v.escurecimento,
    fundoEmTodoApp: v.fundoEmTodoApp,
    reduzirAnimacoes: v.reduzirAnimacoes
  }
  await gravar(nova)
  aplicarTema(nova.bioma)
  return nova
}

// A imagem vai para a tela como "data URL", porque a janela só carrega arquivos do próprio app.
export async function lerFundo(): Promise<string | null> {
  const { fundo } = await lerAparencia()
  if (!fundo) return null
  try {
    const dados = await readFile(join(pastaFundos(), fundo))
    return `data:${TIPOS[extname(fundo).toLowerCase()]};base64,${dados.toString('base64')}`
  } catch {
    return null // a cópia sumiu; o app segue sem imagem
  }
}

// Remove a cópia anterior (só a que o próprio app guardou na pasta de dados).
async function apagarCopiaAnterior(aparencia: Aparencia): Promise<void> {
  if (aparencia.fundo) await rm(join(pastaFundos(), aparencia.fundo), { force: true })
}

// Copia a imagem para a pasta de dados do app e passa a usá-la como fundo.
async function copiarComoFundo(origem: string): Promise<string | null> {
  const extensao = extname(origem).toLowerCase()
  if (!TIPOS[extensao]) throw new ErroApp('Escolha uma imagem PNG, JPG, WEBP ou GIF.')
  if ((await stat(origem)).size > LIMITE_BYTES) {
    throw new ErroApp('Essa imagem é muito grande. Escolha uma de até 15 MB.')
  }
  const anterior = await lerAparencia()
  const nome = `fundo-${Date.now()}${extensao}`
  await mkdir(pastaFundos(), { recursive: true })
  await copyFile(origem, join(pastaFundos(), nome))
  await gravar({ ...anterior, fundo: nome })
  await apagarCopiaAnterior(anterior)
  return lerFundo()
}

export async function escolherFundo(janela: BrowserWindow | null): Promise<string | null> {
  const opcoes = {
    title: 'Escolha a imagem de fundo',
    properties: ['openFile' as const],
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const origem = escolha.filePaths[0]
  if (escolha.canceled || !origem) return null
  return copiarComoFundo(origem)
}

export async function removerFundo(): Promise<void> {
  const anterior = await lerAparencia()
  await gravar({ ...anterior, fundo: null })
  await apagarCopiaAnterior(anterior)
}

// ---------- Screenshots do Minecraft ----------

async function nomesDosScreenshots(): Promise<string[]> {
  let nomes: string[]
  try {
    nomes = (await readdir(pastaScreenshots())).filter((n) => /\.(png|jpe?g)$/i.test(n))
  } catch {
    return [] // o jogo nunca tirou print neste PC
  }
  const comData = await Promise.all(
    nomes.map(async (nome) => ({
      nome,
      quando: (await stat(join(pastaScreenshots(), nome))).mtimeMs
    }))
  )
  return comData.sort((a, b) => b.quando - a.quando).map((s) => s.nome)
}

// Os prints mais recentes, como miniaturas pequenas (JPEG de 400px) para a tela não pesar.
export async function listarScreenshots(): Promise<Screenshot[]> {
  const nomes = (await nomesDosScreenshots()).slice(0, MAX_SCREENSHOTS)
  const lista: Screenshot[] = []
  for (const nome of nomes) {
    const imagem = nativeImage.createFromPath(join(pastaScreenshots(), nome))
    if (imagem.isEmpty()) continue
    const pequena = imagem.resize({ width: 400, quality: 'good' })
    lista.push({
      nome,
      miniatura: `data:image/jpeg;base64,${pequena.toJPEG(75).toString('base64')}`
    })
  }
  return lista
}

export async function usarScreenshotComoFundo(valor: unknown): Promise<string | null> {
  const nome = typeof valor === 'string' ? basename(valor) : ''
  if (!nome || !(await nomesDosScreenshots()).includes(nome)) {
    throw new ErroApp('Esse print não existe mais. Atualize a lista e escolha outro.')
  }
  return copiarComoFundo(join(pastaScreenshots(), nome))
}
