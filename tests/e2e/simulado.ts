import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

// Servidor HTTP local que faz o papel da internet nos testes rápidos (HUBSQUARE_DOWNLOADS).
// O app pede <servidor>/<site>/<caminho> (rede.ts › urlDeVerdade). Arquivos pequenos e falsos:
// nada da Mojang, do Paper ou de mods de verdade. Pedido que não está aqui volta 404 e fica
// anotado em `desconhecidos`, para o teste falhar.
//
// Modo "proxy" (testes lentos): busca no site de verdade e guarda os downloads grandes em
// .teste/cache, para a próxima rodada não baixar de novo.

export const MC = '1.21.1'
export const FABRIC_LOADER = '0.16.14'
const RAIZ = join(__dirname, '..', '..', '.teste')
const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')

const sha = (alg: string, b: Buffer): string => createHash(alg).update(b).digest('hex')

// Monta um .zip (tar.exe do Windows) a partir de { caminho: conteúdo }.
function zip(nome: string, arquivos: Record<string, string | Buffer>): Buffer {
  const pasta = join(RAIZ, 'e2e-arquivos', nome)
  rmSync(pasta, { recursive: true, force: true })
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    mkdirSync(join(pasta, caminho, '..'), { recursive: true })
    writeFileSync(join(pasta, caminho), conteudo)
  }
  const destino = join(RAIZ, 'e2e-arquivos', `${nome}.zip`)
  rmSync(destino, { force: true })
  execFileSync(TAR, [
    '-a',
    '-cf',
    destino,
    '-C',
    pasta,
    ...Object.keys(arquivos)
      .map((c) => c.split('/')[0])
      .filter((c, i, l) => l.indexOf(c) === i)
  ])
  return readFileSync(destino)
}

export interface Arquivos {
  paperJar: Buffer
  vanillaJar: Buffer
  javaZip: Buffer
  fabricJar: Buffer
  modJar: Buffer
  pluginJar: Buffer
  mrpack: Buffer
  caminhoMrpack: string
  caminhoPlugin: string
}

let arquivos: Arquivos | undefined

export function arquivosFalsos(): Arquivos {
  if (arquivos) return arquivos
  const paperJar = zip('paper', { 'META-INF/MANIFEST.MF': 'Build-Number: 100\n' })
  const vanillaJar = zip('vanilla', { 'META-INF/MANIFEST.MF': 'Main-Class: falso\n' })
  const fabricJar = zip('fabric', { 'META-INF/MANIFEST.MF': 'Main-Class: falso\n' })
  // Só o java.exe falso: o modo rápido nunca liga o servidor.
  const javaZip = zip('java', { 'jdk-21.0.5+11-jre/bin/java.exe': 'java falso' })
  const modJar = zip('mod', {
    'fabric.mod.json': JSON.stringify({
      schemaVersion: 1,
      id: 'mod_de_teste',
      version: '1.0.0',
      name: 'Mod de Teste'
    })
  })
  const pluginJar = zip('plugin', {
    'plugin.yml': 'name: PluginDeTeste\nversion: 1.0.0\nmain: teste.Plugin\napi-version: "1.21"\n'
  })
  const modUrl = 'https://cdn.modrinth.com/data/AAAAAAAA/versions/BBBBBBBB/mod-de-teste-1.0.0.jar'
  const indice = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name: 'Pack de Teste',
    files: [
      {
        path: 'mods/mod-de-teste-1.0.0.jar',
        hashes: { sha1: sha('sha1', modJar), sha512: sha('sha512', modJar) },
        env: { client: 'required', server: 'required' },
        downloads: [modUrl],
        fileSize: modJar.length
      }
    ],
    dependencies: { minecraft: MC, 'fabric-loader': FABRIC_LOADER }
  }
  const mrpack = zip('pack', {
    'modrinth.index.json': JSON.stringify(indice, null, 2),
    'overrides/config/pack-de-teste.txt': 'configuração do pack'
  })
  const caminhoMrpack = join(RAIZ, 'e2e-arquivos', 'Pack de Teste 1.0.0.mrpack')
  writeFileSync(caminhoMrpack, mrpack)
  const caminhoPlugin = join(RAIZ, 'e2e-arquivos', 'PluginDeTeste-1.0.0.jar')
  writeFileSync(caminhoPlugin, pluginJar)
  arquivos = {
    paperJar,
    vanillaJar,
    javaZip,
    fabricJar,
    modJar,
    pluginJar,
    mrpack,
    caminhoMrpack,
    caminhoPlugin
  }
  return arquivos
}

