import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Locator, type Page } from '@playwright/test'
import { area, criarPeloAssistente, expect, pagina, test, type AppDeTeste } from './apoio'
import { MC } from './simulado'

// Fase V11: modo vitrine no Painel e no Jogar. O fundo do app é a mesma instância antes, durante
// e depois; ficam a barra lateral (compactável) e o bloco (ícone, nome, LIGAR/JOGAR e o olho que
// traz o painel de volta); saída pelo olho, Esc ou outra tela; lembrar ao reabrir e Tab só no visível. Prints em .teste/prints-v11/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v11')

const bloco = (j: Page): Locator => j.getByRole('region', { name: /^Vitrine de / })

// Escondido de verdade: dentro de uma área inert (fora do Tab e do leitor de tela).
const dentroDeInert = (l: Locator): Promise<boolean> => l.evaluate((e) => !!e.closest('[inert]'))

// Tab passa só pelo que está à mostra: nada dentro de [inert] nem escondido.
async function tabSoNoVisivel(j: Page): Promise<string[]> {
  const vistos: string[] = []
  for (let n = 0; n < 30; n++) {
    await j.keyboard.press('Tab')
    const r = await j.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      if (!a || a === document.body) return null
      const caixa = a.getBoundingClientRect()
      return {
        rotulo: a.getAttribute('aria-label') ?? a.textContent?.trim().slice(0, 30) ?? a.tagName,
        inerte: !!a.closest('[inert]'),
        visivel: caixa.width > 0 && caixa.height > 0
      }
    })
    if (!r) continue
    expect(r.inerte, `Tab entrou em algo escondido: ${r.rotulo}`).toBe(false)
    expect(r.visivel, `Tab foi para algo invisível: ${r.rotulo}`).toBe(true)
    vistos.push(r.rotulo)
  }
  return vistos
}

// O fundo do app (FundoDoApp): o canvas fixo atrás da janela inteira. A vitrine nunca troca,
// pausa nem remonta ele: guardamos o elemento antes e conferimos que é o mesmo (e continua na
// página) durante e depois.
const guardarFundo = (j: Page): Promise<void> =>
  j.evaluate(() => {
    const c = [...document.querySelectorAll('canvas')].filter((e) => e.classList.contains('fixed'))
    if (c.length !== 1) throw new Error(`fundos do app: ${c.length}`)
    ;(window as unknown as { __fundo: Element }).__fundo = c[0]
  })
const mesmoFundo = (j: Page): Promise<boolean> =>
  j.evaluate(() => {
    const c = [...document.querySelectorAll('canvas')].filter((e) => e.classList.contains('fixed'))
    const antes = (window as unknown as { __fundo: Element }).__fundo
    return c.length === 1 && c[0] === antes && antes.isConnected
  })
const opacidade = (j: Page, seletor: string): Promise<number> =>
  j
    .locator(seletor)
    .first()
    .evaluate((e) => Number(getComputedStyle(e).opacity))
const larguraDaBarra = (j: Page): Promise<number> =>
  j.locator('nav[aria-label="Seções"]').evaluate((n) => n.getBoundingClientRect().width)

// Na vitrine: a barra lateral fica (usável); somem o cabeçalho (com o medidor) e o vidro do
// painel; o bloco tem o nome, o botão principal e o olho que traz o painel de volta.
async function soOBlocoEABarra(j: Page): Promise<void> {
  await expect.poll(() => opacidade(j, '.vitrine-titulo')).toBe(0)
  await expect(j.locator('nav[aria-label="Seções"]')).toBeVisible()
  expect(await dentroDeInert(j.getByRole('tab', { name: 'ServSquare' }))).toBe(false)
  const vidro = await j
    .locator('main.vidro-painel')
    .evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(vidro).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  await expect(bloco(j).getByRole('button', { name: 'Fundo' })).toHaveCount(0)
  await expect(bloco(j).getByRole('button', { name: 'Mostrar painel' })).toBeVisible()
}

