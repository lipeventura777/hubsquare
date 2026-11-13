import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeDeExibicao, nomeLimpo } from '../src/main/nomeRegras.ts'

// Fase V3: nomes de exibição com os pontos da versão; a pasta continua a de sempre.

test('nome sugerido mantém os pontos e tira o resto', () => {
  assert.equal(nomeLimpo('COBBLEVERSE-1.7.42-CF'), 'COBBLEVERSE-1.7.42-CF')
  assert.equal(nomeLimpo('Cobbleverse 1.7.42'), 'Cobbleverse 1.7.42')
  assert.equal(nomeLimpo('  Pack: "Mega"  2.0.  '), 'Pack Mega 2.0')
  assert.equal(nomeLimpo('x'.repeat(40)).length, 32)
})

test('instalação antiga: a versão do modpack volta com pontos', () => {
  const pack = { nome: 'COBBLEVERSE', versao: '1.7.42' }
  assert.equal(nomeDeExibicao('COBBLEVERSE-1 7 42-CF', pack), 'COBBLEVERSE-1.7.42-CF')
  assert.equal(nomeDeExibicao('Cobbleverse 1 7 42', pack), 'Cobbleverse 1.7.42')
})

test('nome escolhido pelo jogador, sem pack ou já com pontos: fica igual', () => {
  const pack = { nome: 'COBBLEVERSE', versao: '1.7.42' }
  assert.equal(nomeDeExibicao('COBBLEVERSE dos NOIA', pack), 'COBBLEVERSE dos NOIA')
  assert.equal(nomeDeExibicao('Pack 11 7 42', pack), 'Pack 11 7 42')
  assert.equal(nomeDeExibicao('COBBLEVERSE-1 7 42-CF', null), 'COBBLEVERSE-1 7 42-CF')
  assert.equal(nomeDeExibicao('COBBLEVERSE 1.7.42', pack), 'COBBLEVERSE 1.7.42')
  assert.equal(
    nomeDeExibicao('COBBLEVERSE', { nome: 'COBBLEVERSE', versao: '1.0.0' }),
    'COBBLEVERSE'
  )
})
