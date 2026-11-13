import { expect, portasEscutando, test } from './apoio'

// A medição das portas olha o processo principal de verdade (Fase M6): o processo que o
// Playwright abre é um intermediário, e medir nele dava sempre "nada escutando".
test('apoio: as portas medidas são as do processo principal do app', async ({ abrir }) => {
  const a = await abrir()
  await expect(a.janela.getByText('Bem-vindo ao HubSquare')).toBeVisible()
  const porta = await a.app.evaluate(async () => {
    const net = (process as unknown as { mainModule: NodeJS.Module }).mainModule.require('net')
    const s = net.createServer()
    await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok))
    ;(globalThis as Record<string, unknown>).__servidorDoTeste = s
    return (s.address() as { port: number }).port
  })
  expect(await portasEscutando(a)).toContain(porta)
})
