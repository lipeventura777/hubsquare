import { type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarPeloAssistente, expect, test } from './apoio'
import { MC } from './simulado'

// Fase V3: troca Serv/Play. Nos cinco biomas: nenhuma aba corta letras, as duas áreas pelo
// clique e pelo teclado (setas), e prints da barra lateral em .teste/prints-v3/ (PRINTS_V3=antes
// gera os do código antigo, para comparar).

const PASTA = join(__dirname, '..', '..', '.teste', 'prints-v3')
const QUANDO = process.env.PRINTS_V3 ?? 'depois'
const BIOMAS = ['diaClaro', 'dia', 'noite', 'mar', 'nether'] as const

const fotoDaBarra = async (j: Page, nome: string): Promise<void> => {
  await j.waitForTimeout(450) // a troca termina de deslizar
  const caixa = await j.locator('[role="tablist"][aria-label="Área do app"]').boundingBox()
  await j.screenshot({
    path: join(PASTA, `${nome}.png`),
    clip: { x: 0, y: 0, width: (caixa?.x ?? 0) + (caixa?.width ?? 180) + 24, height: 400 }
  })
}

for (const bioma of BIOMAS) {
  test(`troca Serv/Play no bioma ${bioma}: abas inteiras, clique e teclado`, async ({ abrir }) => {
    mkdirSync(PASTA, { recursive: true })
    const a = await abrir(bioma, (p) => {
      const dados = join(p, 'appData', 'ServSquare')
      mkdirSync(dados, { recursive: true })
      writeFileSync(join(dados, 'aparencia.json'), JSON.stringify({ bioma, vidroLeve: false }))
    })
    const j = a.janela
    await criarPeloAssistente(j, 'Servidor Abas', MC)
    const serv = j.getByRole('tab', { name: 'ServSquare' })
    const play = j.getByRole('tab', { name: 'PlaySquare' })

    // Nenhuma aba corta letras: o texto cabe inteiro (scrollWidth ≤ clientWidth).
    const inteiras = (): Promise<boolean> =>
      j.evaluate(() =>
        [...document.querySelectorAll('[role="tablist"][aria-label="Área do app"] [role="tab"]')]
          .map((b) => b as HTMLElement)
          .every((b) => b.scrollWidth <= b.clientWidth + 1)
      )
    await expect(serv).toHaveAttribute('aria-selected', 'true')
    await fotoDaBarra(j, `${QUANDO}-${bioma}-serv`)
    if (QUANDO === 'antes') {
      await play.click()
      await fotoDaBarra(j, `antes-${bioma}-play`)
      return
    }
    await expect(serv).toHaveText('ServSquare')
    await expect(play).toHaveText('Play')
    expect(await inteiras(), 'aba cortada no ServSquare').toBe(true)
    // Cantos pelos tokens: trilho = --raio-item; aba = --raio-item − 4px (paralelos).
    const raios = await j.evaluate(() => {
      const trilho = document.querySelector(
        '[role="tablist"][aria-label="Área do app"]'
      ) as HTMLElement
      const item = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--raio-item')
      )
      return {
        item,
        trilho: parseFloat(getComputedStyle(trilho).borderTopLeftRadius),
        aba: parseFloat(getComputedStyle(trilho.querySelector('[role="tab"]')!).borderTopLeftRadius)
      }
    })
    expect(raios.trilho).toBe(raios.item)
    expect(raios.aba).toBe(raios.item - 4)

    // Clique.
    await play.click()
    await expect(play).toHaveAttribute('aria-selected', 'true')
    await expect(play).toHaveText('PlaySquare')
    await expect(serv).toHaveText('Serv')
    await fotoDaBarra(j, `${QUANDO}-${bioma}-play`)
    expect(await inteiras(), 'aba cortada no PlaySquare').toBe(true)

    // Teclado: foco na aba selecionada, seta para a esquerda volta ao ServSquare (e o foco vai junto).
    await play.focus()
    await j.keyboard.press('ArrowLeft')
    await expect(serv).toHaveAttribute('aria-selected', 'true')
    await expect(serv).toBeFocused()
    await j.keyboard.press('ArrowRight')
    await expect(play).toHaveAttribute('aria-selected', 'true')
    await expect(play).toBeFocused()
  })
}
