import { app, shell } from 'electron'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { gravarComSeguranca } from './config'
import { avisarTela } from './servidor'
import { REPOSITORIO, urlDeVerdade, userAgent } from './rede'
import {
  INTERVALO,
  aplicarResposta,
  avisoParaMostrar,
  deveVerificar,
  lembrarDepois,
  lerEstado,
  pularVersao,
  type EstadoAviso,
  type ReleaseApp,
  type RespostaGitHub
} from './atualizacaoAppRegras'

// Aviso de versão nova do HubSquare (Fase M2): ao abrir e a cada 6 h lê o último release público
// no GitHub (sem chave nem login), com cache em atualizacao-app.json (pasta de dados). Só avisa:
// "Baixar" abre a página do release no navegador; nada é baixado nem instalado sozinho.

const arquivo = (): string => join(app.getPath('userData'), 'atualizacao-app.json')
const URL_API = `https://api.github.com/repos/${REPOSITORIO}/releases/latest`

async function ler(): Promise<EstadoAviso> {
  try {
    return lerEstado(JSON.parse(await readFile(arquivo(), 'utf8')))
  } catch {
    return lerEstado(null)
  }
}

async function gravar(e: EstadoAviso): Promise<void> {
  await gravarComSeguranca(arquivo(), JSON.stringify(e, null, 2))
  avisarTela('appVersao:mudou', avisoParaMostrar(app.getVersion(), e, Date.now()))
}

// Sem internet, tempo esgotado ou qualquer erro: null (nada é mostrado, nada dá erro).
async function pedirGitHub(etag: string | null): Promise<RespostaGitHub> {
  try {
    const r = await fetch(urlDeVerdade(URL_API), {
      headers: {
        'User-Agent': userAgent(),
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(etag ? { 'If-None-Match': etag } : {})
      },
      signal: AbortSignal.timeout(10_000)
    })
    const json = r.status === 200 ? await r.json() : null
    return { status: r.status, etag: r.headers.get('etag'), json }
  } catch {
    return null
  }
}

let emAndamento: Promise<void> | null = null

export function verificarVersaoApp(forcar = false): Promise<void> {
  emAndamento ??= (async () => {
    const e = await ler()
    if (!e.ligado || (!forcar && !deveVerificar(e, Date.now()))) return
    const r = await pedirGitHub(e.etag)
    if (r) await gravar(aplicarResposta(e, r, REPOSITORIO, Date.now()))
  })()
    .catch(() => {})
    .finally(() => (emAndamento = null))
  return emAndamento
}

export function iniciarAvisoVersaoApp(): void {
  void verificarVersaoApp()
  setInterval(() => void verificarVersaoApp(), INTERVALO)
}

export async function avisoVersaoApp(): Promise<ReleaseApp | null> {
  return avisoParaMostrar(app.getVersion(), await ler(), Date.now())
}

export async function lembrarVersaoDepois(): Promise<void> {
  await gravar(lembrarDepois(await ler(), Date.now()))
}

export async function pularVersaoApp(): Promise<void> {
  await gravar(pularVersao(await ler()))
}

// "Baixar": só a página do release guardado (já conferida em releaseDoGitHub).
export async function abrirPaginaVersaoApp(): Promise<void> {
  const r = (await ler()).release
  if (r?.url.startsWith(`https://github.com/${REPOSITORIO}/releases/`)) {
    await shell.openExternal(r.url)
  }
}

export async function avisoVersaoLigado(): Promise<boolean> {
  return (await ler()).ligado
}

export async function ligarAvisoVersao(ligado: unknown): Promise<boolean> {
  const e = { ...(await ler()), ligado: ligado !== false }
  await gravar(e)
  if (e.ligado) void verificarVersaoApp(true)
  return e.ligado
}
