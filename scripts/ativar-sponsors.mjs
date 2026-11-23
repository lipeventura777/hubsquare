// Liga o GitHub Sponsors quando a conta já existir (só o dono pode criá-la). Uso:
//
//   npm run ativar:sponsors -- <usuario> <url>
//   npm run ativar:sponsors -- lipeventura777 https://github.com/sponsors/lipeventura777
//
// Faz quatro coisas: troca os marcadores [USUARIO_GITHUB] e [LINK_PAGINA_APOIO], liga
// GITHUB_SPONSORS_ATIVO em src/shared/apoioRegras.ts, descomenta a seção em inglês do README e a
// linha `github:` do .github/FUNDING.yml. Depois roda lint e testes; se algo falhar, devolve tudo
// como estava. Recusa qualquer valor que não seja uma URL https de github.com/sponsors.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
export const ARQUIVOS = {
  regras: 'src/shared/apoioRegras.ts',
  readmePt: 'README.md',
  readmeEn: 'README.en.md',
  funding: '.github/FUNDING.yml'
}

const URL_SPONSORS = /^https:\/\/github\.com\/sponsors\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/?$/

// Confere os dois valores e devolve { usuario, url }; erro com uma frase clara.
export function validar(usuario, url) {
  const m = URL_SPONSORS.exec(String(url ?? ''))
  if (!m)
    throw new Error('A URL precisa ser https://github.com/sponsors/<usuario> (https, github.com).')
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(String(usuario ?? '')))
    throw new Error('O usuário do GitHub só pode ter letras, números e hífen.')
  if (m[1].toLowerCase() !== String(usuario).toLowerCase())
    throw new Error('O usuário não bate com o da URL do Sponsors.')
  return { usuario, url }
}

function trocarUma(texto, de, para, onde) {
  if (texto.split(de).length !== 2)
    throw new Error(`${onde}: não achei (ou achei mais de uma vez) "${de}". Já está ativo?`)
  return texto.replace(de, para)
}

export const ligarConstantes = (src, url) =>
  trocarUma(
    trocarUma(
      src,
      'export const GITHUB_SPONSORS_ATIVO = false',
      'export const GITHUB_SPONSORS_ATIVO = true',
      ARQUIVOS.regras
    ),
    "export const GITHUB_SPONSORS_URL = '[LINK_PAGINA_APOIO]'",
    `export const GITHUB_SPONSORS_URL = '${url}'`,
    ARQUIVOS.regras
  )

export const abrirSecaoEn = (readme, usuario) =>
  trocarUma(
    trocarUma(readme, '<!-- SPONSORS-EN-INICIO\n', '', ARQUIVOS.readmeEn),
    'SPONSORS-EN-FIM -->\n',
    '',
    ARQUIVOS.readmeEn
  ).replaceAll('[USUARIO_GITHUB]', usuario)

export const ligarFunding = (yml, usuario) =>
  trocarUma(yml, '# github: [USUARIO_GITHUB]', `github: [${usuario}]`, ARQUIVOS.funding)

function rodar(comando) {
  return spawnSync(comando, { cwd: RAIZ, shell: true, stdio: 'inherit' }).status === 0
}

async function principal() {
  const [usuario, url] = process.argv.slice(2)
  const dados = validar(usuario, url)
  const antes = Object.fromEntries(
    Object.values(ARQUIVOS).map((f) => [f, readFileSync(join(RAIZ, f), 'utf8')])
  )
  const depois = {
    [ARQUIVOS.regras]: ligarConstantes(antes[ARQUIVOS.regras], dados.url),
    [ARQUIVOS.readmePt]: antes[ARQUIVOS.readmePt].replaceAll('[USUARIO_GITHUB]', dados.usuario),
    [ARQUIVOS.readmeEn]: abrirSecaoEn(antes[ARQUIVOS.readmeEn], dados.usuario),
    [ARQUIVOS.funding]: ligarFunding(antes[ARQUIVOS.funding], dados.usuario)
  }
  for (const [f, texto] of Object.entries(depois)) writeFileSync(join(RAIZ, f), texto)
  if (rodar('npm run lint') && rodar('npm test')) {
    console.log('\nGitHub Sponsors ativado. Confira o README e faça o commit.')
    return
  }
  for (const [f, texto] of Object.entries(antes)) writeFileSync(join(RAIZ, f), texto)
  console.error('\nLint ou testes falharam: tudo foi devolvido como estava.')
  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await principal()
  } catch (e) {
    console.error(`Erro: ${e.message}`)
    process.exit(1)
  }
}
