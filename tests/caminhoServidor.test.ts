import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { caminhoNoServidor } from '../src/main/caminhoServidor.ts'

test('aceita caminhos dentro da pasta do servidor e recusa os de fora', async () => {
  const tudo = mkdtempSync(join(tmpdir(), 'servsquare-caminho-'))
  const raiz = join(tudo, 'servidor')
  const fora = join(tudo, 'segredo')
  mkdirSync(join(raiz, 'plugins'), { recursive: true })
  mkdirSync(fora)
  writeFileSync(join(raiz, 'server.properties'), '')
  // Junção do Windows (não precisa de administrador): parece pasta, mas aponta para fora.
  symlinkSync(fora, join(raiz, 'atalho'), 'junction')

  assert.equal(await caminhoNoServidor(raiz, ''), raiz)
  assert.equal(await caminhoNoServidor(raiz, 'server.properties'), join(raiz, 'server.properties'))
  assert.equal(await caminhoNoServidor(raiz, 'plugins/novo.yml'), join(raiz, 'plugins', 'novo.yml'))
  assert.equal(
    await caminhoNoServidor(raiz, 'pasta/nova/a.txt'),
    join(raiz, 'pasta', 'nova', 'a.txt')
  )

  for (const ruim of [
    '..',
    '..\\..\\',
    'plugins/../../segredo',
    fora,
    'C:\\Windows',
    'c:arquivo',
    '\\\\servidor\\c$',
    'arquivo.txt:fluxo',
    'NUL',
    'plugins/con.txt',
    'atalho',
    'atalho/arquivo.txt',
    'a\0b',
    42
  ]) {
    await assert.rejects(caminhoNoServidor(raiz, ruim), `deveria recusar ${String(ruim)}`)
  }
})
