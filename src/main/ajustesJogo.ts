import { app, dialog, type BrowserWindow } from 'electron'
import { AsyncLocalStorage } from 'async_hooks'
import { join } from 'path'
import { AVISOS, type AjustesJogo, type InfoServidor, type TipoAviso } from '../shared/tipos'
import { gravarComSeguranca, lerTexto, limitesRam } from './config'
import { ErroApp } from './erros'

// PlaySquare (Fases P3 e P5).

// As telas de mods do ServSquare (Explorar, Instalados, configs) também servem a uma instalação
// do jogador: os canais "play:..." rodam o mesmo código com a instalação no lugar do servidor.
export const alvoJogador = new AsyncLocalStorage<InfoServidor>()

// Ajustes do jogo (ajustes-jogo.json, na pasta de dados): avisos escondidos, memória padrão,
// resolução da janela e pasta das instalações novas.
const arquivo = (): string => join(app.getPath('userData'), 'ajustes-jogo.json')

export async function lerAjustesJogo(): Promise<AjustesJogo> {
  const texto = await lerTexto(arquivo())
  const d = texto ? (JSON.parse(texto) as Partial<AjustesJogo>) : {}
  const r = d.resolucao
  return {
    avisosOcultos: Array.isArray(d.avisosOcultos)
      ? d.avisosOcultos.filter((a): a is TipoAviso => AVISOS.includes(a as TipoAviso))
      : [],
    memoriaPadrao: Number.isInteger(d.memoriaPadrao) ? d.memoriaPadrao! : null,
    resolucao:
      r && Number.isInteger(r.largura) && Number.isInteger(r.altura)
        ? { largura: r.largura, altura: r.altura }
        : null,
    pastaInstalacoes: typeof d.pastaInstalacoes === 'string' ? d.pastaInstalacoes : null,
    pastasDownloads: Array.isArray(d.pastasDownloads)
      ? d.pastasDownloads.filter((p): p is string => typeof p === 'string').slice(0, 20)
      : [],
    ...(typeof d.nick === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(d.nick) && { nick: d.nick })
  }
}

// O nick do Minecraft usado no último convite (Fase M4).
export async function lembrarNick(nick: string): Promise<void> {
  await gravar({ ...(await lerAjustesJogo()), nick })
}

// Fase D: outras pastas onde o assistente procura os downloads manuais (além de Downloads).
export async function mudarPastaDownloads(
  janela: BrowserWindow | null,
  remover: unknown
): Promise<AjustesJogo> {
  const atual = await lerAjustesJogo()
  if (typeof remover === 'string') {
    return gravar({ ...atual, pastasDownloads: atual.pastasDownloads.filter((p) => p !== remover) })
  }
  const opcoes = {
    title: 'Escolha outra pasta onde você salva downloads',
    properties: ['openDirectory' as const]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const pasta = escolha.filePaths[0]
  if (escolha.canceled || !pasta || atual.pastasDownloads.includes(pasta)) return atual
  return gravar({ ...atual, pastasDownloads: [...atual.pastasDownloads, pasta] })
}

async function gravar(a: AjustesJogo): Promise<AjustesJogo> {
  await gravarComSeguranca(arquivo(), JSON.stringify(a, null, 2))
  return a
}

export async function ocultarAviso(tipo: unknown, ocultar: unknown): Promise<AjustesJogo> {
  if (!AVISOS.includes(tipo as TipoAviso)) throw new ErroApp('Aviso desconhecido.')
  const atual = await lerAjustesJogo()
  const outros = atual.avisosOcultos.filter((a) => a !== tipo)
  return gravar({
    ...atual,
    avisosOcultos: ocultar === true ? [...outros, tipo as TipoAviso] : outros
  })
}

// Memória padrão e resolução (a tela manda os dois; null volta ao padrão).
export async function salvarAjustesJogo(valor: unknown): Promise<AjustesJogo> {
  const v = (valor ?? {}) as Partial<AjustesJogo>
  const { min, max } = limitesRam()
  if (
    v.memoriaPadrao !== null &&
    !(Number.isInteger(v.memoriaPadrao) && v.memoriaPadrao! >= min && v.memoriaPadrao! <= max)
  ) {
    throw new ErroApp(`A memória padrão precisa ficar entre ${min} e ${max} GB.`)
  }
  const r = v.resolucao
  if (
    r !== null &&
    !(
      r &&
      Number.isInteger(r.largura) &&
      Number.isInteger(r.altura) &&
      r.largura >= 640 &&
      r.altura >= 480 &&
      r.largura <= 7680 &&
      r.altura <= 4320
    )
  ) {
    throw new ErroApp('Use uma resolução entre 640×480 e 7680×4320.')
  }
  return gravar({
    ...(await lerAjustesJogo()),
    memoriaPadrao: v.memoriaPadrao ?? null,
    resolucao: r ? { largura: r.largura, altura: r.altura } : null
  })
}

// Pasta das instalações NOVAS. As que já existem continuam onde estão (nada é movido).
export async function escolherPastaInstalacoes(
  janela: BrowserWindow | null,
  voltarAoPadrao: unknown
): Promise<AjustesJogo> {
  if (voltarAoPadrao === true)
    return gravar({ ...(await lerAjustesJogo()), pastaInstalacoes: null })
  const opcoes = {
    title: 'Escolha onde ficam as instalações novas',
    properties: ['openDirectory' as const, 'createDirectory' as const]
  }
  const escolha = janela
    ? await dialog.showOpenDialog(janela, opcoes)
    : await dialog.showOpenDialog(opcoes)
  const pasta = escolha.filePaths[0]
  if (escolha.canceled || !pasta) return lerAjustesJogo()
  return gravar({ ...(await lerAjustesJogo()), pastaInstalacoes: pasta })
}
