/* eslint-disable @typescript-eslint/explicit-function-return-type -- JavaScript puro, sem tipos */
// Lê o .cpuprofile do processo principal e mostra os trechos em que ele ficou ocupado sem
// parar por mais de 300 ms (o que trava a janela), com as funções que mais apareceram.
import { readFileSync } from 'node:fs'

const p = JSON.parse(readFileSync(process.argv[2] ?? '.teste/perfil-principal.cpuprofile', 'utf8'))
const nos = new Map(p.nodes.map((n) => [n.id, n]))
const pai = new Map()
for (const n of p.nodes) for (const f of n.children ?? []) pai.set(f, n.id)
const ocioso = new Set(
  p.nodes.filter((n) => ['(idle)', '(program)'].includes(n.callFrame.functionName)).map((n) => n.id)
)

function pilha(id) {
  const r = []
  for (let x = id; x !== undefined; x = pai.get(x)) {
    const c = nos.get(x).callFrame
    if (c.functionName === '(root)') break
    const arq = c.url.split(/[\\/]/).pop()
    r.push(`${c.functionName || '(anônima)'} ${arq}:${c.lineNumber + 1}`)
  }
  return r
}

let t = p.startTime
const trechos = []
let atual = null
for (let i = 0; i < p.samples.length; i++) {
  t += p.timeDeltas[i]
  const ocupado = !ocioso.has(p.samples[i])
  if (ocupado) {
    if (!atual) atual = { inicio: t, fim: t, amostras: [] }
    atual.fim = t
    atual.amostras.push(p.samples[i])
  } else if (atual) {
    if (atual.fim - atual.inicio > 300_000) trechos.push(atual)
    atual = null
  }
}
console.log(`${trechos.length} trechos ocupados acima de 300 ms`)
for (const tr of trechos.sort((a, b) => b.fim - b.inicio - (a.fim - a.inicio)).slice(0, 8)) {
  const conta = new Map()
  for (const s of tr.amostras) {
    const chave = pilha(s).slice(0, 6).join('  <  ')
    conta.set(chave, (conta.get(chave) ?? 0) + 1)
  }
  console.log(
    `\n== ${((tr.fim - tr.inicio) / 1000).toFixed(0)} ms, aos ${((tr.inicio - p.startTime) / 1e6).toFixed(1)} s`
  )
  for (const [k, n] of [...conta].sort((a, b) => b[1] - a[1]).slice(0, 4))
    console.log(`  ${((n / tr.amostras.length) * 100).toFixed(0)}%  ${k}`)
}
