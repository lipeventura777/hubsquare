// npm run ler-relatorio -- <arquivo.zip>
// Abre um relatório de erro do HubSquare (Fase M8) numa pasta temporária e imprime o resumo
// (LEIA-ME), os erros mais recentes do app, as linhas de erro dos logs do servidor e do jogo, os
// relatórios de travamento e o último diagnóstico. Guia completo: docs/como-ler-relatorio.md.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const zip = process.argv[2]
if (!zip || !existsSync(zip)) {
  console.error('Uso: npm run ler-relatorio -- <arquivo.zip>')
  process.exit(1)
}

const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
const pasta = mkdtempSync(join(tmpdir(), 'ler-relatorio-'))
const ler = (nome) => {
  const c = join(pasta, nome)
  return existsSync(c) ? readFileSync(c, 'utf8') : null
}
const titulo = (t) => console.log(`\n===== ${t} =====`)
const ERRO = /\b(ERROR|FATAL|SEVERE|Exception|Caused by|Erro|falhou)\b/

try {
  execFileSync(TAR, ['-xf', zip, '-C', pasta])

  titulo('Resumo (LEIA-ME.txt)')
  console.log(ler('LEIA-ME.txt') ?? '(sem LEIA-ME.txt: não parece um relatório do HubSquare)')

  titulo('Erros mais recentes do app (erros.log, os 5 últimos)')
  const erros = ler('erros.log')
  if (!erros) console.log('(não veio)')
  else {
    const entradas = erros.split(/\r?\n(?=\[\d{4}-\d{2}-\d{2}T)/).filter((e) => e.trim())
    for (const e of entradas.slice(-5))
      console.log(`${e.trim().split(/\r?\n/).slice(0, 8).join('\n')}\n`)
  }

  for (const [nome, arquivo] of [
    ['Servidor', 'servidor/latest.log'],
    ['Jogo', 'jogo/latest.log']
  ]) {
    titulo(`${nome}: linhas de erro (${arquivo}, as 20 últimas)`)
    const texto = ler(arquivo)
    if (!texto) console.log('(não veio)')
    else {
      const linhas = texto.split(/\r?\n/).filter((l) => ERRO.test(l))
      console.log(linhas.length ? linhas.slice(-20).join('\n') : '(nenhuma linha de erro)')
    }
  }

  titulo('Relatórios de travamento')
  const travamentos = existsSync(join(pasta, 'travamentos'))
    ? readdirSync(join(pasta, 'travamentos'))
    : []
  if (!travamentos.length) console.log('(nenhum)')
  for (const t of travamentos) {
    const texto = ler(join('travamentos', t)) ?? ''
    const descricao = texto.match(/^Description: (.*)$/m)?.[1] ?? '?'
    const causa =
      texto.split(/\r?\n/).find((l) => /^[\w.$]+(Exception|Error)\b/.test(l.trim())) ?? ''
    console.log(`- ${t}: ${descricao}\n  ${causa.trim()}`)
  }

  titulo('Último diagnóstico de conexão')
  console.log(ler('diagnostico.txt') ?? '(não veio)')

  const mods = ler('mods.json')
  if (mods) {
    const m = JSON.parse(mods)
    titulo('Mods')
    for (const lado of ['servidor', 'instalacao']) {
      if (m[lado]) console.log(`${m[lado].nome}: ${m[lado].mods.length} mods/plugins`)
    }
  }
  console.log('\nPara ver tudo, extraia o .zip. Guia: docs/como-ler-relatorio.md')
} finally {
  rmSync(pasta, { recursive: true, force: true })
}
