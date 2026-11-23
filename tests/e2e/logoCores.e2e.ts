import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { criarPeloAssistente, expect, test } from './apoio'
import { MC } from './simulado'
import { BIOMAS } from '../../src/shared/tipos'

// Logo: esconder da barra lateral e cores que acompanham o fundo. Prints em
// .teste/prints-logo-cores/: a barra lateral nos 12 biomas (claros e escuros), sobre uma imagem de
// fundo e com a logo escondida.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-logo-cores')
const RAIZ = join(__dirname, '..', '..')

const variaveis = (j: Page): Promise<Record<string, string>> =>
  j.evaluate(() => {
    const s = document.documentElement.style
    const v: Record<string, string> = {}
    for (const nome of ['--logo-contorno', '--logo-topo', '--logo-esquerda', '--logo-direita'])
      v[nome] = s.getPropertyValue(nome)
    return v
  })

async function fotoDaBarra(j: Page, nome: string): Promise<void> {
  await j.waitForTimeout(500) // a cor da logo termina de trocar
  const caixa = await j.getByRole('navigation').boundingBox()
  await j.screenshot({
    path: join(PRINTS, `${nome}.png`),
    clip: { x: 0, y: 0, width: (caixa?.x ?? 0) + (caixa?.width ?? 180) + 10, height: 300 }
  })
}

const preparar =
  (extra: Record<string, unknown> = {}) =>
  (p: string): void => {
    const dados = join(p, 'appData', 'HubSquare')
    mkdirSync(dados, { recursive: true })
    writeFileSync(
      join(dados, 'aparencia.json'),
      JSON.stringify({ bioma: 'nether', vidroLeve: false, ...extra })
    )
  }

test('logo: esconder da barra lateral (Sobre continua) e cores que seguem o bioma', async ({
  abrir
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir('app', preparar())
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Logo', MC)
  const marca = j.locator('[data-marca-barra]')
  await expect(marca).toBeVisible()

  // Acompanhar o fundo (padrão): as variáveis da logo estão no :root e mudam com o bioma.
  await expect.poll(() => variaveis(j).then((v) => v['--logo-esquerda'])).not.toBe('')
  const nether = await variaveis(j)
  await j.getByRole('button', { name: 'Aparência' }).click()
  await j.getByRole('tab', { name: 'Fundo' }).click()
  await j.getByRole('radio', { name: 'Cerejeira' }).click()
  await expect.poll(() => variaveis(j)).not.toEqual(nether)

  // Oficiais: as variáveis saem e a logo volta às cores da marca.
  await j.getByRole('tab', { name: 'Tema' }).click()
  await j.getByRole('radio', { name: 'Oficiais' }).check({ force: true })
  await expect.poll(() => variaveis(j).then((v) => v['--logo-esquerda'])).toBe('')
  await j.getByRole('radio', { name: 'Acompanhar o fundo' }).check({ force: true })
  await expect.poll(() => variaveis(j).then((v) => v['--logo-esquerda'])).not.toBe('')
  await j.screenshot({ path: join(PRINTS, 'aparencia-secao-logo.png') })

  // Esconder: some da barra lateral, as abas Serv/Play continuam e Sobre ainda mostra a logo.
  await j.getByRole('switch', { name: 'Mostrar logo na barra lateral' }).click()
  await expect(marca).toHaveCount(0)
  await expect(j.getByRole('tab', { name: 'ServSquare' })).toBeVisible()
  await j.getByRole('tab', { name: 'PlaySquare' }).click()
  await expect(j.getByRole('tab', { name: 'PlaySquare' })).toHaveAttribute('aria-selected', 'true')
  await j.getByRole('tab', { name: 'ServSquare' }).click()
  await fotoDaBarra(j, 'escondida-cerejeira')
  await j.getByRole('button', { name: 'Aparência' }).click()
  await j.getByRole('tab', { name: 'Sobre' }).click()
  // A tela Tema (com as prévias) sai por cima por um instante; no fim, só a logo do Sobre.
  const doSobre = j.locator('main [data-logo="completa"]')
  await expect(doSobre).toHaveCount(1)
  await expect(doSobre).toBeVisible()
})

for (const bioma of BIOMAS) {
  test(`print da logo na barra lateral: ${bioma}`, async ({ abrir }) => {
    mkdirSync(PRINTS, { recursive: true })
    const a = await abrir(bioma, preparar({ bioma }))
    const j = a.janela
    await criarPeloAssistente(j, 'Servidor Logo', MC)
    await expect.poll(() => variaveis(j).then((v) => v['--logo-esquerda'])).not.toBe('')
    await fotoDaBarra(j, `bioma-${bioma}`)
  })
}

test('print da logo na barra lateral sobre uma imagem de fundo', async ({ abrir }) => {
  mkdirSync(PRINTS, { recursive: true })
  const imagem = join(RAIZ, 'docs', 'assets', 'en-jogar.png')
  const nome = `${createHash('sha256').update(readFileSync(imagem)).digest('hex')}.png`
  const a = await abrir('imagem', (p) => {
    preparar({
      bioma: 'dia',
      fundoApp: {
        tipo: 'imagem',
        imagem: nome,
        ajuste: {
          enquadrar: 'preencher',
          focoX: 0.5,
          focoY: 0.5,
          desfoque: 0,
          luz: 0,
          particulas: null
        }
      }
    })(p)
    const fundos = join(p, 'appData', 'HubSquare', 'fundos')
    mkdirSync(fundos, { recursive: true })
    copyFileSync(imagem, join(fundos, nome))
  })
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Imagem', MC)
  await expect.poll(() => variaveis(j).then((v) => v['--logo-esquerda'])).not.toBe('')
  await fotoDaBarra(j, 'imagem-de-fundo')
})
