import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lerMotd, semCodigos } from '../src/shared/motd'

test('cores e estilos do MOTD', () => {
  const t = lerMotd('Olá §6§lDourado §rnormal §cvermelho')
  assert.deepEqual(
    t.map((x) => [x.texto, x.cor, x.negrito]),
    [
      ['Olá ', null, false],
      ['Dourado ', '#ffaa00', true],
      ['normal ', null, false],
      ['vermelho', '#ff5555', false]
    ]
  )
})

test('cor nova limpa o negrito, como no jogo', () => {
  const t = lerMotd('§lA§aB')
  assert.equal(t[0].negrito, true)
  assert.deepEqual([t[1].negrito, t[1].cor], [false, '#55ff55'])
})

test('contagem ignora os códigos', () => {
  assert.equal(semCodigos('§6§lAção§r!'), 'Ação!')
  assert.equal(semCodigos('100§'), '100§') // § sozinho no fim fica
})
