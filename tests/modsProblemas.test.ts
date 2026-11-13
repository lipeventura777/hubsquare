import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  atende,
  lerMetaJar,
  suspeitosDoTravamento,
  verificarProblemas,
  type ModAnalise
} from '../src/main/modsProblemas'

test('faixas de versão do Fabric e do Maven', () => {
  assert.equal(atende('1.20.1', '>=1.20 <1.21', 'fabric'), true)
  assert.equal(atende('1.21', '>=1.20 <1.21', 'fabric'), false)
  assert.equal(atende('1.20.4', '~1.20.1', 'fabric'), true)
  assert.equal(atende('1.21.1', '~1.20.1', 'fabric'), false)
  assert.equal(atende('1.20.6', '1.20.x', 'fabric'), true)
  assert.equal(atende('1.21', ['1.20.x', '1.21'], 'fabric'), true)
  assert.equal(atende('26.3', '*', 'fabric'), true)
  assert.equal(atende('1.20.1', '[1.20.1,1.21)', 'maven'), true)
  assert.equal(atende('1.21', '[1.20.1,1.21)', 'maven'), false)
  assert.equal(atende('1.21.1', '[1.21,)', 'maven'), true)
  assert.equal(atende('1.20.1', '[1.18,1.19),[1.20,)', 'maven'), true)
  assert.equal(atende('1.19.2', '1.20.1', 'maven'), true) // versão sugerida: aceita qualquer
  assert.equal(atende('1.20.1', 'coisa estranha', 'fabric'), true)
})

test('dados do fabric.mod.json, do mods.toml e do plugin.yml', () => {
  const f = lerMetaJar({
    fabric: JSON.stringify({
      id: 'sodium',
      name: 'Sodium',
      version: '0.6.0',
      environment: 'client',
      provides: ['rubidium'],
      depends: { minecraft: '>=1.21', fabricloader: '*', 'fabric-api': '*' },
      breaks: { optifabric: '*' },
      entrypoints: { client: ['net.caffeinemc.mods.sodium.Sodium'] }
    })
  })
  assert.deepEqual(f.ids, ['sodium', 'rubidium'])
  assert.deepEqual(
    f.depende.map((d) => d.id),
    ['fabric-api']
  )
  assert.equal(f.mc?.faixa, '>=1.21')
  assert.equal(f.ambiente, 'cliente')
  assert.deepEqual(
    f.conflita.map((d) => d.id),
    ['optifabric']
  )
  assert.deepEqual(f.pacotes, ['net.caffeinemc.mods.sodium'])

  const t = lerMetaJar({
    toml: `modLoader="javafml"
[[mods]]
modId="create"
displayName="Create"
[[dependencies.create]]
    modId="forge"
    mandatory=true
    versionRange="[47,)"
[[dependencies.create]]
    modId="minecraft"
    mandatory=true
    versionRange="[1.20.1,1.20.2)"
[[dependencies.create]]
    modId="flywheel"
    mandatory=true
    versionRange="[0.6.10,)"
[[dependencies.create]]
    modId="jei"
    mandatory=false
[[dependencies.create]]
    modId="optifine"
    type="incompatible"
`
  })
  assert.deepEqual(t.loaders, ['forge'])
  assert.deepEqual(t.ids, ['create'])
  assert.deepEqual(
    t.depende.map((d) => d.id),
    ['flywheel']
  )
  assert.equal(t.mc?.faixa, '[1.20.1,1.20.2)')
  assert.deepEqual(
    t.conflita.map((d) => d.id),
    ['optifine']
  )

  const p = lerMetaJar({ plugin: 'name: Towny\nversion: 0.100\ndepend: [Vault]\n' })
  assert.deepEqual(p.loaders, ['paper'])
  assert.deepEqual(p.ids, ['towny'])
  assert.deepEqual(
    p.depende.map((d) => d.id),
    ['vault']
  )
})

