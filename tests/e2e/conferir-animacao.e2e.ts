import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './apoio'

// Fundo vivo (Fase V2): anima com a janela aberta e para no último quadro ao minimizar.

for (const bioma of ['nether', 'dia'] as const) {
  test(`fundo animado (${bioma}): anima, e para ao minimizar`, async ({ abrir }) => {
    const a = await abrir('app', (p) => {
      const dados = join(p, 'appData', 'ServSquare')
      mkdirSync(dados, { recursive: true })
      writeFileSync(
        join(dados, 'aparencia.json'),
        JSON.stringify({ bioma, animacaoFundo: 'completa' })
      )
    })
    const j = a.janela
    await expect(j.getByText('Bem-vindo ao HubSquare')).toBeVisible()
    const foto = (): Promise<string> =>
      j.evaluate(() => (document.querySelector('canvas.fixed') as HTMLCanvasElement).toDataURL())

    const antes = await foto()
    await j.waitForTimeout(1000)
    expect(await foto(), 'o fundo deveria estar se mexendo').not.toBe(antes)

    await a.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
    await j.waitForTimeout(300) // o aviso da janela chega à tela
    const parado = await foto()
    await j.waitForTimeout(1000)
    expect(await foto(), 'minimizado, o fundo fica no último quadro').toBe(parado)
  })
}
