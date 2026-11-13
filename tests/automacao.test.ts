import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AUTOMACAO_PADRAO, proximoReinicio, validarAutomacao } from '../src/shared/automacao'

test('configuração inválida volta para o padrão', () => {
  assert.deepEqual(validarAutomacao(undefined), AUTOMACAO_PADRAO)
  const v = validarAutomacao({
    vazio: { ligado: true, minutos: 2 },
    reinicio: { ligado: true, dias: [6, 1, 1, 9, 'x'], hora: '25:00' },
    backup: { ligado: true, horas: 100, manter: 0 }
  })
  assert.deepEqual(v.vazio, { ligado: true, minutos: 5 })
  assert.deepEqual(v.reinicio, { ligado: true, dias: [1, 6], hora: '05:00' })
  assert.deepEqual(v.backup, { ligado: true, horas: 48, manter: 1 })
})

test('próximo reinício', () => {
  // terça-feira, 10/11/2026, 12:00 (hora local)
  const agora = new Date(2026, 10, 10, 12, 0, 0)
  assert.equal(agora.getDay(), 2)
  // hoje mais tarde
  assert.deepEqual(proximoReinicio([2], '18:30', agora), new Date(2026, 10, 10, 18, 30))
  // hoje já passou: semana que vem
  assert.deepEqual(proximoReinicio([2], '05:00', agora), new Date(2026, 10, 17, 5, 0))
  // sábado
  assert.deepEqual(proximoReinicio([6, 0], '05:00', agora), new Date(2026, 10, 14, 5, 0))
  // exatamente no horário conta como já passado
  assert.deepEqual(proximoReinicio([2], '12:00', agora), new Date(2026, 10, 17, 12, 0))
  assert.equal(proximoReinicio([], '05:00', agora), null)
})
