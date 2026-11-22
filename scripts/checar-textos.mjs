// Lint da tradução (Fase I1): procura texto visível escrito direto no código das telas e do
// processo principal, fora de src/shared/i18n. Falha se achar. Confere:
// - texto dentro de JSX e os atributos title, alt, aria-label, placeholder e label;
// - no processo principal: dialog.show*(), new Notification(), label: de menus e setToolTip().
// Nomes próprios e siglas (HubSquare e as metades do wordmark, Modrinth, CPU, RAM...) não contam como texto a traduzir.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const RAIZ = join(import.meta.dirname, '..')
const PASTAS = ['src/renderer/src', 'src/main', 'src/preload']

// Arquivos que ficam de fora, com o motivo.
const ARQUIVOS_FORA = {
  // Vitrine de componentes, só existe em desenvolvimento (o import some do build).
  'src/renderer/src/componentes/Galeria.tsx': 'só em desenvolvimento',
  // Página do painel do celular: os textos vêm de t() no momento em que é servida.
  'src/main/celularPagina.ts': 'HTML montado com t()'
}

const NOMES = new Set(
  'hubsquare hub square servsquare playsquare modrinth curseforge hangar minecraft mojang microsoft java paper vanilla fabric forge neoforge quilt iris oculus radmin vpn tailscale playit gg cpu ram tps kdr pin motd eula uuid op xp url tcp udp upnp ok gb mb kb json zip mrpack jar spark chunky bluemap dynmap discord github windows prism launcher nether end serv play the x y z f2 f3 rcon id lan ip ipv4 cgnat api v'.split(
    ' '
  )
)
// Textos que não são de nenhum idioma, com o motivo.
const TEXTOS_FORA = new Set([
  'Ctrl+S', // atalho de teclado
  '&gt;', // o sinal > antes do campo do console
  'give {jogador} minecraft:bread 16', // exemplo de comando do Minecraft (1ª linha)
  '26.12.34.56:8788#K7QF-M2XA-9TBC-H4PZ' // exemplo de código de convite
])
const ATRIBUTOS = new Set(['title', 'alt', 'aria-label', 'placeholder', 'label'])
const PROPS_MAIN = new Set(['title', 'message', 'detail', 'buttons', 'label', 'body'])

function arquivos(dir) {
  const r = []
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${n}`
    if (statSync(join(RAIZ, p)).isDirectory()) r.push(...arquivos(p))
    else if (/\.tsx?$/.test(n) && !n.endsWith('.d.ts')) r.push(p)
  }
  return r
}

// Tem alguma palavra de verdade (2+ letras) que não é nome próprio nem sigla?
export function ehTexto(s) {
  const palavras = s.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? []
  return palavras.some((p) => !NOMES.has(p.toLowerCase()))
}

const achados = []
for (const arq of PASTAS.flatMap(arquivos)) {
  if (ARQUIVOS_FORA[arq]) continue
  const fonte = readFileSync(join(RAIZ, arq), 'utf8')
  const sf = ts.createSourceFile(arq, fonte, ts.ScriptTarget.Latest, true)
  const principal = arq.startsWith('src/main')
  const anotar = (no, texto) => {
    if (TEXTOS_FORA.has(texto.trim().split(String.fromCharCode(10))[0].trim())) return
    const linha = sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1
    achados.push(`${relative(RAIZ, join(RAIZ, arq))}:${linha}  ${texto.trim().slice(0, 70)}`)
  }
  const literal = (no) =>
    no && (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) ? no.text : null
  const visitar = (no) => {
    if (ts.isJsxText(no) && ehTexto(no.text)) anotar(no, no.text)
    if (ts.isJsxAttribute(no) && ATRIBUTOS.has(no.name.getText(sf))) {
      const v = no.initializer
      const s = literal(v) ?? (v && ts.isJsxExpression(v) ? literal(v.expression) : null)
      if (s && ehTexto(s)) anotar(no, s)
    }
    if (principal) {
      if (ts.isPropertyAssignment(no) && PROPS_MAIN.has(no.name.getText(sf))) {
        const v = no.initializer
        const lista = ts.isArrayLiteralExpression(v) ? v.elements : [v]
        for (const e of lista) {
          const s = literal(e)
          if (s && ehTexto(s)) anotar(e, s)
        }
      }
      if (ts.isCallExpression(no) && /setToolTip$/.test(no.expression.getText(sf))) {
        const s = literal(no.arguments[0])
        if (s && ehTexto(s)) anotar(no, s)
      }
    }
    ts.forEachChild(no, visitar)
  }
  visitar(sf)
}

if (achados.length) {
  console.error(`Texto visível fora dos arquivos de tradução (${achados.length}):`)
  for (const a of achados) console.error('  ' + a)
  console.error('Mova para src/shared/i18n/pt-BR.ts e en-US.ts e use t().')
  process.exit(1)
}
console.log('checar-textos: nenhum texto visível fixo.')
