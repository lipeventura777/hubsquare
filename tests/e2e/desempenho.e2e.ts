import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './apoio'

// Desempenho do fundo animado (Fase V2, @desempenho, npm run desempenho:fundo). Para cada bioma,
// o app fica 60 s aberto (no assistente, com os painéis de vidro sobre o fundo) em cada
// situação, e mede a CPU do processo da tela e da GPU (app.getAppMetrics do Electron).
// Pausado = janela minimizada (o mesmo caminho da pausa de verdade).

const BIOMAS = ['diaClaro', 'dia', 'noite', 'mar', 'nether'] as const
const SITUACOES = [
  { nome: 'completa', prefs: { animacaoFundo: 'completa', vidroLeve: false } },
  { nome: 'completa + vidro leve', prefs: { animacaoFundo: 'completa', vidroLeve: true } },
  { nome: 'leve', prefs: { animacaoFundo: 'leve', vidroLeve: false } },
  { nome: 'pausado (minimizado)', prefs: { animacaoFundo: 'completa', vidroLeve: false } }
] as const
const SEGUNDOS = Number(process.env.SEGUNDOS ?? 60)
const TABELA = join(__dirname, '..', '..', '.teste', 'resultados-desempenho', 'fundo.md')

for (const bioma of BIOMAS) {
  for (const s of SITUACOES) {
    test(`@desempenho ${bioma} · ${s.nome}`, async ({ abrir }) => {
      test.setTimeout((SEGUNDOS + 60) * 1000)
      const a = await abrir(`${bioma}`, (p) => {
        const dados = join(p, 'appData', 'ServSquare')
        mkdirSync(dados, { recursive: true })
        writeFileSync(join(dados, 'aparencia.json'), JSON.stringify({ bioma, ...s.prefs }))
      })
      await expect(a.janela.getByText('Bem-vindo ao HubSquare')).toBeVisible()
      const pausado = s.nome.startsWith('pausado')
      // A janela só aparece no ready-to-show: minimizar antes disso não vale (ela volta a aparecer).
      await a.janela.waitForTimeout(2000)
      if (pausado) {
        await a.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
      }
      await a.janela.waitForTimeout(3000) // aquecimento
      const medir = (): Promise<{ tela: number; gpu: number }> =>
        a.app.evaluate(({ app }) => {
          const m = app.getAppMetrics()
          const soma = (tipo: string): number =>
            m.filter((x) => x.type === tipo).reduce((t, x) => t + x.cpu.percentCPUUsage, 0)
          return { tela: soma('Tab'), gpu: soma('GPU') }
        })
      await medir() // zera a contagem
      const amostras: { tela: number; gpu: number }[] = []
      for (let i = 0; i < SEGUNDOS / 5; i++) {
        await a.janela.waitForTimeout(5000)
        amostras.push(await medir())
      }
      if (pausado) {
        const minimizada = await a.app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isMinimized()
        )
        expect(minimizada, 'a janela precisa continuar minimizada durante a medição').toBe(true)
      }
      const media = (k: 'tela' | 'gpu'): number =>
        amostras.reduce((t, x) => t + x[k], 0) / amostras.length
      mkdirSync(join(TABELA, '..'), { recursive: true })
      if (!existsSync(TABELA)) {
        writeFileSync(
          TABELA,
          `| Bioma | Situação | CPU da tela (%) | CPU da GPU (%) |\n| --- | --- | --- | --- |\n`
        )
      }
      appendFileSync(
        TABELA,
        `| ${bioma} | ${s.nome} | ${media('tela').toFixed(1)} | ${media('gpu').toFixed(1)} |\n`
      )
    })
  }
}
