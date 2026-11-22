import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ajustarAoFundo,
  contraste,
  hex,
  piorContraste,
  rgbDeTexto,
  superficies,
  type Rgb
} from '../src/shared/contrasteRegras.ts'
import {
  MIN_LETRA,
  MIN_NOME,
  OFICIAIS,
  nomeDaLogo,
  paletaDaLogo,
  paraOklab,
  type PaletaLogo
} from '../src/shared/logoCoresRegras.ts'
import { ARTE, LOGO } from '../src/renderer/src/fundo/biomas.ts'
import { BIOMAS, type Bioma } from '../src/shared/tipos.ts'

// Logo e nome que acompanham o fundo (DESIGN.md 1.1): cada um dos 12 fundos tem a paleta tirada
// à mão das cores da própria cena (LOGO em fundo/biomas.ts). Regra 3: o nome ("Hub" na cor da face
// do H, "Square" na da face do S) com 4,5:1 sobre o vidro da barra lateral, e as letras H e S com
// 3:1 sobre a face; regra 7: na versão pequena, as letras continuam brancas e também com 3:1.

const RAIZ = join(import.meta.dirname, '..')
const CSS = readFileSync(join(RAIZ, 'src', 'renderer', 'src', 'assets', 'tokens.css'), 'utf8')

function variaveis(bloco: string): Record<string, string> {
  const v: Record<string, string> = {}
  for (const m of bloco.matchAll(/(--[\w-]+):\s*([^;]+);/g)) v[m[1]] = m[2].trim()
  return v
}
function tokens(bioma: string): Record<string, string> {
  const raiz = variaveis(/:root \{([\s\S]*?)\n\}/.exec(CSS)![1])
  const seletor = bioma === 'dia' ? ":root,\n[data-bioma='dia'] {" : `[data-bioma='${bioma}'] {`
  const inicio = CSS.indexOf(seletor)
  return { ...raiz, ...variaveis(CSS.slice(inicio, CSS.indexOf('}', inicio))) }
}

// O vidro da barra lateral sobre o fundo, com a opacidade que a tela usa (a do contraste do texto).
function vidroSobre(bioma: Bioma, fundos: Rgb[]): Rgb[] {
  const t = tokens(bioma)
  const vidro = rgbDeTexto(t['--vidro-rgb'])
  const { alfa } = ajustarAoFundo(
    {
      vidro,
      vidro2: rgbDeTexto(t['--vidro-2-rgb']),
      alfa: Number(t['--vidro-alfa']),
      texto: hex(t['--text']),
      textoApagado: hex(t['--text-muted'])
    },
    fundos,
    {}
  )
  return superficies({ cores: [vidro], textos: [] }, alfa, fundos)
}

const matiz = (c: Rgb): number => {
  const [, a, b] = paraOklab(c)
  return (Math.atan2(b, a) * 180) / Math.PI
}
const croma = (c: Rgb): number => Math.hypot(paraOklab(c)[1], paraOklab(c)[2])

for (const bioma of BIOMAS) {
  test(`logo e nome legíveis no fundo ${bioma}`, () => {
    const cena = LOGO[bioma]
    // As cores vêm da própria cena (nunca de fórmula ou giro de matiz).
    const daCena = new Set(ARTE[bioma].paleta.map((c) => c.toLowerCase()))
    for (const k of ['h', 's', 'topo'] as const) {
      assert.ok(daCena.has(cena[k].toLowerCase()), `${bioma}: ${k} ${cena[k]} não é da cena`)
    }
    const sobre = vidroSobre(bioma, ARTE[bioma].paleta.map(hex))
    const p = paletaDaLogo({ modo: 'fundo', cena })
    const c = (k: keyof PaletaLogo): Rgb => hex(p[k])
    const nomes = nomeDaLogo(p, sobre)
    for (const [lado, original, palavra] of [
      ['esquerda', cena.h, nomes.hub],
      ['direita', cena.s, nomes.square]
    ] as const) {
      const face = c(lado)
      // Regra 3: o nome (no tom da face) com 4,5:1 sobre o vidro da barra lateral.
      const nome = piorContraste([hex(palavra)], sobre)
      assert.ok(nome >= MIN_NOME, `${bioma}: nome no tom da ${lado} ${nome.toFixed(2)}`)
      // Letra gravada da completa e letra branca da pequena (regra 7), com 3:1 sobre a face.
      const gravada = contraste(c(`${lado}Letra`), face)
      assert.ok(gravada >= MIN_LETRA, `${bioma}: letra ${lado} ${gravada.toFixed(2)}`)
      assert.equal(p[`${lado}LetraPequena`], '#ffffff')
      const branca = contraste([255, 255, 255], face)
      assert.ok(branca >= MIN_LETRA, `${bioma}: letra branca ${lado} ${branca.toFixed(2)}`)
      // Só a claridade mudou: o tom é o da cena (quando a cor tem tom).
      if (croma(hex(original)) > 0.04) {
        for (const [qual, cor] of [
          ['face', face],
          ['nome', hex(palavra)]
        ] as const) {
          const d = Math.abs(((matiz(cor) - matiz(hex(original)) + 540) % 360) - 180)
          assert.ok(d <= 10, `${bioma}: o tom do ${qual} (${lado}) mudou ${d.toFixed(1)}°`)
        }
      }
    }
    // O topo e o contorno são os da cena, sem ajuste.
    assert.equal(p.topo, cena.topo.toLowerCase())
    assert.equal(p.contorno, cena.contorno)
  })
}

test('fundo sem paleta própria (imagem do usuário) e "Oficiais": as cores originais da logo', () => {
  assert.deepEqual(paletaDaLogo({ modo: 'fundo', cena: null }), OFICIAIS)
  for (const bioma of BIOMAS) {
    assert.deepEqual(paletaDaLogo({ modo: 'oficiais', cena: LOGO[bioma] }), OFICIAIS)
  }
})

test('as cores oficiais são exatamente as dos SVGs de build/logo', () => {
  const svgs = ['hubsquare-logo.svg', 'hubsquare-logo-pequena.svg']
    .map((n) => readFileSync(join(RAIZ, 'build', 'logo', n), 'utf8'))
    .join('')
  const nosSvgs = new Set([...svgs.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toLowerCase()))
  assert.deepEqual(new Set(Object.values(OFICIAIS)), nosSvgs)
})
