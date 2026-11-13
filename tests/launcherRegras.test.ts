import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aplicarPerfil,
  escolherLauncher,
  launcherSeguro,
  argumentosJava,
  lerServidoresDat,
  pastaDoNome,
  servidorNoTopo,
  type PerfilLauncher
} from '../src/main/launcherRegras.ts'

const perfil: PerfilLauncher = {
  name: 'Meu Servidor',
  type: 'custom',
  lastVersionId: 'fabric-loader-0.16.0-1.21.4',
  gameDir: 'C:\\jogo\\Meu Servidor',
  javaArgs: argumentosJava(4),
  icon: 'Furnace',
  lastUsed: '2026-11-11T00:00:00.000Z'
}

test('perfil novo entra sem mexer nos outros perfis nem nas configurações', () => {
  const antes = {
    profiles: {
      abc: { name: '', type: 'latest-release', lastVersionId: 'latest-release', icon: 'Grass' },
      def: { name: 'Antigo', type: 'custom', lastVersionId: '1.18', campoNovo: [1, 2] }
    },
    settings: { locale: 'pt-BR', enableSnapshots: false },
    version: 3
  }
  const depois = JSON.parse(aplicarPerfil(JSON.stringify(antes), 'hubsquare-1', perfil))
  assert.deepEqual(depois.profiles.abc, antes.profiles.abc)
  assert.deepEqual(depois.profiles.def, antes.profiles.def)
  assert.deepEqual(depois.settings, antes.settings)
  assert.equal(depois.version, 3)
  assert.equal(depois.profiles['hubsquare-1'].lastVersionId, perfil.lastVersionId)
  assert.match(depois.profiles['hubsquare-1'].javaArgs, /^-Xmx4G /)
})

test('atualizar o perfil guarda a data de criação e campos que o launcher pôs', () => {
  const antes = {
    profiles: { 'hubsquare-1': { ...perfil, created: '2020-01-01', resolution: { width: 800 } } }
  }
  const depois = JSON.parse(
    aplicarPerfil(JSON.stringify(antes), 'hubsquare-1', { ...perfil, javaArgs: argumentosJava(6) })
  )
  assert.equal(depois.profiles['hubsquare-1'].created, '2020-01-01')
  assert.deepEqual(depois.profiles['hubsquare-1'].resolution, { width: 800 })
  assert.match(depois.profiles['hubsquare-1'].javaArgs, /^-Xmx6G /)
})

test('formato estranho do launcher não é gravado', () => {
  assert.throws(() => aplicarPerfil('não é json', 'x', perfil))
  assert.throws(() => aplicarPerfil('{"perfis": {}}', 'x', perfil))
  assert.throws(() => aplicarPerfil('null', 'x', perfil))
})

test('servers.dat: servidor vai para o topo, sem duplicar e sem perder os outros', () => {
  const primeiro = servidorNoTopo(null, 'Amigo', 'amigo.exemplo.com')
  assert.deepEqual(lerServidoresDat(primeiro), ['amigo.exemplo.com'])
  const dois = servidorNoTopo(primeiro, 'Meu', 'localhost:25565')
  assert.deepEqual(lerServidoresDat(dois), ['localhost:25565', 'amigo.exemplo.com'])
  const denovo = servidorNoTopo(dois, 'Meu (novo nome)', 'LOCALHOST:25565')
  assert.deepEqual(lerServidoresDat(denovo), ['LOCALHOST:25565', 'amigo.exemplo.com'])
  // A entrada do amigo volta byte a byte (aqui, igual à criada no começo).
  assert.ok(denovo.includes(primeiro.subarray(18, primeiro.length - 2)))
})

test('servers.dat com campos extras (ícone, acceptTextures) continua legível', () => {
  // compound raiz > lista servers > 1 compound com name, ip, acceptTextures (byte) e icon
  const partes: number[] = [10, 0, 0, 9, 0, 7, ...Buffer.from('servers'), 10, 0, 0, 0, 1]
  const texto = (nome: string, valor: string): number[] => [
    8,
    0,
    nome.length,
    ...Buffer.from(nome),
    0,
    valor.length,
    ...Buffer.from(valor)
  ]
  partes.push(
    ...texto('name', 'X'),
    ...texto('ip', 'x.com'),
    1,
    0,
    14,
    ...Buffer.from('acceptTextures'),
    1
  )
  partes.push(...texto('icon', 'AAAA'), 0, 0)
  const dat = servidorNoTopo(Buffer.from(partes), 'Novo', 'novo.com')
  assert.deepEqual(lerServidoresDat(dat), ['novo.com', 'x.com'])
  assert.ok(dat.includes(Buffer.from('acceptTextures')))
  // servers.dat estragado: começa de novo em vez de travar
  assert.deepEqual(lerServidoresDat(servidorNoTopo(Buffer.from('lixo'), 'A', 'a.com')), ['a.com'])
})

test('nome de pasta seguro no Windows', () => {
  assert.equal(pastaDoNome('Meu: servidor?'), 'Meu servidor')
  assert.equal(pastaDoNome('con'), 'Instalação')
  assert.equal(pastaDoNome('...'), 'Instalação')
  assert.equal(pastaDoNome('fim. '), 'fim')
})

const STORE = 'Microsoft.4297127D64EC6_8wekyb3d8bbwe!Minecraft'
const MARCADOR = 'Microsoft.MinecraftJavaEdition_8wekyb3d8bbwe!Game'
const CLASSICO = 'C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe'

test('launcher: só o da Store', () => {
  assert.deepEqual(escolherLauncher([STORE], []), { tipo: 'store', app: STORE })
})

test('launcher: só o clássico', () => {
  assert.deepEqual(escolherLauncher([], [CLASSICO]), { tipo: 'classico', exe: CLASSICO })
})

test('launcher: os dois, prefere o da Store (mesmo com o marcador antes)', () => {
  assert.deepEqual(escolherLauncher([MARCADOR, STORE], [CLASSICO]), { tipo: 'store', app: STORE })
})

test('launcher: nenhum', () => {
  assert.equal(escolherLauncher([], []), null)
})

test('launcher: o marcador do Xbox sozinho é recusado', () => {
  assert.equal(escolherLauncher([MARCADOR], []), null)
  assert.equal(escolherLauncher([MARCADOR], [CLASSICO])?.tipo, 'classico')
})

test('launcher: nada que abra a Microsoft Store', () => {
  const loja = [
    'ms-windows-store://pdp/?productid=9PJ8266BHFWN',
    'ms-windows-store:\\x\\MinecraftLauncher.exe',
    'C:MinecraftLauncher.exe',
    'Microsoft.4297127D64EC6_8wekyb3d8bbwe!Game',
    'Microsoft.WindowsStore_8wekyb3d8bbwe!App'
  ]
  assert.equal(escolherLauncher(loja, loja), null)
  assert.equal(escolherLauncher([], ['C:\\Program Files\\Minecraft Launcher\\Outro.exe']), null)
  assert.equal(launcherSeguro({ tipo: 'store', app: MARCADOR }), false)
  assert.equal(launcherSeguro({ tipo: 'classico', exe: 'ms-windows-store:x' }), false)
  assert.equal(launcherSeguro({ tipo: 'classico', exe: CLASSICO }), true)
})
