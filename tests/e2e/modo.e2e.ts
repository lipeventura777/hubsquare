import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  area,
  criarPeloAssistente,
  expect,
  pagina,
  pastaServidor,
  portasEscutando,
  test
} from './apoio'
import { MC } from './simulado'

// Modo amigo (Fase M6): só o PlaySquare e nenhum serviço do ServSquare escutando a rede.

const modoSalvo = (pasta: string): unknown =>
  JSON.parse(readFileSync(join(pasta, 'appData', 'ServSquare', 'modo-app.json'), 'utf8')).modo

test('modo amigo: primeira abertura, só o PlaySquare, nada escutando e fechar sai do app', async ({
  abrir
}) => {
  const a = await abrir()
  const j = a.janela
  await expect(j.getByText('Bem-vindo ao HubSquare')).toBeVisible()
  // Linha de base: nas boas-vindas nada do app ligou (as portas que sobram são as do Playwright,
  // que controla o Electron no teste).
  const base = await portasEscutando(a)
  await j.getByRole('button', { name: /Só vou jogar com amigos/ }).click()

  // Só o PlaySquare: sem a troca Serv/Play e sem o assistente de servidor.
  await expect(j.locator('[data-indicador="Jogar"]')).toBeVisible()
  await expect(j.getByRole('tab', { name: 'ServSquare' })).toHaveCount(0)
  await expect(j.getByText('Que tipo de servidor?')).toHaveCount(0)
  expect(modoSalvo(a.pasta)).toBe('amigo')

  // Nenhum serviço do ServSquare escutando (nem a 8788 do convite, nem o painel do celular).
  const portas = await portasEscutando(a)
  expect(portas.sort()).toEqual(base.sort())
  expect(portas).not.toContain(8788)
  expect(portas).not.toContain(8787)

  // Fechar a janela, sem nada rodando, fecha o app de verdade (não vai para a bandeja).
  const fechou = a.app.waitForEvent('close')
  await a.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await fechou
})

test('modo amigo: aberto por um convite, sugere o amigo e o convite já vem colado', async ({
  abrir
}) => {
  const link = 'hubsquare://convite/eyJ0ZXN0ZSI6MX0'
  const a = await abrir('app', undefined, [link])
  const j = a.janela
  await expect(j.getByText('Você abriu um convite')).toBeVisible()
  await expect(
    j.getByRole('button', { name: /Só vou jogar com amigos/ }).getByText('sugerido')
  ).toBeVisible()
  await j.getByRole('button', { name: /Só vou jogar com amigos/ }).click()
  await expect(j.getByRole('dialog')).toContainText('Entrar com convite')
  await expect(j.getByLabel('Código ou link do convite')).toHaveValue(link)
})

test('modo: trocar para o completo e voltar, sem perder o servidor', async ({ abrir }) => {
  const a = await abrir()
  const j = a.janela
  await expect(j.getByText('Bem-vindo ao HubSquare')).toBeVisible()
  const base = await portasEscutando(a)
  await j.getByRole('button', { name: /Só vou jogar com amigos/ }).click()
  await pagina(j, 'Ajustes do jogo')
  await j.getByRole('button', { name: 'Também quero hospedar servidores' }).click()
  // Completo e sem servidores: o assistente de sempre.
  await criarPeloAssistente(j, 'Servidor Volta', MC)
  expect(modoSalvo(a.pasta)).toBe('completo')

  // No completo, o convite escuta (porta própria do teste).
  await pagina(j, 'Conexão')
  await j.getByRole('tab', { name: 'Convites' }).click()
  const porta = 20000 + Math.floor(Math.random() * 20000)
  const campo = j.getByLabel('Porta do convite (só leitura)')
  await expect(campo).toHaveValue('8788')
  await campo.fill(String(porta))
  await j.getByRole('button', { name: 'Salvar' }).click()
  await j.getByRole('button', { name: 'Convidar amigos' }).click()
  await expect(j.getByText('Código (para ditar ou colar)')).toBeVisible()
  await expect.poll(() => portasEscutando(a)).toContain(porta)

  // Volta ao amigo: some o ServSquare e o convite para de escutar; nada é apagado.
  await area(j, 'PlaySquare')
  await pagina(j, 'Ajustes do jogo')
  await j.getByRole('button', { name: 'Usar só o PlaySquare (modo amigo)' }).click()
  await expect(j.getByRole('tab', { name: 'ServSquare' })).toHaveCount(0)
  await expect.poll(async () => (await portasEscutando(a)).sort()).toEqual(base.sort())
  expect(modoSalvo(a.pasta)).toBe('amigo')
  const servidor = pastaServidor(a.pasta, 'Servidor Volta')
  expect(existsSync(join(servidor, 'servsquare.json'))).toBe(true)
  expect(existsSync(join(servidor, 'servsquare-convite.json'))).toBe(true)
})
