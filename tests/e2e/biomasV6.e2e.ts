import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, criarPeloAssistente, expect, pagina, test } from './apoio'
import { MC } from './simulado'

// Fase V6: os sete biomas novos vivos. Para cada um, uma "gravação" (8 quadros, 1 s entre eles,
// numa folha só) em .teste/prints-v6/, e a pausa ao minimizar. Também: com menos movimento o
// fundo fica parado, e a troca entre dois biomas novos na tela Jogar.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v6')
const NOVOS = ['cerejeira', 'caverna', 'deepDark', 'deserto', 'aurora', 'ametista', 'pantano']
const fundoDoApp = (): string =>
  (document.querySelector('canvas.fixed') as HTMLCanvasElement).toDataURL()

function preparar(prefs: object) {
  return (p: string): void => {
    const dados = join(p, 'appData', 'HubSquare')
    mkdirSync(dados, { recursive: true })
    writeFileSync(join(dados, 'aparencia.json'), JSON.stringify(prefs))
  }
}

for (const bioma of NOVOS) {
  test(`bioma vivo ${bioma}: anima, grava a sequência e para ao minimizar`, async ({ abrir }) => {
    mkdirSync(PRINTS, { recursive: true })
    const a = await abrir(bioma, preparar({ bioma, animacaoFundo: 'completa' }))
    const j = a.janela
    await expect(j.getByText('Bem-vindo ao HubSquare')).toBeVisible()
    const quadros: string[] = []
    for (let i = 0; i < 8; i++) {
      quadros.push(await j.evaluate(fundoDoApp))
      await j.waitForTimeout(1000)
    }
    expect(new Set(quadros).size, 'o fundo deveria estar se mexendo').toBeGreaterThan(1)
    // A folha: os 8 quadros em 4 × 2, ampliados 2× sem suavizar.
    const folha = await j.evaluate(async (lista) => {
      const [w, h] = [640, 360]
      const tela = document.createElement('canvas')
      tela.width = 4 * w
      tela.height = 2 * h
      const c = tela.getContext('2d')!
      c.imageSmoothingEnabled = false
      for (const [i, url] of lista.entries()) {
        const img = new Image()
        img.src = url
        await img.decode()
        c.drawImage(img, (i % 4) * w, Math.floor(i / 4) * h, w, h)
      }
      return tela.toDataURL().split(',')[1]
    }, quadros)
    writeFileSync(join(PRINTS, `${bioma}-sequencia.png`), Buffer.from(folha, 'base64'))

    await a.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
    await j.waitForTimeout(300) // o aviso da janela chega à tela
    const parado = await j.evaluate(fundoDoApp)
    await j.waitForTimeout(1000)
    expect(await j.evaluate(fundoDoApp), 'minimizado, o fundo fica no último quadro').toBe(parado)
  })
}

test('com menos movimento pedido, o bioma novo fica parado', async ({ abrir }) => {
  const a = await abrir('parado', preparar({ bioma: 'aurora', reduzirAnimacoes: true }))
  const j = a.janela
  await expect(j.getByText('Bem-vindo ao HubSquare')).toBeVisible()
  const antes = await j.evaluate(fundoDoApp)
  await j.waitForTimeout(1500)
  expect(await j.evaluate(fundoDoApp)).toBe(antes)
})

test('Jogar: troca suave entre dois biomas novos no fundo da instalação', async ({ abrir }) => {
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Troca', MC)
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  const indice = join(a.pasta, 'appData', 'HubSquare', 'instalacoes.json')
  const fundo = (): unknown => JSON.parse(readFileSync(indice, 'utf8')).instalacoes[0].fundo
  await j.getByRole('button', { name: 'Trocar o fundo' }).click()
  const painel = j.getByRole('dialog', { name: 'Trocar o fundo' })
  await painel.getByRole('radio', { name: 'Bioma' }).click()
  for (const [nome, id] of [
    ['Deep Dark', 'deepDark'],
    ['Cerejeira', 'cerejeira'],
    ['Pântano de Vagalumes', 'pantano']
  ]) {
    await painel.getByRole('radio', { name: nome }).click()
    await expect.poll(fundo).toEqual({ tipo: 'bioma', bioma: id })
    await j.waitForTimeout(300) // no meio da transição de 0,6 s
    await j.screenshot({ path: join(PRINTS, `troca-para-${id}.png`) })
  }
})
