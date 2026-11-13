import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  acharMesmo,
  entradaAceita,
  limparPropriedades,
  motivoParaFicar,
  motivoSemAtualizar,
  nomeDoAmigo,
  temSegredo,
  textoEmprestado,
  validarPacote
} from '../src/main/passarRegras'

const ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b'
const SHA1 = 'a'.repeat(40)
const SHA512 = 'b'.repeat(128)
const pacote = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  formato: 1,
  idFixo: ID,
  nome: 'Mundo',
  tipo: 'fabric',
  versao: '1.21.4',
  versaoLoader: '0.16.9',
  mods: [
    {
      path: 'mods/sodium.jar',
      hashes: { sha1: SHA1, sha512: SHA512 },
      downloads: ['https://cdn.modrinth.com/data/AAAA/versions/BBBB/sodium.jar'],
      fileSize: 10
    }
  ],
  manuais: [],
  semLink: ['meu.jar'],
  geradoEm: '2026-11-13T10:00:00Z',
  ...extra
})

test('server.properties: senha do RCON, segredo e IP deste PC saem em branco; o resto fica', () => {
  const saida = limparPropriedades(
    'motd=Ol\\u00e1\nrcon.password=abc123\nserver-ip=192.168.0.5\nmanagement-server-secret=xyz\nserver-port=25565\n#rcon.password=velho'
  )
  assert.equal(
    saida,
    'motd=Ol\\u00e1\nrcon.password=\nserver-ip=\nmanagement-server-secret=\nserver-port=25565\n#rcon.password=velho'
  )
})

test('segredos: valor preenchido conta; vazio, número e booleano não', () => {
  assert.equal(temSegredo('database:\n  password: hunter2'), true)
  assert.equal(temSegredo('{"token": "abc.def"}'), true)
  assert.equal(temSegredo('discord-webhook-url = https://x'), true)
  assert.equal(temSegredo('velocity:\n  secret: ""'), false)
  assert.equal(temSegredo('password:\napi-key: null\ntoken = 5\nsecret: false'), false)
  assert.equal(temSegredo('max-tokens: 10\ntoken-bucket-size: 3\nsecretRoom = true'), false)
})

test('config fica no PC com caminho deste PC, segredo ou programa; sem nada, vai', () => {
  const casa = 'C:\\Users\\Ana'
  assert.match(motivoParaFicar('config/a.yml', 'pasta: C:/Users/Ana/mapas', [casa])!, /caminhos/)
  assert.match(motivoParaFicar('config/a.json', '"dir": "C:\\\\Users\\\\Ana"', [casa])!, /caminhos/)
  assert.match(motivoParaFicar('plugins/x/config.yml', 'password: x', [casa])!, /senha/)
  assert.match(motivoParaFicar('plugins/x/lib.jar', null, [casa])!, /nunca vai/)
  assert.equal(motivoParaFicar('config/sodium.json', '{"fps": 60}', [casa]), null)
  assert.equal(motivoParaFicar('config/imagem.png', null, [casa]), null)
})

test('ao abrir: nada de .jar, programas, caminhos absolutos ou ".."', () => {
  assert.equal(entradaAceita('hubserver.json'), true)
  assert.equal(entradaAceita('world/region/r.0.0.mca'), true)
  assert.equal(entradaAceita('config/'), true)
  for (const ruim of ['mods/x.jar', 'run.bat', 'a/b.exe', '../fora.txt', 'C:/x.txt', '/abs'])
    assert.equal(entradaAceita(ruim), false, ruim)
})

test('pacote: aceita o certo e recusa link fora do Modrinth, caminho estranho ou id inválido', () => {
  const p = validarPacote(pacote())
  assert.equal(p.idFixo, ID)
  assert.equal(p.mods.length, 1)
  assert.deepEqual(p.semLink, ['meu.jar'])
  assert.throws(() => validarPacote(pacote({ idFixo: '../x' })), /id/)
  assert.throws(() => validarPacote(pacote({ tipo: 'quilt' })), /tipo/)
  const mod = (pacote().mods as Record<string, unknown>[])[0]
  assert.throws(
    () => validarPacote(pacote({ mods: [{ ...mod, downloads: ['https://exemplo.com/x.jar'] }] })),
    /link/
  )
  assert.throws(
    () => validarPacote(pacote({ mods: [{ ...mod, path: 'config/../../x.jar' }] })),
    /caminho/
  )
  assert.throws(() => validarPacote(pacote({ formato: 2 })), /formato/)
})

test('mesmo servidor: pelo id fixo; atualizar só com o mesmo tipo e versão', () => {
  const locais = [
    { id: 'a', idFixo: 'outro' },
    { id: 'b', idFixo: ID.toUpperCase() }
  ]
  assert.equal(acharMesmo(ID, locais)?.id, 'b')
  assert.equal(acharMesmo('nada', locais), null)
  assert.equal(
    motivoSemAtualizar({ tipo: 'fabric', versao: '1.21.4' }, { tipo: 'fabric', versao: '1.21.4' }),
    null
  )
  assert.match(
    motivoSemAtualizar({ tipo: 'fabric', versao: '1.21.4' }, { tipo: 'fabric', versao: '1.21.5' })!,
    /Software/
  )
})

test('"Com <nome> desde <data>" e o nome do amigo', () => {
  assert.equal(
    textoEmprestado({ com: 'Bia', desde: '2026-11-13T12:00:00Z' }),
    'Com Bia desde 13/11/2026'
  )
  assert.equal(nomeDoAmigo('  Bia '), 'Bia')
  assert.throws(() => nomeDoAmigo(''))
  assert.throws(() => nomeDoAmigo('a\nb'))
  assert.throws(() => nomeDoAmigo('x'.repeat(33)))
})
