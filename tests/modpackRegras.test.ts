import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  caminhoDoPack,
  compararPack,
  downloadPermitido,
  lerIndice,
  licencaDoMod,
  licencaPermite,
  loaderDoIndice,
  precisaNoJogador,
  sugerirRam,
  type NoDisco
} from '../src/main/modpackRegras'

const H1 = 'a'.repeat(40)
const H512 = 'b'.repeat(128)

test('índice válido e inválido', () => {
  const bom = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0',
    name: 'Pack',
    files: [{ path: 'mods/a.jar', hashes: { sha1: H1, sha512: H512 }, downloads: [], fileSize: 1 }],
    dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.9' }
  }
  assert.equal(lerIndice(JSON.stringify(bom)).name, 'Pack')
  assert.throws(() => lerIndice('{'))
  assert.throws(() => lerIndice(JSON.stringify({ ...bom, game: 'outro' })))
  const ruim = { ...bom, files: [{ ...bom.files[0], path: '../fora.jar' }] }
  assert.throws(() => lerIndice(JSON.stringify(ruim)), /perigoso/)
})

test('loader do índice', () => {
  assert.deepEqual(loaderDoIndice({ minecraft: '1.21.1', 'fabric-loader': '0.16.9' }), {
    tipo: 'fabric',
    versaoLoader: '0.16.9'
  })
  assert.deepEqual(loaderDoIndice({ minecraft: '1.20.1', forge: '47.2.0' }).tipo, 'forge')
  assert.deepEqual(loaderDoIndice({ minecraft: '1.21.1', neoforge: '21.1.77' }).tipo, 'neoforge')
  assert.throws(() => loaderDoIndice({ minecraft: '1.21.1', 'quilt-loader': '0.26' }), /Quilt/)
  assert.throws(() => loaderDoIndice({ minecraft: '1.21.1' }))
  assert.throws(() => loaderDoIndice({ minecraft: '1.21.1', forge: '../x' }))
})

test('caminhos e domínios', () => {
  assert.equal(caminhoDoPack('config/a.toml'), true)
  assert.equal(caminhoDoPack('C:/x'), false)
  assert.equal(caminhoDoPack('mods/a.jar:fluxo'), false)
  assert.equal(caminhoDoPack('a/../../b'), false)
  assert.equal(downloadPermitido('https://cdn.modrinth.com/data/x/a.jar'), true)
  assert.equal(downloadPermitido('https://github.com/a/b/releases/x.jar'), true)
  assert.equal(downloadPermitido('https://exemplo.com/a.jar'), false)
  assert.equal(downloadPermitido('http://cdn.modrinth.com/a.jar'), false)
})

test('RAM pelo tamanho do pack', () => {
  assert.equal(sugerirRam(30, 14).gb, 4)
  assert.equal(sugerirRam(120, 14).gb, 6)
  assert.equal(sugerirRam(300, 14).gb, 8)
  const pouca = sugerirRam(300, 6)
  assert.equal(pouca.gb, 6)
  assert.match(pouca.explicacao, /só deixa usar 6 GB/)
})

test('comparação ao atualizar o pack', () => {
  const disco: Record<string, NoDisco> = {
    'mods/igual.jar': 'h1',
    'mods/velho.jar': 'h2', // o pack tirou, usuário não mexeu → apaga
    'config/mexido.toml': 'meu', // usuário mudou → conflito
    'config/intacto.toml': 'h4', // usuário não mexeu → escreve o novo
    'mods/desligado.jar': 'desativado',
    'config/removido-mexido.toml': 'meu2',
    'world/level.dat': 'x'
  }
  const r = compararPack(
    {
      'mods/igual.jar': 'h1',
      'mods/velho.jar': 'h2',
      'config/mexido.toml': 'h3',
      'config/intacto.toml': 'h4',
      'mods/desligado.jar': 'h5',
      'config/removido-mexido.toml': 'h6'
    },
    {
      'mods/igual.jar': 'h1',
      'mods/novo.jar': 'n1',
      'config/mexido.toml': 'n3',
      'config/intacto.toml': 'n4',
      'mods/desligado.jar': 'n5',
      'world/level.dat': 'n6'
    },
    (c) => disco[c] ?? null,
    (c) => c.startsWith('world/')
  )
  assert.deepEqual(r.escrever.sort(), ['config/intacto.toml', 'mods/novo.jar'])
  assert.deepEqual(r.apagar, ['mods/velho.jar'])
  assert.deepEqual(r.conflitos.map((c) => c.caminho).sort(), [
    'config/mexido.toml',
    'config/removido-mexido.toml',
    'mods/desligado.jar'
  ])
})

test('o que o jogador precisa', () => {
  assert.equal(precisaNoJogador(['client_and_server']), 'required')
  assert.equal(precisaNoJogador(['server_only']), null)
  assert.equal(precisaNoJogador(['dedicated_server_only']), null)
  assert.equal(precisaNoJogador(['server_only_client_optional']), 'optional')
  assert.equal(precisaNoJogador(undefined, 'unsupported'), null)
  assert.equal(precisaNoJogador(undefined, 'required'), 'required')
})

test('licença dos mods sem Modrinth', () => {
  assert.equal(licencaDoMod('{"license":"MIT"}', 'json'), 'MIT')
  assert.equal(licencaDoMod('{"license":["MIT","Apache-2.0"]}', 'json'), 'MIT OR Apache-2.0')
  assert.equal(licencaDoMod('modLoader="javafml"\nlicense="LGPL-3.0"\n', 'toml'), 'LGPL-3.0')
  assert.equal(licencaPermite('MIT'), true)
  assert.equal(licencaPermite('LGPL-3.0-only'), true)
  assert.equal(licencaPermite('All Rights Reserved'), false)
  assert.equal(licencaPermite('ARR'), false)
  assert.equal(licencaPermite('CC-BY-NC-4.0'), false)
  assert.equal(licencaPermite(null), false)
  assert.equal(licencaPermite('Minha licença'), false)
})
