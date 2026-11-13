import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comandoDaAcao, validarIp, validarJogador } from '../src/main/comandosJogador.ts'
import { resumirJogador, rostoComChapeu } from '../src/main/dadosJogador.ts'

test('nomes e IPs fora do formato são recusados', () => {
  assert.equal(validarJogador(' Ana_123 '), 'Ana_123')
  for (const ruim of ['ab', 'a'.repeat(17), 'Ana; op Bob', 'Ana Bob', '', 5]) {
    assert.throws(() => validarJogador(ruim), String(ruim))
  }
  assert.equal(validarIp('10.0.0.1'), '10.0.0.1')
  for (const ruim of ['10.0.0.256', '::1', '1.2.3.4 x', '']) assert.throws(() => validarIp(ruim))
})

test('ações viram comandos seguros', () => {
  assert.equal(comandoDaAcao('Ana', { tipo: 'matar' }), 'kill Ana')
  assert.equal(comandoDaAcao('Ana', { tipo: 'modo', modo: 'creative' }), 'gamemode creative Ana')
  assert.equal(
    comandoDaAcao('Ana', {
      tipo: 'teleportar',
      local: { x: -293, y: 68, z: 1e-7, dimensao: 'minecraft:the_nether' }
    }),
    'execute in minecraft:the_nether run tp Ana -293.000 68.000 0.000'
  )
  assert.throws(() => comandoDaAcao('Ana', { tipo: 'modo', modo: 'op' }))
  assert.throws(() =>
    comandoDaAcao('Ana', {
      tipo: 'teleportar',
      local: { x: 0, y: 0, z: 0, dimensao: 'x run op Bob' }
    })
  )
  assert.throws(() =>
    comandoDaAcao('Ana', { tipo: 'teleportar', local: { x: NaN, y: 0, z: 0, dimensao: 'a:b' } })
  )
  assert.throws(() => comandoDaAcao('Ana', { tipo: 'stop' }))
})

test('lê o .dat no formato novo (1.21.5+)', () => {
  const r = resumirJogador({
    Health: 13.5,
    foodLevel: 7,
    XpLevel: 24,
    XpP: 0.5,
    playerGameType: 1,
    Pos: [1.5, 64, -2.25],
    Dimension: 'minecraft:overworld',
    respawn: { pos: new Int32Array([10, 70, 20]), dimension: 'minecraft:the_nether' },
    LastDeathLocation: { pos: new Int32Array([-293, 68, 405]), dimension: 'minecraft:the_end' }
  })
  assert.equal(r.vida, 13.5)
  assert.equal(r.modo, 'creative')
  assert.deepEqual(r.posicao, { x: 1.5, y: 64, z: -2.25, dimensao: 'minecraft:overworld' })
  assert.deepEqual(r.renascimento, { x: 10, y: 70, z: 20, dimensao: 'minecraft:the_nether' })
  assert.deepEqual(r.ultimaMorte, { x: -293, y: 68, z: 405, dimensao: 'minecraft:the_end' })
})

test('lê o .dat em formatos antigos e marca o que falta', () => {
  const r = resumirJogador({ Pos: [0, 70, 0], Dimension: -1, SpawnX: 5, SpawnY: 64, SpawnZ: 6 })
  assert.equal(r.posicao?.dimensao, 'minecraft:the_nether')
  assert.deepEqual(r.renascimento, { x: 5, y: 64, z: 6, dimensao: 'minecraft:overworld' })
  assert.equal(r.ultimaMorte, null) // antes da 1.19
  assert.equal(r.modo, null)
  assert.equal(resumirJogador({}).posicao, null)
})

test('cabeça: o chapéu cobre o rosto onde não é transparente', () => {
  const largura = 64
  const skin = Buffer.alloc(largura * 64 * 4)
  const pintar = (x: number, y: number, cor: number[]): void =>
    cor.forEach((v, c) => (skin[(y * largura + x) * 4 + c] = v))
  pintar(8, 8, [10, 20, 30, 255]) // rosto, pixel (0,0)
  pintar(9, 8, [10, 20, 30, 255]) // rosto, pixel (1,0)
  pintar(41, 8, [200, 100, 50, 255]) // chapéu opaco só no pixel (1,0)
  const cabeca = rostoComChapeu(skin, largura)
  assert.deepEqual([...cabeca.subarray(0, 4)], [10, 20, 30, 255])
  assert.deepEqual([...cabeca.subarray(4, 8)], [200, 100, 50, 255])
})
