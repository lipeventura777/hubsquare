import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { area, criarPeloAssistente, expect, pagina, test } from './apoio'
import { MC } from './simulado'

// Fase V4: fundo do app inteiro (Aparência › Fundo), o painel Fundo da tela Jogar e a imagem que
// some por fora. Prints em .teste/prints-v4/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v4')
const IMAGEM = join(__dirname, '..', '..', 'build', 'logo', 'png', 'hubsquare-512.png') // arte do próprio app
// O arquivo só aparece depois da primeira mudança salva: ausente conta como vazio.
const lerJson = (f: string): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return {}
  }
}
const foto = async (j: Page, nome: string): Promise<void> => {
  await j.waitForTimeout(500)
  await j.screenshot({ path: join(PRINTS, `${nome}.png`) })
}

test('fundo do app: bioma com desfazer, imagem minha, Jogar igual ao app e imagem que some', async ({
  abrir
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Visual', MC)
  const html = j.locator('html')
  await expect(html).toHaveAttribute('data-bioma', 'dia')
  const dados = join(a.pasta, 'appData', 'HubSquare')

  await j.getByRole('button', { name: 'Aparência' }).click()
  await j.getByRole('tab', { name: 'Fundo' }).click()

  // Bioma: muda na hora; "Desfazer" volta ao anterior.
  await j.getByRole('radio', { name: 'Noite' }).click()
  await expect(html).toHaveAttribute('data-bioma', 'noite')
  await j.getByRole('button', { name: 'Desfazer' }).click()
  await expect(html).toHaveAttribute('data-bioma', 'dia')

  // Imagem minha: vira o fundo de todas as telas, pelo protocolo do app.
  await a.escolherArquivo(IMAGEM)
  await j.getByRole('button', { name: 'Escolher uma imagem…' }).click()
  const fundoDoApp = j.locator('.fixed.-z-10 img[data-fundo]')
  await expect(fundoDoApp).toHaveCount(1)
  await expect(fundoDoApp).toHaveAttribute('src', /^hubsquare-fundo:\/\/img\//)
  await expect
    .poll(() => lerJson(join(dados, 'aparencia.json')).fundoApp)
    .toMatchObject({
      tipo: 'imagem'
    })
  // Ajustes ao vivo: desfoque e enquadramento.
  await j.getByText('Mostrar a imagem inteira').click()
  await expect(fundoDoApp).toHaveCSS('object-fit', 'contain')
  await foto(j, 'aparencia-fundo')

  // Jogar: a instalação está "Igual ao app", então o banner mostra a mesma imagem.
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  const banner = j.getByRole('region', { name: /^Instalação Servidor Visual/ })
  await expect(banner.locator('img[data-fundo]')).toHaveCount(1)
  await foto(j, 'jogar-com-imagem')
  await j.getByRole('button', { name: 'Trocar o fundo' }).click()
  const painel = j.getByRole('dialog', { name: 'Trocar o fundo' })
  await expect(painel.getByRole('radio', { name: 'Igual ao app' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  // Nada desligado sem explicação: "Voltar ao fundo do app" só aparece com um fundo próprio.
  await expect(painel.getByRole('button', { name: 'Voltar ao fundo do app' })).toHaveCount(0)
  await painel.getByRole('radio', { name: 'Bioma' }).click()
  await painel.getByRole('radio', { name: 'Nether' }).click()
  await expect(banner.locator('img[data-fundo]')).toHaveCount(0)
  await expect(painel.getByRole('button', { name: 'Voltar ao fundo do app' })).toBeVisible()
  await foto(j, 'painel-fundo')
  await painel.getByRole('button', { name: 'Voltar ao fundo do app' }).click()
  await expect(banner.locator('img[data-fundo]')).toHaveCount(1)
  await j.keyboard.press('Escape')

  // A imagem some por fora: o fundo volta ao bioma padrão, com um aviso (nunca tela preta).
  for (const n of readdirSync(join(dados, 'fundos'))) rmSync(join(dados, 'fundos', n))
  await j.reload()
  await expect(j.getByText(/A imagem de fundo não abriu/)).toBeVisible()
  await expect(html).toHaveAttribute('data-bioma', 'dia')
  await expect(j.locator('.fixed.-z-10 img[data-fundo]')).toHaveCount(0)
})
