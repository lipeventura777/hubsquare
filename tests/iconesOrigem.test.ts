import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'

// Fase P7 (DESIGN.md 6.11): todo ícone do app vem de src/renderer/src/icones/. Falha se aparecer
// um <svg> desenhado em outro lugar, uma biblioteca de ícones ou um caractere usado como ícone.

const RAIZ = join(import.meta.dirname, '..')
const TELAS = join(RAIZ, 'src', 'renderer', 'src')
// <svg> que não é ícone: o gráfico de linha da tela Desempenho.
const SVG_PERMITIDO = new Set(['desempenho/TelaDesempenho.tsx'])
// Caracteres que eram usados como ícone. Ficam de fora os de texto: setas dentro de frases
// (→ ↑ ↓ ←), o › de "Opções › Integrações" e o × de medidas (64×64, largura × altura).
const GLIFOS = /[⋯⋮★☆⟳↻✎✓✔✕✗✖⚠‹«»▶■▼▾▲▴]/u

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) ? [p] : []
  })
}

// Só o código: linhas de comentário e comentários no fim da linha viram vazio (as linhas mantêm
// o número para a mensagem de erro).
const codigo = (texto: string): string =>
  texto
    .split('\n')
    .map((l) => (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l) ? '' : l.replace(/\s\/\/.*$/, '')))
    .join('\n')

test('nenhum <svg> fora de src/renderer/src/icones/', () => {
  const fora = arquivos(TELAS)
    .map((p) => relative(TELAS, p).split('\\').join('/'))
    .filter((r) => !r.startsWith('icones/') && !SVG_PERMITIDO.has(r))
    .filter((r) => /<svg[\s>]/.test(codigo(readFileSync(join(TELAS, r), 'utf8'))))
  assert.deepEqual(fora, [])
})

test('nenhuma biblioteca de ícones nas dependências', () => {
  const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'))
  const nomes = Object.keys({ ...pacote.dependencies, ...pacote.devDependencies })
  assert.deepEqual(
    nomes.filter((n) => /icon|lucide|heroicons|phosphor|tabler|feather|fontawesome/i.test(n)),
    []
  )
})

test('nenhum caractere usado como ícone nas telas nem nas traduções', () => {
  const achados: string[] = []
  const conferir = (p: string): void =>
    codigo(readFileSync(p, 'utf8'))
      .split('\n')
      .forEach((l, i) => {
        const m = l.match(GLIFOS)
        if (m) achados.push(`${relative(RAIZ, p)}:${i + 1} ${m[0]}`)
      })
  for (const p of arquivos(TELAS)) conferir(p)
  for (const idioma of ['pt-BR', 'en-US'])
    conferir(join(RAIZ, 'src', 'shared', 'i18n', `${idioma}.ts`))
  assert.deepEqual(achados, [])
})
