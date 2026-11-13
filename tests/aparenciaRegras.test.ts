import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrarAparencia, PADRAO } from '../src/main/aparenciaRegras.ts'

// Migração do aparencia.json para os biomas (Fase V1): nada do usuário se perde.

const antigo = {
  tema: 'escuro',
  destaque: '#3c8527',
  destaquePlay: '#2f6fd6',
  escurecimento: 0.4,
  fundo: 'fundo-123.png',
  fundoEmTodoApp: true,
  reduzirAnimacoes: true
}

test('escuro vira Dia; claro vira Dia claro', () => {
  assert.equal(migrarAparencia(antigo, false).aparencia.bioma, 'dia')
  assert.equal(migrarAparencia({ ...antigo, tema: 'claro' }, true).aparencia.bioma, 'diaClaro')
})

test('"seguir o Windows" usa o tema do Windows na hora da migração', () => {
  assert.equal(migrarAparencia({ ...antigo, tema: 'sistema' }, true).aparencia.bioma, 'dia')
  assert.equal(migrarAparencia({ ...antigo, tema: 'sistema' }, false).aparencia.bioma, 'diaClaro')
})

test('imagem, escurecimento e animações continuam; o arquivo é regravado uma vez', () => {
  const { aparencia, migrou } = migrarAparencia(antigo, false)
  assert.equal(migrou, true)
  assert.equal(aparencia.fundo, 'fundo-123.png')
  assert.equal(aparencia.fundoEmTodoApp, true)
  assert.equal(aparencia.escurecimento, 0.4)
  assert.equal(aparencia.reduzirAnimacoes, true)
  assert.equal(aparencia.tema, 'escuro') // campo antigo fica, para versões antigas do app
  assert.equal(aparencia.vidroLeve, false)
})

test('cores padrão antigas passam a seguir o bioma; cor escolhida continua', () => {
  const padrao = migrarAparencia(antigo, false).aparencia
  assert.equal(padrao.destaque, null)
  assert.equal(padrao.destaquePlay, null)
  const minhas = migrarAparencia({ ...antigo, destaque: '#C42B2B', destaquePlay: '#7e3ff2' }, false)
  assert.equal(minhas.aparencia.destaque, '#C42B2B')
  assert.equal(minhas.aparencia.destaquePlay, '#7e3ff2')
})

test('arquivo já no formato novo não muda', () => {
  const novo = { ...PADRAO, bioma: 'nether', destaque: '#3c8527', vidroLeve: true }
  const { aparencia, migrou } = migrarAparencia(novo, false)
  assert.equal(migrou, false)
  assert.equal(aparencia.bioma, 'nether')
  assert.equal(aparencia.destaque, '#3c8527') // escolhido depois da migração: fica
  assert.equal(aparencia.vidroLeve, true)
})

test('sem arquivo: padrão (Dia), sem regravar nada estranho', () => {
  const { aparencia } = migrarAparencia({}, false)
  assert.equal(aparencia.bioma, 'diaClaro') // Windows claro, tema "sistema"
  assert.equal(aparencia.destaque, null)
  assert.deepEqual(migrarAparencia({ destaque: 'vermelho' }, true).aparencia.destaque, null)
})
