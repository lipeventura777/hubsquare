// Gera todos os ícones e imagens da marca do HubSquare a partir das duas logos em build/logo/
// (a COMPLETA, de 56 px para cima, e a PEQUENA, de 48 px para baixo). Nunca redesenha a logo:
// cada tamanho é o SVG original desenhado direto naquele tamanho pelo próprio Electron.
// Rode com: npm run icone   (nenhuma dependência extra)
//
// Saídas:
//   build/icon.ico            16–48 px da pequena + 64, 128 e 256 px da completa
//   build/logo/png/           hubsquare-<tamanho>.png de 16 a 1024 px (mesma regra)
//   resources/                hubsquare.ico (o mesmo .ico: janela e bandeja, o Windows escolhe o
//                             tamanho), logo-32.png (pequena: favicon do celular) e logo-256.png
//                             (completa: ícone grande do painel do celular)
//   docs/marca/               social-preview.png (1280×640), avatar.png (500×500) e o wordmark
//                             do README (wordmark-claro.png e wordmark-escuro.png)
//   .teste/prints-logo/       folha com os tamanhos do .ico e da bandeja em fundo claro e escuro
import { app, BrowserWindow } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const raiz = join(import.meta.dirname, '..')
const ler = (...p) => readFileSync(join(raiz, ...p))
const COMPLETA = ler('build', 'logo', 'hubsquare-logo.svg').toString()
const PEQUENA = ler('build', 'logo', 'hubsquare-logo-pequena.svg').toString()
const logoPara = (tamanho) => (tamanho >= 56 ? COMPLETA : PEQUENA) // regra do DESIGN.md (Marca)
const dataUrl = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
// Inter local do app (variável: o ExtraBold é o peso 800), embutida para nada vir da internet.
const INTER = ler('src', 'renderer', 'src', 'assets', 'fonts', 'InterVariable.woff2').toString(
  'base64'
)
const FONTE = `@font-face{font-family:Inter;src:url(data:font/woff2;base64,${INTER}) format('woff2');font-weight:100 900}`
// Cores do wordmark: "Hub" verde e "Square" azul, mais escuros sobre fundo claro.
const WORDMARK = {
  claro: { hub: '#2E7A41', square: '#1F6A93' },
  escuro: { hub: '#45A55A', square: '#2F95C8' }
}
const ESCURO = '#12161C'

// ICO com as imagens em PNG dentro (formato aceito pelo Windows desde o Vista).
function montarIco(pngs) {
  const cabecalho = Buffer.alloc(6 + 16 * pngs.length)
  cabecalho.writeUInt16LE(1, 2) // tipo: ícone
  cabecalho.writeUInt16LE(pngs.length, 4)
  let posicao = cabecalho.length
  pngs.forEach(({ tamanho, dados }, i) => {
    const e = 6 + 16 * i
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, e) // 0 significa 256
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, e + 1)
    cabecalho.writeUInt16LE(1, e + 4) // planos
    cabecalho.writeUInt16LE(32, e + 6) // bits por pixel
    cabecalho.writeUInt32LE(dados.length, e + 8)
    cabecalho.writeUInt32LE(posicao, e + 12)
    posicao += dados.length
  })
  return Buffer.concat([cabecalho, ...pngs.map((p) => p.dados)])
}

let janela
// Desenha um HTML em largura × altura (fundo transparente) e devolve o PNG.
async function foto(corpo, largura, altura) {
  janela.setContentSize(largura, altura)
  const html = `<!doctype html><html><head><style>${FONTE}html,body{margin:0;width:${largura}px;height:${altura}px;overflow:hidden;background:transparent}</style></head><body>${corpo}</body></html>`
  await janela.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'))
  await janela.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
  await new Promise((r) => setTimeout(r, 150))
  const imagem = await janela.webContents.capturePage({
    x: 0,
    y: 0,
    width: largura,
    height: altura
  })
  return imagem.resize({ width: largura, height: altura, quality: 'best' }).toPNG()
}

