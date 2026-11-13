import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aplicarPerfil,
  escolherShader,
  faltandoNaPasta,
  montarPerfil
} from '../src/main/launcherRegras.ts'
import { ativarPacks } from '../src/main/compatRegras.ts'

// Correção M1: o jogo abre na pasta da instalação, com os mods, os packs e o shader.

const PERFIS = JSON.stringify({
  profiles: { outro: { name: 'Do jogador', type: 'custom', gameDir: 'D:\\x' } },
  settings: { locale: 'pt-BR' },
  version: 3
})

for (const pasta of [
  'C:\\Users\\Ana Paula\\Documents\\ServSquare\\jogo\\COBBLEVERSE-1 7 42-CF',
  'C:\\Users\\João Ávila\\Documentos\\ServSquare\\jogo\\Ação & Aventura',
  'C:\\Users\\ana\\OneDrive\\Documentos\\ServSquare\\jogo\\Meu Mundo'
]) {
  test(`gameDir absoluto e intacto no JSON: ${pasta}`, () => {
    const perfil = montarPerfil({
      nome: 'Inst',
      versaoId: 'fabric-loader-0.20.1-1.21.1',
      pasta,
      ram: 6,
      agora: '2026-11-13T20:00:00.000Z'
    })
    const lido = JSON.parse(aplicarPerfil(PERFIS, 'hubsquare-1', perfil))
    assert.equal(lido.profiles['hubsquare-1'].gameDir, pasta)
    assert.match(lido.profiles['hubsquare-1'].javaArgs, /^-Xmx6G /)
    assert.equal(lido.profiles['hubsquare-1'].lastVersionId, 'fabric-loader-0.20.1-1.21.1')
    // O perfil do jogador e as configurações ficam iguais.
    assert.deepEqual(lido.profiles.outro, JSON.parse(PERFIS).profiles.outro)
    assert.deepEqual(lido.settings, { locale: 'pt-BR' })
  })
}

test('gameDir com barras normais ou ".." vira o caminho absoluto do Windows', () => {
  const p = montarPerfil({
    nome: 'x',
    versaoId: 'v',
    pasta: 'C:/Users/ana/Documents/ServSquare/jogo/../jogo/Mundo',
    ram: 4,
    agora: 'a'
  })
  assert.equal(p.gameDir, 'C:\\Users\\ana\\Documents\\ServSquare\\jogo\\Mundo')
  assert.equal(p.icon, 'Furnace')
  assert.equal(p.resolution, undefined)
  const r = montarPerfil({
    nome: 'x',
    versaoId: 'v',
    pasta: 'C:\\a',
    ram: 4,
    agora: 'a',
    resolucao: { largura: 1280, altura: 720 },
    imagem: 'data:image/png;base64,AAAA'
  })
  assert.deepEqual(r.resolution, { width: 1280, height: 720 })
  assert.equal(r.icon, 'data:image/png;base64,AAAA')
})

test('o que falta na pasta (desligado pelo jogador conta como presente)', () => {
  assert.deepEqual(
    faltandoNaPasta(
      ['mods/a.jar', 'mods/b.jar', 'resourcepacks/P.zip', 'shaderpacks/S.zip'],
      ['mods/A.jar', 'mods/b.jar.disabled', 'resourcepacks/P.zip']
    ),
    ['shaderpacks/S.zip']
  )
  assert.deepEqual(faltandoNaPasta(['mods/a.jar'], []), ['mods/a.jar'])
})

test('options.txt existente: só a linha resourcePacks muda, packs do servidor por cima na ordem', () => {
  const antes = 'version:3955\nfov:0.5\nresourcePacks:["vanilla","file/Meu.zip"]\nlang:pt_br\n'
  const depois = ativarPacks(antes, ['Primeiro.zip', 'Segundo.zip'])
  assert.equal(
    depois,
    'version:3955\nfov:0.5\nresourcePacks:["vanilla","file/Meu.zip","file/Segundo.zip","file/Primeiro.zip"]\nlang:pt_br\n'
  )
})

test('options.txt vazio ou inexistente: só a linha resourcePacks', () => {
  assert.equal(ativarPacks('', ['P.zip']), 'resourcePacks:["vanilla","file/P.zip"]\n')
})

test('shader: sem arquivo, escolhe o primeiro e liga; escolha válida do jogador fica', () => {
  assert.equal(escolherShader('', ['A.zip', 'B.zip']), 'shaderPack=A.zip\nenableShaders=true\n')
  const meu = 'maxShadowRenderDistance=32\nshaderPack=B.zip\nenableShaders=false\n'
  assert.equal(escolherShader(meu, ['A.zip', 'B.zip']), meu)
  assert.equal(
    escolherShader('maxShadowRenderDistance=32\nshaderPack=Sumiu.zip\n', ['A.zip']),
    'maxShadowRenderDistance=32\nshaderPack=A.zip\nenableShaders=true\n'
  )
  assert.equal(escolherShader('x=1\n', []), 'x=1\n')
})
