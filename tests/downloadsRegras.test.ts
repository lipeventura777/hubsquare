import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  conferir,
  ehTemporario,
  nomeOriginal,
  triar,
  type Esperado
} from '../src/main/downloadsRegras'

const SHA1 = 'a'.repeat(40)
const esperado: Esperado = {
  id: 'x',
  arquivo: 'create-1.21.1-6.0.jar',
  tamanho: 1000,
  sha1: SHA1,
  md5: null
}

test('hash certo: aceita', () => {
  assert.deepEqual(triar('create-1.21.1-6.0.jar', 1000, [esperado]), {
    tipo: 'conferir',
    ids: ['x']
  })
  assert.deepEqual(conferir('create-1.21.1-6.0.jar', { sha1: SHA1, md5: '' }, [esperado]), {
    tipo: 'ok',
    ids: ['x']
  })
  // Só o hash decide: com outro nome, o mesmo conteúdo vale.
  assert.equal(conferir('qualquer.jar', { sha1: SHA1, md5: '' }, [esperado]).tipo, 'ok')
  // Sem SHA-1, vale o MD5.
  const soMd5 = { ...esperado, sha1: null, md5: 'b'.repeat(32) }
  assert.equal(conferir('a.jar', { sha1: SHA1, md5: 'b'.repeat(32) }, [soMd5]).tipo, 'ok')
})

test('hash errado: nunca aceita; com o mesmo nome, explica', () => {
  const r = conferir('create-1.21.1-6.0.jar', { sha1: 'c'.repeat(40), md5: '' }, [esperado])
  assert.equal(r.tipo, 'diferente')
  // Arquivo qualquer do mesmo tamanho e hash diferente: nem é citado (não é tocado).
  assert.deepEqual(conferir('foto.png', { sha1: 'c'.repeat(40), md5: '' }, [esperado]), {
    tipo: 'ignorar'
  })
  // Nome certo e tamanho errado: diferente, com o motivo.
  const t = triar('create-1.21.1-6.0.jar', 900, [esperado])
  assert.equal(t.tipo, 'diferente')
  assert.match((t as { motivo: string }).motivo, /tamanho/)
  // Nome sozinho não basta.
  assert.notEqual(triar('create-1.21.1-6.0.jar', 900, [esperado]).tipo, 'conferir')
  // Item sem hash nenhum nunca vai para conferir.
  assert.equal(triar('a.jar', 1000, [{ ...esperado, sha1: null }]).tipo, 'ignorar')
})

test('nome com " (1)" e parecidos', () => {
  assert.equal(nomeOriginal('create-1.21.1-6.0 (1).jar'), 'create-1.21.1-6.0.jar')
  assert.equal(nomeOriginal('create-1.21.1-6.0(2).jar'), 'create-1.21.1-6.0.jar')
  assert.equal(nomeOriginal('mod (12)'), 'mod')
  assert.equal(nomeOriginal('mod-(1.21).jar'), 'mod-(1.21).jar')
  const t = triar('create-1.21.1-6.0 (1).jar', 900, [esperado])
  assert.equal(t.tipo, 'diferente')
  assert.equal(
    conferir('create-1.21.1-6.0 (1).jar', { sha1: SHA1, md5: '' }, [esperado]).tipo,
    'ok'
  )
})

test('arquivo temporário de download: ignorado até terminar', () => {
  for (const n of [
    'create-1.21.1-6.0.jar.crdownload',
    'create-1.21.1-6.0.jar.part',
    'create-1.21.1-6.0.jar.tmp',
    'Não confirmado 123.crdownload'
  ]) {
    assert.equal(ehTemporario(n), true, n)
    assert.deepEqual(triar(n, 1000, [esperado]), { tipo: 'ignorar' })
  }
  assert.equal(ehTemporario('create-1.21.1-6.0.jar'), false)
  // Firefox: o arquivo final existe vazio até o .part terminar.
  assert.deepEqual(triar('create-1.21.1-6.0.jar', 0, [esperado]), { tipo: 'ignorar' })
})
