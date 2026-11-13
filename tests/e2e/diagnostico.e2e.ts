import { type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  amigoAceita,
  criarPeloAssistente,
  donoComConvite,
  expect,
  pagina,
  test,
  type AppDeTeste
} from './apoio'
import { MC, servidorMinecraftFalso } from './simulado'

// Diagnóstico de conexão (Fase M5): o primeiro problema que impede a entrada, com o conserto.

const resultado = (j: Page): ReturnType<Page['getByRole']> =>
  j.getByRole('dialog').getByRole('list', { name: 'Resultado do diagnóstico' })

async function naoConsigoEntrar(amigo: AppDeTeste): Promise<ReturnType<Page['getByRole']>> {
  const j = amigo.janela
  await pagina(j, 'Jogar')
  await j.getByLabel('Instalação', { exact: true }).click()
  await j.getByRole('option', { name: /Servidor Amigos/ }).click()
  await j.getByRole('button', { name: 'Não consigo entrar' }).click()
  return resultado(j)
}

test('diagnóstico do dono: servidor desligado para no primeiro problema', async ({ abrir }) => {
  const { janela: j } = await abrir()
  await criarPeloAssistente(j, 'Servidor Teste', MC)
  await pagina(j, 'Conexão')
  await j.getByRole('button', { name: 'Testar tudo' }).click()
  const lista = resultado(j)
  await expect(lista).toContainText('O servidor está desligado')
  await expect(j.getByRole('dialog')).toContainText('O que impede a entrada: Servidor ligado.')
  await expect(lista.getByRole('button', { name: 'Ligar o servidor' })).toBeVisible()
  // As seguintes nem rodam.
  await expect(lista.getByRole('listitem').filter({ hasText: 'Acesso de fora' })).toContainText(
    'Não conferido'
  )
})

test('diagnóstico do amigo: servidor do dono desligado', async ({ abrir }) => {
  // Porta própria do teste, onde nada escuta: o servidor "desligado".
  const vazio = await servidorMinecraftFalso()
  const porta = vazio.porta
  await vazio.fechar()
  const { texto } = await donoComConvite(abrir, MC, porta)
  const amigo = await amigoAceita(abrir, texto, 'AmigoTeste', MC)
  await expect(amigo.janela.getByText('Servidor Amigos').first()).toBeVisible({ timeout: 60_000 })
  const lista = await naoConsigoEntrar(amigo)
  await expect(lista.getByRole('listitem').filter({ hasText: 'Internet' })).toContainText(
    'Este PC está na internet'
  )
  await expect(
    lista.getByRole('listitem').filter({ hasText: 'Servidor respondendo' })
  ).toContainText('não respondeu')
  await expect(amigo.janela.getByRole('dialog')).toContainText(
    'O que impede a entrada: Servidor respondendo.'
  )
})

test('diagnóstico do amigo: instalação desatualizada, depois nick não aprovado, depois tudo certo', async ({
  abrir
}) => {
  const jogo = await servidorMinecraftFalso()
  try {
    const { dono, texto } = await donoComConvite(abrir, MC, jogo.porta)
    const amigo = await amigoAceita(abrir, texto, 'AmigoTeste', MC)
    await expect(amigo.janela.getByText('Servidor Amigos').first()).toBeVisible({
      timeout: 60_000
    })
    const j = amigo.janela

    // 1) A instalação ainda não foi montada: conserto "Atualizar a instalação".
    let lista = await naoConsigoEntrar(amigo)
    await expect(
      lista.getByRole('listitem').filter({ hasText: 'Servidor respondendo' })
    ).toContainText('está ligado')
    const versao = lista.getByRole('listitem').filter({ hasText: 'Instalação atualizada' })
    await expect(versao).toContainText('ainda não foi montada')
    await versao.getByRole('button', { name: 'Atualizar a instalação' }).click()
    // O fluxo de sempre do ATUALIZAR: confirma os diálogos dele até a instalação ficar montada.
    const montada = (): boolean =>
      JSON.parse(
        readFileSync(join(amigo.pasta, 'appData', 'ServSquare', 'instalacoes.json'), 'utf8')
      ).instalacoes.some(
        (i: { origem: { tipo: string }; instaladaEm?: string }) =>
          i.origem.tipo === 'convite' && !!i.instaladaEm
      )
    const confirmar = j
      .getByRole('dialog')
      .getByRole('button', { name: /^(Atualizar e jogar|Não, começar do padrão|OK)$/ })
    await expect
      .poll(
        async () => {
          if (montada()) return true
          if (
            await confirmar
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            await confirmar
              .first()
              .click()
              .catch(() => {})
          }
          return false
        },
        { timeout: 60_000 }
      )
      .toBe(true)
    // Fecha o "Tudo pronto" que o fluxo mostra no fim, se ainda estiver aberto.
    if (
      await confirmar
        .first()
        .isVisible()
        .catch(() => false)
    )
      await confirmar.first().click()

    // 2) Instalada; agora o dono ainda não aprovou o nick.
    await j.getByRole('button', { name: 'Não consigo entrar' }).click()
    lista = resultado(j)
    const nick = lista.getByRole('listitem').filter({ hasText: 'Nick aprovado' })
    await expect(nick).toContainText('O dono ainda não aprovou o nick AmigoTeste', {
      timeout: 30_000
    })
    await j.keyboard.press('Escape')

    // 3) O dono aprova: nada mais impede a entrada.
    await pagina(dono.janela, 'Jogadores')
    await dono.janela
      .getByRole('list', { name: 'Pedidos para entrar' })
      .getByRole('button', { name: 'Aprovar' })
      .click()
    await j.getByRole('button', { name: 'Não consigo entrar' }).click()
    await expect(j.getByRole('dialog')).toContainText('Tudo certo: nada impede a entrada.', {
      timeout: 30_000
    })
  } finally {
    await jogo.fechar()
  }
})
