import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import type { LoaderCliente } from '../shared/tipos'
import {
  ehForgeAntigo,
  lerPerfilAntigo,
  montarVersaoCliente,
  urlDoMaven,
  type BibliotecaAntiga,
  type PerfilAntigo
} from '../shared/forgeAntigoRegras'
import { ErroApp, detalhar } from './erros'
import { hashEmTrabalhador } from './hashTrabalhador'
import { tar } from './importarZip'
import { garantirJava } from './java'
import { fotografarPerfis, MINECRAFT, exigirPerfis, restaurarPerfis } from './launcherOficial'
import { javaDaVersao } from './mojang'
import { baixar, buscarBytes, buscarJson, type AoProgredir } from './rede'
import { maisNovaEstavel } from './tipos/fabric'
import { nomeDoForgeAntigo, versoesForge } from './tipos/forge'
import { versoesNeoForge } from './tipos/neoforge'
import { t } from '../shared/i18n'
import { registrarErro } from './registroErros'

// Loaders em modo cliente para o launcher oficial (Fase P1), só de fontes oficiais. O resultado
// fica em .minecraft/versions e libraries (onde o launcher procura). O jogo em si o launcher baixa.

const FABRIC = 'https://meta.fabricmc.net/v2'
const FORGE = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
const NEOFORGE = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'

const idSeguro = (id: string): boolean => /^[\w.+-]{1,80}$/.test(id) && !id.includes('..')
const temVersao = (id: string): boolean =>
  existsSync(join(MINECRAFT(), 'versions', id, `${id}.json`))

export async function versaoDoLoader(
  loader: LoaderCliente,
  versao: string,
  fixa: string | null
): Promise<string | null> {
  if (loader === 'vanilla') return null
  if (fixa) return fixa
  if (loader === 'fabric') return maisNovaEstavel('loader')
  const mapa = loader === 'forge' ? await versoesForge() : await versoesNeoForge()
  const numero = mapa.get(versao)
  if (!numero) {
    throw new ErroApp(
      t('p.clienteLoader.oAindaNaoTemO', {
        v: loader === 'forge' ? t('p.clienteLoader.forge') : t('p.clienteLoader.neoforge'),
        versao
      })
    )
  }
  return numero
}

