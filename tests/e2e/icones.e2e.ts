import { type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, criarPeloAssistente, expect, pagina, test } from './apoio'
import { MC } from './simulado'

// Fase P7: prints da barra lateral das duas áreas, do Painel, da tela Jogar e do Explorar nos
// temas claro (Dia claro) e escuro (Noite), em .teste/prints-p7/<FASE_PRINTS ou "depois">/,
// para comparar os ícones antes e depois. Também confere que nenhum ícone aparece sem o
// conjunto novo (todo <svg> dentro da barra lateral é um ícone de 24 px).

const PASTA = join(
  __dirname,
  '..',
  '..',
  '.teste',
  'prints-p7',
  process.env.FASE_PRINTS ?? 'depois'
)
const TEMAS = [
  ['claro', 'diaClaro'],
  ['escuro', 'noite']
] as const

async function foto(j: Page, tema: string, nome: string): Promise<void> {
  await j.waitForTimeout(400) // animação de entrada da tela
  await j.screenshot({ path: join(PASTA, `${tema}-${nome}.png`) })
}

for (const [tema, bioma] of TEMAS) {
  test(`ícones nas telas principais, tema ${tema}`, async ({ abrir }) => {
    mkdirSync(PASTA, { recursive: true })
    const a = await abrir(tema, (p) => {
      writeFileSync(
        join(p, 'appData', 'HubSquare', 'aparencia.json'),
        JSON.stringify({ bioma, vidroLeve: false, animacaoFundo: 'desligada' })
      )
    })
    const j = a.janela
    await expect(j.locator('html')).toHaveAttribute('data-bioma', bioma)
    await criarPeloAssistente(j, 'Servidor Ícones', MC)
    await foto(j, tema, '01-painel-e-barra-serv')
    // Todo ícone da barra lateral é do conjunto novo (grade de 24 px, traço de 2 px). A logo
    // ([data-logo]) não é ícone de interface: fica de fora.
    const icones = await j
      .locator('nav svg:not([data-logo] svg)')
      .evaluateAll((s) =>
        s.map((e) => `${e.getAttribute('viewBox')} ${e.getAttribute('stroke-width')}`)
      )
    expect(icones.length).toBeGreaterThan(10)
    expect([...new Set(icones)]).toEqual(['0 0 24 24 2'])
    await pagina(j, 'Mods')
    await j.getByRole('tab', { name: 'Explorar' }).click()
    await foto(j, tema, '02-explorar')
    await area(j, 'PlaySquare')
    await pagina(j, 'Jogar')
    await foto(j, tema, '03-jogar-e-barra-play')
    await pagina(j, 'Explorar')
    await foto(j, tema, '04-explorar-play')
  })
}
