import { type Locator, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type AppDeTeste } from './apoio'
import { PIX_COPIA_E_COLA } from '../../src/shared/apoioRegras'

// Apoiar o projeto (Engrenagem › Sobre): doação opcional, nunca desbloqueia nada. Português mostra o
// Pix; inglês só mostra algo com o GitHub Sponsors ativo (nos testes, HUBSQUARE_SPONSORS_TESTE).
// Prints em .teste/prints-apoio/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-apoio')
const FRASE = {
  'pt-BR':
    'A doação é totalmente opcional e não desbloqueia nada de novo no app. O HubSquare é e continuará gratuito.',
  'en-US':
    'Donating is entirely optional and unlocks nothing new in the app. HubSquare is and will stay free.'
} as const
type Idioma = keyof typeof FRASE
const SPONSORS = 'https://github.com/sponsors/fulano'

// Abre o app no idioma e no bioma pedidos, pelo modo amigo (sem criar servidor), e vai em
// Engrenagem › Sobre. O env do app herda o do teste: o Sponsors é ligado por ele.
async function abrirSobre(
  abrir: (nome?: string, preparar?: (pasta: string) => void) => Promise<AppDeTeste>,
  idioma: Idioma,
  opcoes: { bioma?: string; sponsors?: boolean } = {}
): Promise<AppDeTeste> {
  const anterior = process.env.HUBSQUARE_SPONSORS_TESTE
  process.env.HUBSQUARE_SPONSORS_TESTE = opcoes.sponsors ? SPONSORS : ''
  try {
    const a = await abrir('app', (pasta) => {
      const dados = join(pasta, 'appData', 'HubSquare')
      mkdirSync(dados, { recursive: true })
      writeFileSync(join(dados, 'idioma.json'), JSON.stringify({ idioma }))
      writeFileSync(
        join(dados, 'aparencia.json'),
        JSON.stringify({ bioma: opcoes.bioma ?? 'dia', vidroLeve: false })
      )
    })
    const j = a.janela
    await j
      .getByRole('button', { name: /Só vou jogar com amigos|I'll just play with friends/ })
      .click()
    await j.getByRole('button', { name: /^(Aparência|Appearance)$/ }).click()
    await j.getByRole('tab', { name: /^(Sobre|About)$/ }).click()
    await expect(j.getByText(/Relatar problema|Report a problem/).first()).toBeVisible()
    return a
  } finally {
    if (anterior === undefined) delete process.env.HUBSQUARE_SPONSORS_TESTE
    else process.env.HUBSQUARE_SPONSORS_TESTE = anterior
  }
}

const botaoApoiar = (j: Page, idioma: Idioma): Locator =>
  j.locator('main').getByRole('button', {
    name: idioma === 'pt-BR' ? 'Apoiar o projeto' : 'Support the project',
    exact: true
  })

const areaDoClipboard = (a: AppDeTeste): Promise<string> =>
  a.app.evaluate(({ clipboard }) => clipboard.readText())

// Menor contraste (WCAG) entre a cor do texto e os pixels da margem da placa de vidro logo à esquerda
// dele (sem texto), lidos de um print do diálogo: vale para o vidro sobre qualquer bioma.
async function menorContraste(a: AppDeTeste, texto: Locator): Promise<number> {
  const cor = await texto.evaluate((e) => getComputedStyle(e).color)
  const dialogo = a.janela.getByRole('dialog')
  const [cx, tx] = await Promise.all([dialogo.boundingBox(), texto.boundingBox()])
  if (!cx || !tx) throw new Error('sem caixa')
  const png = await dialogo.screenshot()
  return a.app.evaluate(
    ({ nativeImage }, { b64, cor, x0, y0, y1 }) => {
      const img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'))
      const { width } = img.getSize()
      const pixels = img.toBitmap() // BGRA
      const lum = (r: number, g: number, b: number): number => {
        const f = (c: number): number =>
          (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const [tr, tg, tb] = (cor.match(/d+/g) ?? []).map(Number)
      const lt = lum(tr, tg, tb)
      let pior = Infinity
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x0 + 8 && x < width; x++) {
          const i = (y * width + x) * 4
          const l = lum(pixels[i + 2], pixels[i + 1], pixels[i])
          const c = (Math.max(l, lt) + 0.05) / (Math.min(l, lt) + 0.05)
          if (c < pior) pior = c
        }
      return pior
    },
    {
      b64: png.toString('base64'),
      cor,
      x0: Math.round(tx.x - cx.x - 12),
      y0: Math.round(tx.y - cx.y),
      y1: Math.round(tx.y - cx.y + tx.height)
    }
  )
}

test('apoio (1) en-US com Sponsors desligado: nenhum item de doação', async ({ abrir }) => {
  const a = await abrirSobre(abrir, 'en-US')
  const j = a.janela
  await expect(j.getByText(/Support the project|Pix|Donat/i)).toHaveCount(0)
  await expect(botaoApoiar(j, 'en-US')).toHaveCount(0)
  expect((await a.aberturas()).filter((x) => x.startsWith('openExternal'))).toEqual([])
})

test('apoio (2) en-US com Sponsors ligado: botão do Sponsors e Pix recolhido; (4) frase; (5) copiar', async ({
  abrir
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrirSobre(abrir, 'en-US', { sponsors: true })
  const j = a.janela
  await expect(j.locator('main').getByText(FRASE['en-US']).first()).toBeVisible() // (4) no cartão
  await botaoApoiar(j, 'en-US').click()
  const dialogo = j.getByRole('dialog')
  await expect(dialogo.getByText(FRASE['en-US'])).toBeVisible() // (4) no topo do diálogo
  const sponsors = dialogo.getByRole('button', { name: 'Support on GitHub Sponsors' })
  await expect(sponsors).toBeVisible()
  // O Pix fica recolhido em "Brazilian? Pix (Brazil only)": o QR só aparece ao abrir.
  await expect(dialogo.locator('[data-qr-pix]')).toBeHidden()
  await dialogo.getByText('Brazilian? Pix (Brazil only)').click()
  await expect(dialogo.locator('[data-qr-pix]')).toBeVisible()
  await j.waitForTimeout(300)
  await j.screenshot({ path: join(PRINTS, 'en-sponsors-ligado.png') })

  await dialogo.getByRole('button', { name: 'Copy Pix code' }).click() // (5)
  expect(await areaDoClipboard(a)).toBe(PIX_COPIA_E_COLA)
  await expect(dialogo.getByRole('button', { name: 'Pix code copied' })).toBeVisible()

  await sponsors.click()
  expect(await a.aberturas()).toContain(`openExternal ${SPONSORS}`)
})

test('apoio (3) pt-BR com o Pix visível; (4) frase; (5) copiar o código', async ({ abrir }) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrirSobre(abrir, 'pt-BR')
  const j = a.janela
  await expect(j.locator('main').getByText(FRASE['pt-BR']).first()).toBeVisible() // (4) no cartão
  // Nunca abre sozinho: o diálogo só aparece depois do clique.
  await expect(j.getByRole('dialog')).toBeHidden()
  await botaoApoiar(j, 'pt-BR').click()
  const dialogo = j.getByRole('dialog')
  await expect(dialogo.getByText(FRASE['pt-BR'])).toBeVisible() // (4) no topo do diálogo
  await expect(dialogo.locator('[data-qr-pix]')).toBeVisible() // (3) QR à vista, sem recolher
  await expect(dialogo.getByText('Titular: Felipe Segantini Ventura (SÃO PAULO)')).toBeVisible()
  await expect(dialogo.getByText('c7635702-b5df-4323-8885-c5216230c3c6')).toBeVisible()
  // Sponsors desligado: nenhum botão do Sponsors.
  await expect(dialogo.getByRole('button', { name: /GitHub Sponsors/ })).toHaveCount(0)
  await j.waitForTimeout(300)
  await j.screenshot({ path: join(PRINTS, 'pt-pix.png') })

  await dialogo.getByRole('button', { name: 'Copiar código Pix' }).click() // (5)
  expect(await areaDoClipboard(a)).toBe(PIX_COPIA_E_COLA)
  await expect(dialogo.getByRole('button', { name: 'Código Pix copiado' })).toBeVisible()
  // Esc fecha; nada foi aberto no navegador.
  await j.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
  expect((await a.aberturas()).filter((x) => x.startsWith('openExternal'))).toEqual([])
})

for (const [bioma, nome] of [
  ['diaClaro', 'claro'],
  ['noite', 'escuro']
] as const) {
  for (const idioma of ['pt-BR', 'en-US'] as const) {
    test(`apoio (6) contraste mínimo 4,5:1 no tema ${nome} em ${idioma}`, async ({ abrir }) => {
      mkdirSync(PRINTS, { recursive: true })
      // Em inglês o item só existe com o Sponsors ligado.
      const a = await abrirSobre(abrir, idioma, { bioma, sponsors: idioma === 'en-US' })
      const j = a.janela
      await botaoApoiar(j, idioma).click()
      const dialogo = j.getByRole('dialog')
      await expect(dialogo.getByText(FRASE[idioma])).toBeVisible()
      if (idioma === 'en-US') await dialogo.getByText('Brazilian? Pix (Brazil only)').click()
      await j.waitForTimeout(400) // a animação de entrada termina
      await j.screenshot({ path: join(PRINTS, `${bioma}-${idioma}.png`) })

      const textos = [
        dialogo.getByText(FRASE[idioma]), // frase obrigatória
        dialogo.getByText(idioma === 'pt-BR' ? /Aponte a câmera/ : /Scan the QR/) // legenda do QR
      ]
      for (const t of textos) {
        const c = await menorContraste(a, t)
        expect(c, `contraste ${bioma} ${idioma}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
}
