import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Mede a instalação: tempo de cada etapa, memória (pico), travamento do event loop (o que
// congelaria a janela no app) e quantos avisos de progresso iriam para a tela por segundo.
// Grava tudo também na pasta de logs do app (%APPDATA%/ServSquare/logs).

const logs = join(process.env.APPDATA ?? '.', 'ServSquare', 'logs')
mkdirSync(logs, { recursive: true })
export const arquivoLog = join(
  logs,
  `repro-modpack-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
)

const inicio = Date.now()
let picoRss = 0
let picoHeap = 0
let maiorTrava = 0
let travasLongas = 0 // > 200 ms: a janela pareceria travada
let avisos = 0
let maiorRajada = 0
let rajada = 0
let etapa = ''
let inicioEtapa = Date.now()
let travaEtapa = 0

const mb = (b: number): string => `${(b / 1048576).toFixed(0)} MB`
const seg = (ms: number): string => `${(ms / 1000).toFixed(1)} s`

export function log(texto: string): void {
  const m = process.memoryUsage()
  const linha = `[${seg(Date.now() - inicio).padStart(7)}] [rss ${mb(m.rss).padStart(7)} heap ${mb(m.heapUsed).padStart(6)}] ${texto}`
  console.log(linha)
  appendFileSync(arquivoLog, linha + '\n')
}

let ultimo = Date.now()
const relogio = setInterval(() => {
  const agora = Date.now()
  const trava = agora - ultimo - 50
  ultimo = agora
  if (trava > maiorTrava) maiorTrava = trava
  if (trava > travaEtapa) travaEtapa = trava
  if (trava > 200) travasLongas++
  const m = process.memoryUsage()
  picoRss = Math.max(picoRss, m.rss)
  picoHeap = Math.max(picoHeap, m.heapUsed)
}, 50)
const porSegundo = setInterval(() => {
  maiorRajada = Math.max(maiorRajada, rajada)
  rajada = 0
}, 1000)

function fecharEtapa(): void {
  if (etapa)
    log(`  fim: "${etapa}" em ${seg(Date.now() - inicioEtapa)}, maior trava ${travaEtapa} ms`)
}

// Mesmo formato do aoProgredir do app.
export function progresso(p: {
  etapa: string
  recebido: number
  total: number
  feitos?: number
  arquivos?: number
}): void {
  avisos++
  rajada++
  const nome = p.etapa
    .replace(/\d+ de \d+.*$/, '')
    .replace(/:.*$/, '')
    .trim()
  if (nome !== etapa) {
    fecharEtapa()
    etapa = nome
    inicioEtapa = Date.now()
    travaEtapa = 0
    log(`etapa: ${p.etapa}`)
  }
}

export function resumo(arquivos: number): string {
  fecharEtapa()
  clearInterval(relogio)
  clearInterval(porSegundo)
  const r = [
    `tempo total: ${seg(Date.now() - inicio)}`,
    `pico de memória: rss ${mb(picoRss)}, heap ${mb(picoHeap)}`,
    `maior trava do event loop: ${maiorTrava} ms (${travasLongas} acima de 200 ms)`,
    `avisos de progresso: ${avisos} (no máximo ${maiorRajada} por segundo)`,
    `arquivos: ${arquivos}`
  ].join('\n')
  log('RESUMO\n' + r)
  return r
}
