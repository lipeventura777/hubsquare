import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import {
  area,
  criarPeloAssistente,
  expect,
  pagina,
  pastaServidor,
  test,
  type AppDeTeste
} from './apoio'
import { MC } from './simulado'

// Fase I1: o app em português e em inglês. Escolha na primeira abertura, troca pela engrenagem
// sem reiniciar o app, instalação antiga sem a pergunta, formatos de número e data, e prints de
// todas as telas nas duas línguas (.teste/prints-i1/<idioma>/) com a conferência de texto cortado.

const dados = (pasta: string): string => join(pasta, 'appData', 'ServSquare')
const idiomaSalvo = (pasta: string): unknown =>
  JSON.parse(readFileSync(join(dados(pasta), 'idioma.json'), 'utf8')).idioma
const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-i1')

// Engrenagem › Idioma / Language › o cartão do idioma. A tela recarrega sozinha.
async function trocarIdioma(j: Page, nome: 'English (US)' | 'Português (Brasil)'): Promise<void> {
  await j.getByRole('button', { name: /^(Aparência|Appearance)$/ }).click()
  await j.getByRole('tab', { name: 'Idioma / Language' }).click()
  const recarregou = j.waitForEvent('load')
  await j.getByRole('radio', { name: nome }).click()
  await recarregou
  await expect(j.getByRole('radio', { name: nome })).toHaveAttribute('aria-checked', 'true')
}

test('primeira abertura: escolhe o idioma antes das boas-vindas', async ({ abrir }) => {
  const a = await abrir('app', (p) => rmSync(join(dados(p), 'idioma.json')))
  const j = a.janela
  await expect(j.getByRole('radio', { name: 'Português (Brasil)' })).toBeVisible()
  await expect(j.getByRole('radio', { name: 'English (US)' })).toBeVisible()
  await j.getByRole('radio', { name: 'English (US)' }).click()
  const recarregou = j.waitForEvent('load')
  await j.getByRole('button', { name: 'Continue' }).click()
  await recarregou
  // As boas-vindas do modo (Fase M6) já em inglês.
  await expect(j.getByText('Welcome to HubSquare')).toBeVisible()
  await expect(j.getByRole('button', { name: /I'll host servers/ })).toBeVisible()
  expect(idiomaSalvo(a.pasta)).toBe('en-US')
  expect(await j.evaluate(() => document.documentElement.lang)).toBe('en-US')
})

test('instalação antiga (de antes da tradução): continua em português, sem a pergunta', async ({
  abrir
}) => {
  const a = await abrir('app', (p) => {
    rmSync(join(dados(p), 'idioma.json'))
    writeFileSync(join(dados(p), 'modo-app.json'), JSON.stringify({ modo: 'completo' }))
  })
  const j = a.janela
  await expect(j.getByText('Que tipo de servidor?')).toBeVisible()
  await expect(j.getByRole('radio', { name: 'English (US)' })).toHaveCount(0)
  expect(idiomaSalvo(a.pasta)).toBe('pt-BR')
})

test('engrenagem › Idioma / Language: troca na hora, sem reiniciar, com os formatos de cada idioma', async ({
  abrir
}) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Idioma', MC)
  const pid = a.app.process().pid
  // Um arquivo de 1.536 bytes: "1,5 KB" em português e "1.5 KB" em inglês.
  writeFileSync(join(pastaServidor(a.pasta, 'Servidor Idioma'), 'tamanho.txt'), 'x'.repeat(1536))

  // Português: 1,5 KB e data dd/mm/aaaa na tela Arquivos.
  await pagina(j, 'Arquivos')
  await expect(j.getByText('1,5 KB', { exact: true })).toBeVisible()
  await expect(j.getByText(/^\d{2}\/\d{2}\/\d{4}/).first()).toBeVisible()

  await trocarIdioma(j, 'English (US)')
  expect(a.app.process().pid).toBe(pid) // o app não reiniciou
  expect(idiomaSalvo(a.pasta)).toBe('en-US')
  await expect(j.locator('[data-indicador="Painel"]')).toContainText('Dashboard')
  await pagina(j, 'Arquivos')
  await expect(j.getByText('1.5 KB', { exact: true })).toBeVisible()
  await expect(j.getByText(/^\d{1,2}\/\d{1,2}\/\d{2},/).first()).toBeVisible()

  await trocarIdioma(j, 'Português (Brasil)')
  await expect(j.locator('[data-indicador="Painel"]')).toContainText('Painel')
  expect(idiomaSalvo(a.pasta)).toBe('pt-BR')
})

// Texto cortado ou para fora: botões, abas e rótulos com o texto maior que a caixa, e rolagem
// para os lados no painel.
async function cortes(j: Page): Promise<string[]> {
  await j.waitForTimeout(450)
  return j.evaluate(() => {
    const r: string[] = []
    const main = document.querySelector('main')
    if (main && main.scrollWidth > main.clientWidth + 1) r.push('o painel rola para os lados')
    for (const el of document.querySelectorAll<HTMLElement>(
      'button, [role="tab"], label, h1, h2'
    )) {
      const box = el.getBoundingClientRect()
      if (box.width < 1 || getComputedStyle(el).overflow === 'visible') continue
      if (el.scrollWidth > el.clientWidth + 1 && !el.closest('[data-pode-cortar]'))
        r.push(`"${(el.textContent ?? '').trim().slice(0, 40)}" cortado`)
    }
    return r
  })
}

async function tamanho(a: AppDeTeste, w: number, h: number): Promise<void> {
  await a.app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const janela = BrowserWindow.getAllWindows()[0]
      janela.unmaximize()
      janela.setContentSize(w, h)
    },
    [w, h]
  )
  await a.janela.waitForTimeout(250)
}

test('prints de todas as telas em português e em inglês, sem texto cortado', async ({ abrir }) => {
  test.setTimeout(30 * 60_000)
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Prints', MC)
  const falhas: string[] = []
  for (const [idioma, cartao] of [
    ['pt-BR', 'Português (Brasil)'],
    ['en', 'English (US)']
  ] as const) {
    if (idioma === 'en') await trocarIdioma(j, cartao)
    const pasta = join(PRINTS, idioma)
    if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true })
    for (const w of [1280, 1920]) {
      await tamanho(a, w, w === 1280 ? 800 : 1080)
      for (const nomeArea of ['ServSquare', 'PlaySquare'] as const) {
        await area(j, nomeArea)
        await j.waitForTimeout(600)
        const nomes = await j
          .locator('nav [data-indicador]')
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-indicador')!))
        for (const nome of [...nomes, 'Aparência']) {
          if (nome === 'Aparência')
            await j.getByRole('button', { name: /^(Aparência|Appearance)$/ }).click()
          else await j.locator(`nav [data-indicador="${nome}"]`).first().click()
          const abas = j.locator('header [role="tab"]')
          const n = Math.max(await abas.count(), 1)
          for (let i = 0; i < n; i++) {
            if (await abas.count()) await abas.nth(i).click()
            const tela = `${nomeArea}-${nome}${(await abas.count()) ? `-${i + 1}` : ''}`
            for (const c of await cortes(j)) falhas.push(`${idioma} ${w} ${tela}: ${c}`)
            await j.screenshot({ path: join(pasta, `${tela.replace(/[^\w-]+/g, '_')}-${w}.png`) })
          }
        }
      }
    }
  }
  writeFileSync(join(PRINTS, 'cortes.txt'), falhas.join('\n') + '\n')
  expect(falhas).toEqual([])
})
