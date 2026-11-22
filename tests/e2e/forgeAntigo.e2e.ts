import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, pagina, prepararLauncherFalso, test } from './apoio'

// Fase F1: JOGAR numa instalação Forge 1.7.10. O app tira do instalador (falso) só o
// install_profile.json, baixa o Forge universal e as bibliotecas com o SHA-1 conferido e grava a
// versão no .minecraft de teste no formato que o launcher confere, com Java 8. O instalador
// nunca roda (os antigos não têm --installClient).

const RAIZ = join(__dirname, '..', '..', '.teste')
const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
const sha1 = (b: Buffer): string => createHash('sha1').update(b).digest('hex')
const NOME = '1.7.10-10.13.4.1614-1.7.10'
const ID = '1.7.10-Forge10.13.4.1614-1.7.10'
const MAVEN = 'maven.minecraftforge.net/net/minecraftforge/forge'

function jar(nome: string, arquivos: Record<string, string>): Buffer {
  const pasta = join(RAIZ, 'e2e-arquivos', nome)
  rmSync(pasta, { recursive: true, force: true })
  for (const [c, conteudo] of Object.entries(arquivos)) {
    mkdirSync(join(pasta, c, '..'), { recursive: true })
    writeFileSync(join(pasta, c), conteudo)
  }
  const destino = join(RAIZ, 'e2e-arquivos', `${nome}.jar`)
  rmSync(destino, { force: true })
  execFileSync(TAR, [
    '-a',
    '-cf',
    destino,
    '--format',
    'zip',
    '-C',
    pasta,
    ...Object.keys(arquivos)
  ])
  return readFileSync(destino)
}

test('JOGAR numa instalação Forge 1.7.10 prepara a versão com Java 8 e as bibliotecas conferidas', async ({
  abrir,
  simulado
}) => {
  const universal = jar('forge-universal', { 'META-INF/MANIFEST.MF': 'Forge falso\n' })
  const wrapper = jar('launchwrapper', { 'META-INF/MANIFEST.MF': 'launchwrapper falso\n' })
  const scala = jar('scala-xml', { 'META-INF/MANIFEST.MF': 'scala falso\n' })
  const perfil = {
    install: { minecraft: '1.7.10', filePath: `forge-${NOME}-universal.jar` },
    versionInfo: {
      id: ID,
      inheritsFrom: '1.7.10',
      jar: '1.7.10',
      minecraftArguments: '--tweakClass cpw.mods.fml.common.launcher.FMLTweaker',
      mainClass: 'net.minecraft.launchwrapper.Launch',
      libraries: [
        { name: `net.minecraftforge:forge:${NOME}`, url: 'https://maven.minecraftforge.net/' },
        { name: 'net.minecraft:launchwrapper:1.12', serverreq: true },
        // Sem .sha1 no site: o hash vem do checksums do perfil.
        {
          name: 'org.scala-lang:scala-xml_2.11:1.0.2',
          url: 'https://maven.minecraftforge.net/',
          checksums: [sha1(scala)],
          clientreq: true
        }
      ]
    }
  }
  const instalador = jar('forge-installer', { 'install_profile.json': JSON.stringify(perfil) })
  const s = simulado!
  const rotas: Record<string, Buffer | string> = {
    [`${MAVEN}/maven-metadata.xml`]: `<metadata><versions><version>${NOME}</version></versions></metadata>`,
    [`${MAVEN}/${NOME}/forge-${NOME}-installer.jar`]: instalador,
    [`${MAVEN}/${NOME}/forge-${NOME}-installer.jar.sha1`]: sha1(instalador),
    [`${MAVEN}/${NOME}/forge-${NOME}-universal.jar`]: universal,
    [`${MAVEN}/${NOME}/forge-${NOME}-universal.jar.sha1`]: sha1(universal),
    'libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar': wrapper,
    'libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar.sha1':
      sha1(wrapper),
    'maven.minecraftforge.net/org/scala-lang/scala-xml_2.11/1.0.2/scala-xml_2.11-1.0.2.jar': scala
  }
  // Um responder por site, com o caminho exato (o responder casa por prefixo).
  for (const site of ['maven.minecraftforge.net/', 'libraries.minecraft.net/']) {
    s.responder(site, (_c, pedido) => {
      const corpo = rotas[pedido]
      if (corpo === undefined) {
        s.desconhecidos.push(pedido)
        return { status: 404, json: {} }
      }
      return { bytes: Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo) }
    })
  }

  const a = await abrir('app', (p) => {
    prepararLauncherFalso(p)
    const dados = join(p, 'appData', 'HubSquare')
    writeFileSync(join(dados, 'modo-app.json'), JSON.stringify({ modo: 'amigo' }))
    writeFileSync(
      join(dados, 'instalacoes.json'),
      JSON.stringify({
        ignorados: [],
        instalacoes: [
          {
            id: 'e'.repeat(32),
            nome: 'Forge Antigo',
            pasta: join(p, 'documents', 'HubSquare', 'jogo', 'Forge Antigo'),
            versao: '1.7.10',
            loader: 'forge',
            versaoLoader: '10.13.4.1614',
            ram: 4,
            origem: { tipo: 'zero' },
            criada: '2026-11-20',
            ultimoUso: null,
            arquivoImagem: null,
            fundo: null
          }
        ]
      })
    )
  })
  const j = a.janela
  await pagina(j, 'Jogar')
  await expect(j.getByText('Esta versão usa Java 8, que o HubSquare baixa sozinho.')).toBeVisible()
  await j.getByRole('button', { name: /^(JOGAR|ATUALIZAR E JOGAR)$/ }).click()
  await expect(j.getByText(/Clique em JOGAR no launcher/)).toBeVisible({ timeout: 60_000 })

  const minecraft = join(a.pasta, 'appData', '.minecraft')
  const versao = JSON.parse(readFileSync(join(minecraft, 'versions', ID, `${ID}.json`), 'utf8'))
  expect(versao.inheritsFrom).toBe('1.7.10')
  expect(versao.javaVersion).toEqual({ component: 'jre-legacy', majorVersion: 8 })
  for (const l of versao.libraries as {
    downloads: { artifact: { path: string; sha1: string } }
  }[]) {
    const f = join(minecraft, 'libraries', l.downloads.artifact.path)
    expect(existsSync(f), f).toBe(true)
    expect(sha1(readFileSync(f))).toBe(l.downloads.artifact.sha1)
  }
  // O Forge fica onde o launcher procura, vindo do universal (no maven, o endereço normal dá 404).
  expect(
    readFileSync(
      join(minecraft, 'libraries', 'net', 'minecraftforge', 'forge', NOME, `forge-${NOME}.jar`)
    ).equals(universal)
  ).toBe(true)
  const perfis = JSON.parse(readFileSync(join(minecraft, 'launcher_profiles.json'), 'utf8'))
  expect(perfis.profiles[`hubsquare-${'e'.repeat(32)}`].lastVersionId).toBe(ID)
  // Os perfis antigos do launcher continuam lá.
  expect(perfis.profiles.antigo1).toBeTruthy()
  expect(s.desconhecidos).toEqual([])
})
