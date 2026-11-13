import { test } from 'node:test'
import assert from 'node:assert/strict'
import { causaProvavel } from '../src/main/causaTravamento.ts'
import { niveisDasLinhas } from '../src/shared/logs.ts'

test('explica as causas comuns de travamento e devolve null quando não sabe', () => {
  assert.match(causaProvavel('java.lang.OutOfMemoryError: Java heap space')!, /sem memória/)
  assert.match(causaProvavel('java.net.BindException: Address already in use')!, /porta/)
  assert.match(
    causaProvavel("Could not load 'plugins\\Essentials.jar' in folder 'plugins'")!,
    /"Essentials\.jar"/
  )
  assert.match(causaProvavel('Error occurred while enabling WorldEdit v7')!, /"WorldEdit"/)
  assert.match(causaProvavel('Incompatible mods found!')!, /mod incompatível/)
  assert.match(causaProvavel('A single server tick took 60.00 seconds')!, /parado tempo demais/)
  assert.equal(causaProvavel('java.lang.NullPointerException'), null)
})

test('nível de cada linha do log, com as linhas de continuação herdando o de cima', () => {
  assert.deepEqual(
    niveisDasLinhas([
      '[12:00:01] [Server thread/INFO]: Starting minecraft server',
      '[12:00:02] [Server thread/WARN]: Cuidado',
      '[12:00:03] [Server thread/ERROR]: Deu ruim',
      'java.lang.RuntimeException: x',
      '\tat a.b.C(C.java:1)',
      '[12:00:04 INFO]: Done (3.2s)!',
      '[12:00:05 WARN]: Paper aviso'
    ]),
    ['INFO', 'WARN', 'ERROR', 'ERROR', 'ERROR', 'INFO', 'WARN']
  )
})
