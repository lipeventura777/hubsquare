import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import {
  amigoAceita,
  donoComConvite,
  expect,
  pagina,
  pastaServidor,
  test,
  type AppDeTeste
} from './apoio'
import { MC } from './simulado'

// Passar o servidor (Fase M7): o dono exporta um .hubserver sem segredos, outro PC importa e
// hospeda (com os convites dele, que o PlaySquare do amigo reconhece como o mesmo servidor),
// muda o mundo e devolve; o original é atualizado com backup protegido antes, sem virar cópia.

const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
const NOME = 'Servidor Amigos'
const SEGREDOS = ['SEGREDO-RCON-123', 'SEGREDO-CONFIG-456']

const salvarEm = (a: AppDeTeste, caminho: string): Promise<void> =>
  a.app.evaluate(({ dialog }, c) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: c
    })) as unknown as typeof dialog.showSaveDialog
  }, caminho)

const lerJson = (f: string): Record<string, unknown> => JSON.parse(readFileSync(f, 'utf8'))

function arquivosDe(pasta: string): string[] {
  return readdirSync(pasta, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name))
}

async function passar(a: AppDeTeste, para: string, destino: string): Promise<void> {
  const j = a.janela
  await salvarEm(a, destino)
  await abrirServidores(j)
  await j.getByRole('button', { name: `Mais ações para ${NOME}` }).click()
  await j.getByRole('menuitem', { name: 'Passar para outro amigo…' }).click()
  const dialogo = j.getByRole('dialog')
  await expect(dialogo.getByText('não ligue este servidor aqui')).toBeVisible()
  await dialogo.getByLabel('Quem vai hospedar?').fill(para)
  await expect(dialogo.getByText('Vai no arquivo')).toBeVisible()
  await dialogo.getByRole('button', { name: 'Gerar arquivo .hubserver' }).click()
  await expect(dialogo.getByText(/Pronto:/)).toBeVisible({ timeout: 60_000 })
  await dialogo.getByRole('button', { name: 'Fechar' }).click()
  await expect(j.getByText(new RegExp(`Com ${para} desde`))).toBeVisible()
}

// A tela Servidores abre pelo nome do servidor ativo, no topo da barra lateral.
const abrirServidores = (j: Page): Promise<void> =>
  j.locator('button[title$="Ver todos os servidores"]').click()

// Convite numa porta própria do teste (como no donoComConvite).
async function convidar(j: Page): Promise<string> {
  await pagina(j, 'Conexão')
  await j.getByRole('tab', { name: 'Convites' }).click()
  const porta = String(20000 + Math.floor(Math.random() * 20000))
  const campo = j.getByLabel('Porta do convite (só leitura)')
  await expect(campo).toHaveValue('8788')
  await campo.fill(porta)
  await j.getByRole('button', { name: 'Salvar' }).click()
  await expect(campo).toHaveValue(porta)
  await j.getByRole('button', { name: 'Convidar amigos' }).click()
  const codigo = j.getByText('Código (para ditar ou colar)').locator('..').locator('code')
  await expect(codigo).toContainText(`:${porta}#`)
  return (await codigo.textContent())!.trim()
}

