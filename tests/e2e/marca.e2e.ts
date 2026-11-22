import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { criarPeloAssistente, expect, test } from './apoio'
import { MC } from './simulado'

// Logo nova (cubo chunk): a marca aparece no topo da barra lateral (pequena, 32 px, com o nome),
// nas boas-vindas (completa, 72 px) e em Sobre (completa, 64 px). Prints em .teste/prints-logo/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-logo')

// Qual versão cada logo mostra (o componente marca em data-logo) e o tamanho na tela.
const versoes = (j: Page): Promise<{ tamanho: number; versao: string }[]> =>
  j.evaluate(() =>
    [...document.querySelectorAll('[data-logo]')]
      .filter((e) => !e.closest('[data-previa-logo]'))
      .map((e) => ({
        tamanho: Math.round(e.getBoundingClientRect().width),
        versao: e.getAttribute('data-logo') ?? ''
      }))
  )

for (const bioma of ['diaClaro', 'noite'] as const) {
  test(`marca na barra lateral, em Sobre e nas boas-vindas (${bioma})`, async ({ abrir }) => {
    mkdirSync(PRINTS, { recursive: true })
    const a = await abrir(bioma, (p) => {
      const dados = join(p, 'appData', 'HubSquare')
      mkdirSync(dados, { recursive: true })
      writeFileSync(join(dados, 'aparencia.json'), JSON.stringify({ bioma, vidroLeve: false }))
    })
    const j = a.janela

    // Boas-vindas: a completa de 72 px.
    await expect(j.getByText('Bem-vindo ao HubSquare')).toBeVisible()
    expect(await versoes(j)).toEqual([{ tamanho: 72, versao: 'completa' }])
    await j.waitForTimeout(300)
    await j.screenshot({ path: join(PRINTS, `boas-vindas-${bioma}.png`) })

    // Barra lateral: a pequena de 32 px com o nome.
    await j.getByRole('button', { name: /Vou hospedar servidores/ }).click()
    await criarPeloAssistente(j, 'Servidor Marca', MC)
    const nav = j.getByRole('navigation')
    await expect(nav.getByText('Hub', { exact: true })).toBeVisible()
    await expect(nav.getByText('Square', { exact: true })).toBeVisible()
    expect(await versoes(j)).toEqual([{ tamanho: 32, versao: 'pequena' }])
    await j.waitForTimeout(400)
    const caixa = await nav.boundingBox()
    await j.screenshot({
      path: join(PRINTS, `barra-lateral-${bioma}.png`),
      clip: { x: 0, y: 0, width: (caixa?.x ?? 0) + (caixa?.width ?? 180) + 10, height: 420 }
    })

    // Sobre: a completa de 64 px com o nome (e a pequena da barra lateral continua lá).
    await j.getByRole('button', { name: 'Aparência' }).click()
    await j.getByRole('tab', { name: 'Sobre' }).click()
    await expect.poll(() => versoes(j)).toContainEqual({ tamanho: 64, versao: 'completa' })
    await j.waitForTimeout(400)
    await j.screenshot({ path: join(PRINTS, `sobre-${bioma}.png`) })
  })
}
