import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Page } from '@playwright/test'
import { area, criarPeloAssistente, expect, pagina, pastaServidor, test } from './apoio'
import { MC } from './simulado'

// Fase V7: nenhuma imagem, faixa ou fundo colorido vaza de um canto arredondado. Em cada tela,
// para cada elemento com cantos arredondados, procura o que encosta num canto dele (imagem,
// canvas ou fundo colorido) e confere pelo getComputedStyle que ele corta o conteúdo (overflow
// diferente de visible) ou que o conteúdo tem o mesmo raio naquele canto. Prints em .teste/prints-v7/.

const PRINTS = join(__dirname, '..', '..', '.teste', 'prints-v7')
const FASE = process.env.PRINTS_V7 ?? 'depois' // "antes" para os prints do código antigo
const IMAGEM = join(__dirname, '..', '..', 'build', 'logo', 'png', 'hubsquare-512.png') // arte do próprio app

async function vazamentos(j: Page): Promise<string[]> {
  await j.waitForTimeout(500) // animação de entrada da tela
  return j.evaluate(() => {
    const visivel = (cor: string): boolean => {
      const m = /rgba?\(([^)]+)\)/.exec(cor)
      if (!m) return false
      const partes = m[1].split(/[\s,/]+/).filter(Boolean)
      return partes.length < 4 || Number(partes[3]) > 0.02
    }
    const pinta = (el: Element): boolean => {
      if (/^(IMG|CANVAS|VIDEO)$/.test(el.tagName)) return true
      const s = getComputedStyle(el)
      return visivel(s.backgroundColor) || s.backgroundImage !== 'none'
    }
    const corta = (s: CSSStyleDeclaration): boolean => s.overflow !== 'visible'
    const raio = (s: CSSStyleDeclaration, canto: string): number =>
      parseFloat(s.getPropertyValue(`border-${canto}-radius`)) || 0
    const nome = (el: Element): string =>
      `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 6).join('.')}`
    const cantos = [
      ['top-left', 'top', 'left'],
      ['top-right', 'top', 'right'],
      ['bottom-left', 'bottom', 'left'],
      ['bottom-right', 'bottom', 'right']
    ] as const
    const achados: string[] = []
    for (const e of document.querySelectorAll('body *')) {
      const se = getComputedStyle(e)
      if (corta(se)) continue
      const re = e.getBoundingClientRect()
      if (re.width < 8 || re.height < 8) continue
      for (const d of e.querySelectorAll('*')) {
        if (!pinta(d)) continue
        const rd = d.getBoundingClientRect()
        if (rd.width < 2 || rd.height < 2) continue
        for (const [canto, v, h] of cantos) {
          const r = raio(se, canto)
          if (r < 2) continue
          const borda = (lado: string): number =>
            parseFloat(se.getPropertyValue(`border-${lado}-width`)) || 0
          const encostaV =
            v === 'top'
              ? rd.top <= re.top + borda('top') + 1
              : rd.bottom >= re.bottom - borda('bottom') - 1
          const encostaH =
            h === 'left'
              ? rd.left <= re.left + borda('left') + 1
              : rd.right >= re.right - borda('right') - 1
          if (!encostaV || !encostaH) continue
          // Cortado no caminho (um ancestral entre os dois que corta com o mesmo raio) ou com raio próprio.
          let ok = false
          for (let n: Element | null = d; n && n !== e; n = n.parentElement) {
            const sn = getComputedStyle(n)
            if (raio(sn, canto) >= r - Math.max(borda(v), borda(h)) - 1 && (n === d || corta(sn)))
              ok = true
          }
          if (!ok) achados.push(`${nome(d)} vaza no canto ${canto} de ${nome(e)}`)
        }
      }
    }
    return [...new Set(achados)]
  })
}

async function conferir(j: Page, tela: string, achados: Record<string, string[]>): Promise<void> {
  const v = await vazamentos(j)
  if (v.length) achados[tela] = v
}

test('nenhuma imagem, faixa ou fundo vaza dos cantos arredondados', async ({ abrir }) => {
  test.setTimeout(5 * 60_000)
  mkdirSync(PRINTS, { recursive: true })
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Cantos', MC)
  const servidor = pastaServidor(a.pasta, 'Servidor Cantos')
  // Um mundo pequeno (o servidor nunca liga no teste rápido) e um backup dele (trocar o software
  // faz backup antes).
  mkdirSync(join(servidor, 'world'), { recursive: true })
  writeFileSync(join(servidor, 'world', 'level.dat'), 'nivel falso')
  copyFileSync(IMAGEM, join(servidor, 'world', 'icon.png'))
  await pagina(j, 'Software')
  await j.getByRole('button', { name: /^Vanilla/ }).click()
  await j.getByRole('button', { name: `Trocar para Vanilla ${MC}` }).click()
  await j.getByRole('dialog').getByRole('button', { name: 'Trocar', exact: true }).click()
  await expect(j.getByRole('dialog')).toBeHidden({ timeout: 60_000 })

  const achados: Record<string, string[]> = {}
  const foto = async (nome: string, cartao?: string): Promise<void> => {
    await j.screenshot({ path: join(PRINTS, `${FASE}-${nome}.png`) })
    if (!cartao) return
    await j.locator(cartao).first().hover()
    await j.waitForTimeout(300)
    await j.screenshot({ path: join(PRINTS, `${FASE}-${nome}-mouse.png`) })
    await conferir(j, `${nome} (mouse em cima)`, achados)
  }

  await pagina(j, 'Cópias de segurança')
  await expect(j.getByRole('button', { name: 'Restaurar', exact: true }).first()).toBeVisible()
  await conferir(j, 'Cópias de segurança', achados)
  await foto('backups', 'article')
  await pagina(j, 'Mundos')
  await conferir(j, 'Mundos', achados)
  await foto('mundos', 'article')
  await pagina(j, 'Mods')
  await conferir(j, 'Mods', achados)
  for (const aba of ['Explorar', 'Instalados']) {
    const t = j.getByRole('tab', { name: aba, exact: true })
    if (await t.count()) {
      await t.click()
      await conferir(j, `Mods › ${aba}`, achados)
    }
  }
  await j.locator('button[title$="Ver todos os servidores"]').click()
  await conferir(j, 'Servidores (ServSquare)', achados)

  await area(j, 'PlaySquare')
  const jogo = join(a.pasta, 'documents', 'HubSquare', 'jogo', 'Servidor Cantos', 'screenshots')
  mkdirSync(jogo, { recursive: true })
  copyFileSync(IMAGEM, join(jogo, '2026-01-01_12.00.00.png'))
  for (const tela of [
    'Jogar',
    'Instalações',
    'Explorar',
    'Conteúdo',
    'Servidores',
    'Capturas de tela'
  ]) {
    await pagina(j, tela)
    await conferir(j, tela, achados)
  }
  await pagina(j, 'Ajustes do jogo')
  await conferir(j, 'Ajustes do jogo', achados)
  await foto('ajustes-do-jogo')

  expect(achados, 'conteúdo vazando de cantos arredondados').toEqual({})
})