const mod = (
  chave: string,
  meta: Partial<ReturnType<typeof lerMetaJar>>,
  extra: Partial<ModAnalise> = {}
): ModAnalise => ({
  chave,
  titulo: chave,
  ativo: true,
  data: '2026-01-01',
  projetoId: null,
  meta: {
    loaders: ['fabric'],
    ids: [chave],
    nome: chave,
    versao: '1.0',
    depende: [],
    conflita: [],
    ambiente: null,
    mc: null,
    pacotes: [],
    fonte: 'manual',
    ...meta
  },
  ...extra
})

test('problemas: dependência, loader, versão, só do jogador, conflito e duplicado', () => {
  const r = verificarProblemas(
    [
      mod('create', { depende: [{ id: 'fabric-api', faixa: '*', estilo: 'fabric' }] }),
      mod('jei', { loaders: ['forge'] }),
      mod('velho', { mc: { id: 'minecraft', faixa: '~1.19.2', estilo: 'fabric' } }),
      mod('sodium', { ambiente: 'cliente' }),
      mod('a', { conflita: [{ id: 'b', faixa: '*', estilo: 'fabric' }] }),
      mod('b', {}),
      mod('dup1', { ids: ['lithium'] }, { data: '2026-01-01' }),
      mod('dup2', { ids: ['lithium'] }, { data: '2026-05-01' }),
      mod('desligado', { loaders: ['forge'] }, { ativo: false })
    ],
    { tipo: 'fabric', versao: '1.21.1' }
  )
  assert.equal(r.create[0].tipo, 'dependencia')
  assert.deepEqual(r.create[0].correcao, {
    tipo: 'instalar',
    rotulo: 'Instalar fabric-api',
    id: 'fabric-api',
    projeto: false
  })
  assert.equal(r.jei[0].tipo, 'loader')
  assert.equal(r.velho[0].tipo, 'versao')
  assert.equal(r.sodium[0].tipo, 'jogador')
  assert.equal(r.a[0].tipo, 'incompativel')
  assert.equal(r.a[0].correcao?.tipo === 'desativar' && r.a[0].correcao.chave, 'b')
  assert.equal(r.dup1[0].tipo, 'duplicado')
  assert.equal(r.dup2, undefined)
  assert.equal(r.desligado, undefined) // desativado não conta
})

test('dependência resolvida por outro mod que "fornece" o id', () => {
  const r = verificarProblemas(
    [
      mod('x', { depende: [{ id: 'fabric', faixa: '*', estilo: 'fabric' }] }),
      mod('fabric-api', { ids: ['fabric-api', 'fabric'] })
    ],
    { tipo: 'fabric', versao: '1.21.1' }
  )
  assert.deepEqual(r, {})
})

test('suspeitos do travamento', () => {
  const relatorio = `---- Minecraft Crash Report ----
Description: Mod loading error has occurred

java.lang.NullPointerException
\tat TRANSFORMER/create@0.5.1/com.simibubi.create.Foo.bar(Foo.java:10)
\tat TRANSFORMER/create@0.5.1/com.simibubi.create.Foo.baz(Foo.java:12)
\tat net.minecraft.server.Main.main(Main.java:1)

Suspected Mods:
\tFlywheel (flywheel), Version: 0.6.10

-- Mod loading issue --`
  const s = suspeitosDoTravamento(relatorio, [
    { chave: 'create', ids: ['create'], pacotes: [] },
    { chave: 'flywheel', ids: ['flywheel'], pacotes: [] },
    { chave: 'jei', ids: ['jei'], pacotes: [] },
    { chave: 'mc', ids: ['minecraft'], pacotes: [] }
  ])
  assert.deepEqual(
    s.map((x) => x.chave),
    ['flywheel', 'create'] // o próprio relatório aponta o flywheel: vem primeiro
  )
  const fabric = suspeitosDoTravamento(
    'Caused by: x\n\tat me.jellysquid.mods.lithium.Mixin.run(Mixin.java:3)\n',
    [{ chave: 'lithium', ids: ['lithium'], pacotes: ['me.jellysquid.mods.lithium'] }]
  )
  assert.equal(fabric[0]?.chave, 'lithium')
})