test('vitrine no Painel: o fundo é a mesma instância, barra lateral compactável, olho no bloco e Esc', async ({
  abrir
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Vitrine', MC)
  await guardarFundo(j)
  const larguraAntes = await larguraDaBarra(j)

  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await expect(bloco(j)).toBeVisible()
  await expect(bloco(j).getByRole('heading', { name: 'Servidor Vitrine' })).toBeVisible()
  await soOBlocoEABarra(j)
  expect(await mesmoFundo(j)).toBe(true)
  expect(await larguraDaBarra(j)).toBe(larguraAntes) // a barra fica como estava
  // O resto do Painel fica fora do Tab e do leitor de tela.
  expect(await dentroDeInert(j.getByRole('button', { name: 'Mais ações' }))).toBe(true)
  const vistos = await tabSoNoVisivel(j)
  expect(vistos).toContain('Mostrar painel')

  // Compactar a barra lateral na vitrine (e expandir de novo), sem sair dela.
  await j.getByRole('button', { name: 'Recolher a barra lateral' }).click()
  await expect.poll(() => larguraDaBarra(j)).toBeLessThan(80)
  await expect(bloco(j)).toBeVisible()
  await j.waitForTimeout(400)
  await j.screenshot({ path: join(PRINTS, 'painel-vitrine-compacta.png') })
  await j.getByRole('button', { name: 'Expandir a barra lateral' }).click()
  await expect.poll(() => larguraDaBarra(j)).toBe(larguraAntes)
  expect(await mesmoFundo(j)).toBe(true)

  // LIGAR pelo bloco continua funcionando.
  await bloco(j).getByRole('button', { name: 'Ligar', exact: true }).click()
  await expect(bloco(j)).toBeVisible()
  await j.waitForTimeout(400)
  await j.screenshot({ path: join(PRINTS, 'painel-vitrine.png') })
  expect(await mesmoFundo(j)).toBe(true)

  // Pelo olho do bloco: o painel volta, com o mesmo fundo.
  await bloco(j).getByRole('button', { name: 'Mostrar painel' }).click()
  await expect(bloco(j)).toHaveCount(0)
  await expect.poll(() => opacidade(j, '.vitrine-titulo')).toBe(1)
  expect(await mesmoFundo(j)).toBe(true)

  // Reabrir lembra a vitrine; Esc também sai; outra tela da barra lateral também.
  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await j.reload()
  await expect(bloco(j)).toBeVisible()
  await guardarFundo(j) // a página recarregou: o fundo desta página
  await j.keyboard.press('Escape')
  await expect(bloco(j)).toHaveCount(0)
  expect(await mesmoFundo(j)).toBe(true)
  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await expect(bloco(j)).toBeVisible()
  await pagina(j, 'Opções')
  await pagina(j, 'Painel')
  await expect(bloco(j)).toHaveCount(0)
})

test('vitrine no Jogar: o fundo é a mesma instância, JOGAR no bloco e Esc', async ({ abrir }) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Jogo', MC)
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  await guardarFundo(j)
  await j.getByRole('button', { name: 'Esconder painel' }).click()
  await expect(bloco(j)).toBeVisible()
  await expect(bloco(j).getByRole('heading', { name: 'Servidor Jogo' })).toBeVisible()
  await soOBlocoEABarra(j)
  expect(await mesmoFundo(j)).toBe(true)
  expect(await dentroDeInert(j.getByRole('combobox', { name: 'Instalação' }))).toBe(true)
  await tabSoNoVisivel(j)

  // O botão principal (JOGAR, ou INSTALAR/ATUALIZAR com o launcher desligado) funciona pelo bloco.
  await bloco(j)
    .getByRole('button', { name: /^(JOGAR|INSTALAR|ATUALIZAR)/ })
    .first()
    .click()
  await expect(
    bloco(j)
      .getByText(/PREPARANDO|ABRINDO|JOGANDO|INSTALANDO|ATUALIZANDO/)
      .or(j.getByRole('dialog'))
      .or(j.getByRole('alert'))
      .first()
  ).toBeVisible({ timeout: 60_000 })
  // Se o JOGAR abriu um diálogo, o Esc fecha só ele (a vitrine continua).
  if (await j.getByRole('dialog').count()) await j.keyboard.press('Escape')
  await expect(bloco(j)).toBeVisible()
  expect(await mesmoFundo(j)).toBe(true)

  // Esc sai (a barra lateral, com as abas Serv/Play, fica fora do alcance na vitrine).
  await j.keyboard.press('Escape')
  await expect(bloco(j)).toHaveCount(0)
  expect(await mesmoFundo(j)).toBe(true)
  // Cada área lembra a sua: no ServSquare o Painel continua com o painel.
  await area(j, 'ServSquare')
  await pagina(j, 'Painel')
  await expect(bloco(j)).toHaveCount(0)
})

// Prints com e sem vitrine nas duas telas: três biomas e uma imagem minha (contraste do bloco:
// a placa de vidro da V1, conferida em tests/contrasteRegras.test.ts).
async function abrirCom(
  abrir: (n?: string, preparar?: (p: string) => void) => Promise<AppDeTeste>,
  nome: string,
  aparencia: object,
  imagem?: Buffer
): Promise<AppDeTeste> {
  return abrir(nome, (p) => {
    const dados = join(p, 'appData', 'HubSquare')
    mkdirSync(join(dados, 'fundos'), { recursive: true })
    if (imagem) {
      const arquivo = `${createHash('sha256').update(imagem).digest('hex')}.png`
      writeFileSync(join(dados, 'fundos', arquivo), imagem)
      aparencia = {
        ...aparencia,
        fundoApp: {
          tipo: 'imagem',
          imagem: arquivo,
          ajuste: {
            enquadrar: 'preencher',
            focoX: 0.5,
            focoY: 0.5,
            desfoque: 0,
            luz: -30,
            particulas: null
          }
        }
      }
    }
    writeFileSync(join(dados, 'aparencia.json'), JSON.stringify(aparencia))
  })
}

const IMAGEM = readFileSync(
  join(__dirname, '..', '..', 'build', 'logo', 'png', 'hubsquare-512.png')
)
for (const [nome, aparencia, imagem] of [
  ['dia', { bioma: 'dia' }, undefined],
  ['cerejeira', { bioma: 'cerejeira' }, undefined],
  ['deepDark', { bioma: 'deepDark' }, undefined],
  ['imagem', { bioma: 'dia' }, IMAGEM]
] as const) {
  test(`prints da vitrine: ${nome}`, async ({ abrir }) => {
    mkdirSync(PRINTS, { recursive: true })
    const a = await abrirCom(abrir, nome, aparencia, imagem)
    const j = a.janela
    await criarPeloAssistente(j, `Servidor ${nome}`, MC)
    for (const [area_, tela, arquivo] of [
      ['ServSquare', 'Painel', 'painel'],
      ['PlaySquare', 'Jogar', 'jogar']
    ] as const) {
      await area(j, area_)
      await pagina(j, tela)
      await j.waitForTimeout(500)
      await j.screenshot({ path: join(PRINTS, `${nome}-${arquivo}-com-painel.png`) })
      await j.getByRole('button', { name: 'Esconder painel' }).click()
      await expect(bloco(j)).toBeVisible()
      await j.waitForTimeout(600) // a animação termina
      await j.screenshot({ path: join(PRINTS, `${nome}-${arquivo}-vitrine.png`) })
      await j.keyboard.press('Escape')
    }
  })
}
