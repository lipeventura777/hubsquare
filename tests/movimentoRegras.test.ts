import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BRILHO_MAX,
  intervaloRaro,
  limiteDeParticulas,
  mudancaAtrasDoVidro,
  noMeio,
  onda,
  PARTE_DO_MEIO_MAX,
  PISCA_MAX_HZ,
  RARO_MAX_S,
  RARO_MIN_S,
  velocidadeMaxima
} from '../src/shared/movimentoRegras.ts'
import { hex, rgbDeTexto } from '../src/shared/contrasteRegras.ts'
import { BIOMAS } from '../src/shared/tipos.ts'

// Limites de movimento dos fundos vivos (Fase V6): as regras e cada um dos doze biomas rodando
// alguns minutos num canvas de mentira (só conta, não desenha).

const tela = (): object => ({
  width: 320,
  height: 180,
  getContext: () => ctx
})
const ctx = {
  fillStyle: '',
  globalAlpha: 1,
  canvas: {},
  fillRect: () => undefined,
  clearRect: () => undefined,
  drawImage: () => undefined
}
ctx.canvas = tela()
;(globalThis as { document?: unknown }).document = { createElement: tela }
const { ARTE, ALTURA, LARGURA } = await import('../src/renderer/src/fundo/biomas.ts')

test('regras: partículas, eventos raros, piscar e o meio da tela', () => {
  assert.equal(limiteDeParticulas(1), 60)
  assert.equal(limiteDeParticulas(0.5), 30)
  assert.equal(intervaloRaro(0), RARO_MIN_S)
  assert.equal(intervaloRaro(0.999999) <= RARO_MAX_S, true)
  assert.equal(intervaloRaro(5), RARO_MAX_S) // sorteio fora do intervalo não escapa
  // Uma onda de 10 Hz é desenhada a 3 Hz: no primeiro quarto do ciclo de 3 Hz ela chega a 1.
  assert.ok(Math.abs(onda(1 / (4 * PISCA_MAX_HZ), 10) - 1) < 1e-9)
  assert.deepEqual(velocidadeMaxima(320, 180), { x: 40, y: 22.5 })
  assert.equal(noMeio(59, 180), false)
  assert.equal(noMeio(60, 180), true)
  assert.equal(noMeio(120, 180), false)
  // Atrás de vidro escuro a 50%, preto ↔ branco muda bem mais que 20%.
  assert.ok(mudancaAtrasDoVidro([0, 0, 0], [255, 255, 255], [0, 0, 0], 0.5) > BRILHO_MAX)
})

const CSS = readFileSync(
  join(import.meta.dirname, '..', 'src', 'renderer', 'src', 'assets', 'tokens.css'),
  'utf8'
)
function vidroDo(bioma: string): { cor: [number, number, number]; alfa: number } {
  const seletor = bioma === 'dia' ? ":root,\n[data-bioma='dia'] {" : `[data-bioma='${bioma}'] {`
  const inicio = CSS.indexOf(seletor)
  const bloco = CSS.slice(inicio, CSS.indexOf('}', inicio))
  return {
    cor: rgbDeTexto(/--vidro-rgb:\s*([^;]+);/.exec(bloco)![1]),
    alfa: Number(/--vidro-alfa:\s*([^;]+);/.exec(bloco)![1])
  }
}

const SEGUNDOS = 240
const DT = 1 / 30
const VEL = velocidadeMaxima(LARGURA, ALTURA)

for (const bioma of BIOMAS) {
  test(`${bioma}: dentro dos limites de movimento`, () => {
    const vidro = vidroDo(bioma)
    for (const [a, b] of ARTE[bioma].brilhos) {
      const m = mudancaAtrasDoVidro(hex(a), hex(b), vidro.cor, vidro.alfa)
      assert.ok(m <= BRILHO_MAX, `${bioma}: brilho ${a}/${b} muda ${m.toFixed(2)} atrás do texto`)
    }
    for (const fracao of [1, 0.5]) {
      const cena = ARTE[bioma].criar()
      const ps = cena.particulas
      const antes = new Map(ps.map((q) => [q, { x: q.x, y: q.y, vida: q.vida }]))
      let noMeioTotal = 0
      let vivasTotal = 0
      let raroAntes = false
      const comecos: number[] = []
      for (let k = 1; k <= SEGUNDOS / DT; k++) {
        const t = k * DT
        cena.quadro(ctx as unknown as CanvasRenderingContext2D, t, DT, fracao, false)
        const vivas = ps.filter((q) => q.vida > 0)
        assert.ok(
          vivas.length <= Math.max(limiteDeParticulas(fracao), 26), // 26: as que já vêm na arte
          `${bioma} (${fracao}): ${vivas.length} partículas vivas em ${t.toFixed(1)} s`
        )
        if (t > 30) {
          // Depois que as partículas da arte parada já saíram de cena.
          vivasTotal += vivas.length
          noMeioTotal += vivas.filter((q) => noMeio(q.y, ALTURA)).length
          assert.ok(vivas.length <= limiteDeParticulas(fracao), `${bioma} (${fracao}): limite`)
        }
        for (const q of vivas) {
          const a = antes.get(q)!
          // Mesma partícula seguindo (a vida caiu um quadro); senão ela renasceu em outro lugar.
          if (!q.raro && a.vida > 0 && Math.abs(a.vida - q.vida - DT) < 1e-6) {
            assert.ok(Math.abs(q.x - a.x) / DT <= VEL.x + 1e-6, `${bioma}: rápido na horizontal`)
            assert.ok(
              Math.abs(q.y - a.y) / DT <= VEL.y + 1e-6,
              `${bioma}: rápido na vertical (tipo ${q.tipo}, ${a.y.toFixed(1)} → ${q.y.toFixed(1)}, vida ${a.vida.toFixed(2)} → ${q.vida.toFixed(2)})`
            )
          }
        }
        for (const q of ps) antes.set(q, { x: q.x, y: q.y, vida: q.vida })
        const raro = ps.some((q) => q.raro && q.vida > 0)
        if (raro && !raroAntes) comecos.push(t)
        raroAntes = raro
      }
      // Eventos raros: o primeiro depois de 20 s; entre o começo de um e o do próximo, 20 s ou mais.
      if (comecos.length) assert.ok(comecos[0] >= RARO_MIN_S - DT, `${bioma}: raro cedo demais`)
      comecos
        .slice(1)
        .forEach((t, i) =>
          assert.ok(t - comecos[i] >= RARO_MIN_S - DT, `${bioma}: raros a ${t - comecos[i]} s`)
        )
      const meio = vivasTotal ? noMeioTotal / vivasTotal : 0
      assert.ok(
        meio <= PARTE_DO_MEIO_MAX,
        `${bioma} (${fracao}): ${(meio * 100).toFixed(0)}% no meio`
      )
    }
  })
}
