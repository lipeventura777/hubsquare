import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import {
  aceitarBlueMap,
  culpadosDoSpark,
  dicas,
  flagsOtimizadas,
  lerBlueMap,
  lerChunky,
  lerPorta,
  lerTps,
  linkDoSpark,
  precisaAceitarBlueMap,
  resumoDosCulpados,
  type DadosDicas
} from '../src/main/desempenhoRegras'
import { estimarPregeracao } from '../src/shared/desempenho'

test('flags otimizadas usam a mesma RAM no -Xms', () => {
  const f = flagsOtimizadas(6)
  assert.equal(f[0], '-Xms6G')
  assert.ok(f.includes('-XX:+UseG1GC'))
})

test('TPS de cada loader', () => {
  assert.equal(
    lerTps('[12:00:00 INFO]: TPS from last 1m, 5m, 15m: *20.0, 19.5, 19.9', false).tps,
    20
  )
  assert.equal(
    lerTps('[12:00:00 INFO]: Overall: Mean tick time: 2.345 ms. Mean TPS: 19.870', false).tps,
    19.87
  )
  assert.equal(lerTps('[12:00:00 INFO]: Overall: 18.500 TPS (54.050 ms/tick)', false).tps, 18.5)
  const titulo = lerTps('[⚡] TPS from last 5s, 10s, 1m, 5m, 15m:', false)
  assert.deepEqual(titulo, { tps: null, esperando: true })
  assert.equal(lerTps('[⚡]  *20.0, 20.0, 19.98, 19.99, 20.0', true).tps, 20)
  assert.equal(lerTps('[12:00:00 INFO]: Fulano joined the game', false).tps, null)
})

const base: DadosDicas = {
  ramUsada: null,
  ramMax: null,
  ramGb: 4,
  ramMaxPc: 14,
  cpu: null,
  tps: null,
  jogadores: 0,
  distanciaVisao: 10,
  distanciaSimulacao: 10,
  mods: 0,
  javaOtimizado: true
}

test('dicas automáticas', () => {
  assert.deepEqual(dicas(base), [])
  assert.match(dicas({ ...base, ramUsada: 3.8e9, ramMax: 4e9 })[0], /aumente para 6 GB/)
  assert.match(
    dicas({ ...base, distanciaVisao: 14, jogadores: 8 })[0],
    /Distância de visão alta \(14\) para 8 jogadores/
  )
  assert.match(dicas({ ...base, tps: 12.3 })[0], /TPS 12,3/)
  assert.match(dicas({ ...base, javaOtimizado: false })[0], /otimizada do Java/)
})

test('estimativa da pré-geração', () => {
  const e = estimarPregeracao(1000)
  assert.equal(e.chunks, 125 * 125)
  assert.ok(e.segundos > 0 && e.bytes > 0)
})

test('mensagens do Chunky', () => {
  assert.deepEqual(
    lerChunky(
      '[12:00:00 INFO]: [Chunky] Task running for minecraft:overworld. Processed: 1234 chunks (12.34%), ETA: 0:01:23, Rate: 45.6 cps, Current: 10, 20'
    ),
    { tipo: 'progresso', chunks: 1234, porcentagem: 12.34, eta: '0:01:23', velocidade: 45.6 }
  )
  assert.deepEqual(
    lerChunky(
      '[Chunky] Task finished for world. Processed: 15625 chunks (100.00%), Total time: 0:08:41'
    ),
    {
      tipo: 'fim',
      chunks: 15625
    }
  )
  assert.equal(lerChunky('[Chunky] Task paused for world.')?.tipo, 'pausado')
  assert.equal(
    lerChunky(
      "[Chunky] A task was already started for this world. To continue running it, type 'chunky continue'."
    )?.tipo,
    'pergunta'
  )
  assert.equal(lerChunky('Fulano joined the game'), null)
})

test('BlueMap: status, porta e aceite', () => {
  assert.deepEqual(lerBlueMap('[BlueMap] progress: 42.125%'), {
    tipo: 'progresso',
    porcentagem: 42.125
  })
  assert.equal(lerBlueMap('✔ 2 render-threads are idle')?.tipo, 'ocioso')
  assert.equal(lerPorta('enabled: true\nport: 8100\n', 'port'), 8100)
  assert.equal(lerPorta('webserver-port: 8123', 'webserver-port'), 8123)
  const conf = '# leia antes\naccept-download: false\nrender-thread-count: 1\n'
  assert.equal(precisaAceitarBlueMap(conf), true)
  assert.equal(precisaAceitarBlueMap(aceitarBlueMap(conf)), false)
  assert.match(aceitarBlueMap(conf), /render-thread-count: 1/)
})

// ---------- protobuf mínimo para montar um relatório do spark de teste ----------

function varint(n: number): number[] {
  const r: number[] = []
  while (n >= 128) {
    r.push((n % 128) | 0x80)
    n = Math.floor(n / 128)
  }
  r.push(n)
  return r
}
const campo = (n: number, bytes: number[]): number[] => [
  ...varint(n * 8 + 2),
  ...varint(bytes.length),
  ...bytes
]
const txt = (s: string): number[] => [...Buffer.from(s, 'utf8')]
const dbl = (xs: number[]): number[] => {
  const b = Buffer.alloc(xs.length * 8)
  xs.forEach((x, i) => b.writeDoubleLE(x, i * 8))
  return [...b]
}
const no = (classe: string, tempo: number, filhos: number[]): number[] => [
  ...campo(3, txt(classe)),
  ...campo(8, dbl([tempo])),
  ...(filhos.length ? campo(9, filhos.flatMap(varint)) : [])
]

test('culpados do relatório do spark', () => {
  const linha = [
    ...campo(1, txt('Server thread')),
    ...campo(3, no('net.minecraft.server.MinecraftServer', 900, [1, 2])), // próprio: 100
    ...campo(3, no('com.example.create.Contraption', 600, [3])), // próprio: 400 (create)
    ...campo(3, no('net.minecraft.world.level.Level', 200, [])), // próprio: 200
    ...campo(3, no('java.util.concurrent.locks.LockSupport', 200, [])), // Java: ignorado
    ...campo(5, varint(0))
  ]
  const fonte = [...campo(1, txt('com.example.create.Contraption')), ...campo(2, txt('create'))]
  const dados = new Uint8Array([...campo(2, linha), ...campo(3, fonte)])
  const r = culpadosDoSpark(dados)
  assert.deepEqual(
    r.map((c) => c.nome),
    ['create', 'minecraft']
  )
  assert.ok(Math.abs(r[0].parte - 4 / 7) < 1e-9) // create 400 de 700
  assert.deepEqual(
    culpadosDoSpark(new Uint8Array(gzipSync(dados))).map((c) => c.nome),
    ['create', 'minecraft']
  )
  assert.match(resumoDosCulpados(r), /"create" é o que mais pesa/)
  assert.equal(linkDoSpark('[⚡] https://spark.lucko.me/AbC123xyz'), 'AbC123xyz')
})
