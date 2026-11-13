// Rode com: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerPropriedades, mudarPropriedades } from '../src/main/propriedades.ts'

const ORIGINAL = [
  '#Minecraft server properties',
  '#Mon Nov 09 15:00:00 BRT 2026',
  'allow-flight=false',
  'difficulty=easy',
  'gamemode=survival',
  'motd=Servidor da Turma\\: bem-vindo',
  'level-seed=',
  'max-players=20',
  ''
].join('\r\n')

test('troca só as chaves pedidas e mantém comentários, ordem e quebra de linha', () => {
  const novo = mudarPropriedades(ORIGINAL, { gamemode: 'creative', difficulty: 'peaceful' })
  assert.equal(novo, ORIGINAL.replace('easy', 'peaceful').replace('=survival', '=creative'))
})

test('chave que não existe vai para o fim', () => {
  const novo = mudarPropriedades(ORIGINAL, { 'white-list': 'true' })
  assert.ok(novo.endsWith('max-players=20\r\nwhite-list=true\r\n'))
})

test('arquivo vazio vira arquivo só com as chaves pedidas', () => {
  assert.equal(mudarPropriedades('', { a: '1', b: '2' }), 'a=1\nb=2\n')
})

test('lê valores com escapes do Java', () => {
  const p = lerPropriedades(ORIGINAL + 'outra=Ol\\u00e1 \\\\ mundo\r\nchave : com espaços \r\n')
  assert.equal(p.get('motd'), 'Servidor da Turma: bem-vindo')
  assert.equal(p.get('level-seed'), '')
  assert.equal(p.get('outra'), 'Olá \\ mundo')
  assert.equal(p.get('chave'), 'com espaços ')
  assert.equal(p.has('#Minecraft server properties'), false)
})

test('MOTD com caracteres especiais volta igual depois de gravar e ler', () => {
  const motd = ' Olá: amigos = 100% #1! \\o/ §aVerde'
  const novo = mudarPropriedades(ORIGINAL, { motd })
  assert.equal(lerPropriedades(novo).get('motd'), motd)
})

test('acentos e § viram escapes u+XXXX e voltam iguais', () => {
  const motd = '§6Olá, §lação§r\n§bsegunda linha ✓'
  const novo = mudarPropriedades('motd=x\n', { motd })
  assert.ok(/^[\x20-\x7e\n]*$/.test(novo)) // só ASCII no arquivo
  assert.ok(novo.includes('\\u00a7') && novo.includes('\\n'))
  assert.equal(
    novo,
    'motd=\\u00a76Ol\\u00e1, \\u00a7la\\u00e7\\u00e3o\\u00a7r\\n\\u00a7bsegunda linha \\u2713\n'
  )
  assert.equal(lerPropriedades(novo).get('motd'), motd)
})
