import { test } from 'node:test'
import assert from 'node:assert/strict'
import { derivarAccent, luminancia } from '../src/renderer/src/aparencia/accent.ts'

test('hover e sombra ficam mais escuros que a cor, na mesma família', () => {
  const { hover, sombra } = derivarAccent('#2f6fd6')
  assert.ok(luminancia(hover) < luminancia('#2f6fd6'))
  assert.ok(luminancia(sombra) < luminancia(hover))
  assert.match(hover, /^#[0-9a-f]{6}$/)
})

test('cinza continua cinza', () => {
  const { hover } = derivarAccent('#808080')
  assert.equal(hover.slice(1, 3), hover.slice(3, 5))
  assert.equal(hover.slice(3, 5), hover.slice(5, 7))
})

test('cor clara pede texto escuro; cor escura pede texto branco', () => {
  assert.equal(derivarAccent('#e8c22b').textoEscuro, true)
  assert.equal(derivarAccent('#ffffff').textoEscuro, true)
  assert.equal(derivarAccent('#3c8527').textoEscuro, false)
  assert.equal(derivarAccent('#7e3ff2').textoEscuro, false)
})
