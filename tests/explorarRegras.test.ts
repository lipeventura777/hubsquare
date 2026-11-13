import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FiltrosExplorar } from '../src/shared/tipos'
import { ambienteDe, destinoDe, facetsExplorar, pastaNoPacote } from '../src/main/explorarRegras'
import { nomeSeguro } from '../src/main/modsRegras'

const base: FiltrosExplorar = {
  tipo: 'mod',
  termo: '',
  versao: null,
  loader: null,
  categorias: [],
  ambiente: null,
  codigoAberto: false,
  esconderInstalados: false,
  ordem: 'relevance',
  offset: 0
}

test('ambiente pelo environment do Modrinth', () => {
  assert.equal(ambienteDe(['client_only']), 'jogador')
  assert.equal(ambienteDe(['server_only', 'server_only_client_optional', 'unknown']), 'servidor')
  assert.equal(ambienteDe(['client_and_server']), 'ambos')
  assert.equal(ambienteDe(['client_only_server_optional']), 'ambos')
  assert.equal(ambienteDe(['unknown']), null)
  assert.equal(ambienteDe(undefined, 'unsupported', 'required'), 'jogador')
  assert.equal(ambienteDe(undefined, 'required', 'unsupported'), 'servidor')
})

test('facets: otimização para Fabric só do servidor', () => {
  const f = facetsExplorar(
    {
      ...base,
      versao: '26.3',
      loader: 'fabric',
      categorias: ['optimization'],
      ambiente: 'servidor',
      codigoAberto: true
    },
    [],
    []
  )
  assert.deepEqual(f, [
    ['project_type:mod'],
    ['categories:fabric'],
    ['versions:26.3'],
    ['categories:optimization'],
    [
      'environment:server_only',
      'environment:server_only_client_optional',
      'environment:dedicated_server_only'
    ],
    ['open_source:true']
  ])
})

test('facets: loader do servidor, esconder instalados e ambiente ignorado em shaders', () => {
  assert.deepEqual(
    facetsExplorar({ ...base, tipo: 'plugin', loader: 'servidor' }, ['paper', 'spigot'], []),
    [['project_type:plugin'], ['categories:paper', 'categories:spigot']]
  )
  assert.deepEqual(
    facetsExplorar({ ...base, esconderInstalados: true }, [], ['AANobbMI', 'mau"id']),
    [['project_type:mod'], ['project_id!=AANobbMI']]
  )
  assert.deepEqual(facetsExplorar({ ...base, tipo: 'shader', ambiente: 'jogador' }, [], []), [
    ['project_type:shader']
  ])
})

test('destino de cada tipo (shaders e itens do jogador nunca no servidor)', () => {
  assert.equal(destinoDe('shader', null, 'fabric').destino, 'amigos')
  assert.equal(destinoDe('mod', 'jogador', 'fabric').destino, 'amigos')
  assert.equal(destinoDe('mod', 'ambos', 'neoforge').destino, 'servidor')
  assert.equal(destinoDe('mod', 'servidor', 'paper').destino, 'incompativel')
  assert.equal(destinoDe('plugin', null, 'paper').destino, 'servidor')
  assert.equal(destinoDe('plugin', null, 'vanilla').destino, 'incompativel')
  assert.equal(destinoDe('datapack', null, 'vanilla').destino, 'datapack')
  assert.equal(destinoDe('resourcepack', null, 'paper').destino, 'resourcepack')
  assert.equal(destinoDe('modpack', null, 'vanilla').destino, 'modpack')
  assert.equal(pastaNoPacote('shader'), 'shaderpacks')
  assert.equal(pastaNoPacote('resourcepack'), 'resourcepacks')
  assert.equal(pastaNoPacote('mod'), 'mods')
})

test('nome seguro com outra extensão', () => {
  assert.equal(nomeSeguro('Terralith.zip', /\.zip$/i), true)
  assert.equal(nomeSeguro('Terralith.zip'), false)
  assert.equal(nomeSeguro('../x.zip', /\.zip$/i), false)
})

test('no PlaySquare, cada tipo vai para a pasta certa da instalação', () => {
  assert.equal(destinoDe('shader', null, 'fabric', true).destino, 'amigos')
  assert.equal(destinoDe('shader', null, 'vanilla', true).destino, 'incompativel')
  assert.equal(destinoDe('resourcepack', null, 'vanilla', true).destino, 'amigos')
  assert.equal(destinoDe('mod', 'ambos', 'fabric', true).destino, 'servidor') // pasta mods, com dependências
  assert.equal(destinoDe('mod', 'jogador', 'forge', true).destino, 'amigos')
  assert.equal(destinoDe('mod', 'jogador', 'vanilla', true).destino, 'incompativel')
  assert.equal(destinoDe('datapack', null, 'fabric', true).destino, 'incompativel')
  assert.equal(destinoDe('plugin', null, 'fabric', true).destino, 'incompativel')
})
