import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { criarPeloAssistente, expect, test } from './apoio'
import { MC } from './simulado'

// Fase R1: Relatar problema. Pela engrenagem › Sobre: e-mail (mailto: com acentos, o .zip da M8
// gerado e mostrado na pasta), GitHub (issue nova pelo modelo) e, sem programa de e-mail, o
// endereço com Copiar. Os links só ficam anotados: nada abre de verdade.

const consulta = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1])

test('relatar problema: e-mail com o relatório, GitHub e sem programa de e-mail', async ({
  abrir
}) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Relato', MC)

  await j.getByRole('button', { name: 'Aparência' }).click()
  await j.getByRole('tab', { name: 'Sobre' }).click()
  await j.getByRole('button', { name: 'Relatar problema' }).click()
  const dialogo = j.getByRole('dialog')
  await expect(dialogo.getByRole('heading', { name: 'Relatar problema' })).toBeVisible()
  // Bug vem com o relatório marcado; Sugestão desmarca.
  const caixa = dialogo.getByRole('checkbox', { name: 'Incluir relatório de erro' })
  await expect(caixa).toBeChecked()
  const enviar = dialogo.getByRole('button', { name: 'Enviar por e-mail' })
  await expect(enviar).toBeDisabled() // sem descrição
  await dialogo
    .getByRole('textbox', { name: 'Descrição' })
    .fill('O servidor não liga: ação & reação')

  // E-mail: gera o .zip, abre o mailto: e mostra o arquivo na pasta.
  await enviar.click()
  await expect(dialogo.getByText(/Anexe o arquivo que acabou de aparecer/)).toBeVisible({
    timeout: 60_000
  })
  const zip = readdirSync(join(a.pasta, 'desktop')).find((n) =>
    /^HubSquare-relatorio-.*\.zip$/.test(n)
  )
  expect(zip, 'o .zip da M8 na Área de Trabalho').toBeTruthy()
  const aberturas = await a.aberturas()
  const mailto = aberturas.find((x) => x.startsWith('openExternal mailto:'))!.slice(13)
  expect(mailto.startsWith('mailto:suporte.hubsquare@gmail.com?subject=')).toBe(true)
  expect(mailto).not.toMatch(/ /)
  const q = consulta(mailto)
  expect(q.get('subject')).toMatch(
    /^\[HubSquare \d+\.\d+\.\d+\] Bug: O servidor não liga: ação & reação$/
  )
  expect(q.get('body')).toContain(zip!)
  expect(q.get('body')).toContain('pt-BR')
  expect(aberturas).toContainEqual(`showItemInFolder ${join(a.pasta, 'desktop', zip!)}`)

  // GitHub: issue nova pelo modelo de bug, com a etiqueta e o nome do arquivo para arrastar.
  await dialogo.getByRole('button', { name: 'Abrir no GitHub' }).click()
  await expect(dialogo.getByText(/A issue abriu no navegador/)).toBeVisible({ timeout: 60_000 })
  const issue = (await a.aberturas())
    .find((x) => x.startsWith('openExternal https://github.com/'))!
    .slice(13)
  expect(issue.startsWith('https://github.com/lipeventura777/hubsquare/issues/new?')).toBe(true)
  const qi = consulta(issue)
  expect(qi.get('template')).toBe('bug.yml')
  expect(qi.get('labels')).toBe('bug')
  expect(qi.get('oque')).toContain('O servidor não liga')
  expect(qi.get('relatorio')).toMatch(/HubSquare-relatorio-.*\.zip/)
  await expect(dialogo.getByRole('button', { name: 'Mostrar o arquivo' })).toBeVisible()

  // Sem programa de e-mail: o Windows recusa o mailto: e a tela mostra o endereço com Copiar.
  await a.app.evaluate(({ shell }) => {
    const anotar = shell.openExternal
    shell.openExternal = async (url: string, ...resto) => {
      if (url.startsWith('mailto:')) throw new Error('sem programa de e-mail')
      return anotar(url, ...resto)
    }
  })
  await dialogo.getByRole('combobox', { name: 'Tipo' }).click()
  await j.getByRole('option', { name: 'Sugestão' }).click()
  await expect(caixa).not.toBeChecked()
  await enviar.click()
  await expect(dialogo.getByText(/Não achamos um programa de e-mail/)).toBeVisible()
  await expect(dialogo.getByText('suporte.hubsquare@gmail.com')).toBeVisible()
  await expect(dialogo.getByRole('button', { name: 'Copiar' })).toBeVisible()
})
