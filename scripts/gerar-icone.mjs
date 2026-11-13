// Gera o ícone do HubSquare (build/icon.png, build/icon.ico e resources/icon.png) a partir de um SVG.
// Rode com: npm run icone   (usa o próprio Electron para desenhar; nenhuma dependência extra)
import { app, BrowserWindow, nativeImage } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22c55e"/>
      <stop offset="1" stop-color="#15803d"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#g)"/>
  <rect x="112" y="112" width="288" height="288" rx="56" fill="none" stroke="#fff" stroke-width="36"/>
  <rect x="196" y="196" width="120" height="120" rx="24" fill="#fff"/>
</svg>`

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

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const janela = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })
  await janela.loadURL(
    'data:text/html,' +
      encodeURIComponent(`<body style="margin:0;background:transparent">${SVG}</body>`)
  )
  await new Promise((r) => setTimeout(r, 500))
  const imagem = await janela.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  const grande = nativeImage.createFromBuffer(imagem.resize({ width: 512, height: 512 }).toPNG())

  const raiz = join(import.meta.dirname, '..')
  writeFileSync(join(raiz, 'build', 'icon.png'), grande.toPNG())
  writeFileSync(join(raiz, 'resources', 'icon.png'), grande.resize({ width: 256, height: 256 }).toPNG())
  const tamanhos = [256, 64, 48, 32, 24, 16]
  writeFileSync(
    join(raiz, 'build', 'icon.ico'),
    montarIco(
      tamanhos.map((tamanho) => ({
        tamanho,
        dados: grande.resize({ width: tamanho, height: tamanho, quality: 'best' }).toPNG()
      }))
    )
  )
  console.log('Ícones gerados em build/ e resources/')
  app.quit()
})