type Resposta = { status?: number; json?: unknown; bytes?: Buffer }

function rotas(): Record<string, Resposta> {
  const a = arquivosFalsos()
  const versaoUrl = `https://piston-meta.mojang.com/v1/packages/teste/${MC}.json`
  const vanillaUrl = `https://piston-data.mojang.com/v1/objects/${sha('sha1', a.vanillaJar)}/server.jar`
  const paperUrl = `https://fill-data.papermc.io/v1/objects/teste/paper-${MC}-100.jar`
  const javaUrl = 'https://github.com/adoptium/temurin21-binaries/releases/download/teste/jre21.zip'
  const fabric = `meta.fabricmc.net/v2/versions/loader/${MC}/${FABRIC_LOADER}`
  const caminho = (url: string): string => url.replace(/^https:\/\//, '')
  return {
    'piston-meta.mojang.com/mc/game/version_manifest_v2.json': {
      json: { latest: { release: MC }, versions: [{ id: MC, type: 'release', url: versaoUrl }] }
    },
    [caminho(versaoUrl)]: {
      json: {
        id: MC,
        javaVersion: { majorVersion: 21 },
        downloads: { server: { url: vanillaUrl, sha1: sha('sha1', a.vanillaJar) } }
      }
    },
    [caminho(vanillaUrl)]: { bytes: a.vanillaJar },
    'fill.papermc.io/v3/projects/paper': { json: { versions: { '1.21': [MC] } } },
    [`fill.papermc.io/v3/projects/paper/versions/${MC}/builds/latest`]: {
      json: {
        id: 100,
        downloads: {
          'server:default': { url: paperUrl, checksums: { sha256: sha('sha256', a.paperJar) } }
        }
      }
    },
    [caminho(paperUrl)]: { bytes: a.paperJar },
    'api.adoptium.net/v3/assets/latest/21/hotspot': {
      json: [{ binary: { package: { link: javaUrl, checksum: sha('sha256', a.javaZip) } } }]
    },
    [caminho(javaUrl)]: { bytes: a.javaZip },
    'meta.fabricmc.net/v2/versions/game': { json: [{ version: MC, stable: true }] },
    'meta.fabricmc.net/v2/versions/loader': { json: [{ version: FABRIC_LOADER, stable: true }] },
    'meta.fabricmc.net/v2/versions/installer': { json: [{ version: '1.0.1', stable: true }] },
    [`${fabric}/1.0.1/server/jar`]: { bytes: a.fabricJar },
    [`${fabric}/profile/json`]: { json: { id: `fabric-loader-${FABRIC_LOADER}-${MC}` } },
    'cdn.modrinth.com/data/AAAAAAAA/versions/BBBBBBBB/mod-de-teste-1.0.0.jar': { bytes: a.modJar },
    // Contas do Minecraft (API pública da Mojang): uma que existe e uma que não.
    'api.mojang.com/users/profiles/minecraft/AmigoTeste': {
      json: { id: '069a79f444e94726a5befca90e38aaf5', name: 'AmigoTeste' }
    },
    'api.mojang.com/users/profiles/minecraft/NinguemAqui123': { status: 404, json: {} },
    // Sem skin no teste: a cabeça do jogador usa o desenho padrão do app.
    'sessionserver.mojang.com/session/minecraft/profile/069a79f444e94726a5befca90e38aaf5': {
      status: 404,
      json: {}
    },
    // Modrinth sem nada encontrado (arquivos do teste não são do Modrinth).
    'api.modrinth.com/v2/version_files': { json: {} },
    'api.modrinth.com/v2/search': { json: { hits: [], offset: 0, limit: 20, total_hits: 0 } },
    // O repositório do app sem release: o aviso de versão nova não aparece.
    'api.github.com/repos/lipeventura777/hubsquare/releases/latest': { status: 404, json: {} }
  }
}

export interface Simulado {
  url: string
  pedidos: string[]
  desconhecidos: string[]
  fechar: () => Promise<void>
}

// Downloads grandes que valem guardar entre rodadas no modo proxy.
const GUARDAR = /\.(jar|zip)$/i

export async function iniciarSimulado(modo: 'falso' | 'proxy' = 'falso'): Promise<Simulado> {
  const tabela = modo === 'falso' ? rotas() : {}
  const pedidos: string[] = []
  const desconhecidos: string[] = []
  const cache = join(RAIZ, 'cache')
  mkdirSync(cache, { recursive: true })

  const servidor: Server = createServer(async (req, res) => {
    const alvo = (req.url ?? '/').slice(1) // "<site>/<caminho>?<consulta>"
    pedidos.push(alvo)
    const semConsulta = alvo.split('?')[0]
    if (modo === 'proxy') {
      try {
        const arquivo = join(cache, sha('sha1', Buffer.from(alvo)))
        if (GUARDAR.test(semConsulta) && existsSync(arquivo)) return res.end(readFileSync(arquivo))
        const r = await fetch(`https://${alvo}`, {
          headers: { 'User-Agent': String(req.headers['user-agent'] ?? 'HubSquare-teste') }
        })
        const corpo = Buffer.from(await r.arrayBuffer())
        if (r.ok && GUARDAR.test(semConsulta)) writeFileSync(arquivo, corpo)
        res.statusCode = r.status
        res.setHeader('content-type', r.headers.get('content-type') ?? 'application/octet-stream')
        return res.end(corpo)
      } catch (e) {
        res.statusCode = 502
        return res.end(String(e))
      }
    }
    const r = tabela[semConsulta]
    if (!r) {
      desconhecidos.push(alvo)
      res.statusCode = 404
      return res.end('{}')
    }
    res.statusCode = r.status ?? 200
    if (r.bytes) {
      res.setHeader('content-length', r.bytes.length)
      return res.end(r.bytes)
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(r.json))
  })
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok))
  const { port } = servidor.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    pedidos,
    desconhecidos,
    fechar: () => new Promise((ok) => servidor.close(() => ok()))
  }
}

