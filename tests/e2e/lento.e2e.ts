import { existsSync, readdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { criarPeloAssistente, expect, pagina, test } from './apoio'

// Fluxo lento (@lento, npm run test:e2e:lento): Paper e Java de verdade (com cache em
// .teste/cache), liga o servidor, conversa pelo console e desliga com backup. Pasta de teste
// própria, como os outros.

const portaLivre = (porta: number): Promise<boolean> =>
  new Promise((ok) => {
    const s = createServer()
    s.once('error', () => ok(false))
    s.listen(porta, () => s.close(() => ok(true)))
  })

test('@lento baixa o Paper, liga, responde no console e desliga com backup', async ({ abrir }) => {
  expect(
    await portaLivre(25565),
    'a porta 25565 está em uso (um servidor de verdade ligado?): desligue-o antes deste teste'
  ).toBe(true)
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Lento', undefined, true)

  await pagina(j, 'Painel')
  await j.getByRole('button', { name: 'Ligar', exact: true }).click()
  const console_ = j.getByLabel('Console do servidor')
  // Pronto ou desligou sozinho: não espera os 5 min se o servidor caiu ao ligar.
  await expect(console_).toContainText(/Done \(|Servidor desligado/, { timeout: 5 * 60_000 })
  await expect(console_).toContainText(/Done \(/, { timeout: 1000 })

  const comando = j.getByLabel('Comando do servidor')
  await comando.fill('list')
  await comando.press('Enter')
  await expect(console_).toContainText(/There are 0 of a max/, { timeout: 30_000 })

  // Fase M5: "Testar tudo" do Painel com o servidor ligado de verdade. O túnel do playit.gg
  // (método padrão) não está configurado no teste: para aí, e o servidor aparece certo.
  await j.getByRole('button', { name: 'Testar tudo' }).click()
  const lista = j.getByRole('dialog').getByRole('list', { name: 'Resultado do diagnóstico' })
  await expect(lista.getByRole('listitem').filter({ hasText: 'Servidor ligado' })).toContainText(
    'Ligado e respondendo',
    { timeout: 30_000 }
  )
  await expect(
    lista.getByRole('listitem').filter({ hasText: 'Conexão (playit.gg)' })
  ).toContainText('ainda não foi vinculado')
  await expect(lista.getByRole('listitem').filter({ hasText: 'Acesso de fora' })).toContainText(
    'Não conferido'
  )
  await j.keyboard.press('Escape')

  await j.getByRole('button', { name: 'Desligar', exact: true }).click()
  await expect(j.getByRole('button', { name: 'Ligar', exact: true })).toBeVisible({
    timeout: 2 * 60_000
  })
  const backups = join(a.pasta, 'documents', 'ServSquare', 'backups', 'Servidor Lento')
  await expect
    .poll(
      () => (existsSync(backups) ? readdirSync(backups).filter((n) => n.endsWith('.zip')) : []),
      {
        timeout: 60_000
      }
    )
    .toHaveLength(1)
})
