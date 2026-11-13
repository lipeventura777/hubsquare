import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  conviteNosArgumentos,
  decidirModo,
  fecharDeVerdade,
  podeUsarModoAmigo
} from '../src/shared/modoRegras.ts'

// Modo amigo (Fase M6): quem decide o modo ao abrir, e o que vale em cada um.

test('primeira abertura, sem servidores: boas-vindas', () => {
  assert.deepEqual(decidirModo({ salvo: null, temServidores: false, abertoPorConvite: false }), {
    modo: null,
    sugerirAmigo: false
  })
})

test('aberto por convite e sem servidores: boas-vindas sugerindo o modo amigo', () => {
  assert.deepEqual(decidirModo({ salvo: null, temServidores: false, abertoPorConvite: true }), {
    modo: null,
    sugerirAmigo: true
  })
})

test('quem já tem servidores salvos fica no completo, sem boas-vindas (mesmo com convite)', () => {
  for (const abertoPorConvite of [false, true]) {
    assert.deepEqual(decidirModo({ salvo: null, temServidores: true, abertoPorConvite }), {
      modo: 'completo',
      sugerirAmigo: false
    })
  }
})

test('a escolha salva vale sempre (inclusive amigo com servidores guardados)', () => {
  assert.equal(
    decidirModo({ salvo: 'amigo', temServidores: true, abertoPorConvite: false }).modo,
    'amigo'
  )
  assert.equal(
    decidirModo({ salvo: 'completo', temServidores: false, abertoPorConvite: true }).modo,
    'completo'
  )
})

test('convite nos argumentos: link ou arquivo .hubsquare; o resto não', () => {
  assert.deepEqual(conviteNosArgumentos(['app.exe', 'hubsquare://convite/eyJ2IjoxfQ']), {
    link: 'hubsquare://convite/eyJ2IjoxfQ'
  })
  assert.deepEqual(conviteNosArgumentos(['app.exe', 'C:\\Users\\x\\Downloads\\Amigos.hubsquare']), {
    arquivo: 'C:\\Users\\x\\Downloads\\Amigos.hubsquare'
  })
  assert.equal(conviteNosArgumentos(['app.exe', '--jogar=abc']), null)
  assert.equal(conviteNosArgumentos(['hubsquare://outra/coisa']), null)
  assert.equal(conviteNosArgumentos(['hubsquare://convite/"; rm -rf']), null)
})

test('voltar ao amigo só com o servidor desligado; fechar no amigo sem nada rodando sai do app', () => {
  assert.equal(podeUsarModoAmigo('desligado'), true)
  assert.equal(podeUsarModoAmigo('ligado'), false)
  assert.equal(podeUsarModoAmigo('ligando'), false)
  assert.equal(fecharDeVerdade('amigo', 'desligado'), true)
  assert.equal(fecharDeVerdade('amigo', 'ligado'), false)
  assert.equal(fecharDeVerdade('completo', 'desligado'), false) // completo: bandeja, como sempre
  assert.equal(fecharDeVerdade(null, 'desligado'), false)
})
