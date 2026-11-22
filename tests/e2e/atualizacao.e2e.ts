import { createHash } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './apoio'

// Fase L1: atualização automática com um servidor de atualização local (o simulado), sem tocar no
// GitHub. O release v99.0.0 tem o latest.yml, o instalador e as novidades: o app baixa em
// segundo plano (para a pasta de teste, nunca a %LOCALAPPDATA% real) e mostra "Versão 99.0.0
// pronta". Ninguém clica em "Reiniciar e atualizar": o instalador do teste não é um programa.

const REPO = 'lipeventura777/hubsquare'
const VERSAO = '99.0.0'
const INSTALADOR = `HubSquare-Setup-${VERSAO}.exe`

test('atualização: baixa a versão nova do servidor local e avisa que está pronta', async ({
  abrir,
  simulado
}) => {
  const bytes = Buffer.from('instalador de teste da versão 99'.repeat(100))
  const sha512 = createHash('sha512').update(bytes).digest('base64')
  simulado!.responder(`api.github.com/repos/${REPO}/releases/latest`, () => ({
    json: {
      tag_name: `v${VERSAO}`,
      html_url: `https://github.com/${REPO}/releases/tag/v${VERSAO}`,
      body: '## Novidades\n- Atualização automática',
      draft: false,
      prerelease: false
    }
  }))
  simulado!.responder(`github.com/${REPO}/releases/latest/download/latest.yml`, () => ({
    bytes: Buffer.from(
      [
        `version: ${VERSAO}`,
        'files:',
        `  - url: ${INSTALADOR}`,
        `    sha512: ${sha512}`,
        `    size: ${bytes.length}`,
        `path: ${INSTALADOR}`,
        `sha512: ${sha512}`,
        "releaseDate: '2026-11-21T00:00:00.000Z'"
      ].join('\n')
    )
  }))
  simulado!.responder(`github.com/${REPO}/releases/latest/download/${INSTALADOR}`, () => ({
    bytes
  }))

  const a = await abrir()
  const j = a.janela
  const aviso = j.getByRole('status').filter({ hasText: `Versão ${VERSAO} pronta` })
  await expect(aviso).toBeVisible({ timeout: 60_000 })
  await expect(aviso.getByRole('button', { name: 'Reiniciar e atualizar' })).toBeEnabled()
  await expect(aviso.getByRole('button', { name: 'Ao fechar' })).toBeVisible()
  await expect(aviso.getByRole('button', { name: 'Pular esta versão' })).toBeVisible()

  // Ver novidades: o texto do release (o CHANGELOG da versão).
  await expect(aviso.getByText('Atualização automática')).toHaveCount(0)
  await aviso.getByRole('button', { name: 'Ver novidades' }).click()
  await expect(aviso.getByText('Atualização automática')).toBeVisible()

  // O instalador baixado fica na pasta de teste, conferido pelo sha512.
  const cache = join(a.pasta, 'localAppData')
  const baixados = existsSync(cache) ? readdirSync(cache, { recursive: true }).map(String) : []
  expect(baixados.some((n) => n.endsWith(INSTALADOR))).toBe(true)

  // "Ao fechar": o aviso some (instala quando o app sair).
  await aviso.getByRole('button', { name: 'Ao fechar' }).click()
  await expect(aviso).toHaveCount(0)
})
