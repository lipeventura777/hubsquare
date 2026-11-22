import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { versaoDaLogo } from '../src/shared/marcaRegras'

// Logo nova do HubSquare (cubo chunk): os dois SVGs são a fonte de tudo, o .ico segue a regra das
// versões e nada do app aponta para a logo antiga.

const RAIZ = join(import.meta.dirname, '..')
const ler = (...p: string[]): Buffer => readFileSync(join(RAIZ, ...p))
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

test('os dois SVGs da logo continuam exatamente como foram entregues', () => {
  assert.equal(
    sha256(ler('build', 'logo', 'hubsquare-logo.svg')),
    'e03d8054d10343a67391edfc1565b783c38a5f85129f4f2e24607fd3db5ed9dc'
  )
  assert.equal(
    sha256(ler('build', 'logo', 'hubsquare-logo-pequena.svg')),
    'a360fcd92508c1a2a86ca1f83ffee6e662417ca1ed101b687fc9dfc09cd05a84'
  )
})

test('completa de 56 px para cima, pequena abaixo', () => {
  for (const t of [16, 20, 24, 32, 40, 48, 55]) assert.equal(versaoDaLogo(t), 'pequena', `${t}`)
  for (const t of [56, 64, 72, 128, 256, 1024]) assert.equal(versaoDaLogo(t), 'completa', `${t}`)
})

test('build/icon.ico: 16 a 48 px da pequena e 64, 128 e 256 px da completa', () => {
  const ico = ler('build', 'icon.ico')
  const quantos = ico.readUInt16LE(4)
  const imagens = new Map<number, Buffer>()
  for (let i = 0; i < quantos; i++) {
    const e = 6 + 16 * i
    const tamanho = ico.readUInt8(e) || 256
    imagens.set(
      tamanho,
      ico.subarray(ico.readUInt32LE(e + 12), ico.readUInt32LE(e + 12) + ico.readUInt32LE(e + 8))
    )
  }
  assert.deepEqual(
    [...imagens.keys()].sort((a, b) => a - b),
    [16, 20, 24, 32, 40, 48, 64, 128, 256]
  )
  // Cada tamanho é o PNG gerado da versão certa (o mesmo de build/logo/png/).
  for (const [t, png] of imagens)
    assert.ok(png.equals(ler('build', 'logo', 'png', `hubsquare-${t}.png`)), `${t}`)
  // A cópia em resources/ (janela e bandeja) é o mesmo .ico.
  assert.ok(ico.equals(ler('resources', 'hubsquare.ico')))
})

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n)
    return statSync(p).isDirectory() ? arquivos(p) : [p]
  })
}

test('nada aponta para a logo antiga', () => {
  for (const antigo of [join('build', 'icon.png'), join('resources', 'icon.png')]) {
    assert.ok(!existsSync(join(RAIZ, antigo)), `${antigo} ainda existe`)
  }
  const onde = [
    ...arquivos(join(RAIZ, 'src')),
    ...arquivos(join(RAIZ, 'scripts')),
    ...arquivos(join(RAIZ, 'tests')),
    ...['electron-builder.yml', 'package.json', 'README.md', 'README.pt-BR.md'].map((n) =>
      join(RAIZ, n)
    )
  ].filter((p) => /\.(tsx?|mjs|ya?ml|json|md|html|nsh)$/.test(p) && !p.endsWith('marca.test.ts'))
  const achados = onde.filter((p) =>
    // server-icon.png e world/icon.png são do jogo (servidor e mundo), não a logo do app.
    /(?<![-\w])icon\.png/.test(
      readFileSync(p, 'utf8')
        .replaceAll('server-icon.png', '')
        .replaceAll("'world', 'icon.png'", '')
    )
  )
  assert.deepEqual(
    achados.map((p) => relative(RAIZ, p)),
    []
  )
})
