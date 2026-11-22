import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ehForgeAntigo,
  forgeSemSuporte,
  lerPerfilAntigo,
  montarVersaoCliente,
  nomeNoMaven,
  urlDoMaven,
  versoesDoMetadata
} from '../src/shared/forgeAntigoRegras'

// Trechos reais do maven-metadata.xml do Forge (o sufixo não segue a versão do Minecraft).
const METADATA = `<metadata><versioning><versions>
  <version>1.7.10-10.13.2.1291</version>
  <version>1.7.10-10.13.4.1614-1.7.10</version>
  <version>1.8-11.14.4.1563</version>
  <version>1.8.9-11.15.1.2318-1.8.9</version>
  <version>1.10.2-12.18.3.2511</version>
  <version>1.12.1-14.22.1.2478</version>
</versions></versioning></metadata>`

test('nome e endereço do instalador antigo, com e sem sufixo', () => {
  const v = versoesDoMetadata(METADATA)
  assert.equal(v.length, 6)
  assert.equal(nomeNoMaven(v, '1.7.10', '10.13.4.1614'), '1.7.10-10.13.4.1614-1.7.10')
  assert.equal(nomeNoMaven(v, '1.7.10', '10.13.2.1291'), '1.7.10-10.13.2.1291')
  assert.equal(nomeNoMaven(v, '1.8.9', '11.15.1.2318'), '1.8.9-11.15.1.2318-1.8.9')
  assert.equal(nomeNoMaven(v, '1.8', '11.14.4.1563'), '1.8-11.14.4.1563')
  assert.equal(nomeNoMaven(v, '1.10.2', '12.18.3.2511'), '1.10.2-12.18.3.2511')
  assert.equal(nomeNoMaven(v, '1.12.1', '14.22.1.2478'), '1.12.1-14.22.1.2478')
  assert.equal(nomeNoMaven(v, '1.7.10', '10.13.4.161'), null)
  assert.equal(
    urlDoMaven('1.7.10-10.13.4.1614-1.7.10', 'installer'),
    'https://maven.minecraftforge.net/net/minecraftforge/forge/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-installer.jar'
  )
})

test('quais versões usam o fluxo antigo e quais continuam recusadas', () => {
  assert.equal(ehForgeAntigo('1.7.10'), true)
  assert.equal(ehForgeAntigo('1.10.2'), true)
  assert.equal(ehForgeAntigo('1.12.1'), true)
  assert.equal(ehForgeAntigo('1.12.2'), false) // instalador novo, fluxo de sempre
  assert.equal(ehForgeAntigo('1.20.1'), false)
  assert.equal(ehForgeAntigo('1.6.4'), false)
  assert.equal(forgeSemSuporte('forge', '1.6.4'), true)
  assert.equal(forgeSemSuporte('forge', '1.7.10'), false)
  assert.equal(forgeSemSuporte('fabric', '1.6.4'), false)
})

// install_profile.json do 1.7.10-10.13.4.1614 (só o que importa).
const PERFIL = JSON.stringify({
  install: { filePath: 'forge-1.7.10-10.13.4.1614-1.7.10-universal.jar', minecraft: '1.7.10' },
  versionInfo: {
    id: '1.7.10-Forge10.13.4.1614-1.7.10',
    inheritsFrom: '1.7.10',
    jar: '1.7.10',
    minecraftArguments:
      '--username ${auth_player_name} --tweakClass cpw.mods.fml.common.launcher.FMLTweaker',
    mainClass: 'net.minecraft.launchwrapper.Launch',
    libraries: [
      {
        name: 'net.minecraftforge:forge:1.7.10-10.13.4.1614-1.7.10',
        url: 'https://maven.minecraftforge.net/'
      },
      { name: 'net.minecraft:launchwrapper:1.12', serverreq: true },
      {
        name: 'org.scala-lang:scala-xml_2.11:1.0.2',
        url: 'https://maven.minecraftforge.net/',
        checksums: ['7a80ec00aec122fba7cd4e0d4cdd87ff7e4cb6d0', 'isso não é sha1'],
        clientreq: true,
        serverreq: true
      }
    ]
  }
})

test('leitura do install_profile.json antigo', () => {
  const p = lerPerfilAntigo(PERFIL, '1.7.10-10.13.4.1614-1.7.10')
  assert.equal(p.id, '1.7.10-Forge10.13.4.1614-1.7.10')
  assert.deepEqual(
    p.bibliotecas.map((b) => [b.caminho, b.url]),
    [
      [
        'net/minecraftforge/forge/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10.jar',
        // o Forge vem do universal (o endereço calculado pelo launcher dá 404)
        'https://maven.minecraftforge.net/net/minecraftforge/forge/1.7.10-10.13.4.1614-1.7.10/forge-1.7.10-10.13.4.1614-1.7.10-universal.jar'
      ],
      [
        'net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar',
        'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar'
      ],
      [
        'org/scala-lang/scala-xml_2.11/1.0.2/scala-xml_2.11-1.0.2.jar',
        'https://maven.minecraftforge.net/org/scala-lang/scala-xml_2.11/1.0.2/scala-xml_2.11-1.0.2.jar'
      ]
    ]
  )
  // Sem .sha1 no maven: o hash vem do checksums do perfil (só os que são SHA-1 de verdade).
  assert.deepEqual(p.bibliotecas[2].sha1s, ['7a80ec00aec122fba7cd4e0d4cdd87ff7e4cb6d0'])
})

test('install_profile.json fora do esperado é recusado', () => {
  const nome = '1.7.10-10.13.4.1614-1.7.10'
  assert.throws(() => lerPerfilAntigo('{}', nome), /versionInfo/)
  const com = (libraries: unknown[]): string =>
    JSON.stringify({ versionInfo: { ...JSON.parse(PERFIL).versionInfo, libraries } })
  assert.throws(
    () =>
      lerPerfilAntigo(
        com([
          { name: `net.minecraftforge:forge:${nome}` },
          { name: 'a:b:1', url: 'https://outro.site/' }
        ]),
        nome
      ),
    /fora dos sites oficiais/
  )
  assert.throws(() => lerPerfilAntigo(com([{ name: '../../x:y:1' }]), nome), /nome estranho/)
  assert.throws(() => lerPerfilAntigo(com([{ name: 'a:b:1' }]), nome), /biblioteca do Forge/)
})

test('versão do cliente no formato novo, sempre com Java 8 (jre-legacy)', () => {
  const p = lerPerfilAntigo(PERFIL, '1.7.10-10.13.4.1614-1.7.10')
  const conferidas = new Map(
    p.bibliotecas.map((b, i) => [b.nome, { sha1: `${i}`.padEnd(40, 'a'), tamanho: 10 + i }])
  )
  const v = montarVersaoCliente(p, conferidas)
  assert.equal(v.id, '1.7.10-Forge10.13.4.1614-1.7.10')
  assert.equal(v.inheritsFrom, '1.7.10')
  assert.equal(v.mainClass, 'net.minecraft.launchwrapper.Launch')
  assert.deepEqual(v.javaVersion, { component: 'jre-legacy', majorVersion: 8 })
  const libs = v.libraries as { name: string; downloads: { artifact: Record<string, unknown> } }[]
  assert.equal(libs.length, 3)
  assert.deepEqual(libs[1].downloads.artifact, {
    path: 'net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar',
    url: 'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar',
    sha1: '1'.padEnd(40, 'a'),
    size: 11
  })
  assert.throws(() => montarVersaoCliente(p, new Map()), /não conferida/)
})
