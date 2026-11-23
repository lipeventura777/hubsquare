// Varredura de "fluxo de IA": o que sai para o repositório público e para o instalador não pode
// levar nome de ferramenta de IA, arquivo de instruções de assistente nem rastro de autoria de IA.
// As palavras são montadas aos pedaços de propósito: este arquivo também vai para o público e não
// pode conter nenhuma delas por extenso.
//
// Uso (sai com código 1 se achar algo):
//   node scripts/varredura-ia.mjs arvore <commit-ou-tree>   arquivos de uma árvore do git
//   node scripts/varredura-ia.mjs pasta <pasta>             uma pasta qualquer
//   node scripts/varredura-ia.mjs asar <app.asar>           o app.asar (e o .unpacked ao lado)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const j = (...partes) => partes.join('')

// Dentro de arquivos e de mensagens de commit (sem diferenciar maiúsculas).
const PALAVRAS = [
  j('cla', 'ude'),
  j('anthro', 'pic'),
  j('co-auth', 'ored-by'),
  j('generated', ' with'),
  j('ai-ass', 'isted'),
  j('impec', 'cable'),
  j('ui-ux-', 'pro-max'),
  j('emil', '-design'),
  j('kowal', 'ski'),
  j('prompt', '-master'),
  j('agents', '\\.md'),
  j('\\.cur', 'sor(rules|[\\\\/])'), // a pasta e o arquivo de regras desse editor, não a classe CSS "cursor-grab"
  j('copi', 'lot')
]
export const FONTE_CONTEUDO = PALAVRAS.join('|')
export const CONTEUDO = new RegExp(FONTE_CONTEUDO, 'i')

// Nomes de arquivos e pastas de fluxo de IA, em qualquer lugar do caminho.
export const NOMES = new RegExp(
  '(^|[\\\\/])(' +
    [
      j('\\.cla', 'ude'),
      j('\\.cur', 'sor'),
      j('\\.cur', 'sorrules'),
      j('\\.age', 'nts'),
      j('CLA', 'UDE\\.md'),
      j('AGE', 'NTS\\.md'),
      j('GEM', 'INI\\.md'),
      'skills'
    ].join('|') +
    ')([\\\\/]|$)',
  'i'
)

// Palavra proibida achada num texto (ou null).
export const acharNoTexto = (texto) => CONTEUDO.exec(texto)?.[0] ?? null
// O caminho é de fluxo de IA?
export const nomeProibido = (caminho) => NOMES.test(caminho)

const git = (args, opcoes) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opcoes })

// Árvore do git: nomes e conteúdo (inclusive de binários) de todos os arquivos.
export function varrerArvore(arvore, cwd = process.cwd()) {
  const achados = []
  for (const caminho of git(['ls-tree', '-r', '--name-only', arvore], { cwd })
    .split('\n')
    .filter(Boolean)) {
    if (nomeProibido(caminho)) achados.push({ onde: caminho, motivo: 'nome do arquivo' })
  }
  let saida = ''
  try {
    saida = git(['grep', '-a', '-i', '-l', '-E', FONTE_CONTEUDO, arvore], { cwd })
  } catch (e) {
    if (e.status !== 1) throw e // 1 = nada achado
  }
  for (const linha of saida.split('\n').filter(Boolean))
    achados.push({ onde: linha.slice(arvore.length + 1), motivo: 'conteúdo' })
  return achados
}

// Uma pasta qualquer (o nome só conta fora de node_modules: dependências têm pastas próprias).
export function varrerPasta(raiz) {
  const achados = []
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const completo = join(dir, nome)
      const rel = relative(raiz, completo).split('\\').join('/')
      const dentroDeModulos = /(^|\/)node_modules\//.test(rel + '/')
      if (!dentroDeModulos && nomeProibido(rel)) achados.push({ onde: rel, motivo: 'nome' })
      const info = statSync(completo)
      if (info.isDirectory()) andar(completo)
      else if (info.size < 200 * 1024 * 1024) {
        const achou = acharNoTexto(readFileSync(completo, 'latin1'))
        if (achou) achados.push({ onde: rel, motivo: 'conteúdo' })
      }
    }
  }
  andar(raiz)
  return achados
}

// O app.asar extraído numa pasta temporária (mais a pasta .unpacked ao lado, se houver).
export async function varrerAsar(arquivo) {
  const { default: asar } = await import('@electron/asar')
  const temp = mkdtempSync(join(tmpdir(), 'varredura-asar-'))
  try {
    asar.extractAll(arquivo, temp)
    const achados = varrerPasta(temp)
    if (existsSync(`${arquivo}.unpacked`)) achados.push(...varrerPasta(`${arquivo}.unpacked`))
    return achados
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

export function relatar(titulo, achados) {
  if (!achados.length) return console.log(`Varredura (${titulo}): nada encontrado.`)
  console.error(`Varredura (${titulo}): ${achados.length} ocorrência(s) de fluxo de IA:`)
  for (const a of achados) console.error(`  ${a.onde} (${a.motivo})`)
}

async function principal() {
  const [modo, alvo] = process.argv.slice(2)
  if (!['arvore', 'pasta', 'asar'].includes(modo) || !alvo) {
    console.error('Uso: node scripts/varredura-ia.mjs <arvore|pasta|asar> <alvo>')
    process.exit(2)
  }
  const achados =
    modo === 'arvore'
      ? varrerArvore(alvo)
      : modo === 'pasta'
        ? varrerPasta(alvo)
        : await varrerAsar(alvo)
  relatar(`${modo} ${alvo}`, achados)
  if (achados.length) process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await principal()