test('passar o servidor: sem segredos, outro PC hospeda, volta e atualiza o original', async ({
  abrir
}) => {
  test.setTimeout(8 * 60_000)
  const { dono, texto, token } = await donoComConvite(abrir, MC)
  const amigo = await amigoAceita(abrir, texto, 'AmigoTeste', MC)
  const indiceAmigo = join(amigo.pasta, 'appData', 'ServSquare', 'instalacoes.json')
  const instalacoes = (): { origem: { token: string; enderecos: string[] } }[] =>
    existsSync(indiceAmigo) ? (lerJson(indiceAmigo).instalacoes as never) : []
  await expect.poll(() => instalacoes().length).toBe(1)

  // Mundo, segredos, caminhos deste PC e um plugin (.jar) no servidor do dono.
  const pastaA = pastaServidor(dono.pasta, NOME)
  mkdirSync(join(pastaA, 'world', 'region'), { recursive: true })
  writeFileSync(join(pastaA, 'world', 'level.dat'), 'nivel-original')
  writeFileSync(join(pastaA, 'world', 'region', 'r.0.0.mca'), 'regiao-original')
  appendFileSync(
    join(pastaA, 'server.properties'),
    `\nrcon.password=${SEGREDOS[0]}\nserver-ip=192.168.0.77\n`
  )
  mkdirSync(join(pastaA, 'config'))
  writeFileSync(join(pastaA, 'config', 'bom.json'), '{"distancia": 8}')
  writeFileSync(join(pastaA, 'config', 'senha.yml'), `banco:\n  password: ${SEGREDOS[1]}\n`)
  writeFileSync(join(pastaA, 'config', 'caminho.yml'), `mapa: ${pastaA.replace(/\\/g, '/')}/mapa`)
  mkdirSync(join(pastaA, 'plugins', 'MeuPlugin'), { recursive: true })
  writeFileSync(join(pastaA, 'plugins', 'meu-plugin.jar'), 'jar falso')
  writeFileSync(join(pastaA, 'plugins', 'MeuPlugin', 'config.yml'), 'ativo: true')

  // 1. O dono passa para a Bia.
  const ida = join(dono.pasta, 'ida.hubserver')
  await passar(dono, 'Bia', ida)
  const infoA = lerJson(join(pastaA, 'servsquare.json'))
  expect(infoA.emprestado).toMatchObject({ com: 'Bia' })

  // O arquivo não leva segredo, token, caminho deste PC, .jar nem os arquivos do app.
  const aberto = join(dono.pasta, 'aberto')
  mkdirSync(aberto)
  execFileSync(TAR, ['-xf', ida, '-C', aberto])
  const proibidos = [
    ...SEGREDOS,
    token,
    pastaA,
    pastaA.replace(/\\/g, '/'),
    dono.pasta,
    homedir(),
    homedir().replace(/\\/g, '/'),
    '192.168.0.77'
  ]
  for (const f of arquivosDe(aberto)) {
    expect(f, 'nenhum .jar no pacote').not.toMatch(/\.jar$/i)
    const conteudo = readFileSync(f, 'latin1')
    for (const p of proibidos) expect(conteudo, `${f} não pode ter ${p}`).not.toContain(p)
  }
  expect(existsSync(join(aberto, 'world', 'level.dat'))).toBe(true)
  expect(existsSync(join(aberto, 'config', 'bom.json'))).toBe(true)
  expect(existsSync(join(aberto, 'plugins', 'MeuPlugin', 'config.yml'))).toBe(true)
  for (const fora of [
    'config/senha.yml',
    'config/caminho.yml',
    'servsquare.json',
    'servsquare-convite.json',
    'eula.txt'
  ])
    expect(existsSync(join(aberto, fora)), `${fora} fica no PC`).toBe(false)
  const pacote = lerJson(join(aberto, 'hubserver.json'))
  expect(pacote.idFixo).toBe(infoA.idFixo)
  expect(pacote.semLink).toEqual(['meu-plugin.jar'])
  expect(readFileSync(join(aberto, 'server.properties'), 'utf8')).toMatch(/^rcon\.password=$/m)

  // Ligar aqui pede confirmação enquanto a Bia hospeda.
  await dono.janela.getByRole('button', { name: `Ligar ${NOME}` }).click()
  await expect(dono.janela.getByText(/Este servidor está com Bia desde/).first()).toBeVisible()
  await expect(dono.janela.getByRole('button', { name: 'Ligar mesmo assim' })).toBeVisible()

  // 2. A Bia (outro PC, sem servidores) recebe pelo assistente: vira um servidor dela.
  const bia = await abrir('bia')
  const jb = bia.janela
  await jb.getByRole('button', { name: /Vou hospedar servidores/ }).click()
  await expect(jb.getByText('Que tipo de servidor?')).toBeVisible()
  await bia.escolherArquivo(ida)
  await jb.getByRole('button', { name: 'Receber servidor (.hubserver)' }).click()
  const receber = jb.getByRole('dialog')
  await expect(receber).toContainText('meu-plugin.jar')
  await expect(receber.getByLabel('Nome do servidor')).toHaveValue(NOME)
  await receber.locator('label', { hasText: 'Li e aceito o' }).click({ position: { x: 6, y: 16 } })
  await expect(receber.getByRole('checkbox', { name: /Li e aceito o/ })).toBeChecked()
  await receber.getByRole('button', { name: 'Criar servidor' }).click()
  await expect(jb.getByRole('tab', { name: 'ServSquare' })).toBeVisible({ timeout: 3 * 60_000 })
  const pastaB = pastaServidor(bia.pasta, NOME)
  expect(lerJson(join(pastaB, 'servsquare.json')).idFixo).toBe(infoA.idFixo)
  expect(readFileSync(join(pastaB, 'world', 'level.dat'), 'utf8')).toBe('nivel-original')
  expect(readFileSync(join(pastaB, 'eula.txt'), 'utf8')).toMatch(/eula=true/)
  expect(existsSync(join(pastaB, 'servsquare-convite.json'))).toBe(false)

  // 3. A Bia convida; o amigo entra com o convite dela e a instalação continua a mesma.
  const textoBia = await convidar(jb)
  const aj = amigo.janela
  await pagina(aj, 'Instalações')
  await aj.getByRole('button', { name: 'Entrar com convite' }).click()
  await aj.getByLabel('Código ou link do convite').fill(textoBia)
  await aj.getByLabel('Seu nick no Minecraft').fill('AmigoTeste')
  await aj.getByRole('dialog').getByRole('button', { name: 'Entrar' }).click()
  const tokenBia = textoBia.split('#')[1].replace(/-/g, '').toUpperCase()
  await expect.poll(() => instalacoes().map((i) => i.origem.token)).toEqual([tokenBia])
  expect(instalacoes()[0].origem.enderecos).toEqual([textoBia.split('#')[0]])

  // 4. A Bia joga (o mundo muda) e devolve.
  writeFileSync(join(pastaB, 'world', 'level.dat'), 'nivel-mudado-pela-bia')
  writeFileSync(join(pastaB, 'world', 'region', 'r.1.0.mca'), 'regiao-nova')
  const volta = join(bia.pasta, 'volta.hubserver')
  await passar(bia, 'Ana', volta)

  // 5. O dono recebe: é o mesmo servidor, então atualiza o dele (backup protegido antes).
  const j = dono.janela
  await dono.escolherArquivo(volta)
  await abrirServidores(j)
  await j.getByRole('button', { name: 'Receber servidor (.hubserver)' }).click()
  const voltou = j.getByRole('dialog')
  await expect(voltou).toContainText(`Esse é o seu servidor ${NOME}, que voltou.`)
  await expect(
    voltou.getByRole('radio', { name: /Atualizar o meu servidor com este mundo/ })
  ).toBeChecked()
  await voltou.getByRole('button', { name: 'Fazer backup e atualizar' }).click()
  await expect(j.getByText(/Com Bia desde/)).toHaveCount(0, { timeout: 60_000 })

  expect(readFileSync(join(pastaA, 'world', 'level.dat'), 'utf8')).toBe('nivel-mudado-pela-bia')
  expect(existsSync(join(pastaA, 'world', 'region', 'r.1.0.mca'))).toBe(true)
  // O que só vale neste PC continua: a senha do RCON e a config com segredo.
  expect(readFileSync(join(pastaA, 'server.properties'), 'utf8')).toContain(
    `rcon.password=${SEGREDOS[0]}`
  )
  expect(existsSync(join(pastaA, 'config', 'senha.yml'))).toBe(true)
  expect(lerJson(join(pastaA, 'servsquare.json')).emprestado).toBeUndefined()
  // Não virou cópia: um servidor só.
  const indiceA = lerJson(join(dono.pasta, 'appData', 'ServSquare', 'servidores.json'))
  expect((indiceA.servidores as unknown[]).length).toBe(1)
  // Backup protegido, com o mundo de antes.
  const backups = join(dono.pasta, 'documents', 'ServSquare', 'backups', NOME)
  const meta = lerJson(join(backups, 'servsquare-backups.json')) as Record<
    string,
    { tipo?: string; protegido?: boolean }
  >
  const [nomeBackup, m] = Object.entries(meta).find(([, v]) => v.tipo === 'atualizar')!
  expect(m.protegido).toBe(true)
  const lista = execFileSync(TAR, ['-tf', join(backups, nomeBackup)], { encoding: 'utf8' })
  expect(lista).toContain('world/level.dat')
  expect(
    execFileSync(TAR, ['-xOf', join(backups, nomeBackup), 'world/level.dat'], { encoding: 'utf8' })
  ).toBe('nivel-original')
})
