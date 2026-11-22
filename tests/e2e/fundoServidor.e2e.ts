import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Locator, type Page } from '@playwright/test'
import { area, criarPeloAssistente, expect, pagina, pastaServidor, test } from './apoio'
import { MC } from './simulado'

// Fase V10: fundo próprio de cada servidor do ServSquare, pelo MESMO painel "Fundo" da tela Jogar.
// Prints do Painel de dois servidores com fundos diferentes em .teste/prints-v10/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v10')
const IMAGEM = join(__dirname, '..', '..', 'build', 'logo', 'png', 'hubsquare-512.png') // arte do próprio app
const infoDe = (raiz: string, nome: string): { fundo?: unknown } =>
  JSON.parse(readFileSync(join(pastaServidor(raiz, nome), 'hubsquare.json'), 'utf8'))
const fundoDaJanela = (j: Page): Locator => j.locator('.fixed.-z-10 img[data-fundo]')

async function abrirPainelFundo(j: Page): Promise<Locator> {
  await pagina(j, 'Painel')
  await j
    .getByRole('region', { name: 'Servidor' })
    .getByRole('button', { name: 'Trocar o fundo' })
    .click()
  return j.getByRole('dialog', { name: 'Trocar o fundo' })
}

async function irParaServidor(j: Page, nome: string): Promise<void> {
  await j.locator('button[title$="Ver todos os servidores"]').click()
  await j.getByRole('button', { name: new RegExp(`^${nome} `) }).click()
  await expect(j.getByRole('heading', { name: nome, level: 2 })).toBeVisible({ timeout: 30_000 })
}

test('fundo do servidor: imagem, bioma, trocar de servidor, igual à instalação e apagar a imagem', async ({
  abrir
}) => {
  test.setTimeout(5 * 60_000)
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  const html = j.locator('html')
  await criarPeloAssistente(j, 'Servidor Imagem', MC)

  // Servidor 1: uma imagem minha, pelo painel. Vale em todas as telas dele.
  let painel = await abrirPainelFundo(j)
  await expect(painel.getByRole('radio', { name: 'Igual ao app' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await expect(
    painel.getByRole('radio', { name: 'Igual à instalação deste servidor' })
  ).toBeVisible()
  await painel.getByRole('radio', { name: 'Imagem' }).click()
  await a.escolherArquivo(IMAGEM)
  await painel.getByRole('button', { name: /Escolher (uma|outra) imagem…/ }).click()
  await expect
    .poll(() => (infoDe(a.pasta, 'Servidor Imagem').fundo as { tipo?: string })?.tipo)
    .toBe('imagem')
  await j.keyboard.press('Escape')
  await expect(fundoDaJanela(j)).toHaveCount(1)
  await j.screenshot({ path: join(PRINTS, 'painel-servidor-imagem.png') })
  await pagina(j, 'Opções')
  await expect(fundoDaJanela(j)).toHaveCount(1)
  // Fora de um servidor (Servidores, Aparência): o fundo do app.
  await j.locator('button[title$="Ver todos os servidores"]').click()
  await expect(fundoDaJanela(j)).toHaveCount(0)

  // Servidor 2: um bioma.
  await j.getByRole('button', { name: 'Criar servidor', exact: true }).click()
  await j.getByRole('menuitem', { name: 'Do zero (assistente)' }).click()
  await criarPeloAssistente(j, 'Servidor Bioma', MC)
  await expect(j.getByRole('heading', { name: 'Servidor Bioma', level: 2 })).toBeVisible()
  await expect(fundoDaJanela(j)).toHaveCount(0)
  painel = await abrirPainelFundo(j)
  await painel.getByRole('radio', { name: 'Bioma' }).click()
  await painel.getByRole('radio', { name: 'Nether' }).click()
  await j.keyboard.press('Escape')
  await expect(html).toHaveAttribute('data-bioma', 'nether')
  await expect
    .poll(() => infoDe(a.pasta, 'Servidor Bioma').fundo)
    .toEqual({ tipo: 'bioma', bioma: 'nether' })
  await j.waitForTimeout(700) // transição do bioma
  await j.screenshot({ path: join(PRINTS, 'painel-servidor-bioma.png') })

  // Trocar de servidor troca o fundo (e a escolha continua depois de reabrir a janela).
  await irParaServidor(j, 'Servidor Imagem')
  await expect(fundoDaJanela(j)).toHaveCount(1)
  await irParaServidor(j, 'Servidor Bioma')
  await expect(html).toHaveAttribute('data-bioma', 'nether')
  await j.reload()
  await expect(html).toHaveAttribute('data-bioma', 'nether')

  // "Igual à instalação": segue o fundo da instalação deste servidor, e acompanha a mudança dela.
  painel = await abrirPainelFundo(j)
  await painel.getByRole('radio', { name: 'Igual à instalação deste servidor' }).click()
  await j.keyboard.press('Escape')
  await expect.poll(() => infoDe(a.pasta, 'Servidor Bioma').fundo).toEqual({ tipo: 'instalacao' })
  await expect(html).toHaveAttribute('data-bioma', 'dia') // a instalação está igual ao app
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  // A instalação deste servidor, no cartão da lista de instalações do Jogar.
  await j
    .locator('main')
    .getByRole('button', { name: / Servidor Bioma \d/ })
    .first()
    .click()
  await expect(j.getByRole('region', { name: /^Instalação Servidor Bioma/ })).toBeVisible()
  await j.getByRole('button', { name: 'Trocar o fundo' }).click()
  const doJogo = j.getByRole('dialog', { name: 'Trocar o fundo' })
  await doJogo.getByRole('radio', { name: 'Bioma' }).click()
  await doJogo.getByRole('radio', { name: 'Aurora Nevada' }).click()
  await j.keyboard.press('Escape')
  await area(j, 'ServSquare')
  await pagina(j, 'Painel')
  await expect(html).toHaveAttribute('data-bioma', 'aurora')

  // Apagar a imagem em uso: "Minhas imagens" mostra o servidor, e ele volta para "Igual ao app".
  await j.getByRole('button', { name: 'Aparência' }).click()
  await j.getByRole('tab', { name: 'Fundo' }).click()
  await expect(j.getByText('Em uso: Servidor Servidor Imagem')).toBeVisible()
  await j.getByRole('button', { name: 'Apagar…' }).first().click()
  await j.getByRole('dialog').getByRole('button', { name: 'Apagar', exact: true }).click()
  await expect.poll(() => infoDe(a.pasta, 'Servidor Imagem').fundo).toBeUndefined()
})
