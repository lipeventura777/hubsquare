import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { amigoAceita, donoComConvite, expect, pagina, pastaServidor, test } from './apoio'
import { MC } from './simulado'

// Fase M4: ao aceitar o convite, o amigo pede para entrar na whitelist; o dono aprova.

const UUID = '069a79f4-44e9-4726-a5be-fca90e38aaf5' // da conta AmigoTeste no simulado da Mojang

test('pedido: o amigo pede ao aceitar o convite, o dono aprova e o nick entra na whitelist', async ({
  abrir
}) => {
  const { dono, texto } = await donoComConvite(abrir, MC)
  const amigo = await amigoAceita(abrir, texto, 'AmigoTeste', MC, 'Oi, posso entrar?')
  await expect(amigo.janela.getByText('Servidor Amigos').first()).toBeVisible({ timeout: 60_000 })
  // O nick fica lembrado para os próximos convites.
  const ajustes = JSON.parse(
    readFileSync(join(amigo.pasta, 'appData', 'ServSquare', 'ajustes-jogo.json'), 'utf8')
  )
  expect(ajustes.nick).toBe('AmigoTeste')

  // O dono recebe o aviso dentro do app e vê o pedido em Jogadores.
  await expect(dono.janela.getByText('pediu para entrar no servidor')).toBeVisible()
  await pagina(dono.janela, 'Jogadores')
  const lista = dono.janela.getByRole('list', { name: 'Pedidos para entrar' })
  await expect(lista).toContainText('AmigoTeste')
  await expect(lista).toContainText('Oi, posso entrar?')
  await lista.getByRole('button', { name: 'Aprovar' }).click()
  await expect(lista).toBeHidden()

  // Servidor desligado: o nick entra no whitelist.json com o UUID da conta.
  const whitelist = JSON.parse(
    readFileSync(join(pastaServidor(dono.pasta, 'Servidor Amigos'), 'whitelist.json'), 'utf8')
  )
  expect(whitelist).toContainEqual({ uuid: UUID, name: 'AmigoTeste' })

  // O amigo vê a resposta na tela Jogar (a rota de leitura só fala do UUID dele).
  await pagina(amigo.janela, 'Jogar')
  await amigo.janela.getByLabel('Instalação', { exact: true }).click()
  await amigo.janela.getByRole('option', { name: /Servidor Amigos/ }).click()
  await expect(amigo.janela.getByText('Aprovado: você está na whitelist')).toBeVisible({
    timeout: 30_000
  })
})

test('pedido: nick que não existe não cria a instalação nem manda pedido', async ({ abrir }) => {
  const { dono, texto } = await donoComConvite(abrir, MC)
  const amigo = await amigoAceita(abrir, texto, 'NinguemAqui123', MC)
  await expect(
    amigo.janela.getByText('Não existe conta do Minecraft com o nick "NinguemAqui123"').first()
  ).toBeVisible()
  const arquivoIndice = join(amigo.pasta, 'appData', 'ServSquare', 'instalacoes.json')
  const indice = existsSync(arquivoIndice)
    ? JSON.parse(readFileSync(arquivoIndice, 'utf8'))
    : { instalacoes: [] }
  expect(
    indice.instalacoes.some((i: { origem: { tipo: string } }) => i.origem.tipo === 'convite')
  ).toBe(false)
  expect(
    existsSync(join(pastaServidor(dono.pasta, 'Servidor Amigos'), 'servsquare-pedidos.json'))
  ).toBe(false)
})

test('pedido: segurança da rota (token, tamanho, caracteres, limite, repetido, bloqueio)', async ({
  abrir
}) => {
  const { dono, endereco, token } = await donoComConvite(abrir, MC)
  const url = (t: string, resto: string): string => `http://${endereco}/convite/${t}/${resto}`
  const post = (t: string, corpo: unknown): Promise<Response> =>
    fetch(url(t, 'pedido'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
    })
  const uuid = (n: number): string => n.toString(16).padStart(32, '0')

  // Token errado e corpo grande demais.
  expect((await post('ABCDEFGHJKLMNPQR', { nick: 'Ok_1', uuid: uuid(1) })).status).toBe(404)
  const grande = JSON.stringify({ nick: 'Ok_1', uuid: uuid(1), recado: 'x'.repeat(2000) })
  expect((await post(token, grande)).status).toBe(413)
  // Caracteres estranhos no nick e no recado, campo a mais e corpo que não é JSON.
  expect((await post(token, { nick: '<script>', uuid: uuid(1) })).status).toBe(400)
  expect((await post(token, { nick: 'a;op b', uuid: uuid(1) })).status).toBe(400)
  expect((await post(token, { nick: 'Ok_1', uuid: uuid(1), recado: 'a\nb' })).status).toBe(400)
  expect((await post(token, { nick: 'Ok_1', uuid: uuid(1), recado: 'bidi‮' })).status).toBe(400)
  expect((await post(token, { nick: 'Ok_1', uuid: uuid(1), comando: 'op Ok_1' })).status).toBe(400)
  expect((await post(token, 'nick=Ok_1')).status).toBe(400)

  // 20 pedidos guardados; UUID repetido não vira outro; o 21º é recusado.
  for (let i = 1; i <= 20; i++) {
    expect((await post(token, { nick: `Amigo_${i}`, uuid: uuid(i) })).status).toBe(200)
  }
  expect((await post(token, { nick: 'OutroNome', uuid: uuid(1) })).status).toBe(409)
  expect((await post(token, { nick: 'Amigo_21', uuid: uuid(21) })).status).toBe(400)
  const pedidos = JSON.parse(
    readFileSync(
      join(pastaServidor(dono.pasta, 'Servidor Amigos'), 'servsquare-pedidos.json'),
      'utf8'
    )
  )
  expect(pedidos.pendentes).toHaveLength(20)
  // Nada entrou na whitelist sem aprovação.
  const wl = join(pastaServidor(dono.pasta, 'Servidor Amigos'), 'whitelist.json')
  expect(existsSync(wl) ? JSON.parse(readFileSync(wl, 'utf8')) : []).toEqual([])

  // Leitura: responde só sobre o UUID perguntado.
  expect(await (await fetch(url(token, `pedido/${uuid(1)}`))).json()).toEqual({
    situacao: 'pendente'
  })
  expect(await (await fetch(url(token, `pedido/${uuid(99)}`))).json()).toEqual({
    situacao: 'desconhecido'
  })

  // 20 erros: o IP fica bloqueado (até o manifesto com o token certo responde 429).
  for (let i = 0; i < 20; i++) await post('ZZZZZZZZZZZZZZZZ', {})
  expect((await fetch(url(token, 'manifesto.json'))).status).toBe(429)
})
