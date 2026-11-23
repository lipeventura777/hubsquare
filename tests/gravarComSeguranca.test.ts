import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gravarComSeguranca, trocarComPaciencia } from '../src/main/config'

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

// Destino ocupado por um instante (no teste, uma pasta com arquivo no lugar do destino, que a troca
// recusa): tenta de novo e consegue quando libera. Sem liberar, desiste com o mesmo erro.
test('trocarComPaciencia: espera o destino liberar e desiste se não liberar', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'trocar-'))
  try {
    const de = join(pasta, 'a.tmp')
    const para = join(pasta, 'a.json')
    const ocupar = (): void => {
      mkdirSync(para)
      writeFileSync(join(para, 'x'), 'x')
    }
    writeFileSync(de, 'novo')
    ocupar()
    const erro = await trocarComPaciencia(de, para, 2).catch((e: NodeJS.ErrnoException) => e)
    assert.ok(erro instanceof Error, 'sem liberar, desiste')
    setTimeout(() => rmSync(para, { recursive: true, force: true }), 120)
    await trocarComPaciencia(de, para)
    assert.equal(readFileSync(para, 'utf8'), 'novo')
    await assert.rejects(trocarComPaciencia(join(pasta, 'nao-existe'), para), { code: 'ENOENT' })
  } finally {
    rmSync(pasta, { recursive: true, force: true })
  }
})
