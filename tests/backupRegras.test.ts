import assert from 'node:assert/strict'
import { test } from 'node:test'
import { antigosParaApagar } from '../src/main/backupRegras'

const b = (nome: string, protegido = false): { nome: string; protegido: boolean } => ({
  nome,
  protegido
})

test('rotação apaga só os velhos que não estão protegidos', () => {
  const lista = [b('5'), b('4'), b('3', true), b('2'), b('1', true)]
  assert.deepEqual(
    antigosParaApagar(lista, 2).map((x) => x.nome),
    ['2']
  )
  assert.deepEqual(antigosParaApagar(lista, 10), [])
  assert.deepEqual(antigosParaApagar([b('1', true)], 0), [])
})