// Deixa a versão pronta no launcher e devolve o id dela (o "lastVersionId" do perfil).
export async function garantirVersaoCliente(
  loader: LoaderCliente,
  versao: string,
  versaoLoader: string | null,
  aoProgredir: AoProgredir
): Promise<string> {
  if (loader === 'vanilla') return versao
  const numero = (await versaoDoLoader(loader, versao, versaoLoader))!

  if (loader === 'fabric') {
    const id = `fabric-loader-${numero}-${versao}`
    if (!idSeguro(id)) throw new ErroApp(t('p.clienteLoader.versaoDoFabricInvalida'))
    if (temVersao(id)) return id
    aoProgredir({
      etapa: t('p.clienteLoader.preparandoOFabric', { numero }),
      recebido: 0,
      total: 0
    })
    // Perfil oficial do Fabric para o launcher; ele baixa as bibliotecas sozinho ao abrir.
    const perfil = await buscarJson<{ id: string }>(
      `${FABRIC}/versions/loader/${encodeURIComponent(versao)}/${encodeURIComponent(numero)}/profile/json`,
      undefined,
      t('p.rede.itemCliente', { loader: 'Fabric', versao })
    )
    if (perfil.id !== id) throw new ErroApp(t('p.clienteLoader.oFabricRespondeuUmaVersao'))
    const pasta = join(MINECRAFT(), 'versions', id)
    await mkdir(pasta, { recursive: true })
    await writeFile(join(pasta, `${id}.json`), JSON.stringify(perfil, null, 2))
    // O instalador oficial do Fabric também cria esse .jar vazio; o launcher espera achar um.
    await writeFile(join(pasta, `${id}.jar`), '')
    return id
  }

  // Fase F1: de 1.7.10 a 1.12.1 o instalador do Forge não instala o cliente pelo terminal.
  if (loader === 'forge' && ehForgeAntigo(versao)) {
    return garantirForgeAntigo(versao, numero, aoProgredir)
  }

  const nome = loader === 'forge' ? t('p.clienteLoader.forge') : 'NeoForge'
  const id = loader === 'forge' ? `${versao}-forge-${numero}` : `neoforge-${numero}`
  if (!idSeguro(id)) throw new ErroApp(t('p.clienteLoader.versaoDoInvalida', { nome }))
  if (temVersao(id)) return id
  exigirPerfis() // o instalador do Forge/NeoForge recusa uma pasta sem launcher_profiles.json

  const url =
    loader === 'forge'
      ? `${FORGE}/${versao}-${numero}/forge-${versao}-${numero}-installer.jar`
      : `${NEOFORGE}/${numero}/neoforge-${numero}-installer.jar`
  const temporaria = join(tmpdir(), `hubsquare-instalador-${randomUUID()}`)
  await mkdir(temporaria, { recursive: true })
  const foto = await fotografarPerfis()
  const antes = new Set(await readdir(join(MINECRAFT(), 'versions')).catch(() => []))
  try {
    const item = t('p.rede.itemCliente', { loader: nome, versao })
    const sha1 = (await buscarBytes(`${url}.sha1`, item)).toString('utf8').trim()
    const jar = join(temporaria, 'instalador.jar')
    await baixar(
      url,
      jar,
      { algoritmo: 'sha1', valor: sha1 },
      t('p.clienteLoader.baixandoOInstaladorDo', { nome }),
      aoProgredir,
      undefined,
      item
    )
    const java = await garantirJava(await javaDaVersao(versao), aoProgredir)
    await executar(
      java,
      ['-jar', jar, '--installClient', MINECRAFT()],
      temporaria,
      `${nome} ${numero}`,
      aoProgredir
    )
  } finally {
    // O instalador cria um perfil "forge"/"NeoForge" no launcher: os perfis voltam a ser os de antes.
    await restaurarPerfis(foto).catch(
      registrarErro('clienteLoader.ts', 'devolver os perfis do launcher depois do instalador')
    )
    await rm(temporaria, { recursive: true, force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
  }
  if (temVersao(id)) return id
  // Nome diferente do esperado (instalador mudou o padrão): usa a versão que ele acabou de criar.
  const novas = (await readdir(join(MINECRAFT(), 'versions')).catch(() => [])).filter(
    (v) => !antes.has(v) && idSeguro(v) && v.includes(numero) && temVersao(v)
  )
  if (novas.length !== 1) {
    throw new ErroApp(t('p.clienteLoader.oInstaladorDoTerminouMas', { nome, id }))
  }
  return novas[0]
}

// Fase F1 (docs/forge-antigo.md): do instalador oficial só sai o install_profile.json (ele nunca
// roda). O Forge (jar universal) e cada biblioteca vêm dos sites oficiais com o SHA-1 conferido e
// ficam em .minecraft/libraries; a versão é gravada no formato que o launcher confere, com Java 8.
async function garantirForgeAntigo(
  versao: string,
  numero: string,
  aoProgredir: AoProgredir
): Promise<string> {
  const versoes = join(MINECRAFT(), 'versions')
  // Já preparada antes (o id tem "Forge<número>" ou "forge<versão>-<número>").
  const marcas = [`forge${numero}`, `forge${versao}-${numero}`].map((m) => m.toLowerCase())
  const pronta = (await readdir(versoes).catch(() => [] as string[])).find(
    (v) => idSeguro(v) && marcas.some((m) => v.toLowerCase().includes(m)) && temVersao(v)
  )
  if (pronta) return pronta

  const nome = await nomeDoForgeAntigo(versao, numero)
  const item = t('p.rede.itemCliente', { loader: 'Forge', versao })
  const temporaria = join(tmpdir(), `hubsquare-forge-${randomUUID()}`)
  await mkdir(temporaria, { recursive: true })
  try {
    const url = urlDoMaven(nome, 'installer')
    const sha1 = (await buscarBytes(`${url}.sha1`, item)).toString('utf8').trim()
    const jar = join(temporaria, 'instalador.jar')
    await baixar(
      url,
      jar,
      { algoritmo: 'sha1', valor: sha1 },
      t('p.clienteLoader.baixandoOInstaladorDo', { nome: 'Forge' }),
      aoProgredir,
      undefined,
      item
    )
    let perfil: PerfilAntigo
    try {
      perfil = lerPerfilAntigo(await tar(['-xOf', jar, 'install_profile.json']), nome)
    } catch (e) {
      throw new ErroApp(t('p.clienteLoader.oInstaladorDoForgeVeio'), detalhar(e))
    }
    const conferidas = new Map<string, { sha1: string; tamanho: number }>()
    for (const [i, b] of perfil.bibliotecas.entries()) {
      aoProgredir({
        etapa: t('p.clienteLoader.bibliotecasDoForge', {
          i: i + 1,
          total: perfil.bibliotecas.length
        }),
        recebido: i,
        total: perfil.bibliotecas.length
      })
      conferidas.set(b.nome, await garantirBiblioteca(b, temporaria, item))
    }
    const pasta = join(versoes, perfil.id)
    await mkdir(pasta, { recursive: true })
    await writeFile(
      join(pasta, `${perfil.id}.json`),
      JSON.stringify(montarVersaoCliente(perfil, conferidas), null, 2)
    )
    return perfil.id
  } finally {
    await rm(temporaria, { recursive: true, force: true }).catch(() => {}) // pasta temporária; o Windows limpa o que sobrar
  }
}

// Uma biblioteca no lugar, com o SHA-1 conferido: o do install_profile.json (que veio de um
// instalador conferido) ou, sem ele, o .sha1 do site. Sem nenhum dos dois, nada é usado.
async function garantirBiblioteca(
  b: BibliotecaAntiga,
  temporaria: string,
  item: string
): Promise<{ sha1: string; tamanho: number }> {
  const aceitos = b.sha1s.length
    ? b.sha1s.map((s) => s.toLowerCase())
    : [
        (await buscarBytes(`${b.url}.sha1`, item))
          .toString('utf8')
          .trim()
          .slice(0, 40)
          .toLowerCase()
      ]
  if (!aceitos.every((s) => /^[0-9a-f]{40}$/.test(s))) {
    throw new ErroApp(t('p.clienteLoader.semComoConferirABiblioteca', { nome: b.nome }))
  }
  const destino = join(MINECRAFT(), 'libraries', ...b.caminho.split('/'))
  if (existsSync(destino)) {
    const atual = await hashEmTrabalhador(destino).catch(() => '')
    if (aceitos.includes(atual)) return { sha1: atual, tamanho: (await stat(destino)).size }
  }
  const baixado = join(temporaria, `${randomUUID()}.jar`)
  await baixar(b.url, baixado, undefined, b.nome, () => {}, undefined, item)
  const obtido = await hashEmTrabalhador(baixado)
  if (!aceitos.includes(obtido)) {
    throw new ErroApp(
      t('p.rede.oArquivoBaixadoVeioCorrompido', { item: b.nome }),
      `${b.url}\nsha1 esperado: ${aceitos.join(' ou ')}\nsha1 obtido: ${obtido}`
    )
  }
  await mkdir(dirname(destino), { recursive: true })
  await rename(baixado, destino).catch(() => copyFile(baixado, destino))
  return { sha1: obtido, tamanho: (await stat(destino)).size }
}

function executar(
  java: string,
  args: string[],
  cwd: string,
  nome: string,
  aoProgredir: AoProgredir
): Promise<void> {
  const etapa = t('p.clienteLoader.instalandoOPodeLevarAlguns', { nome })
  aoProgredir({ etapa, recebido: 0, total: 0 })
  return new Promise((resolver, falhar) => {
    const filho = spawn(java, args, { cwd, windowsHide: true })
    const ultimas: string[] = []
    let aviso = 0
    const linha = (d: Buffer): void => {
      for (const l of d.toString('utf8').split(/\r?\n/).filter(Boolean)) {
        ultimas.push(l)
        if (ultimas.length > 40) ultimas.shift()
        if (Date.now() - aviso > 200) {
          aviso = Date.now()
          aoProgredir({ etapa: `${etapa}: ${l.trim().slice(0, 80)}`, recebido: 0, total: 0 })
        }
      }
    }
    filho.stdout.on('data', linha)
    filho.stderr.on('data', linha)
    filho.on('error', (e) =>
      falhar(new ErroApp(t('p.clienteLoader.oInstaladorDoNaoAbriu', { nome }), String(e)))
    )
    filho.on('close', (codigo) =>
      codigo === 0
        ? resolver()
        : falhar(
            new ErroApp(
              t('p.clienteLoader.naoConseguiInstalarOConfira', { nome }),
              t('p.clienteLoader.oInstaladorSaiuComCodigo', { codigo, join: ultimas.join('\n') })
            )
          )
    )
  })
}
