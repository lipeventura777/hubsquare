import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, criarPeloAssistente, expect, pagina, test } from './apoio'
import { MC } from './simulado'

// Fase V5: os sete biomas novos. Prints da tela Jogar e do Painel em cada um, a folha com as doze
// miniaturas (as mesmas da escolha de fundo) e o Vidro leve, em .teste/prints-v5/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v5')
const NOVOS = [
  'cerejeira',
  'caverna',
  'deepDark',
  'deserto',
  'aurora',
  'ametista',
  'pantano'
] as const

for (const bioma of NOVOS) {
  test(`bioma novo ${bioma}: Painel e Jogar`, async ({ abrir }) => {
    mkdirSync(PRINTS, { recursive: true })
    const a = await abrir(bioma, (p) => {
      const dados = join(p, 'appData', 'ServSquare')
      mkdirSync(dados, { recursive: true })
      writeFileSync(join(dados, 'aparencia.json'), JSON.stringify({ bioma, vidroLeve: false }))
    })
    const j = a.janela
    await expect(j.locator('html')).toHaveAttribute('data-bioma', bioma)
    await criarPeloAssistente(j, 'Servidor Bioma', MC)
    await j.waitForTimeout(400) // animação de entrada da tela
    await j.screenshot({ path: join(PRINTS, `${bioma}-painel.png`) })
    await area(j, 'PlaySquare')
    await pagina(j, 'Jogar')
    await j.waitForTimeout(400)
    await j.screenshot({ path: join(PRINTS, `${bioma}-jogar.png`) })
  })
}

test('doze biomas na escolha de fundo do app e da instalação, com Vidro leve nos novos', async ({
  abrir
}) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Doze', MC)
  const html = j.locator('html')

  await j.getByRole('button', { name: 'Aparência' }).click()
  await j.getByRole('tab', { name: 'Fundo' }).click()
  const claros = j.getByRole('radiogroup', { name: 'Biomas claros' })
  const escuros = j.getByRole('radiogroup', { name: 'Biomas escuros' })
  await expect(claros.getByRole('radio')).toHaveCount(4)
  await expect(escuros.getByRole('radio')).toHaveCount(8)
  await expect(claros.getByRole('radio', { name: 'Cerejeira' })).toBeVisible()

  // A folha: as doze miniaturas da própria tela, lado a lado (4 × 3).
  const folha = await j.evaluate(() => {
    const telas = [...document.querySelectorAll<HTMLCanvasElement>('[aria-label^="Biomas"] canvas')]
    const [w, h, vao] = [320, 180, 8]
    const tela = document.createElement('canvas')
    tela.width = 4 * w + 5 * vao
    tela.height = 3 * h + 4 * vao
    const c = tela.getContext('2d')!
    c.fillRect(0, 0, tela.width, tela.height)
    telas.forEach((t, i) =>
      c.drawImage(t, vao + (i % 4) * (w + vao), vao + Math.floor(i / 4) * (h + vao))
    )
    return { n: telas.length, png: tela.toDataURL().split(',')[1] }
  })
  expect(folha.n).toBe(12)
  writeFileSync(join(PRINTS, 'doze-miniaturas.png'), Buffer.from(folha.png, 'base64'))

  // Fundo do app: um bioma novo vale na hora.
  await escuros.getByRole('radio', { name: 'Geodo de Ametista' }).click()
  await expect(html).toHaveAttribute('data-bioma', 'ametista')
  await j.waitForTimeout(400)
  await j.screenshot({ path: join(PRINTS, 'escolha-de-fundo.png') })

  // Vidro leve: sem desfoque nos sete (inclusive nos que trocam a saturação e o brilho).
  const desfoques = await j.evaluate((biomas) => {
    const raiz = document.documentElement
    const antes = raiz.dataset.bioma
    const ler = (): string =>
      getComputedStyle(document.querySelector('.vidro-painel')!).backdropFilter
    const r = biomas.map((b) => {
      raiz.dataset.bioma = b
      raiz.removeAttribute('data-vidro-leve')
      const normal = ler()
      raiz.setAttribute('data-vidro-leve', '')
      return { b, normal, leve: ler() }
    })
    raiz.removeAttribute('data-vidro-leve')
    raiz.dataset.bioma = antes
    return r
  }, NOVOS)
  for (const d of desfoques) {
    expect(d.normal, d.b).toContain('blur(')
    expect(d.leve, d.b).toBe('none')
  }

  // Fundo da instalação: um bioma novo no painel Fundo da tela Jogar.
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  await j.getByRole('button', { name: 'Trocar o fundo' }).click()
  const painel = j.getByRole('dialog', { name: 'Trocar o fundo' })
  await painel.getByRole('radio', { name: 'Bioma' }).click()
  await expect(painel.getByRole('radiogroup', { name: 'Bioma' }).getByRole('radio')).toHaveCount(12)
  await painel.getByRole('radio', { name: 'Aurora Nevada' }).click()
  const indice = join(a.pasta, 'appData', 'ServSquare', 'instalacoes.json')
  await expect
    .poll(() => JSON.parse(readFileSync(indice, 'utf8')).instalacoes[0].fundo)
    .toEqual({ tipo: 'bioma', bioma: 'aurora' })
  await j.waitForTimeout(700) // transição do bioma
  await j.screenshot({ path: join(PRINTS, 'painel-fundo-da-instalacao.png') })
})
