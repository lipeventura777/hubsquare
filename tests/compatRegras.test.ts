import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ativarPacks,
  compatibilidade,
  modDeShader,
  type EntradaCompat
} from '../src/main/compatRegras.ts'

const base: EntradaCompat = {
  tipo: 'mod',
  ambiente: 'jogador',
  loader: 'fabric',
  versao: '26.3',
  temVersao: true,
  jogador: {
    instalacaoId: 'x',
    servidor: null,
    proibidos: [],
    doServidor: [],
    obrigatorios: []
  },
  noServidor: false,
  nomes: ['sodium.jar', 'Sodium'],
  temModDeShader: false
}
const comServidor = { ...base.jogador, servidor: 'Amigos', proibidos: ['xray'] }

test('mod compatível explica o loader e a versão', () => {
  const c = compatibilidade(base)
  assert.equal(c.vai, true)
  assert.equal(c.frase, 'Vai funcionar: compatível com Fabric 26.3.')
  assert.equal(c.aviso, null)
})

test('o que não pode instalar bloqueia (loader e versão)', () => {
  const vanilla = compatibilidade({ ...base, loader: 'vanilla' })
  assert.equal(vanilla.vai, false)
  assert.equal(vanilla.bloqueia, true)
  assert.match(vanilla.frase, /^Não vai funcionar: mods precisam de Fabric/)
  const semVersao = compatibilidade({ ...base, temVersao: false })
  assert.equal(semVersao.aviso, 'versao')
  assert.equal(semVersao.bloqueia, true)
})

test('shader avisa do Iris (Fabric) ou do Oculus (Forge) e do peso', () => {
  const c = compatibilidade({ ...base, tipo: 'shader', ambiente: null })
  assert.equal(c.vai, true)
  assert.equal(c.aviso, 'shader')
  assert.match(c.frase, /precisa do Iris, que será instalado junto/)
  assert.match(compatibilidade({ ...base, tipo: 'shader', loader: 'forge' }).frase, /Oculus/)
  assert.match(
    compatibilidade({ ...base, tipo: 'shader', temModDeShader: true }).frase,
    /já está na instalação/
  )
  assert.equal(compatibilidade({ ...base, tipo: 'shader', loader: 'vanilla' }).bloqueia, true)
  assert.deepEqual(modDeShader('neoforge'), { id: 'iris', nome: 'Iris' })
})

test('mod só de servidor e mod que precisa do servidor não bloqueiam, mas avisam', () => {
  const so = compatibilidade({ ...base, ambiente: 'servidor' })
  assert.equal(so.vai, false)
  assert.equal(so.aviso, 'soServidor')
  assert.equal(so.bloqueia, false)
  const ambos = compatibilidade({ ...base, ambiente: 'ambos', jogador: comServidor })
  assert.equal(ambos.aviso, 'precisaServidor')
  assert.match(ambos.frase, /precisa estar também no servidor Amigos/)
  // Sem servidor ligado à instalação, um mod "dos dois lados" funciona sozinho.
  assert.equal(compatibilidade({ ...base, ambiente: 'ambos' }).vai, true)
})

test('mod proibido pelo servidor: explica que é um combinado entre amigos', () => {
  const c = compatibilidade({ ...base, nomes: ['XRay-Ultimate.jar'], jogador: comServidor })
  assert.equal(c.aviso, 'proibido')
  assert.equal(c.vai, false)
  assert.match(c.frase, /combinado entre amigos/)
})

test('o que veio do servidor sempre funciona', () => {
  const c = compatibilidade({ ...base, ambiente: 'ambos', noServidor: true, jogador: comServidor })
  assert.equal(c.vai, true)
  assert.equal(c.frase, 'Vai funcionar: veio do servidor Amigos.')
})

test('resource packs do servidor ficam por cima, na ordem, sem tirar os do jogador', () => {
  const antes = 'version:4325\nresourcePacks:["vanilla","file/meu.zip"]\nfov:0.5\n'
  const depois = ativarPacks(antes, ['FreshAnimations.zip', 'Base.zip'])
  assert.equal(
    depois,
    'version:4325\nresourcePacks:["vanilla","file/meu.zip","file/Base.zip","file/FreshAnimations.zip"]\nfov:0.5\n'
  )
  // De novo: não duplica.
  assert.equal(ativarPacks(depois, ['FreshAnimations.zip', 'Base.zip']), depois)
  // Sem options.txt: cria só a linha.
  assert.equal(ativarPacks('', ['A.zip']), 'resourcePacks:["vanilla","file/A.zip"]\n')
})
