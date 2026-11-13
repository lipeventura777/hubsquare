import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dividirMemoria,
  duracao,
  lerRespostaDeStatus,
  lerVarint,
  pedidoDeStatus,
  separarEndereco,
  varint
} from '../src/main/jogoRegras.ts'

test('VarInt vai e volta, inclusive nos limites de byte', () => {
  for (const n of [0, 1, 127, 128, 255, 25565, 2097151, 767]) {
    assert.equal(lerVarint(varint(n))?.valor, n)
  }
  assert.equal(lerVarint(Buffer.from([0x80])), null) // incompleto: espera mais bytes
})

test('endereço com e sem porta', () => {
  assert.deepEqual(separarEndereco('26.1.2.3'), { host: '26.1.2.3', porta: 25565 })
  assert.deepEqual(separarEndereco('x.joinmc.link:4321'), { host: 'x.joinmc.link', porta: 4321 })
  assert.equal(separarEndereco('a b'), null)
  assert.equal(separarEndereco('host:99999'), null)
})

test('pedido de status começa com o handshake no estado 1', () => {
  const p = pedidoDeStatus('localhost', 25565)
  const t = lerVarint(p)!
  const id = lerVarint(p, t.fim)!
  assert.equal(id.valor, 0)
  assert.equal(p[t.fim + t.valor - 1], 1) // próximo estado: status
  assert.deepEqual([...p.subarray(p.length - 2)], [1, 0]) // pedido de status vazio
})

test('lê a resposta com jogadores e ignora nomes anônimos', () => {
  const json = JSON.stringify({
    players: {
      online: 3,
      max: 20,
      sample: [
        { name: 'Ana', id: '069a79f4-44e9-4726-a5be-fca90e38aaf5' },
        { name: 'Anonymous Player', id: '00000000-0000-0000-0000-000000000000' }
      ]
    }
  })
  const corpo = Buffer.concat([varint(0), varint(Buffer.byteLength(json)), Buffer.from(json)])
  const resposta = Buffer.concat([varint(corpo.length), corpo])
  assert.deepEqual(lerRespostaDeStatus(resposta), {
    online: 3,
    max: 20,
    amostra: [{ nome: 'Ana', uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5' }]
  })
  assert.equal(lerRespostaDeStatus(resposta.subarray(0, 10)), null) // chegou pela metade
})

test('memória dividida com o servidor no mesmo PC', () => {
  assert.deepEqual(dividirMemoria(16, 6, 4), { disponivel: 8, cabe: true })
  assert.deepEqual(dividirMemoria(8, 6, 4), { disponivel: 1, cabe: false })
  assert.deepEqual(dividirMemoria(16, null, 8), { disponivel: 14, cabe: true })
})

test('tempo de sessão em texto curto', () => {
  assert.equal(duracao(45_000), '45 s')
  assert.equal(duracao(12 * 60_000), '12 min')
  assert.equal(duracao(65 * 60_000), '1 h 05 min')
})
