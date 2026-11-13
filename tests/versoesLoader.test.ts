import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  argsDoRunBat,
  escolherForge,
  escolherNeoForge,
  mcDoNeoForge
} from '../src/main/tipos/versoesLoader'

test('versão do Minecraft a partir da NeoForge', () => {
  assert.equal(mcDoNeoForge('21.1.77'), '1.21.1')
  assert.equal(mcDoNeoForge('21.0.5-beta'), '1.21')
  assert.equal(mcDoNeoForge('20.2.3-beta'), '1.20.2')
  assert.equal(mcDoNeoForge('26.1.2.123'), '26.1.2')
  assert.equal(mcDoNeoForge('26.3.0.102'), '26.3')
  assert.equal(mcDoNeoForge('26.1.0.0-alpha.5'), '26.1')
})

test('NeoForge: estável mais nova ganha da beta', () => {
  const m = escolherNeoForge(['21.4.9-beta', '21.4.10', '21.4.75-beta', '21.4.12', '21.3.5-beta'])
  assert.equal(m.get('1.21.4'), '21.4.12')
  assert.equal(m.get('1.21.3'), '21.3.5-beta')
})

test('Forge: recomendada, senão a mais nova', () => {
  const m = escolherForge({
    '26.2-latest': '65.1.6',
    '26.2-recommended': '65.1.5',
    '26.1-latest': '62.0.9',
    '1.12.2-recommended': '14.23.5.2859',
    '1.12.2-latest': '14.23.5.2860'
  })
  assert.equal(m.get('26.2'), '65.1.5')
  assert.equal(m.get('26.1'), '62.0.9')
  assert.equal(m.get('1.12.2'), '14.23.5.2859')
})

test('arquivo de argumentos do run.bat', () => {
  const bat =
    '@echo off\r\njava @user_jvm_args.txt @libraries/net/neoforged/neoforge/26.3.0.102/win_args.txt %*\r\npause\r\n'
  assert.equal(argsDoRunBat(bat), 'libraries/net/neoforged/neoforge/26.3.0.102/win_args.txt')
  assert.equal(argsDoRunBat('@echo off\r\njava -jar x.jar\r\n'), null)
})
