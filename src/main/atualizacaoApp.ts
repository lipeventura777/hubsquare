import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { gravarComSeguranca } from './config'
import { avisarTela } from './servidor'
import { REPOSITORIO, urlDeVerdade, userAgent } from './rede'
import {
  INTERVALO,
  aplicarResposta,
  avisoParaMostrar,
  compararSemver,
  deveVerificar,
  lembrarDepois,
  lerEstado,
  motivoParaEsperar,
  pularVersao,
  type EstadoAviso,
  type MotivoEspera,
  type Ocupacao,
  type RespostaGitHub
} from './atualizacaoAppRegras'
import type { AvisoVersao } from '../shared/tipos'
import { registrarErro } from './registroErros'

// Versão nova do HubSquare (Fase M2 + Fase L1): ao abrir e a cada 6 h lê o último release público
// no GitHub (sem chave nem login), com cache em atualizacao-app.json (pasta de dados). Com
// "Atualizar automaticamente" ligado, o electron-updater baixa a versão em segundo plano (do
// mesmo release: latest.yml, instalador e .blockmap, com o sha512 conferido) e o aviso vira
// "Versão X pronta". Instala só com o clique ("Reiniciar e atualizar") ou ao fechar o app, e nunca
// com servidor ligado, backup, modpack instalando ou JOGAR preparando (motivoParaEsperar). Se o
// download falhar, o aviso continua com "Baixar" (a página do release) e o motivo vai para o
// erros.log.

const arquivo = (): string => join(app.getPath('userData'), 'atualizacao-app.json')
const URL_API = `https://api.github.com/repos/${REPOSITORIO}/releases/latest`

async function ler(): Promise<EstadoAviso> {
  try {
    return lerEstado(JSON.parse(await readFile(arquivo(), 'utf8')))
  } catch {
    return lerEstado(null)
  }
}

let ocupacao: () => Ocupacao = () => ({ servidor: 'desligado', backups: 0, modpacks: 0, jogar: 0 })
let pronta: string | null = null // versão já baixada, pronta para instalar
let esperando: MotivoEspera | null = null
let espera: NodeJS.Timeout | null = null

const paraTela = (e: EstadoAviso): AvisoVersao | null => {
  const r = avisoParaMostrar(app.getVersion(), e, Date.now())
  return r && { ...r, pronta: pronta === r.versao, esperando }
}

async function gravar(e: EstadoAviso): Promise<void> {
  await gravarComSeguranca(arquivo(), JSON.stringify(e, null, 2))
  avisarTela('appVersao:mudou', paraTela(e))
}

// Baixa a versão do aviso pelo electron-updater. O latest.yml do release precisa ser dessa
// mesma versão (senão tenta de novo no próximo ciclo).
async function baixar(versao: string): Promise<void> {
  if (pronta === versao) return
  const r = await autoUpdater.checkForUpdates()
  const v = r?.updateInfo.version
  if (!v || v !== versao || compararSemver(v, app.getVersion()) <= 0) return
  await autoUpdater.downloadUpdate()
  pronta = versao
  avisarTela('appVersao:mudou', paraTela(await ler()))
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
    if (!r) return
    const novo = aplicarResposta(e, r, REPOSITORIO, Date.now())
    await gravar(novo)
    const aviso = paraTela(novo)
    if (aviso && !aviso.pronta) await baixar(aviso.versao)
  })()
    .catch(registrarErro('atualizacaoApp.ts', 'conferir se há versão nova do HubSquare'))
    .finally(() => (emAndamento = null))
  return emAndamento
}

export function iniciarAvisoVersaoApp(comoEsta: () => Ocupacao): void {
  ocupacao = comoEsta
  autoUpdater.autoDownload = false // só baixa a versão do aviso (nunca uma pulada)
  autoUpdater.autoInstallOnAppQuit = true // "Ao fechar": instala depois que o app sai de vez
  autoUpdater.logger = null
  // O erro também volta pela promessa (já registrado em verificarVersaoApp); sem este ouvinte o
  // EventEmitter derrubaria o processo.
  autoUpdater.on('error', () => {})
  // Testes (HUBSQUARE_DADOS): o mesmo caminho do release no servidor simulado, e nunca instala
  // ao fechar (o "instalador" do teste não é um programa).
  if (process.env.HUBSQUARE_DADOS && process.env.HUBSQUARE_DOWNLOADS) {
    const config = join(process.env.HUBSQUARE_DADOS, 'app-update.yml')
    const url = urlDeVerdade(`https://github.com/${REPOSITORIO}/releases/latest/download`)
    writeFileSync(
      config,
      `provider: generic\nurl: ${url}\nupdaterCacheDirName: hubsquare-updater\n`
    )
    autoUpdater.updateConfigPath = config
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.autoInstallOnAppQuit = false
  }
  app.on('before-quit', () => {
    if (espera) clearInterval(espera)
    espera = null
  })
  void verificarVersaoApp()
  setInterval(() => void verificarVersaoApp(), INTERVALO)
}

export async function avisoVersaoApp(): Promise<AvisoVersao | null> {
  return paraTela(await ler())
}

export async function lembrarVersaoDepois(): Promise<void> {
  await gravar(lembrarDepois(await ler(), Date.now()))
}

export async function pularVersaoApp(): Promise<void> {
  const e = pularVersao(await ler())
  // A versão pulada não instala nem ao fechar.
  if (pronta && pronta === e.pulada) autoUpdater.autoInstallOnAppQuit = false
  await gravar(e)
}

// "Reiniciar e atualizar" (Fase L1): instala agora, ou espera o que estiver rodando terminar e
// então instala sozinho (a tela mostra o motivo enquanto isso). null = já está instalando.
export async function instalarVersaoApp(): Promise<MotivoEspera | null> {
  if (!pronta) return null
  esperando = motivoParaEsperar(ocupacao())
  if (!esperando) {
    autoUpdater.quitAndInstall(true, true)
    return null
  }
  espera ??= setInterval(() => {
    const antes = esperando
    esperando = motivoParaEsperar(ocupacao())
    // O motivo muda (desligou o servidor, agora é o backup): a tela acompanha.
    if (esperando !== antes) void ler().then((e) => avisarTela('appVersao:mudou', paraTela(e)))
    if (esperando) return
    if (espera) clearInterval(espera)
    espera = null
    autoUpdater.quitAndInstall(true, true)
  }, 5000)
  avisarTela('appVersao:mudou', paraTela(await ler()))
  return esperando
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
