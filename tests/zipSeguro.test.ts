import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import {
  caminhoSeguro,
  detectarConteudo,
  detectarLoader,
  lerNbt,
  versaoDoLevelDat
} from '../src/main/zipSeguro.ts'
import { compararVersoes } from '../src/shared/versoes.ts'

test('caminhos que saem da pasta de destino são recusados', () => {
  for (const ok of ['world/level.dat', 'servidor/plugins/a.jar', 'a.txt', 'pasta/']) {
    assert.equal(caminhoSeguro(ok), true, ok)
  }
  for (const ruim of [
    '../fora.txt',
    'a/../../b',
    '/etc/passwd',
    'C:/Windows/x',
    'c:\\x',
    '..\\x',
    ''
  ]) {
    assert.equal(caminhoSeguro(ruim), false, ruim)
  }
})

test('detecta servidor inteiro pelo server.properties mais raso', () => {
  const r = detectarConteudo([
    'meu-server/',
    'meu-server/server.properties',
    'meu-server/world/level.dat',
    'meu-server/plugins/x/server.properties'
  ])
  assert.deepEqual(r, {
    tipo: 'servidor',
    raiz: 'meu-server/',
    levelDat: 'meu-server/world/level.dat'
  })
})

test('detecta mundo pelo level.dat em qualquer subpasta, ou na raiz', () => {
  assert.deepEqual(
    detectarConteudo(['backup/Mundo legal/level.dat', 'backup/Mundo legal/region/r.0.0.mca']),
    {
      tipo: 'mundo',
      raiz: 'backup/Mundo legal/',
      levelDat: 'backup/Mundo legal/level.dat'
    }
  )
  assert.equal(detectarConteudo(['level.dat'])?.raiz, '')
  assert.equal(detectarConteudo(['leia-me.txt', 'foto.png']), null)
  // Exportado pelo app (Paper): o mundo principal vence o Nether e o End.
  assert.equal(
    detectarConteudo(['world_nether/level.dat', 'world_the_end/level.dat', 'world/level.dat'])
      ?.raiz,
    'world/'
  )
})

// Monta um NBT pequeno: { Data: { Version: { Name: "1.21.4", Id: 4189 }, Nums: [1,2] } }
function nbtDeTeste(): Buffer {
  const str = (s: string): Buffer => {
    const b = Buffer.from(s, 'utf8')
    const t = Buffer.alloc(2)
    t.writeUInt16BE(b.length)
    return Buffer.concat([t, b])
  }
  const tag = (tipo: number, nome: string, valor: Buffer): Buffer =>
    Buffer.concat([Buffer.from([tipo]), str(nome), valor])
  const int = (n: number): Buffer => {
    const b = Buffer.alloc(4)
    b.writeInt32BE(n)
    return b
  }
  const fim = Buffer.from([0])
  const versao = Buffer.concat([tag(8, 'Name', str('1.21.4')), tag(3, 'Id', int(4189)), fim])
  const lista = Buffer.concat([Buffer.from([3]), int(2), int(1), int(2)])
  const data = Buffer.concat([tag(10, 'Version', versao), tag(9, 'Nums', lista), fim])
  return tag(10, '', Buffer.concat([tag(10, 'Data', data), fim]))
}

test('lê NBT com e sem gzip e acha a versão do level.dat', () => {
  const cru = nbtDeTeste()
  const raiz = lerNbt(cru) as { Data: { Version: { Id: number }; Nums: number[] } }
  assert.equal(raiz.Data.Version.Id, 4189)
  assert.deepEqual(raiz.Data.Nums, [1, 2])
  assert.equal(versaoDoLevelDat(gzipSync(cru)), '1.21.4')
  assert.equal(versaoDoLevelDat(Buffer.from('não é nbt')), null)
})

test('compara versões antigas e novas', () => {
  assert.ok(compararVersoes('1.21.11', '26.3') < 0)
  assert.ok(compararVersoes('26.3', '26.1.2') > 0)
  assert.ok(compararVersoes('1.21.4', '1.21.10') < 0)
  assert.equal(compararVersoes('26.1', '26.1.0'), 0)
})

test('server pack sem server.properties é reconhecido pela pasta mods', () => {
  const r = detectarConteudo([
    'Pack 1.2/mods/a.jar',
    'Pack 1.2/config/a.toml',
    'Pack 1.2/startserver.bat'
  ])
  assert.equal(r?.tipo, 'servidor')
  assert.equal(r?.raiz, 'Pack 1.2/')
  assert.equal(detectarConteudo(['mods/a.jar'])?.raiz, '')
})

test('pack do CurseForge para o jogo (manifest.json + overrides) não é server pack', () => {
  // Ex.: COBBLEVERSE-1.7.42-CF.zip: a maioria dos mods vem só como número no manifest.json, e
  // overrides/mods traz poucos .jar. Importar como servidor deixava faltando fabric-api etc.
  const pack = [
    'manifest.json',
    'modlist.html',
    'overrides/mods/tmcraft.jar',
    'overrides/config/a.toml'
  ]
  assert.equal(detectarConteudo(pack), null)
  // Um server pack que traz um manifest.json junto, mas com server.properties, continua servidor.
  assert.equal(detectarConteudo([...pack, 'server.properties'])?.tipo, 'servidor')
})

test('detecta o loader de um server pack', () => {
  assert.deepEqual(detectarLoader(['p/forge-1.20.1-47.2.0-installer.jar', 'p/mods/a.jar'], 'p/'), {
    tipo: 'forge',
    versao: '1.20.1',
    versaoLoader: '47.2.0'
  })
  assert.deepEqual(
    detectarLoader(['libraries/net/neoforged/neoforge/21.1.77/x.jar', 'mods/a.jar'], ''),
    { tipo: 'neoforge', versao: '1.21.1', versaoLoader: '21.1.77' }
  )
  assert.deepEqual(
    detectarLoader(
      [
        'fabric-server-launch.jar',
        'libraries/net/fabricmc/intermediary/1.20.1/i.jar',
        'libraries/net/fabricmc/fabric-loader/0.16.9/l.jar'
      ],
      ''
    ),
    { tipo: 'fabric', versao: '1.20.1', versaoLoader: '0.16.9' }
  )
  assert.deepEqual(
    detectarLoader(
      ['mods/a.jar', 'variables.txt'],
      '',
      'MINECRAFT_VERSION=1.20.1\r\nMODLOADER=NeoForge\r\nMODLOADER_VERSION=20.4.237\r\n'
    ),
    { tipo: 'neoforge', versao: '1.20.1', versaoLoader: '20.4.237' }
  )
  assert.equal(detectarLoader(['mods/a.jar'], ''), null)
  assert.equal(detectarLoader(['quilt-server-launch.jar'], '')?.tipo, 'quilt')
})
