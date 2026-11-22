// Fase P7: gera a folha de amostra dos ícones e tira os prints, sem abrir o app.
// Uso: node scripts/amostra-icones/gerar.mjs  →  .teste/prints-p7/amostra/<variante>.png
// Empacota entrada.ts com o rolldown (o mesmo do projeto) e fotografa a página pelo Electron
// (Playwright), no tamanho de 1 px por pixel, sem nada da internet.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'rolldown'
import { _electron } from 'playwright'

const raiz = resolve(import.meta.dirname, '..', '..')
const pasta = join(raiz, '.teste', 'amostra-icones')
const prints = join(raiz, '.teste', 'prints-p7', 'amostra')
mkdirSync(pasta, { recursive: true })
mkdirSync(prints, { recursive: true })

await build({
  input: join(raiz, 'scripts', 'amostra-icones', 'entrada.ts'),
  platform: 'browser',
  output: { file: join(pasta, 'amostra.js'), format: 'iife' },
  logLevel: 'warn'
})
copyFileSync(
  join(raiz, 'src', 'renderer', 'src', 'assets', 'tokens.css'),
  join(pasta, 'tokens.css')
)
writeFileSync(
  join(pasta, 'amostra.html'),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="tokens.css">
<style>
  html, body { margin: 0; width: 1360px; font: 13px system-ui, sans-serif; color: var(--text); }
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; z-index: -1; }
  #painel { margin: 24px; padding: 24px; border-radius: 22px; background: rgb(var(--vidro-rgb) / max(var(--vidro-alfa), 0.72));
    backdrop-filter: blur(var(--vidro-blur)) saturate(150%); border: 1px solid var(--vidro-borda); }
  h1 { margin: 0 0 4px; font-size: 18px; } p { margin: 0 0 16px; color: var(--text-muted); }
  .grade { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  .celula { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 12px; background: rgb(var(--vidro-2-rgb) / max(var(--vidro-alfa), 0.6)); }
  .tamanhos { display: flex; align-items: flex-end; gap: 10px; }
  .accent { color: var(--accent-padrao); } .outra { color: #e11d48; }
  span { font: 11px ui-monospace, monospace; color: var(--text-muted); }
</style></head><body><canvas></canvas><main id="painel"></main><script src="amostra.js"></script></body></html>`
)
writeFileSync(
  join(pasta, 'principal.cjs'),
  // A pasta de dados do Electron fica na pasta de teste: a padrão (o nome do produto) seria a
  // %APPDATA%\\HubSquare de verdade.
  `const { app, BrowserWindow } = require('electron')
app.setPath('userData', ${JSON.stringify(join(pasta, 'dados-electron'))})
app.whenReady().then(() => new BrowserWindow({ width: 1360, height: 1000, show: false }).loadURL('about:blank'))`
)

const VARIANTES = [
  ['claro', 'diaClaro', 'tema claro (Dia claro)'],
  ['escuro', 'noite', 'tema escuro (Noite)'],
  ['cerejeira', 'cerejeira', 'bioma Cerejeira'],
  ['deepDark', 'deepDark', 'bioma Deep Dark'],
  ['nether', 'nether', 'bioma Nether']
]
// Como em tests/e2e/apoio.ts: com ELECTRON_RUN_AS_NODE o Electron abriria como Node, sem janela.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const aplicativo = await _electron.launch({ args: [join(pasta, 'principal.cjs')], env })
const janela = await aplicativo.firstWindow()
for (const [arquivo, bioma, titulo] of VARIANTES) {
  const url = new URL(pathToFileURL(join(pasta, 'amostra.html')))
  url.search = new URLSearchParams({ bioma, titulo }).toString()
  await janela.goto(url.href)
  await janela.waitForSelector('.celula')
  await janela.screenshot({ path: join(prints, `${arquivo}.png`), fullPage: true })
  console.log('print:', join(prints, `${arquivo}.png`))
}
await aplicativo.close()
