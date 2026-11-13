import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  acimaDoOrcamento,
  AMOSTRAS,
  deveAnimar,
  deveDesenhar,
  modoInicial,
  msAtePausaSemFoco,
  passo,
  ritmo,
  type Situacao
} from '../src/shared/animacaoRegras.ts'

// Fundo animado (Fase V2): quando pausa, em que ritmo e quando cai para o modo leve.

const normal: Situacao = {
  visivel: true,
  semFocoDesde: null,
  jogoAberto: false,
  modpackInstalando: false,
  agora: 100_000
}

test('anima com a janela aberta e o modo ligado', () => {
  assert.equal(deveAnimar('completa', normal), true)
  assert.equal(deveAnimar('leve', normal), true)
  assert.equal(deveAnimar('desligada', normal), false)
})

test('pausa com a janela minimizada ou na bandeja', () => {
  assert.equal(deveAnimar('completa', { ...normal, visivel: false }), false)
})

test('pausa com o jogo aberto pelo PlaySquare', () => {
  assert.equal(deveAnimar('completa', { ...normal, jogoAberto: true }), false)
})

test('pausa durante a instalação de um modpack', () => {
  assert.equal(deveAnimar('leve', { ...normal, modpackInstalando: true }), false)
})

test('sem foco: continua até 30 s e então pausa', () => {
  const s = { ...normal, semFocoDesde: normal.agora - 29_000 }
  assert.equal(deveAnimar('completa', s), true)
  assert.equal(msAtePausaSemFoco(s), 1000)
  assert.equal(deveAnimar('completa', { ...s, agora: s.agora + 1000 }), false)
  assert.equal(msAtePausaSemFoco(normal), null)
})

test('ritmo: completa a 30 quadros, leve a 15 com metade das partículas', () => {
  assert.deepEqual(ritmo('completa'), { fps: 30, particulas: 1 })
  assert.deepEqual(ritmo('leve'), { fps: 15, particulas: 0.5 })
})

test('não acelera em telas de 144 Hz: só desenha no intervalo do ritmo', () => {
  // Uma tela de 144 Hz chama a cada ~6,9 ms; a 30 quadros só 1 em cada ~5 vira desenho.
  let ultimo = 0
  let desenhos = 0
  for (let t = 0; t <= 1000; t += 1000 / 144) {
    if (deveDesenhar(ultimo, t, 30)) {
      desenhos++
      ultimo = t
    }
  }
  assert.ok(desenhos >= 28 && desenhos <= 31, `desenhou ${desenhos} quadros em 1 s`)
})

test('movimento por deltaTime, sem salto depois de uma pausa', () => {
  assert.equal(passo(1000, 1033), 0.033)
  assert.equal(passo(1000, 61_000), 0.1)
  assert.equal(passo(1000, 900), 0)
})

test('cai para leve quando o desenho passa de 4 ms em média', () => {
  assert.equal(acimaDoOrcamento(Array(AMOSTRAS).fill(3.9)), false)
  assert.equal(acimaDoOrcamento(Array(AMOSTRAS).fill(4.5)), true)
  // Um pico só não derruba; poucas amostras ainda não decidem.
  assert.equal(acimaDoOrcamento([...Array(AMOSTRAS - 1).fill(2), 60]), false)
  assert.equal(acimaDoOrcamento(Array(10).fill(9)), false)
})

test('reduzir movimento do Windows começa no modo leve (sem escolha salva)', () => {
  assert.equal(modoInicial(undefined, true), 'leve')
  assert.equal(modoInicial(undefined, false), 'completa')
  assert.equal(modoInicial('completa', true), 'completa') // escolha do usuário vale
})
