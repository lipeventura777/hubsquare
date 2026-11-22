import { expect, test } from './apoio'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// A primeira tela do assistente usa a marca atual: logo nova (cubo chunk) e o nome HubSquare.
const PRINTS = join(process.cwd(), '.teste', 'prints-assistente')

test('assistente: cabeçalho com a logo nova e o nome HubSquare', async ({ abrir }) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  // Sem servidores salvos, a primeira abertura pergunta o modo; "hospedar" leva ao assistente.
  const hospedar = j.getByRole('button', { name: /Vou hospedar servidores|I'll host servers/ })
  if (await hospedar.isVisible().catch(() => false)) await hospedar.click()
  const titulo = j.getByText(/^(Bem-vindo ao HubSquare|Welcome to HubSquare)$/)
  await expect(titulo.first()).toBeVisible()
  await expect(j.getByText(/ServSquare$/).filter({ hasText: /^(Bem-vindo|Welcome)/ })).toHaveCount(
    0
  )
  // A logo do cabeçalho é o componente Logo (SVG do cubo), não o ícone antigo.
  const logo = j.locator('header [data-logo]')
  await expect(logo).toHaveCount(1)
  await j.screenshot({ path: join(PRINTS, 'assistente.png') })
})
