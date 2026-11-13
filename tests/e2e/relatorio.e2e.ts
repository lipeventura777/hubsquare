import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { donoComConvite, expect, pagina, pastaServidor, test } from './apoio'
import { MC } from './simulado'

// Relatório de erro (Fase M8): segredos falsos plantados em todo canto não podem aparecer no .zip;
// mundos e arquivos de mods não vão; o npm run ler-relatorio resume o arquivo.

const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
const RAIZ = join(__dirname, '..', '..')

test('relatório de erro: sem nenhum segredo plantado, sem mundo nem mod, e o ler-relatorio resume', async ({
  abrir
}) => {
  const { dono, token } = await donoComConvite(abrir, MC)
  const j = dono.janela
  const dados = join(dono.pasta, 'appData', 'ServSquare')
  const servidor = pastaServidor(dono.pasta, 'Servidor Amigos')

  // Segredos deste PC (valores falsos, nos arquivos de verdade do app).
  const pinHash = 'f00dfeedc0ffee1234567890abcdef'
  const pinSalt = 'sal-secreto-9876'
  const sessao = 'cookie-de-sessao-abcdef123456'
  const chaveCf = 'Q0ZfRkFLRV9DSEFWRV9DSUZSQURB'
  const playit = 'segredo-do-playit-0123456789'
  writeFileSync(
    join(dados, 'celular.json'),
    JSON.stringify({
      ativo: false,
      porta: 8787,
      pin: { salt: pinSalt, hash: pinHash },
      sessoes: [{ id: sessao, criada: Date.now(), aparelho: 'Celular' }]
    })
  )
  writeFileSync(join(dados, 'curseforge.json'), JSON.stringify({ chave: chaveCf }))
  mkdirSync(join(dados, 'playit'), { recursive: true })
  writeFileSync(join(dados, 'playit', 'chave-secreta'), playit)

  // Os mesmos segredos (e outros) vazando nos logs, como num app com bug.
  const ipPublico = '187.45.10.20'
  const senhaRcon = 'senha-do-rcon-555'
  mkdirSync(join(dados, 'logs'), { recursive: true })
  appendFileSync(
    join(dados, 'logs', 'erros.log'),
    [
      `[2026-11-13T10:00:00.000Z] Error: algo antigo`,
      `[2026-11-13T11:00:00.000Z] Error: Falha plantada no teste`,
      `    at C:\\Users\\${homedir().split(/[\\/]/).pop()}\\x.js`,
      `    pasta ${homedir()}\\AppData\\Roaming\\ServSquare`,
      `    pin hash ${pinHash} salt ${pinSalt}`,
      `    Cookie: hs=${sessao}`,
      `    chave ${chaveCf} playit ${playit} convite ${token}`,
      `    ip ${ipPublico}`,
      ''
    ].join('\n')
  )
  mkdirSync(join(servidor, 'logs'), { recursive: true })
  writeFileSync(
    join(servidor, 'logs', 'latest.log'),
    `[10:00:00] [Server thread/ERROR]: Erro plantado no servidor\nAuthorization: Bearer abc.def.ghi\nrcon.password=${senhaRcon}\n`
  )
  appendFileSync(join(servidor, 'server.properties'), `\nrcon.password=${senhaRcon}\n`)
  mkdirSync(join(servidor, 'crash-reports'), { recursive: true })
  writeFileSync(
    join(servidor, 'crash-reports', 'crash-2026-11-13_11.00.00-server.txt'),
    `Description: Exception in server tick loop\njava.lang.NullPointerException\n--accessToken token-do-jogo-xyz987\n`
  )
  // Mundo e mod: nunca vão (nem o conteúdo).
  mkdirSync(join(servidor, 'world'), { recursive: true })
  writeFileSync(join(servidor, 'world', 'level.dat'), 'CONTEUDO-DO-MUNDO')
  mkdirSync(join(servidor, 'plugins'), { recursive: true })
  writeFileSync(join(servidor, 'plugins', 'meu-plugin.jar'), 'CONTEUDO-DO-JAR')

  // Gera pela tela: Opções › Gerais › Ajuda, tirando um item.
  await pagina(j, 'Opções')
  await j.getByRole('button', { name: 'Gerar relatório de erro' }).click()
  const dialogo = j.getByRole('dialog')
  await expect(dialogo.getByText('Vai no relatório')).toBeVisible()
  await expect(dialogo).toContainText('Nada é enviado')
  const versao = dialogo.getByRole('checkbox', { name: /Versão do convite/ })
  await expect(versao).toBeChecked()
  await dialogo
    .locator('label', { hasText: 'Versão do convite' })
    .click({ position: { x: 6, y: 16 } })
  await expect(versao).not.toBeChecked()
  await dialogo.getByRole('button', { name: 'Salvar na Área de Trabalho' }).click()
  await expect(dialogo.getByText(/Salvo na Área de Trabalho/)).toBeVisible({ timeout: 60_000 })
  await dialogo.getByRole('button', { name: 'Abrir pasta' }).click()
  await expect
    .poll(() => dono.aberturas())
    .toContainEqual(expect.stringMatching(/openPath .*desktop/))

  const desktop = join(dono.pasta, 'desktop')
  const zip = readdirSync(desktop).find((n) =>
    /^HubSquare-relatorio-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.zip$/.test(n)
  )
  expect(zip, 'o .zip na Área de Trabalho, com a data no nome').toBeTruthy()
  const caminho = join(desktop, zip!)
  // Para conferir o ler-relatorio à mão: GUARDAR_RELATORIO=<caminho> guarda uma cópia.
  if (process.env.GUARDAR_RELATORIO) copyFileSync(caminho, process.env.GUARDAR_RELATORIO)

  const aberto = join(dono.pasta, 'aberto')
  mkdirSync(aberto)
  execFileSync(TAR, ['-xf', caminho, '-C', aberto])
  const arquivos = readdirSync(aberto, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name))
  const nomes = arquivos.map((f) => f.slice(aberto.length + 1).replace(/\\/g, '/'))
  for (const esperado of [
    'LEIA-ME.txt',
    'erros.log',
    'servidor/latest.log',
    'sistema.json',
    'config/servidores.json',
    'config/instalacoes.json',
    'mods.json'
  ])
    expect(nomes, esperado).toContain(esperado)
  expect(nomes.some((n) => n.startsWith('travamentos/servidor-crash-'))).toBe(true)
  expect(nomes, 'item tirado não vai').not.toContain('manifesto.json')
  expect(nomes.some((n) => /level\.dat|\.jar$/i.test(n))).toBe(false)

  const proibidos = [
    pinHash,
    pinSalt,
    sessao,
    chaveCf,
    playit,
    token,
    senhaRcon,
    ipPublico,
    'abc.def.ghi',
    'token-do-jogo-xyz987',
    'CONTEUDO-DO-MUNDO',
    'CONTEUDO-DO-JAR',
    homedir(),
    homedir().replace(/\\/g, '/'),
    homedir().replace(/\\/g, '\\\\')
  ]
  for (const f of arquivos) {
    const texto = readFileSync(f, 'utf8')
    for (const p of proibidos) expect(texto, `${f} não pode ter ${p}`).not.toContain(p)
  }
  const leia = readFileSync(join(aberto, 'LEIA-ME.txt'), 'utf8')
  expect(leia).toContain('Falha plantada no teste')
  expect(readFileSync(join(aberto, 'erros.log'), 'utf8')).toContain('%USERPROFILE%')
  expect(readFileSync(join(aberto, 'mods.json'), 'utf8')).toContain('plugins/meu-plugin.jar')

  // O guia pelo terminal resume o relatório.
  const saida = execFileSync(
    process.execPath,
    [join(RAIZ, 'scripts', 'ler-relatorio.mjs'), caminho],
    {
      encoding: 'utf8'
    }
  )
  expect(saida).toContain('RELATÓRIO DE ERRO DO HUBSQUARE')
  expect(saida).toContain('Falha plantada no teste')
  expect(saida).toContain('Erro plantado no servidor')
  expect(saida).toContain('Exception in server tick loop')
})
