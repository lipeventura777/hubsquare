import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decidir,
  guardarPedido,
  lerPedidos,
  MAX_PEDIDOS,
  normalizarUuid,
  PEDIDOS_VAZIO,
  situacaoDoPedido,
  urlDaSituacao,
  validarPedido
} from '../src/main/conviteRegras.ts'

// Pedidos para entrar pelo convite (Fase M4): a rota de escrita só guarda pedidos válidos.

const UUID = '069a79f4-44e9-4726-a5be-fca90e38aaf5'
const pedido = {
  nick: 'Amigo_1',
  uuid: UUID.replace(/-/g, ''),
  recado: 'Oi! Sou amigo do dono 😀'
}
const AGORA = '2026-11-13T12:00:00.000Z'

test('pedido válido: nick, UUID (com ou sem tracinhos) e recado', () => {
  assert.deepEqual(validarPedido(pedido), {
    nick: 'Amigo_1',
    uuid: UUID,
    recado: 'Oi! Sou amigo do dono 😀'
  })
  assert.deepEqual(validarPedido({ nick: 'abc', uuid: UUID }), {
    nick: 'abc',
    uuid: UUID,
    recado: ''
  })
})

test('nick com caracteres estranhos é recusado', () => {
  for (const nick of [
    'ab',
    'a'.repeat(17),
    'nome com espaço',
    'José',
    '<script>',
    'a;op b',
    '../../x',
    '',
    42
  ]) {
    assert.throws(() => validarPedido({ ...pedido, nick }), undefined, String(nick))
  }
})

test('recado longo ou com caracteres de controle é recusado', () => {
  assert.throws(() => validarPedido({ ...pedido, recado: 'a'.repeat(101) }))
  assert.doesNotThrow(() => validarPedido({ ...pedido, recado: 'é'.repeat(100) }))
  for (const recado of ['linha\nnova', 'nulo\u0000', 'bidi‮abc', 'tab\tx', 'zero​width', 7]) {
    assert.throws(() => validarPedido({ ...pedido, recado }), undefined, JSON.stringify(recado))
  }
})

test('corpo com campo a mais, UUID ruim ou que não é objeto é recusado', () => {
  assert.throws(() => validarPedido({ ...pedido, comando: 'op Amigo_1' }))
  assert.throws(() => validarPedido({ ...pedido, uuid: 'nao-e-uuid' }))
  assert.throws(() => validarPedido(null))
  assert.throws(() => validarPedido([pedido]))
  assert.throws(() => validarPedido('nick=Amigo_1'))
  assert.equal(normalizarUuid('069A79F444E94726A5BEFCA90E38AAF5'), UUID)
})

test('guarda até 20 pendentes; o 21º é recusado', () => {
  let p = PEDIDOS_VAZIO
  for (let i = 0; i < MAX_PEDIDOS; i++) {
    const uuid = normalizarUuid(i.toString(16).padStart(32, '0'))!
    const r = guardarPedido(p, { nick: `Amigo${i}`, uuid, recado: '' }, AGORA)
    assert.equal(r.resultado, 'guardado')
    p = r.pedidos
  }
  const r21 = guardarPedido(p, validarPedido(pedido), AGORA)
  assert.equal(r21.resultado, 'cheio')
  assert.equal(r21.pedidos.pendentes.length, MAX_PEDIDOS)
})

test('UUID repetido não vira outro pedido', () => {
  const um = guardarPedido(PEDIDOS_VAZIO, validarPedido(pedido), AGORA).pedidos
  const dois = guardarPedido(um, { ...validarPedido(pedido), nick: 'OutroNome' }, AGORA)
  assert.equal(dois.resultado, 'repetido')
  assert.equal(dois.pedidos.pendentes.length, 1)
})

test('aprovação automática: não guarda, manda aprovar', () => {
  const auto = { ...PEDIDOS_VAZIO, aprovarAutomatico: true }
  const r = guardarPedido(auto, validarPedido(pedido), AGORA)
  assert.equal(r.resultado, 'aprovar')
  assert.equal(r.pedidos.pendentes.length, 0)
})

test('aprovar, recusar e a situação só do UUID perguntado', () => {
  const p = guardarPedido(PEDIDOS_VAZIO, validarPedido(pedido), AGORA).pedidos
  assert.equal(situacaoDoPedido(p, UUID), 'pendente')
  assert.equal(situacaoDoPedido(p, normalizarUuid('1'.repeat(32))!), 'desconhecido')
  const aprovado = decidir(p, UUID, true)
  assert.equal(aprovado.pendentes.length, 0)
  assert.equal(situacaoDoPedido(aprovado, UUID), 'aprovado')
  assert.equal(guardarPedido(aprovado, validarPedido(pedido), AGORA).resultado, 'ja-aprovado')
  const recusado = decidir(p, UUID, false)
  assert.equal(situacaoDoPedido(recusado, UUID), 'recusado')
  // Recusado pode pedir de novo (volta a pendente).
  assert.equal(
    situacaoDoPedido(guardarPedido(recusado, validarPedido(pedido), AGORA).pedidos, UUID),
    'pendente'
  )
})

test('arquivo de pedidos estranho volta ao vazio; URL da situação leva só o UUID', () => {
  assert.deepEqual(lerPedidos(null), PEDIDOS_VAZIO)
  assert.deepEqual(
    lerPedidos({
      pendentes: [{ nick: '<x>', uuid: 'y', recado: 1 }],
      respostas: { a: 'aprovado' }
    }),
    PEDIDOS_VAZIO
  )
  assert.equal(
    urlDaSituacao('26.1.2.3:8788', 'ABCDEFGHJKLMNPQR', UUID),
    'http://26.1.2.3:8788/convite/ABCDEFGHJKLMNPQR/pedido/069a79f444e94726a5befca90e38aaf5'
  )
})
