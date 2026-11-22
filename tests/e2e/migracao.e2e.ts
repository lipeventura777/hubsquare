import { spawn, type ChildProcess } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { expect, prepararLauncherFalso, test } from './apoio'
import { MC } from './simulado'

// Fase E2: quem usava a 1.4.0 (pastas ServSquare) abre a versão nova e encontra tudo nas pastas
// HubSquare. Tudo dentro da pasta de teste (HUBSQUARE_DADOS), nunca nas pastas reais.

const SERVIDOR = 'Mundo Antigo'
const INSTALACAO = 'Jogo Antigo'
const ID_INSTALACAO = 'a'.repeat(32)
const lerJson = (f: string): Record<string, unknown> => JSON.parse(readFileSync(f, 'utf8'))
const antigos = (p: string): { dados: string; docs: string } => ({
  dados: join(p, 'appData', 'ServSquare'),
  docs: join(p, 'documents', 'ServSquare')
})
const novos = (p: string): { dados: string; docs: string } => ({
  dados: join(p, 'appData', 'HubSquare'),
  docs: join(p, 'documents', 'HubSquare')
})

// Uma pasta de dados como a 1.4.0 deixava: índices com caminhos absolutos, servsquare*.json nas
// pastas, backups e um perfil hubsquare-<id> no launcher apontando para Documentos\ServSquare.
function montar140(p: string): void {
  rmSync(novos(p).dados, { recursive: true, force: true }) // o apoio cria a nova; a 1.4.0 não tinha
  const { dados, docs } = antigos(p)
  const servidor = join(docs, 'servidores', SERVIDOR)
  const jogo = join(docs, 'jogo', INSTALACAO)
  for (const d of [dados, servidor, jogo, join(docs, 'backups', SERVIDOR)]) {
    mkdirSync(d, { recursive: true })
  }
  writeFileSync(join(dados, 'idioma.json'), '{"idioma":"pt-BR"}')
  writeFileSync(
    join(dados, 'servidores.json'),
    JSON.stringify({
      ativo: 's1',
      servidores: [{ id: 's1', nome: SERVIDOR, pasta: servidor, tipo: 'paper', versao: MC }]
    })
  )
  writeFileSync(
    join(dados, 'instalacoes.json'),
    JSON.stringify({
      ignorados: ['s1'],
      instalacoes: [
        {
          id: ID_INSTALACAO,
          nome: INSTALACAO,
          pasta: jogo,
          versao: MC,
          loader: 'vanilla',
          versaoLoader: null,
          ram: 4,
          origem: { tipo: 'zero' },
          criada: '2026-01-01',
          ultimoUso: null,
          arquivoImagem: null,
          fundo: null
        }
      ]
    })
  )
  writeFileSync(
    join(dados, 'ajustes-jogo.json'),
    JSON.stringify({ pastaInstalacoes: join(docs, 'jogo') })
  )
  writeFileSync(
    join(servidor, 'servsquare.json'),
    JSON.stringify({ nome: SERVIDOR, tipo: 'paper', versao: MC, java: 21 })
  )
  writeFileSync(join(servidor, 'servsquare-acoes.log'), '2026-11-01T10:00:00.000Z Backup feito\n')
  writeFileSync(join(servidor, 'server.properties'), 'motd=Antigo\n')
  writeFileSync(join(servidor, 'eula.txt'), 'eula=true\n')
  writeFileSync(join(docs, 'backups', SERVIDOR, 'servsquare-backups.json'), '{}')
  writeFileSync(join(jogo, 'options.txt'), 'lang:pt_br\n')

  prepararLauncherFalso(p)
  const arquivo = join(p, 'appData', '.minecraft', 'launcher_profiles.json')
  const perfis = lerJson(arquivo) as { profiles: Record<string, unknown> }
  perfis.profiles[`hubsquare-${ID_INSTALACAO}`] = {
    name: INSTALACAO,
    type: 'custom',
    lastVersionId: MC,
    gameDir: jogo,
    icon: 'Furnace'
  }
  writeFileSync(arquivo, JSON.stringify(perfis, null, 2))
}

