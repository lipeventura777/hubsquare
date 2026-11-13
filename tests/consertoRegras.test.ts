import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arquivoPareceDoMod, javaExigido, modsFaltando } from '../src/main/consertoRegras'

// Trechos reais do console do COBBLEVERSE (Fabric 0.18.4, Minecraft 1.21.1).
const FABRIC = [
  "\t - Mod 'CobbleFurnies' (cobblefurnies) 1.2 requires version 4.0.2 or later of athena, which is missing!",
  "\t - Mod 'Rechiseled' (rechiseled) 1.2.4 requires version 1.2.12 or later of fusion, which is missing!",
  "\t - Mod 'Concurrent Chunk Management Engine (Optimizations/Natives Math)' (c2me-opts-natives-math) 0.4.0-alpha.0.23+1.21.1 requires version 25 or later of 'OpenJDK 64-Bit Server VM' (java), but only the wrong version is present: 21!"
]

test('acha o Java pedido pelo Fabric e pelo class file version', () => {
  // A mensagem solta do C2ME (Java 25) não manda: sem linha Fix com java, nada muda.
  assert.equal(javaExigido(FABRIC), null)
  assert.equal(
    javaExigido([
      '[15:59:50] [main/INFO]: Fix: add [], remove [], replace [[java 25] -> add:java 21 ([[21,21]])]'
    ]),
    21
  )
  assert.equal(
    javaExigido([
      'java.lang.UnsupportedClassVersionError: x has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0'
    ]),
    21
  )
  assert.equal(javaExigido(['[main/INFO]: Done (3.2s)!']), null)
})

test('acha os mods que faltam (Fabric e Forge), sem o java', () => {
  assert.deepEqual(modsFaltando(FABRIC), [
    { id: 'athena', pedidoPor: 'CobbleFurnies', exige: '4.0.2 or later' },
    { id: 'fusion', pedidoPor: 'Rechiseled', exige: '1.2.12 or later' }
  ])
  assert.deepEqual(
    modsFaltando([
      "\tMod ID: 'architectury', Requested by: 'rei', Expected range: '[13,)', Actual version: '[MISSING]'"
    ]),
    [{ id: 'architectury', pedidoPor: 'rei', exige: '[13,)' }]
  )
})

test('palpite pelo nome do arquivo', () => {
  assert.equal(arquivoPareceDoMod('mods/athena-fabric-1.21.1-4.0.6.jar', 'athena'), true)
  assert.equal(arquivoPareceDoMod('mods/fusion-1.2.12-fabric-mc1.21.jar', 'fusion'), true)
  assert.equal(arquivoPareceDoMod('mods/fabric-api-0.1.jar', 'athena'), false)
  assert.equal(arquivoPareceDoMod('mods/ab.jar', 'ab'), false)
})
