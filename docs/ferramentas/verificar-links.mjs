// Confere os links e imagens relativos de todos os .md do repositório (Node puro, sem dependências).
// Uso, da raiz do projeto: node docs/ferramentas/verificar-links.mjs
//
// - Link ou imagem que aponta para arquivo ou pasta que não existe: ERRO.
// - Âncora (#secao) que não existe no .md de destino: ERRO.
// - Imagem listada em docs/assets/CAPTURAS.md que ainda não foi tirada: PENDENTE (não é erro).
// Links externos (http, https, mailto) não são conferidos. Termina com código 1 se houver erro.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const RAIZ = resolve(
  dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')),
  '..',
  '..'
)
const PULAR = new Set([
  'node_modules',
  '.git',
  '.teste',
  'out',
  'release',
  'dist',
  '.playwright-mcp'
])
const CAPTURAS = join(RAIZ, 'docs', 'assets', 'CAPTURAS.md')

const barra = (p) => p.split(sep).join('/')

function arquivosMd(pasta) {
  const lista = []
  for (const nome of readdirSync(pasta)) {
    if (PULAR.has(nome)) continue
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) lista.push(...arquivosMd(caminho))
    else if (nome.toLowerCase().endsWith('.md')) lista.push(caminho)
  }
  return lista
}

// Tira blocos de código (``` e ~~~) e código em linha, mantendo as linhas para a contagem.
function semCodigo(texto) {
  const linhas = texto.split(/\r?\n/)
  let cerca = null
  return linhas.map((linha) => {
    const abre = linha.match(/^\s*(`{3,}|~{3,})/)
    if (abre) {
      if (!cerca) cerca = abre[1][0].repeat(abre[1].length)
      else if (linha.trim().startsWith(cerca)) cerca = null
      return ''
    }
    return cerca ? '' : linha.replace(/`[^`]*`/g, '')
  })
}

// Âncoras do jeito do GitHub: minúsculas, sem pontuação, espaços viram hífen, repetidas ganham -1, -2...
function ancoras(arquivo) {
  const vistas = new Map()
  const conjunto = new Set()
  for (const linha of semCodigo(readFileSync(arquivo, 'utf8'))) {
    const m = linha.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const base = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-')
    const n = vistas.get(base) ?? 0
    vistas.set(base, n + 1)
    conjunto.add(n === 0 ? base : `${base}-${n}`)
  }
  return conjunto
}

function alvos(linha) {
  const achados = []
  for (const m of linha.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g))
    achados.push(m[1])
  for (const m of linha.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)) achados.push(m[1])
  for (const m of linha.matchAll(/\bsrcset\s*=\s*"([^"]+)"/g))
    for (const parte of m[1].split(',')) achados.push(parte.trim().split(/\s+/)[0])
  return achados
}

const pendentesListados = new Set(
  existsSync(CAPTURAS)
    ? [...readFileSync(CAPTURAS, 'utf8').matchAll(/`(docs\/assets\/[^`]+)`/g)].map((m) => m[1])
    : []
)

const erros = []
const pendentes = new Set()
let conferidos = 0
const cacheAncoras = new Map()

for (const arquivo of arquivosMd(RAIZ)) {
  semCodigo(readFileSync(arquivo, 'utf8')).forEach((linha, i) => {
    for (const alvo of alvos(linha)) {
      if (/^(https?:|mailto:|data:)/i.test(alvo)) continue
      conferidos++
      const [caminho, ancora] = alvo.split('#')
      const destino = caminho
        ? resolve(dirname(arquivo), decodeURIComponent(caminho.split('?')[0]))
        : arquivo
      const onde = `${barra(relative(RAIZ, arquivo))}:${i + 1}`
      if (!existsSync(destino)) {
        const doRepo = barra(relative(RAIZ, destino))
        if (pendentesListados.has(doRepo)) pendentes.add(doRepo)
        else erros.push(`${onde}  arquivo não existe: ${alvo}`)
        continue
      }
      if (ancora && destino.toLowerCase().endsWith('.md')) {
        if (!cacheAncoras.has(destino)) cacheAncoras.set(destino, ancoras(destino))
        if (!cacheAncoras.get(destino).has(decodeURIComponent(ancora).toLowerCase()))
          erros.push(`${onde}  âncora não existe: ${alvo}`)
      }
    }
  })
}

console.log(`Links e imagens relativos conferidos: ${conferidos}`)
if (pendentes.size) {
  console.log(
    `\nPendentes (listados em docs/assets/CAPTURAS.md, ainda não tirados): ${pendentes.size}`
  )
  for (const p of [...pendentes].sort()) console.log(`  pendente  ${p}`)
}
if (erros.length) {
  console.log(`\nErros: ${erros.length}`)
  for (const e of erros) console.log(`  ERRO  ${e}`)
  process.exit(1)
}
console.log('\nNenhum erro.')
