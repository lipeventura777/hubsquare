import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contarModsDaInstalacao } from '../src/main/jogoRegras.ts'

// Fase V3: a memória sugerida conta os mods que a instalação vai ter, não só os que já chegaram.

const esperados = Array.from({ length: 300 }, (_, n) => `mods/mod-${n}.jar`)

test('instalação ainda não instalada: conta os mods do servidor (não 0)', () => {
  assert.equal(contarModsDaInstalacao([], esperados), 300)
})

test('instalada: os da pasta e os esperados não contam duas vezes; desligados e outros arquivos não contam', () => {
  const naPasta = ['mod-0.jar', 'MOD-1.jar', 'meu-mod.jar', 'velho.jar.disabled', 'leia.txt']
  assert.equal(contarModsDaInstalacao(naPasta, esperados), 301)
  assert.equal(contarModsDaInstalacao(naPasta, ['resourcepacks/P.zip']), 3)
  assert.equal(contarModsDaInstalacao(['mod-0.jar'], ['mods\\mod-0.jar']), 1)
})
