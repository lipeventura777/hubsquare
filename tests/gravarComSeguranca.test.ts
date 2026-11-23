import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gravarComSeguranca } from '../src/main/config'

// Duas gravações ao mesmo tempo no mesmo arquivo (a tela pede a mesma coisa de vários lugares):
// nenhuma pode falhar e o arquivo termina com o conteúdo inteiro de uma delas, sem sobra de .tmp.
test('gravarComSeguranca: gravações simultâneas no mesmo arquivo não falham', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'gravar-'))
  try {
    const arquivo = join(pasta, 'instalacoes.json')
    const textos = Array.from({ length: 30 }, (_, i) => JSON.stringify({ i, x: 'a'.repeat(5000) }))
    await Promise.all(textos.map((t) => gravarComSeguranca(arquivo, t)))
    assert.ok(textos.includes(readFileSync(arquivo, 'utf8')))
    assert.deepEqual(readdirSync(pasta), ['instalacoes.json'])
  } finally {
    rmSync(pasta, { recursive: true, force: true })
  }
})