// Servidor de Minecraft simulado (Fase M5): só responde ao "ping" de status, como a lista de
// Multijogador espera. Escuta numa porta livre escolhida pelo sistema.
export async function servidorMinecraftFalso(): Promise<{
  porta: number
  fechar: () => Promise<void>
}> {
  const { createServer: criarTcp } = await import('node:net')
  const varint = (n: number): Buffer => {
    const b: number[] = []
    do {
      let byte = n & 0x7f
      n >>>= 7
      if (n) byte |= 0x80
      b.push(byte)
    } while (n)
    return Buffer.from(b)
  }
  const json = Buffer.from(
    JSON.stringify({
      version: { name: MC, protocol: 767 },
      players: { online: 0, max: 10 },
      description: { text: 'Servidor simulado' }
    })
  )
  const corpo = Buffer.concat([varint(0), varint(json.length), json])
  const resposta = Buffer.concat([varint(corpo.length), corpo])
  const servidor = criarTcp((s) => {
    s.on('data', () => s.write(resposta))
    s.on('error', () => {})
  })
  await new Promise<void>((ok) => servidor.listen(0, '0.0.0.0', ok))
  return {
    porta: (servidor.address() as AddressInfo).port,
    fechar: () => new Promise((ok) => servidor.close(() => ok()))
  }
}
