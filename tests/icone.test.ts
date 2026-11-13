import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pngDe64 } from '../src/main/icone'

function png(largura: number, altura: number): Buffer {
  const b = Buffer.alloc(40)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'latin1')
  b.writeUInt32BE(largura, 16)
  b.writeUInt32BE(altura, 20)
  return b
}

test('só aceita PNG de 64×64', () => {
  assert.equal(pngDe64(png(64, 64)), true)
  assert.equal(pngDe64(png(128, 128)), false)
  assert.equal(pngDe64(Buffer.from('não é png, mas tem mais de trinta e três bytes...')), false)
})
