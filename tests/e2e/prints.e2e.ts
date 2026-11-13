import { type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, criarPeloAssistente, expect, pagina, test } from './apoio'
import { MC } from './simulado'

// Prints de cada tela principal nos cinco biomas (Fase V1), em .teste/prints-v1/. Servem para
// conferir o vidro e o contraste a olho; o teste falha se alguma tela der erro ao abrir.

const PASTA = join(__dirname, '..', '..', '.teste', 'prints-v1')
const BIOMAS = ['diaClaro', 'dia', 'noite', 'mar', 'nether'] as const

async function foto(j: Page, bioma: string, nome: string): Promise<void> {
  await j.waitForTimeout(400) // animação de entrada da tela
  await j.screenshot({ path: join(PASTA, `${bioma}-${nome}.png`) })
}

for (const bioma of BIOMAS) {
  test(`prints das telas no bioma ${bioma}`, async ({ abrir }) => {
    mkdirSync(PASTA, { recursive: true })
    const a = await abrir(bioma, (p) => {
      const dados = join(p, 'appData', 'ServSquare')
      mkdirSync(dados, { recursive: true })
      writeFileSync(join(dados, 'aparencia.json'), JSON.stringify({ bioma, vidroLeve: false }))
    })
    const j = a.janela
    await expect(j.locator('html')).toHaveAttribute('data-bioma', bioma)
    await foto(j, bioma, '01-assistente')
    await criarPeloAssistente(j, 'Servidor Bioma', MC)

    await foto(j, bioma, '02-painel')
    for (const [tela, n] of [
      ['Console', '03-console'],
      ['Mods', '04-mods'],
      ['Opções', '05-opcoes'],
      ['Cópias de segurança', '06-backups'],
      ['Conexão', '07-conexao']
    ] as const) {
      await pagina(j, tela)
      await foto(j, bioma, n)
    }
    // Lista flutuante (seleção de versão) e diálogo.
    await pagina(j, 'Software')
    await j.getByRole('combobox').first().click()
    await foto(j, bioma, '08-lista-flutuante')
    await j.keyboard.press('Escape')
    await j.getByRole('button', { name: 'Aparência' }).click()
    await foto(j, bioma, '09-aparencia')

    await area(j, 'PlaySquare')
    await pagina(j, 'Jogar')
    await foto(j, bioma, '10-jogar')
    await pagina(j, 'Instalações')
    await foto(j, bioma, '11-instalacoes')
    await j.getByRole('button', { name: 'Entrar com convite' }).click()
    await foto(j, bioma, '12-dialogo')
  })
}
