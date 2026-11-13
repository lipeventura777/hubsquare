import { type Page } from '@playwright/test'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import {
  amigoAceita,
  area,
  criarPeloAssistente as assistente,
  donoComConvite,
  expect,
  pagina,
  pastaServidor,
  prepararLauncherFalso,
  test
} from './apoio'
import { arquivosFalsos, MC } from './simulado'

// Fluxos rápidos (Fase M3): sem internet, cada um numa pasta de teste nova.

const criarPeloAssistente = (j: Page, nome: string): Promise<void> => assistente(j, nome, MC)

test('abre e troca entre ServSquare e PlaySquare', async ({ abrir }) => {
  const { janela: j } = await abrir()
  // Na primeira abertura só existe o assistente; as áreas aparecem com um servidor criado.
  await criarPeloAssistente(j, 'Servidor Teste')
  await area(j, 'PlaySquare')
  await expect(j.getByRole('tab', { name: 'PlaySquare' })).toHaveAttribute('aria-selected', 'true')
  await area(j, 'ServSquare')
  await expect(j.getByRole('tab', { name: 'ServSquare' })).toHaveAttribute('aria-selected', 'true')
})

test('cria um servidor Paper pelo assistente', async ({ abrir }) => {
  const a = await abrir()
  await criarPeloAssistente(a.janela, 'Servidor Teste')
  const pasta = pastaServidor(a.pasta, 'Servidor Teste')
  const info = JSON.parse(readFileSync(join(pasta, 'servsquare.json'), 'utf8'))
  expect(info).toMatchObject({ nome: 'Servidor Teste', tipo: 'paper', versao: MC, java: 21 })
  expect(readFileSync(join(pasta, 'eula.txt'), 'utf8')).toContain('eula=true')
  expect(existsSync(join(pasta, 'server.jar'))).toBe(true)
  expect(existsSync(join(a.pasta, 'appData', 'ServSquare', 'java', '21', 'bin', 'java.exe'))).toBe(
    true
  )
  // O servidor novo vira o ativo: o cartão da barra lateral mostra o nome.
  await expect(a.janela.getByText('Servidor Teste').first()).toBeVisible()
})

test('apaga um plugin e desfaz', async ({ abrir }) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Mods')
  const plugins = join(pastaServidor(a.pasta, 'Servidor Mods'), 'plugins')
  mkdirSync(plugins, { recursive: true })
  copyFileSync(arquivosFalsos().caminhoPlugin, join(plugins, 'PluginDeTeste-1.0.0.jar'))

  await pagina(j, 'Mods')
  await j.getByRole('tab', { name: 'Instalados' }).click()
  // Jar posto à mão (não instalado pelo app) aparece em "Outros".
  await j.getByRole('tab', { name: /^Outros/ }).click()
  await j.getByRole('button', { name: 'Remover', exact: true }).first().click()
  await j.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true }).click()
  await expect(j.getByRole('button', { name: 'Desfazer' })).toBeVisible()
  expect(existsSync(join(plugins, 'PluginDeTeste-1.0.0.jar'))).toBe(false)

  await j.getByRole('button', { name: 'Desfazer' }).click()
  await expect.poll(() => existsSync(join(plugins, 'PluginDeTeste-1.0.0.jar'))).toBe(true)
})

test('backup antes de trocar o software e restaurar', async ({ abrir }) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Backup')
  // Um mundo pequeno (o servidor nunca liga no teste rápido).
  const mundo = join(pastaServidor(a.pasta, 'Servidor Backup'), 'world')
  mkdirSync(mundo, { recursive: true })
  writeFileSync(join(mundo, 'level.dat'), 'nivel falso')
  writeFileSync(join(mundo, 'marcador.txt'), 'original')

  await pagina(j, 'Software')
  await j.getByRole('button', { name: /^Vanilla/ }).click()
  await j.getByRole('button', { name: `Trocar para Vanilla ${MC}` }).click()
  await j.getByRole('dialog').getByRole('button', { name: 'Trocar', exact: true }).click()
  await expect(j.getByRole('dialog')).toBeHidden({ timeout: 60_000 })

  writeFileSync(join(mundo, 'marcador.txt'), 'mudou depois do backup')
  await pagina(j, 'Cópias de segurança')
  await j.getByRole('button', { name: 'Restaurar', exact: true }).first().click()
  await j.getByRole('dialog').getByRole('button', { name: 'Restaurar', exact: true }).click()
  await expect
    .poll(() => readFileSync(join(mundo, 'marcador.txt'), 'utf8'), { timeout: 30_000 })
    .toBe('original')
})

test('JOGAR abre só o launcher simulado, com o perfil novo e os antigos intactos', async ({
  abrir
}) => {
  let perfisAntes: Record<string, unknown> = {}
  const a = await abrir('dono', (p) => (perfisAntes = prepararLauncherFalso(p)))
  const j = a.janela
  await criarPeloAssistente(j, 'Servidor Jogar')
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  await j.getByRole('button', { name: /^(JOGAR|ATUALIZAR E JOGAR)$/ }).click()
  await expect(
    j.getByText(/Clique em JOGAR no launcher: a instalação Servidor Jogar já está selecionada/)
  ).toBeVisible({ timeout: 60_000 })

  expect((await a.aberturas()).some((t) => /MinecraftLauncher\.exe$/i.test(t))).toBe(true)
  const perfis = JSON.parse(
    readFileSync(join(a.pasta, 'appData', '.minecraft', 'launcher_profiles.json'), 'utf8')
  )
  const antes = (perfisAntes as { profiles: Record<string, unknown> }).profiles
  for (const k of Object.keys(antes)) expect(perfis.profiles[k]).toEqual(antes[k])
  const novo = Object.entries(
    perfis.profiles as Record<string, { name: string; lastVersionId: string; gameDir: string }>
  ).find(([k]) => k.startsWith('hubsquare-'))
  expect(novo?.[1]).toMatchObject({ name: 'Servidor Jogar', lastVersionId: MC })
  // O servidor no topo da lista de Multijogador da instalação.
  const dat = readFileSync(join(novo![1].gameDir, 'servers.dat'))
  expect(dat.includes(Buffer.from('localhost:25565'))).toBe(true)
})

