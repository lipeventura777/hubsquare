import { app, nativeImage, nativeTheme } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import { BIOMAS, type Aparencia, type Bioma, type Screenshot } from '../shared/tipos'
import { migrarAparencia } from './aparenciaRegras'
import { MODOS_ANIMACAO, type ModoAnimacao } from '../shared/animacaoRegras'
import { gravarComSeguranca, lerTexto } from './config'
import { ErroApp } from './erros'
import {
  BIOMAS_DE_VIDRO_CLARO,
  fundoAppAntigo,
  validarEscolha,
  type EscolhaFundo
} from '../shared/fundoRegras'
import { avisarFundo, guardarImagem, pastaFundos } from './fundos'

// Preferências de aparência do app (bioma, cores, vidro, imagem de fundo), na pasta de dados.
const TIPOS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}
const MAX_SCREENSHOTS = 24

const arquivo = (): string => join(app.getPath('userData'), 'aparencia.json')
// Onde o Minecraft guarda os prints (F2). Ele não separa por mundo.
const pastaScreenshots = (): string => join(app.getPath('appData'), '.minecraft', 'screenshots')

export async function lerAparencia(): Promise<Aparencia> {
  const texto = await lerTexto(arquivo())
  const salvo = texto ? (JSON.parse(texto) as Record<string, unknown>) : {}
  const { aparencia, migrou } = migrarAparencia(salvo, nativeTheme.shouldUseDarkColors)
  // Arquivo de antes da Fase V4: o fundo do app passa para o fundoApp (uma vez).
  if (!aparencia.fundoApp) {
    const nova = await migrarFundoApp(aparencia)
    if (texto) await gravar(nova)
    return nova
  }
  // Arquivo de antes da Fase V1: grava a migração uma vez, para o bioma não mudar depois.
  if (texto && migrou) await gravar(aparencia)
  return aparencia
}

async function gravar(aparencia: Aparencia): Promise<void> {
  await gravarComSeguranca(arquivo(), JSON.stringify(aparencia, null, 2))
}

// Menus, barras de rolagem e campos nativos seguem o vidro do bioma (claro ou escuro).
export function aplicarTema(bioma: Bioma): void {
  nativeTheme.themeSource = BIOMAS_DE_VIDRO_CLARO.includes(bioma) ? 'light' : 'dark'
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
  let fundoApp: EscolhaFundo
  try {
    fundoApp = validarEscolha(v.fundoApp ?? null) ?? { tipo: 'bioma', bioma }
  } catch (e) {
    throw new ErroApp((e as Error).message)
  }
  const nova: Aparencia = {
    ...(await lerAparencia()),
    // O tema antigo acompanha o bioma, para uma versão antiga do app abrir parecida.
    tema: BIOMAS_DE_VIDRO_CLARO.includes(bioma) ? 'claro' : 'escuro',
    bioma,
    vidroLeve: v.vidroLeve,
    animacaoFundo: v.animacaoFundo as ModoAnimacao | undefined,
    particulasSobreImagem: v.particulasSobreImagem,
    destaque: v.destaque as string | null,
    destaquePlay: v.destaquePlay as string | null,
    escurecimento: v.escurecimento,
    fundoEmTodoApp: v.fundoEmTodoApp,
    reduzirAnimacoes: v.reduzirAnimacoes,
    fundoApp
  }
  await gravar(nova)
  aplicarTema(nova.bioma)
  return nova
}

// Imagem antiga só do banner do Painel (antes da Fase V4, com "em todo o app" desligado): a tela
// ainda mostra ela lá, como data URL. O fundo do app inteiro agora é o fundoApp.
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

// Fase V4: o fundo do app vem do fundoApp. Arquivo de antes: a imagem que valia no app inteiro
// vira uma imagem guardada; se ela sumiu, fica o bioma e o app avisa uma vez.
async function migrarFundoApp(a: Aparencia): Promise<Aparencia> {
  const { usarImagemAntiga, ajuste } = fundoAppAntigo(a)
  let fundoApp: EscolhaFundo = { tipo: 'bioma', bioma: a.bioma }
  if (usarImagemAntiga && a.fundo) {
    try {
      fundoApp = {
        tipo: 'imagem',
        imagem: await guardarImagem(join(pastaFundos(), a.fundo)),
        ajuste
      }
    } catch {
      avisarFundo('A imagem de fundo do app não existe mais. O app voltou para o bioma.')
    }
  }
  return { ...a, fundoApp }
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

export async function usarScreenshotComoFundo(valor: unknown): Promise<string> {
  const nome = typeof valor === 'string' ? basename(valor) : ''
  if (!nome || !(await nomesDosScreenshots()).includes(nome)) {
    throw new ErroApp('Esse print não existe mais. Atualize a lista e escolha outro.')
  }
  return guardarImagem(join(pastaScreenshots(), nome))
}
