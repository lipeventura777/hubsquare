import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ehMaisNova,
  escolherVersao,
  nomeSeguro,
  soDoJogador,
  urlDoModrinth
} from '../src/main/modsRegras'

test('só do jogador', () => {
  assert.equal(soDoJogador(['client_only']), true)
  assert.equal(soDoJogador(['singleplayer_only']), true)
  assert.equal(soDoJogador(['client_and_server']), false)
  assert.equal(soDoJogador(['client_only_server_optional']), false)
  assert.equal(soDoJogador([], 'unsupported'), true)
  assert.equal(soDoJogador(undefined, 'required'), false)
})

const v = (
  id: string,
  tipo: string,
  data: string,
  status?: string
): { id: string; version_type: string; date_published: string; status?: string } => ({
  id,
  version_type: tipo,
  date_published: data,
  status
})

test('escolhe a release mais nova, senão a mais nova', () => {
  assert.equal(
    escolherVersao([
      v('a', 'release', '2026-01-01'),
      v('b', 'beta', '2026-03-01'),
      v('c', 'release', '2026-02-01'),
      v('d', 'release', '2026-04-01', 'archived')
    ])?.id,
    'c'
  )
  assert.equal(
    escolherVersao([v('a', 'beta', '2026-01-01'), v('b', 'alpha', '2026-02-01')])?.id,
    'b'
  )
  assert.equal(escolherVersao([]), undefined)
})

test('só atualiza para versão publicada depois', () => {
  assert.equal(ehMaisNova(v('n', 'release', '2026-05-01'), v('a', 'beta', '2026-04-01')), true)
  assert.equal(ehMaisNova(v('n', 'release', '2026-03-01'), v('a', 'beta', '2026-04-01')), false)
  assert.equal(ehMaisNova(v('a', 'release', '2026-04-01'), v('a', 'release', '2026-04-01')), false)
})

test('nome de arquivo e URL aceitos', () => {
  assert.equal(nomeSeguro('fabric-api-0.120.0+26.3.jar'), true)
  assert.equal(nomeSeguro('../mods/x.jar'), false)
  assert.equal(nomeSeguro('x.zip'), false)
  assert.equal(nomeSeguro('.x.jar'), false)
  assert.equal(urlDoModrinth('https://cdn.modrinth.com/data/P7dR8mSH/versions/x/a.jar'), true)
  assert.equal(urlDoModrinth('https://cdn.modrinth.com.mal.com/a.jar'), false)
  assert.equal(urlDoModrinth('http://cdn.modrinth.com/a.jar'), false)
})