test('cria servidor a partir de um modpack pequeno (.mrpack)', async ({ abrir }) => {
  const a = await abrir()
  const j = a.janela
  await criarPeloAssistente(j, 'Primeiro')
  await j.getByText('Primeiro').first().click()
  await j.getByRole('button', { name: 'Criar servidor' }).click()
  await j.getByText('A partir de um modpack').click()
  await a.escolherArquivo(arquivosFalsos().caminhoMrpack)
  await j.getByRole('button', { name: 'Abrir arquivo .mrpack' }).click()
  await expect(j.getByText('Pack de Teste').first()).toBeVisible({ timeout: 60_000 })
  const eula = j.getByRole('checkbox', { name: /Li e aceito o/ })
  for (let i = 0; i < 5 && !(await eula.count()); i++) {
    await j.getByRole('button', { name: 'Próximo' }).click()
  }
  await eula.check({ force: true })
  await j.getByRole('button', { name: 'Criar servidor' }).click()
  await expect(j.getByText('Tudo pronto!')).toBeVisible({ timeout: 90_000 })

  const servidores = join(a.pasta, 'documents', 'ServSquare', 'servidores')
  const pasta = readdirSync(servidores)
    .map((n) => join(servidores, n))
    .find((p) => existsSync(join(p, 'servsquare-modpack.json')))!
  expect(existsSync(join(pasta, 'mods', 'mod-de-teste-1.0.0.jar'))).toBe(true)
  expect(readFileSync(join(pasta, 'config', 'pack-de-teste.txt'), 'utf8')).toBe(
    'configuração do pack'
  )
  expect(JSON.parse(readFileSync(join(pasta, 'servsquare.json'), 'utf8'))).toMatchObject({
    tipo: 'fabric',
    versao: MC
  })
})

test('convite: o dono convida e o amigo, em outra instância, entra', async ({ abrir }) => {
  const { texto } = await donoComConvite(abrir, MC)
  const amigo = await amigoAceita(abrir, texto, 'AmigoTeste', MC)
  await expect(amigo.janela.getByText('Servidor Amigos').first()).toBeVisible({ timeout: 60_000 })

  const indice = JSON.parse(
    readFileSync(join(amigo.pasta, 'appData', 'ServSquare', 'instalacoes.json'), 'utf8')
  )
  const inst = indice.instalacoes.find(
    (i: { origem: { tipo: string } }) => i.origem.tipo === 'convite'
  )
  expect(inst).toMatchObject({ nome: 'Servidor Amigos', versao: MC })
  expect(existsSync(inst.pasta)).toBe(true)
})

test('aparência: migra o tema antigo, troca o bioma, vidro leve e banner por instalação', async ({
  abrir
}) => {
  // Preferências de antes da Fase V1: tema claro, cor padrão antiga e uma cor própria no Play.
  const a = await abrir('app', (p) => {
    const dados = join(p, 'appData', 'ServSquare')
    mkdirSync(dados, { recursive: true })
    writeFileSync(
      join(dados, 'aparencia.json'),
      JSON.stringify({
        tema: 'claro',
        destaque: '#3c8527',
        destaquePlay: '#c42b2b',
        escurecimento: 0.5,
        fundo: null,
        fundoEmTodoApp: false,
        reduzirAnimacoes: true
      })
    )
  })
  const j = a.janela
  const arquivo = join(a.pasta, 'appData', 'ServSquare', 'aparencia.json')
  const salvo = (): Record<string, unknown> => JSON.parse(readFileSync(arquivo, 'utf8'))
  await expect(j.locator('html')).toHaveAttribute('data-bioma', 'diaClaro')
  expect(salvo()).toMatchObject({
    bioma: 'diaClaro',
    destaque: null,
    destaquePlay: '#c42b2b',
    reduzirAnimacoes: true
  })

  await criarPeloAssistente(j, 'Servidor Visual')
  await j.getByRole('button', { name: 'Aparência' }).click()
  await j.getByRole('radio', { name: 'Nether' }).click()
  await expect(j.locator('html')).toHaveAttribute('data-bioma', 'nether')
  await expect.poll(() => salvo().bioma).toBe('nether')

  await j.getByRole('switch', { name: 'Vidro leve' }).click()
  await expect(j.locator('html')).toHaveAttribute('data-vidro-leve', '')
  await expect.poll(() => salvo().vidroLeve).toBe(true)

  // Bioma próprio no banner da instalação do servidor (PlaySquare › Jogar › Fundo).
  await area(j, 'PlaySquare')
  await pagina(j, 'Jogar')
  await j.getByRole('button', { name: 'Fundo' }).click()
  await j.getByRole('menuitem', { name: 'Bioma Noite nesta instalação' }).click()
  const indice = join(a.pasta, 'appData', 'ServSquare', 'instalacoes.json')
  await expect
    .poll(() => JSON.parse(readFileSync(indice, 'utf8')).instalacoes[0].bannerBioma)
    .toBe('noite')
})