const logo = (tamanho, svg = logoPara(tamanho)) =>
  foto(
    `<img src="${dataUrl(svg)}" width="${tamanho}" height="${tamanho}" style="display:block">`,
    tamanho,
    tamanho
  )

const wordmark = (tamanho, cores) =>
  `<span style="font:800 ${tamanho}px/1 Inter;letter-spacing:-0.02em;white-space:nowrap"><span style="color:${cores.hub}">Hub</span><span style="color:${cores.square}">Square</span></span>`

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  janela = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  const escrever = (caminho, dados) => {
    mkdirSync(join(caminho, '..'), { recursive: true })
    writeFileSync(caminho, dados)
  }

  // .ico e PNGs: cada tamanho desenhado no próprio tamanho, com a versão certa.
  const png = {}
  for (const t of [16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024]) {
    png[t] = await logo(t)
    escrever(join(raiz, 'build', 'logo', 'png', `hubsquare-${t}.png`), png[t])
  }
  const ico = montarIco(
    [256, 128, 64, 48, 40, 32, 24, 20, 16].map((tamanho) => ({ tamanho, dados: png[tamanho] }))
  )
  escrever(join(raiz, 'build', 'icon.ico'), ico)
  escrever(join(raiz, 'resources', 'hubsquare.ico'), ico)
  escrever(join(raiz, 'resources', 'logo-32.png'), png[32])
  escrever(join(raiz, 'resources', 'logo-256.png'), png[256])

  // GitHub: prévia social, avatar e o wordmark do README (claro e escuro).
  escrever(
    join(raiz, 'docs', 'marca', 'social-preview.png'),
    await foto(
      `<div style="width:1280px;height:640px;background:${ESCURO};display:flex;align-items:center;gap:72px;padding:0 120px;box-sizing:border-box"><img src="${dataUrl(COMPLETA)}" width="360" height="360">${wordmark(120, WORDMARK.escuro)}</div>`,
      1280,
      640
    )
  )
  escrever(
    join(raiz, 'docs', 'marca', 'avatar.png'),
    await foto(
      `<div style="width:500px;height:500px;background:${ESCURO};display:flex;align-items:center;justify-content:center"><img src="${dataUrl(COMPLETA)}" width="380" height="380"></div>`,
      500,
      500
    )
  )
  for (const tom of ['claro', 'escuro']) {
    escrever(
      join(raiz, 'docs', 'marca', `wordmark-${tom}.png`),
      await foto(
        `<div style="width:720px;height:120px;display:flex;align-items:center;justify-content:center">${wordmark(88, WORDMARK[tom])}</div>`,
        720,
        120
      )
    )
  }

  // Folha de conferência (fora do git): todos os tamanhos do .ico e a bandeja, no claro e no escuro.
  const linha = (fundo) =>
    `<div style="background:${fundo};display:flex;align-items:flex-end;gap:24px;padding:24px">${[
      16, 20, 24, 32, 40, 48, 64, 128, 256
    ]
      .map(
        (t) =>
          `<div style="text-align:center;font:600 12px Inter;color:${fundo === '#ffffff' ? '#1E2A2F' : '#E6F5EA'}"><img src="data:image/png;base64,${png[t].toString('base64')}" width="${t}" height="${t}" style="display:block;margin:0 auto 6px;image-rendering:pixelated">${t}</div>`
      )
      .join(
        ''
      )}<div style="margin-left:24px;padding:6px 10px;background:${fundo === '#ffffff' ? '#e9edf2' : '#1f1f1f'};font:600 12px Inter;color:${fundo === '#ffffff' ? '#1E2A2F' : '#E6F5EA'}"><img src="data:image/png;base64,${png[16].toString('base64')}" width="16" height="16" style="vertical-align:middle;margin-right:6px">bandeja</div></div>`
  escrever(
    join(raiz, '.teste', 'prints-logo', 'folha-icones.png'),
    await foto(`${linha('#ffffff')}${linha('#202020')}`, 1100, 660)
  )

  console.log('Ícones gerados: build/icon.ico, build/logo/png/, resources/ e docs/marca/')
  app.quit()
})
