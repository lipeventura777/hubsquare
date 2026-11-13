import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularPosicao } from '../src/shared/posicaoFlutuante'

const janela = { largura: 1024, altura: 640 }
const ancora = (
  top: number,
  left = 100,
  largura = 200
): {
  top: number
  bottom: number
  left: number
  right: number
  width: number
} => ({ top, bottom: top + 36, left, right: left + largura, width: largura })

test('abre embaixo quando cabe', () => {
  const p = calcularPosicao(ancora(100), { altura: 200, largura: 200 }, janela, 'baixo', 'inicio')
  assert.deepEqual(p, { top: 140, left: 100, maxHeight: 640 - 136 - 4 - 8, cima: false })
})

test('vira para cima perto do fim da janela, colada em cima da âncora', () => {
  const p = calcularPosicao(ancora(560), { altura: 200, largura: 200 }, janela, 'baixo', 'inicio')
  assert.equal(p.cima, true)
  assert.equal(p.top, 560 - 4 - 200)
})

test('limita a altura ao espaço do lado escolhido (rolagem interna)', () => {
  const p = calcularPosicao(ancora(300), { altura: 2000, largura: 200 }, janela, 'baixo', 'inicio')
  assert.equal(p.cima, false) // embaixo tem mais espaço (296) que em cima (288)
  assert.equal(p.maxHeight, 640 - 336 - 4 - 8)
  assert.equal(p.top, 340)
})

test('prefere cima (autocompletar) mas desce se não couber em cima', () => {
  assert.equal(
    calcularPosicao(ancora(500), { altura: 200, largura: 200 }, janela, 'cima', 'inicio').cima,
    true
  )
  assert.equal(
    calcularPosicao(ancora(40), { altura: 200, largura: 200 }, janela, 'cima', 'inicio').cima,
    false
  )
})

test('não sai da janela pelos lados', () => {
  const direita = calcularPosicao(
    ancora(100, 950, 60),
    { altura: 100, largura: 300 },
    janela,
    'baixo',
    'inicio'
  )
  assert.equal(direita.left, 1024 - 300 - 8)
  const esquerda = calcularPosicao(
    ancora(100, 0, 40),
    { altura: 100, largura: 300 },
    janela,
    'baixo',
    'fim'
  )
  assert.equal(esquerda.left, 8)
})

test('centralizada no ponto (dica do gráfico)', () => {
  const p = calcularPosicao(
    ancora(300, 500, 0),
    { altura: 30, largura: 100 },
    janela,
    'cima',
    'centro'
  )
  assert.equal(p.left, 450)
  assert.equal(p.cima, true)
})