// Tudo nas pastas novas, com os nomes novos e os caminhos reescritos.
async function conferirMigrado(p: string): Promise<void> {
  const { dados, docs } = novos(p)
  expect(existsSync(antigos(p).dados), 'a pasta de dados antiga foi movida').toBe(false)
  expect(existsSync(antigos(p).docs), 'Documentos\\ServSquare foi movida').toBe(false)
  const registro = lerJson(join(dados, 'migracao-hubsquare.json'))
  expect(registro.concluida).toBe(true)
  expect(registro.movido).toHaveLength(2)

  const servidor = join(docs, 'servidores', SERVIDOR)
  const jogo = join(docs, 'jogo', INSTALACAO)
  const indice = lerJson(join(dados, 'servidores.json')) as { servidores: { pasta: string }[] }
  expect(indice.servidores[0].pasta).toBe(servidor)
  const instalacoes = lerJson(join(dados, 'instalacoes.json')) as {
    instalacoes: { pasta: string }[]
  }
  expect(instalacoes.instalacoes[0].pasta).toBe(jogo)
  expect(lerJson(join(dados, 'ajustes-jogo.json')).pastaInstalacoes).toBe(join(docs, 'jogo'))

  expect(lerJson(join(servidor, 'hubsquare.json')).nome).toBe(SERVIDOR)
  expect(existsSync(join(servidor, 'servsquare.json'))).toBe(false)
  expect(readFileSync(join(servidor, 'hubsquare-acoes.log'), 'utf8')).toContain('Backup feito')
  expect(readFileSync(join(servidor, 'server.properties'), 'utf8')).toContain('motd=Antigo')
  expect(existsSync(join(docs, 'backups', SERVIDOR, 'hubsquare-backups.json'))).toBe(true)
  expect(readFileSync(join(jogo, 'options.txt'), 'utf8')).toContain('lang:pt_br')

  // O gameDir do perfil é corrigido pelo mesmo caminho do JOGAR (com backup); os outros perfis ficam.
  const arquivo = join(p, 'appData', '.minecraft', 'launcher_profiles.json')
  await expect
    .poll(
      () =>
        (lerJson(arquivo).profiles as Record<string, { gameDir?: string }>)[
          `hubsquare-${ID_INSTALACAO}`
        ].gameDir,
      { timeout: 30_000 }
    )
    .toBe(jogo)
  expect((lerJson(arquivo).profiles as Record<string, unknown>).antigo1).toBeTruthy()
  expect(existsSync(join(docs, 'backups', 'launcher'))).toBe(true)
  await expect
    .poll(() => lerJson(join(dados, 'migracao-hubsquare.json')).perfisPendentes)
    .toBe(false)
}

test('migração 1.4.0 → HubSquare: servidores, instalações, backups e gameDir', async ({
  abrir
}) => {
  const a = await abrir('app', montar140)
  const j = a.janela
  await expect(j.getByText(SERVIDOR).first()).toBeVisible()
  await conferirMigrado(a.pasta)
  await expect(j.locator('[data-aviso="migracao"]')).toHaveCount(0)

  await j.getByRole('tab', { name: 'PlaySquare' }).click()
  await j.locator('[data-indicador="Instalações"]').click()
  await expect(j.getByText(INSTALACAO).first()).toBeVisible()
})

test('migração que falha no meio deixa tudo como estava e termina na próxima abertura', async ({
  abrir
}) => {
  let trava: ChildProcess | null = null
  try {
    const a = await abrir('falha', (p) => {
      montar140(p)
      // Um processo com a pasta atual dentro de Documentos\ServSquare: o Windows não deixa
      // renomear a pasta (como um arquivo em uso). A pasta de dados já foi movida e volta.
      trava = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        cwd: join(antigos(p).docs, 'servidores'),
        stdio: 'ignore'
      })
    })
    const j = a.janela
    await expect(j.locator('[data-aviso="migracao"]')).toBeVisible()
    await expect(j.locator('[data-aviso="migracao"]')).toContainText('Nada foi apagado')
    // Esta sessão usa as pastas antigas: o servidor está lá.
    await expect(j.getByText(SERVIDOR).first()).toBeVisible()
    const { dados, docs } = antigos(a.pasta)
    expect(existsSync(join(dados, 'servidores.json'))).toBe(true)
    // As pastas ficam onde estavam; dentro delas, o arquivo do servidor ganha o nome novo (é o
    // que deixa o app achá-lo nesta sessão), com o mesmo conteúdo.
    const info = join(docs, 'servidores', SERVIDOR, 'hubsquare.json')
    expect(lerJson(info).nome).toBe(SERVIDOR)
    expect(readFileSync(join(docs, 'servidores', SERVIDOR, 'server.properties'), 'utf8')).toContain(
      'motd=Antigo'
    )
    expect(existsSync(novos(a.pasta).docs)).toBe(false)
    expect(existsSync(novos(a.pasta).dados)).toBe(false)
    expect(readFileSync(join(dados, 'logs', 'erros.log'), 'utf8')).toContain(
      'Migração para HubSquare'
    )
    await a.app.close()
    ;(trava as ChildProcess | null)?.kill()
    trava = null

    // Próxima abertura (a mesma pasta de dados, copiada): agora termina.
    const b = await abrir('segunda', (p) => {
      rmSync(novos(p).dados, { recursive: true, force: true })
      for (const nome of ['appData', 'documents', 'pf86']) {
        cpSync(join(a.pasta, nome), join(p, nome), { recursive: true })
      }
      // A cópia leva caminhos absolutos da primeira pasta de teste: passam a apontar para esta.
      const de = JSON.stringify(a.pasta).slice(1, -1)
      const para = JSON.stringify(p).slice(1, -1)
      const andar = (d: string): void => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const f = join(d, e.name)
          if (e.isDirectory()) andar(f)
          else if (e.name.endsWith('.json')) {
            writeFileSync(f, readFileSync(f, 'utf8').split(de).join(para))
          }
        }
      }
      andar(join(p, 'appData'))
      andar(join(p, 'documents'))
    })
    await expect(b.janela.getByText(SERVIDOR).first()).toBeVisible()
    await conferirMigrado(b.pasta)
    await expect(b.janela.locator('[data-aviso="migracao"]')).toHaveCount(0)
  } finally {
    ;(trava as ChildProcess | null)?.kill()
  }
})
