import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ajustarAoFundo,
  alfaNecessario,
  contraste,
  hex,
  misturar,
  piorContraste,
  rgbDeTexto,
  superficies,
  type Rgb,
  type TokensBioma
} from '../src/shared/contrasteRegras.ts'
import { ARTE } from '../src/renderer/src/fundo/biomas.ts'
import { derivarAccent } from '../src/renderer/src/aparencia/accent.ts'
import { BIOMAS } from '../src/shared/tipos.ts'

// Contraste de 4,5:1 em todo texto, nos cinco biomas (Fase V1). Lê o tokens.css de verdade e a
// paleta de cada bioma (o pior pedaço de fundo que pode ficar atrás de um painel).

const CSS = readFileSync(
  join(import.meta.dirname, '..', 'src', 'renderer', 'src', 'assets', 'tokens.css'),
  'utf8'
)

function variaveis(bloco: string): Record<string, string> {
  const v: Record<string, string> = {}
  for (const m of bloco.matchAll(/(--[\w-]+):\s*([^;]+);/g)) v[m[1]] = m[2].trim()
  return v
}

function tokens(bioma: string): Record<string, string> {
  const raiz = variaveis(/:root \{([\s\S]*?)\n\}/.exec(CSS)![1])
  const seletor = bioma === 'dia' ? ":root,\n[data-bioma='dia'] {" : `[data-bioma='${bioma}'] {`
  const inicio = CSS.indexOf(seletor)
  assert.ok(inicio >= 0, `bioma ${bioma} no tokens.css`)
  return { ...raiz, ...variaveis(CSS.slice(inicio, CSS.indexOf('}', inicio))) }
}

function doBioma(t: Record<string, string>): TokensBioma {
  const brilho = /rgb\((\d+ \d+ \d+) \/ ([\d.]+)\)/.exec(t['--brilho-topo'])
  return {
    vidro: rgbDeTexto(t['--vidro-rgb']),
    vidro2: rgbDeTexto(t['--vidro-2-rgb']),
    alfa: Number(t['--vidro-alfa']),
    texto: hex(t['--text']),
    textoApagado: hex(t['--text-muted']),
    brilho: brilho ? { cor: rgbDeTexto(brilho[1]), alfa: Number(brilho[2]) } : undefined
  }
}

test('regra: o vidro fica mais opaco até o texto ter 4,5:1', () => {
  const branco: Rgb = [255, 255, 255]
  const vidro = { cores: [[12, 20, 28] as Rgb], textos: [hex('#f8fafc')] }
  const a = alfaNecessario(vidro, [branco], 0.42)
  assert.ok(a > 0.42 && a < 1)
  assert.ok(piorContraste(vidro.textos, superficies(vidro, a, [branco])) >= 4.5)
  assert.ok(piorContraste(vidro.textos, superficies(vidro, a - 0.01, [branco])) < 4.5)
  // Fundo que já dá contraste: fica na opacidade do bioma.
  assert.equal(alfaNecessario(vidro, [[0, 0, 0]], 0.42), 0.42)
})

for (const bioma of BIOMAS) {
  test(`contraste 4,5:1 no bioma ${bioma}`, () => {
    const t = tokens(bioma)
    const b = doBioma(t)
    const fundos = ARTE[bioma].paleta.map(hex)
    const accent = hex(t['--accent-padrao'])
    const { alfa, legiveis } = ajustarAoFundo(b, fundos, {
      accent,
      perigo: hex(t['--status-error']),
      atencao: hex(t['--warning']),
      online: hex(t['--status-online'])
    })
    // Continua vidro (dá para ver o fundo).
    console.log(`${bioma}: vidro a ${alfa}`)
    assert.ok(alfa <= 0.85, `${bioma}: vidro opaco demais (${alfa})`)
    const vidro = {
      cores: [b.vidro, b.vidro2],
      textos: [b.texto, b.textoApagado],
      brilho: b.brilho
    }
    const sobre = superficies(vidro, alfa, fundos)
    assert.ok(piorContraste(vidro.textos, sobre) >= 4.5, `${bioma}: texto`)
    // Hover/selecionado (--bg-tile-active = vidro 2 com +0,18).
    const hover = fundos.map((f) => misturar(b.vidro2, Math.min(1, alfa + 0.18), f))
    assert.ok(piorContraste(vidro.textos, hover) >= 4.5, `${bioma}: texto no hover`)
    for (const [nome, cor] of Object.entries(legiveis)) {
      assert.ok(piorContraste([cor], sobre) >= 4.5, `${bioma}: ${nome} como texto`)
    }
    // Texto do botão de destaque (JOGAR): escuro sobre a cor do bioma.
    const { textoEscuro } = derivarAccent(t['--accent-padrao'])
    const textoBotao = hex(textoEscuro ? t['--text-on-light'] : t['--text-on-dark'])
    assert.ok(contraste(textoBotao, accent) >= 4.5, `${bioma}: texto do JOGAR`)
    // Console e editores (vidro quase opaco, sempre escuro).
    const consoles = fundos.map((f) => misturar(rgbDeTexto(t['--console-rgb']), 0.88, f))
    assert.ok(
      piorContraste([hex(t['--text-on-dark']), hex(t['--console-text-muted'])], consoles) >= 4.5,
      `${bioma}: console`
    )
  })
}

test('botões sólidos (perigo, atenção, destaque, secundário) com texto legível', () => {
  const t = tokens('dia')
  const pares: [string, string][] = [
    ['--text-on-dark', '--danger'],
    ['--text-on-light', '--warning'],
    ['--text-on-dark', '--highlight'],
    ['--text-on-light', '--secondary']
  ]
  for (const [texto, fundo] of pares) {
    assert.ok(contraste(hex(t[texto]), hex(t[fundo])) >= 4.5, `${texto} sobre ${fundo}`)
  }
})

test('placa do banner (vidro a 70%) dá 4,5:1 sobre qualquer imagem, em todos os biomas', () => {
  // Pior caso de qualquer imagem: preto, branco e as cores puras.
  const qualquer: Rgb[] = []
  for (const r of [0, 128, 255])
    for (const g of [0, 128, 255]) for (const b of [0, 128, 255]) qualquer.push([r, g, b])
  for (const bioma of BIOMAS) {
    const b = doBioma(tokens(bioma))
    const alfa = Math.max(b.alfa, 0.7)
    const placas = qualquer.map((f) => misturar(b.vidro, alfa, f))
    assert.ok(piorContraste([b.texto, b.textoApagado], placas) >= 4.5, `${bioma}: placa do banner`)
  }
})
