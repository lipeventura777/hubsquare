import { Worker } from 'node:worker_threads'

// Trabalho pesado de arquivos fora da thread principal (num worker), para a janela não travar:
// hash de arquivos grandes e apagar pastas com milhares de arquivos (um modpack extraído). O código do worker é curto e vai inline: assim
// funciona igual no app empacotado, nos testes e nos scripts.
const CODIGO = `
const { parentPort } = require('node:worker_threads')
const { createHash } = require('node:crypto')
const { createReadStream, rmSync } = require('node:fs')
parentPort.on('message', ({ id, caminho, algoritmo }) => {
  if (algoritmo === 'apagar') {
    try {
      rmSync(caminho, { recursive: true, force: true, maxRetries: 3 })
      parentPort.postMessage({ id, hash: '' })
    } catch (e) {
      parentPort.postMessage({ id, erro: String((e && e.message) || e) })
    }
    return
  }
  const h = createHash(algoritmo)
  createReadStream(caminho, { highWaterMark: 1 << 20 })
    .on('error', (e) => parentPort.postMessage({ id, erro: String(e && e.message || e) }))
    .on('data', (d) => h.update(d))
    .on('end', () => parentPort.postMessage({ id, hash: h.digest('hex') }))
})
`

let trabalhador: Worker | null = null
let proximo = 0
const esperando = new Map<number, { resolver: (h: string) => void; falhar: (e: Error) => void }>()

function obter(): Worker {
  if (trabalhador) return trabalhador
  const w = new Worker(CODIGO, { eval: true })
  w.unref() // não segura o app aberto
  w.on('message', (m: { id: number; hash?: string; erro?: string }) => {
    const p = esperando.get(m.id)
    esperando.delete(m.id)
    if (m.erro !== undefined) p?.falhar(new Error(m.erro))
    else p?.resolver(m.hash!)
  })
  // Se o worker cair, quem esperava recebe o erro e o próximo pedido cria outro.
  const cair = (e: unknown): void => {
    trabalhador = null
    for (const p of esperando.values()) p.falhar(e instanceof Error ? e : new Error(String(e)))
    esperando.clear()
  }
  w.on('error', cair)
  w.on('exit', (c) => c !== 0 && cair(new Error(`worker de hash saiu com código ${c}`)))
  trabalhador = w
  return w
}

// Apaga uma pasta inteira no worker (no Electron, o rm recursivo trava a janela por segundos).
export function apagarEmTrabalhador(pasta: string): Promise<void> {
  return hashEmTrabalhador(pasta, 'apagar').then(() => {})
}

export function hashEmTrabalhador(caminho: string, algoritmo = 'sha1'): Promise<string> {
  return new Promise((resolver, falhar) => {
    const id = proximo++
    esperando.set(id, { resolver, falhar })
    obter().postMessage({ id, caminho, algoritmo })
  })
}
