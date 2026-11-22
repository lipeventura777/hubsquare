import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { DURACOES } from '../src/shared/animacaoRegras'

// Fase P8 (DESIGN.md seção 8): um sistema de movimento só. Falha se uma animação usar duração ou
// curva fora dos tokens, ou se mexer em propriedade de layout (largura, altura, posição, margem).

const RAIZ = join(import.meta.dirname, '..')
const TELAS = join(RAIZ, 'src', 'renderer', 'src')
const CSS = readFileSync(join(TELAS, 'assets', 'main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const TOKENS = readFileSync(join(TELAS, 'assets', 'tokens.css'), 'utf8')

const DURACAO_TOKEN = /^var\(--dur-(fast|base|modal)\)$/
const CURVA_TOKEN = /^(var\(--ease-(entrada|saida)\)|linear|steps\(\d+\))$/
// Só o que o navegador desenha sem refazer o layout.
const PROPRIEDADES = new Set([
  'opacity',
  'transform',
  'translate',
  'scale',
  'color',
  'background-color',
  'border-color',
  'outline-color',
  'box-shadow',
  // Cores do SVG da logo (fill e stroke só repintam, não mexem no layout).
  'fill',
  'stroke'
])
// Tempos fixos que não são duração de interface: a barra de 5 s dos avisos (é um relógio) e a
// espera de 150 ms antes do esqueleto aparecer. Loops (infinite) têm o próprio ritmo.
// 300 ms: a cor da logo e do nome acompanha a troca de fundo (pedido explícito, DESIGN.md 1.1).
// 250 ms: o fade do modo vitrine (pedido explícito, DESIGN.md 6.22.10).
const TEMPOS_PERMITIDOS = new Set(['5s', '150ms', '0ms', '300ms', '250ms'])

// Declarações `animation:` e `transition:` do main.css (podem ocupar várias linhas).
const declaracoes = (nome: string): string[] =>
  [...CSS.matchAll(new RegExp(`(?<![\\w-])${nome}:\\s*([^;]+);`, 'g'))].map((m) =>
    m[1].replace(/!important/, '').trim()
  )

test('os tokens de duração do CSS são os mesmos do código (DURACOES)', () => {
  const valor = (v: string): number =>
    Number(TOKENS.match(new RegExp(`--dur-${v}:\\s*(\\d+)ms`))?.[1])
  assert.equal(valor('fast'), DURACOES.rapida)
  assert.equal(valor('base'), DURACOES.normal)
  assert.equal(valor('modal'), DURACOES.modal)
  for (const velho of ['--dur-slow', '--dur-instant', '--ease-out']) {
    assert.ok(!TOKENS.includes(velho) && !CSS.includes(velho), `sobrou o token antigo ${velho}`)
  }
})

test('animações e transições do CSS usam só durações e curvas dos tokens', () => {
  const problemas: string[] = []
  for (const d of [...declaracoes('animation'), ...declaracoes('transition')]) {
    if (d === 'none') continue
    for (const parte of d.split(/,(?![^(]*\))/)) {
      const loop = /\binfinite\b/.test(parte)
      const palavras = parte.trim().match(/[\w-]+\([^)]*\)|[^\s]+/g) ?? []
      for (const p of palavras) {
        if (/^\d/.test(p) && /m?s$/.test(p) && !loop && !TEMPOS_PERMITIDOS.has(p)) {
          problemas.push(`duração fixa "${p}" em: ${parte.trim()}`)
        }
        if (/^var\(--dur-/.test(p) && !DURACAO_TOKEN.test(p)) problemas.push(`duração ${p}`)
        if (
          /^(ease|ease-in|ease-out|ease-in-out|cubic-bezier\(.*|var\(--ease-.*)$/.test(p) &&
          !CURVA_TOKEN.test(p)
        ) {
          problemas.push(`curva "${p}" em: ${parte.trim()}`)
        }
        if (loop && /^var\(--ease-/.test(p))
          problemas.push(`loop com curva de entrada/saída: ${parte.trim()}`)
      }
    }
  }
  assert.deepEqual(problemas, [])
})

test('transições do CSS só mexem em opacidade, transform e cor', () => {
  const problemas: string[] = []
  for (const d of declaracoes('transition')) {
    if (d === 'none') continue
    for (const parte of d.split(/,(?![^(]*\))/)) {
      const prop = parte.trim().split(/\s+/)[0]
      if (!PROPRIEDADES.has(prop)) problemas.push(`transition de "${prop}"`)
    }
  }
  for (const d of declaracoes('transition-property')) {
    for (const prop of d.split(',').map((p) => p.trim())) {
      if (!PROPRIEDADES.has(prop)) problemas.push(`transition-property "${prop}"`)
    }
  }
  assert.deepEqual(problemas, [])
})

test('keyframes só animam opacidade e transform', () => {
  const problemas: string[] = []
  for (const inicio of CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    // O bloco vai até a chave que fecha a do @keyframes.
    let fim = inicio.index + inicio[0].length
    for (let nivel = 1; nivel > 0 && fim < CSS.length; fim++) {
      if (CSS[fim] === '{') nivel++
      else if (CSS[fim] === '}') nivel--
    }
    const corpo = CSS.slice(inicio.index + inicio[0].length, fim)
    for (const m of corpo.matchAll(/([\w-]+)\s*:/g)) {
      // content: os três pontos do LIGANDO trocam de texto em degraus.
      if (!['opacity', 'transform', 'content'].includes(m[1])) {
        problemas.push(`@keyframes ${inicio[1]} anima "${m[1]}"`)
      }
    }
  }
  assert.deepEqual(problemas, [])
})

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) ? [p] : []
  })
}
const semComentarios = (texto: string): string =>
  texto.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/(^|\s)\/\/.*$/gm, '$1')

test('classes de movimento das telas usam só os tokens', () => {
  const problemas: string[] = []
  for (const arquivo of arquivos(TELAS)) {
    const nome = relative(TELAS, arquivo).replaceAll('\\', '/')
    const codigo = semComentarios(readFileSync(arquivo, 'utf8'))
    const achar = (re: RegExp, ok: (m: string) => boolean, rotulo: string): void => {
      for (const m of codigo.matchAll(re))
        if (!ok(m[0])) problemas.push(`${nome}: ${rotulo} "${m[0]}"`)
    }
    achar(
      /(?<![\w-])duration-[^\s"'`]+/g,
      (m) => /^duration-\(--dur-(fast|base|modal)\)$/.test(m),
      'duração'
    )
    achar(
      /(?<![\w-])delay-[^\s"'`]+/g,
      (m) => /^delay-\(--dur-(fast|base|modal)\)$/.test(m),
      'atraso'
    )
    achar(
      /(?<![\w-])ease-[^\s"'`]+/g,
      (m) => /^ease-(\(--ease-(entrada|saida)\)|linear)$/.test(m),
      'curva'
    )
    achar(
      /(?<![\w-])transition(-[^\s"'`]+)?(?=[\s"'`])/g,
      (m) => {
        if (/^transition-(colors|opacity|transform|shadow|none)$/.test(m)) return true
        const lista = m.match(/^transition-\[(.+)\]$/)?.[1]
        return !!lista && lista.split(',').every((p) => PROPRIEDADES.has(p))
      },
      'transição'
    )
    achar(/(?<![\w-])animate-[^\s"'`]+/g, () => false, 'animação do Tailwind')
    achar(/\b(transition|animation)\s*:/g, () => false, 'estilo inline')
  }
  assert.deepEqual(problemas, [])
})
