import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { area, criarPeloAssistente, expect, test, type AppDeTeste } from './apoio'
import { MC } from './simulado'

// Fase V8: telas mais largas. Abre todas as telas (e abas) do ServSquare e do PlaySquare em
// quatro tamanhos de janela e confere: sem rolagem para os lados; em 1920, o conteúdo usa pelo
// menos 65% da largura do painel (ou chega a 1480px); nenhum parágrafo com mais de 90 caracteres
// por linha. A medida de cada tela vai para .teste/prints-v8/medidas-<fase>.md e os prints para
// .teste/prints-v8/ ("PRINTS_V8=antes" para os do código antigo).

const PASTA = join(__dirname, '..', '..', '.teste', 'prints-v8')
const FASE = process.env.PRINTS_V8 ?? 'depois'
const JANELAS = [
  [1280, 800],
  [1600, 900],
  [1920, 1080],
  [2560, 1440]
] as const
// As telas que a Fase V8 mudou ganham prints nas quatro janelas.
const FOTOGRAFAR = (process.env.FOTOGRAFAR ?? '').split(',').filter(Boolean)

interface Medida {
  painel: number
  usado: number
  rolaDeLado: string[]
  linhaLonga: { texto: string; chars: number }[]
  vazia: boolean
}

async function medir(j: Page): Promise<Medida> {
  await j.waitForTimeout(450) // animação de entrada da tela
  return j.evaluate(() => {
    const main = document.querySelector('main')!
    const rm = main.getBoundingClientRect()
    let direita = rm.left
    for (const el of main.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const s = getComputedStyle(el)
      if (s.visibility === 'hidden' || s.position === 'fixed') continue
      const folha =
        !el.children.length || /^(IMG|CANVAS|INPUT|SELECT|TEXTAREA|BUTTON|SVG)$/i.test(el.tagName)
      const pinta = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.borderTopWidth !== '0px' || folha
      // O banner e o fundo ocupam a largura toda por desenho; contam só as superfícies e textos.
      if (pinta && !el.closest('[aria-hidden="true"]')) direita = Math.max(direita, r.right)
    }
    const rolaDeLado: string[] = []
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      rolaDeLado.push('página')
    for (const el of [main, ...main.querySelectorAll('*')]) {
      // Contêineres de rolagem vertical da tela não podem rolar para os lados.
      if (
        /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
        el.scrollWidth > el.clientWidth + 1
      )
        rolaDeLado.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
    }
    const linhaLonga: { texto: string; chars: number }[] = []
    for (const p of main.querySelectorAll('p')) {
      const r = p.getBoundingClientRect()
      if (r.width < 1 || p.closest('pre, code, [role="log"]')) continue
      const texto = (p.textContent ?? '').trim()
      if (texto.length < 90) continue
      // A linha mais larga (pelas caixas de linha do texto), em caracteres: largura dela vezes
      // os caracteres por pixel do próprio parágrafo escrito numa linha só.
      const faixa = document.createRange()
      faixa.selectNodeContents(p)
      const porLinha = new Map<number, [number, number]>()
      for (const c of faixa.getClientRects()) {
        if (!c.width) continue
        const topo = Math.round(c.top / 4) // caixas da mesma linha (com <b>, <code>...)
        const [e, d] = porLinha.get(topo) ?? [c.left, c.right]
        porLinha.set(topo, [Math.min(e, c.left), Math.max(d, c.right)])
      }
      const maior = Math.max(...[...porLinha.values()].map(([e, d]) => d - e))
      const s = getComputedStyle(p)
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
      const chars = Math.round((texto.length * maior) / ctx.measureText(texto).width)
      if (chars > 90) linhaLonga.push({ texto: texto.slice(0, 50), chars })
    }
    // Tela vazia ou de "preparar": um aviso centralizado no painel, de propósito estreito.
    const vazia = !!main.querySelector('.estado-vazio')
    return { painel: rm.width, usado: direita - rm.left, rolaDeLado, linhaLonga, vazia }
  })
}

async function tamanho(a: AppDeTeste, w: number, h: number): Promise<void> {
  await a.app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const j = BrowserWindow.getAllWindows()[0]
      j.unmaximize()
      j.setContentSize(w, h)
    },
    [w, h]
  )
  await a.janela.waitForTimeout(250)
}

// Todas as telas da barra lateral da área e, em cada uma, todas as abas do cabeçalho.
async function telas(j: Page, visitar: (nome: string) => Promise<void>): Promise<void> {
  const nomes = await j
    .locator('nav[aria-label="Seções"] [data-indicador]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-indicador')!))
  for (const nome of nomes) {
    await j.locator(`nav[aria-label="Seções"] [data-indicador="${nome}"]`).click()
    const abas = j.locator('header [role="tab"]')
    const n = await abas.count()
    if (!n) {
      await visitar(nome)
      continue
    }
    for (let i = 0; i < n; i++) {
      const aba = abas.nth(i)
      const rotulo = (await aba.innerText()).replace(/\s+/g, ' ').trim()
      await aba.click()
      await visitar(`${nome} › ${rotulo}`)
    }
  }
}

test('telas mais largas: sem rolagem lateral, largura usada e linhas curtas', async ({ abrir }) => {
  test.setTimeout(20 * 60_000)
  mkdirSync(PASTA, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Largo', MC)
  // Software: com o software e a versão atuais escolhidos, o botão fica desligado com a dica.
  await j.locator('nav[aria-label="Seções"] [data-indicador="Software"]').click()
  const dica = j.locator('span[title="Este já é o software atual"]')
  await expect(dica).toBeVisible()
  await expect(dica.getByRole('button')).toBeDisabled()
  const relatorio: string[] = [
    '| Janela | Tela | Usado / painel | % |',
    '| --- | --- | --- | --- |'
  ]
  const falhas: string[] = []

  for (const [w, h] of JANELAS) {
    await tamanho(a, w, h)
    for (const nomeArea of ['ServSquare', 'PlaySquare'] as const) {
      await area(j, nomeArea)
      await j.waitForTimeout(600) // a barra lateral troca de área com animação
      await telas(j, async (tela) => {
        const m = await medir(j)
        const pct = Math.round((m.usado / m.painel) * 100)
        relatorio.push(
          `| ${w}×${h} | ${nomeArea} › ${tela} | ${Math.round(m.usado)} / ${Math.round(m.painel)} | ${pct}% |`
        )
        const onde = `${w}×${h} ${nomeArea} › ${tela}`
        if (m.rolaDeLado.length)
          falhas.push(`${onde}: rola para os lados (${m.rolaDeLado.join(', ')})`)
        for (const l of m.linhaLonga)
          falhas.push(`${onde}: ${l.chars} caracteres por linha ("${l.texto}…")`)
        if (w === 1920 && !m.vazia && m.usado < Math.min(0.65 * m.painel, 1480))
          falhas.push(`${onde}: usa ${pct}% do painel`)
        if (FOTOGRAFAR.some((f) => tela.startsWith(f)))
          await j.screenshot({
            path: join(PASTA, `${FASE}-${nomeArea}-${tela.replace(/[›\s/]+/g, '_')}-${w}.png`)
          })
      })
    }
  }
  writeFileSync(join(PASTA, `medidas-${FASE}.md`), relatorio.join('\n') + '\n')
  writeFileSync(join(PASTA, `falhas-${FASE}.txt`), falhas.join('\n') + '\n')
  expect(falhas).toEqual([])
})
