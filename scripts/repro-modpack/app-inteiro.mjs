/* eslint-disable @typescript-eslint/explicit-function-return-type -- JavaScript puro, sem tipos */
// Abre o HubSquare de verdade (out/, depois do npm run build), com janela e tela, mas com todas
// as pastas (dados, Documentos, Downloads, temporários) na pasta de testes. Faz o mesmo que a
// tela faz ao importar e criar o servidor do modpack, recarrega (como "Ir para o painel") e
// mede: janela sem responder, tempo de resposta da tela, memória de cada processo e quedas.
// Uso: npm run repro:modpack:app [-- caminho-do-pack]  (roda dentro do Electron)
import electron from 'electron'
import { appendFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const { app, dialog } = electron
const raiz = resolve(import.meta.dirname, '..', '..')
const arquivo = resolve(process.argv[2] ?? join(raiz, '.teste', 'COBBLEVERSE 1.0.0.mrpack'))
const base = join(raiz, '.teste', 'app')
rmSync(base, { recursive: true, force: true })
const mapa = {
  appData: join(base, 'appdata'),
  documents: join(base, 'Documentos'),
  downloads: join(base, 'Downloads'),
  temp: join(base, 'tmp')
}
for (const p of Object.values(mapa)) mkdirSync(p, { recursive: true })
const getPathReal = app.getPath.bind(app)
app.getPath = (nome) => mapa[nome] ?? getPathReal(nome)
process.env.TEMP = process.env.TMP = mapa.temp
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [arquivo] })

const logs = join(process.env.APPDATA, 'ServSquare', 'logs')
mkdirSync(logs, { recursive: true })
const arquivoLog = join(logs, `repro-app-${new Date().toISOString().replace(/[:.]/g, '-')}.log`)
const t0 = Date.now()
const log = (t) => {
  const l = `[${((Date.now() - t0) / 1000).toFixed(1).padStart(7)} s] ${t}`
  console.log(l)
  appendFileSync(arquivoLog, l + '\n')
}
log(`log em ${arquivoLog}; pack ${arquivo}`)

let janela = null
let picoPrincipal = 0
let picoTela = 0
let maiorTravaPrincipal = 0
let maiorRespostaTela = 0
let semResposta = 0

app.on('browser-window-created', (_e, w) => {
  janela = w
  w.on('unresponsive', () => {
    semResposta++
    log('JANELA SEM RESPONDER (o Windows mostraria "Não está respondendo")')
  })
  w.on('responsive', () => log('janela voltou a responder'))
  w.webContents.on('render-process-gone', (_e, d) => log(`TELA CAIU: ${JSON.stringify(d)}`))
  w.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') log(`tela ${e.level}: ${e.message}`)
  })
})
app.on('child-process-gone', (_e, d) => log(`PROCESSO CAIU: ${JSON.stringify(d)}`))
process.on('exit', (c) => log(`processo principal saindo, código ${c}`))

// Cada pedido da tela (IPC): quanto demora e quais estavam rodando numa trava.
const rodando = new Map()
const handleReal = electron.ipcMain.handle.bind(electron.ipcMain)
electron.ipcMain.handle = (canal, fn) =>
  handleReal(canal, async (...a) => {
    const id = Symbol()
    const t = Date.now()
    rodando.set(id, canal)
    try {
      return await fn(...a)
    } finally {
      rodando.delete(id)
      const d = Date.now() - t
      if (d > 2000) log(`pedido ${canal} levou ${d} ms`)
    }
  })

// Trava do processo principal e memória de todos os processos.
let ultimo = Date.now()
setInterval(() => {
  const agora = Date.now()
  const trava = agora - ultimo - 100
  if (trava > 300)
    log(`TRAVA do processo principal: ${trava} ms; rodando: ${[...rodando.values()].join(', ')}`)
  maiorTravaPrincipal = Math.max(maiorTravaPrincipal, trava)
  ultimo = agora
  for (const m of app.getAppMetrics()) {
    const mb = m.memory.workingSetSize / 1024
    if (m.type === 'Browser') picoPrincipal = Math.max(picoPrincipal, mb)
    if (m.type === 'Tab') picoTela = Math.max(picoTela, mb)
  }
}, 100)

// A tela responde? (um executeJavaScript vazio; demora = interface travada)
async function sondarTela() {
  for (;;) {
    await new Promise((r) => setTimeout(r, 500))
    if (!janela || janela.isDestroyed()) continue
    const t = Date.now()
    await janela.webContents.executeJavaScript('1').catch(() => {})
    const d = Date.now() - t
    maiorRespostaTela = Math.max(maiorRespostaTela, d)
    if (d > 1000) log(`tela demorou ${d} ms para responder`)
  }
}

const tela = (codigo) => janela.webContents.executeJavaScript(codigo, true)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function roteiro() {
  while (!janela) await esperar(200)
  await new Promise((r) =>
    janela.webContents.isLoading() ? janela.webContents.once('did-finish-load', r) : r()
  )
  log('tela carregada')
  void sondarTela()
  await tela(`window.__avisos = 0; window.api.aoProgredir(() => window.__avisos++); true`)
  log('analisando (como "Abrir arquivo .mrpack")')
  const a = await tela('window.api.analisarModpackArquivo()')
  if (!a.ok) throw new Error(JSON.stringify(a.erro))
  log(`análise: ${a.valor.nome}, ${a.valor.mods} mods`)
  log('criando o servidor (como "Criar servidor")')
  const c = await tela(
    `window.api.criarDeModpack({ token: ${JSON.stringify(a.valor.token)}, nome: 'Cobbleverse teste', aceitouEula: true })`
  )
  if (!c.ok) throw new Error(JSON.stringify(c.erro))
  log(`criado em ${c.valor.pasta}; avisos de progresso na tela: ${await tela('window.__avisos')}`)
  log('recarregando a tela (como "Ir para o painel") e esperando 3 min no Painel')
  janela.webContents.reload()
  await esperar(180_000)
  log('PlaySquare: listando instalações (cria a do servidor novo)')
  const l = await tela('window.api.listarInstalacoes()')
  log(`instalações: ${l.ok ? l.valor.map((i) => i.nome).join(', ') : JSON.stringify(l.erro)}`)
  await esperar(30_000)
}

// Perfil de CPU do processo principal (para achar o que trava): .teste/perfil-principal.cpuprofile
const { Session } = await import('node:inspector/promises')
const perfil = new Session()
perfil.connect()
await perfil.post('Profiler.enable')
await perfil.post('Profiler.setSamplingInterval', { interval: 5000 })
await perfil.post('Profiler.start')

app.whenReady().then(() =>
  roteiro()
    .catch((e) => log(`FALHOU: ${e.stack ?? e}`))
    .finally(async () => {
      const { profile } = await perfil.post('Profiler.stop')
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(raiz, '.teste', 'perfil-principal.cpuprofile'), JSON.stringify(profile))
      log(
        [
          'RESUMO',
          `tempo total: ${((Date.now() - t0) / 1000).toFixed(0)} s`,
          `pico de memória: principal ${picoPrincipal.toFixed(0)} MB, tela ${picoTela.toFixed(0)} MB`,
          `maior trava do processo principal: ${maiorTravaPrincipal} ms`,
          `maior tempo de resposta da tela: ${maiorRespostaTela} ms`,
          `vezes que a janela ficou sem responder: ${semResposta}`
        ].join('\n')
      )
      app.exit(0)
    })
)

await import('../../out/main/index.js')
