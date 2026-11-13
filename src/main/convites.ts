import { app, dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { createServer, type Server } from 'http'
import { rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type {
  ArquivoManual,
  ConviteServidor,
  InfoServidor,
  LoaderCliente,
  Manifesto
} from '../shared/tipos'
import { gravarComSeguranca, lerArquivoPropriedades, lerTexto } from './config'
import { ipLocal, ipRadmin, ipTailscale, lerPreferencias } from './conexao'
import {
  arquivoDeConvite,
  codigoDoConvite,
  enderecoValido,
  hashDoConteudo,
  linkDoConvite,
  novoToken,
  proximaVersao,
  decidir,
  guardarPedido,
  lerPedidos,
  MAX_CORPO,
  situacaoDoPedido,
  validarPedido,
  type PedidoEntrada,
  type PedidosServidor
} from './conviteRegras'
import { avisarTela } from './servidor'
import { aprovarNaWhitelist } from './whitelist'
import { ErroApp } from './erros'
import { montarPacoteAmigos } from './modpacks'
import { downloadPermitido } from './modpackRegras'
import { lerIndice, lerInfo } from './servidores'
import { idFixoDe } from './passarServidor'

// Convites (Fase P2), lado do dono. Cada servidor tem um manifesto (o que o amigo precisa
// instalar, só com links oficiais e hashes) servido por um endereço SÓ DE LEITURA:
// GET /convite/<token>/manifesto.json. Fase M4: POST /convite/<token>/pedido SÓ guarda um
// pedido para entrar na whitelist (o dono aprova), e GET /convite/<token>/pedido/<uuid> responde
// só sobre aquele UUID. Nada mais responde nesse servidor HTTP: nem console, nem arquivos, nem
// comandos. Ele escuta só nos IPs da rede local, do Radmin e do Tailscale
// (e em 127.0.0.1 quando o dono cadastra um túnel do playit para ele). Nunca em 0.0.0.0.

const ARQUIVO = 'servsquare-convite.json' // na pasta do servidor
const PORTA_PADRAO = 8788
const CACHE_MS = 60_000
const MAX_ERROS = 20
const BLOQUEIO_MS = 15 * 60_000

interface ConviteSalvo {
  conviteId: string
  token: string | null // null: revogado
  versao: number
  hash: string
  proibidos: string[]
  mensagem?: string // recado do dono para os amigos (Fase P4)
}

interface ConfigGlobal {
  porta: number
  enderecoPlayit: string | null // túnel do playit criado pelo dono, apontando para a porta
}

const arquivoConfig = (): string => join(app.getPath('userData'), 'convites.json')

async function lerConfig(): Promise<ConfigGlobal> {
  const texto = await lerTexto(arquivoConfig())
  const d = texto ? (JSON.parse(texto) as Partial<ConfigGlobal>) : {}
  return {
    porta: Number.isInteger(d.porta) ? d.porta! : PORTA_PADRAO,
    enderecoPlayit: enderecoValido(d.enderecoPlayit) ? d.enderecoPlayit : null
  }
}

async function lerConvite(pasta: string): Promise<ConviteSalvo | null> {
  const texto = await lerTexto(join(pasta, ARQUIVO)).catch(() => '')
  return texto ? (JSON.parse(texto) as ConviteSalvo) : null
}

// Para a instalação do próprio dono no PlaySquare (Fase P3).
export async function proibidosDoServidor(pasta: string): Promise<string[]> {
  return (await lerConvite(pasta).catch(() => null))?.proibidos ?? []
}

async function gravarConvite(pasta: string, c: ConviteSalvo): Promise<void> {
  await gravarComSeguranca(join(pasta, ARQUIVO), JSON.stringify(c, null, 2))
  tokens = null
  manifestos.delete(pasta)
}

// ---------- Pedidos para entrar (Fase M4) ----------

const ARQUIVO_PEDIDOS = 'servsquare-pedidos.json' // na pasta do servidor
let filaPedidos: Promise<unknown> = Promise.resolve()

async function lerPedidosDe(pasta: string): Promise<PedidosServidor> {
  try {
    const texto = await lerTexto(join(pasta, ARQUIVO_PEDIDOS))
    return lerPedidos(texto ? JSON.parse(texto) : null)
  } catch {
    return lerPedidos(null)
  }
}

// Ler, mudar e gravar um de cada vez (dois pedidos ao mesmo tempo não se atropelam).
function comPedidos<T>(
  pasta: string,
  mudar: (p: PedidosServidor) => Promise<[PedidosServidor, T]>
): Promise<T> {
  const tarefa = filaPedidos.then(async () => {
    const atual = await lerPedidosDe(pasta)
    const [novo, valor] = await mudar(atual)
    if (novo !== atual) {
      await gravarComSeguranca(join(pasta, ARQUIVO_PEDIDOS), JSON.stringify(novo, null, 2))
      avisarTela('pedidos:mudou', null)
    }
    return valor
  })
  filaPedidos = tarefa.catch(() => {})
  return tarefa
}

export async function listarPedidos(info: InfoServidor): Promise<PedidoEntrada[]> {
  return (await lerPedidosDe(info.pasta)).pendentes
}

// Aprovar põe na whitelist (comando com o servidor ligado; senão o whitelist.json com o UUID).
export function decidirPedido(
  info: InfoServidor,
  uuid: unknown,
  aprovar: unknown
): Promise<PedidoEntrada[]> {
  return comPedidos(info.pasta, async (p) => {
    const pedido = p.pendentes.find((x) => x.uuid === uuid)
    if (!pedido) throw new ErroApp('Esse pedido não existe mais. Atualize a lista.')
    if (aprovar === true) await aprovarNaWhitelist(info, { name: pedido.nick, uuid: pedido.uuid })
    const novo = decidir(p, pedido.uuid, aprovar === true)
    return [novo, novo.pendentes]
  })
}

export async function definirAprovarAutomatico(
  info: InfoServidor,
  ligado: unknown
): Promise<ConviteServidor> {
  await comPedidos(info.pasta, async (p) => [{ ...p, aprovarAutomatico: ligado === true }, null])
  return estadoConvite(info)
}

// O pedido que chegou pela rede: só guarda (ou aprova, com a opção automática ligada).
// null: pedido inválido ou lista cheia (conta como erro do IP).
async function receberPedido(pasta: string, corpo: string): Promise<[number, string] | null> {
  let pedido: Omit<PedidoEntrada, 'em'>
  try {
    pedido = validarPedido(JSON.parse(corpo))
  } catch {
    return null
  }
  const item = (await lerIndice()).servidores.find((s) => s.pasta === pasta)
  const info = item ? await lerInfo(item) : null
  if (!info) return null
  return comPedidos<[number, string] | null>(pasta, async (p) => {
    const { pedidos, resultado } = guardarPedido(p, pedido, new Date().toISOString())
    if (resultado === 'cheio') return [p, null]
    if (resultado === 'repetido') return [p, [409, JSON.stringify({ situacao: 'pendente' })]]
    if (resultado === 'ja-aprovado') return [p, [200, JSON.stringify({ situacao: 'aprovado' })]]
    if (resultado === 'aprovar') {
      await aprovarNaWhitelist(info, { name: pedido.nick, uuid: pedido.uuid })
      return [decidir(p, pedido.uuid, true), [200, JSON.stringify({ situacao: 'aprovado' })]]
    }
    avisarTela('pedidos:novo', { servidor: info.nome, nick: pedido.nick })
    return [pedidos, [200, JSON.stringify({ situacao: 'pendente' })]]
  })
}

// ---------- Manifesto ----------

// Endereços para entrar no jogo, na ordem que o amigo deve tentar.
async function enderecosDeJogo(info: InfoServidor): Promise<string[]> {
  const porta = (await lerArquivoPropriedades(info.pasta)).get('server-port') || '25565'
  const { modo, enderecoPlayit } = await lerPreferencias()
  const ips = [ipRadmin(), ipTailscale(), ipLocal()].filter((ip): ip is string => !!ip)
  const lista = ips.map((ip) => `${ip}:${porta}`)
  if (enderecoPlayit) lista[modo === 'playit' ? 'unshift' : 'push'](enderecoPlayit)
  return [...new Set(lista)]
}

const manifestos = new Map<string, { em: number; manifesto: Manifesto }>()

// Monta o manifesto a partir do Pacote pros amigos. A versão sobe quando o conteúdo muda.
export async function manifestoDoServidor(info: InfoServidor): Promise<Manifesto> {
  const guardado = manifestos.get(info.pasta)
  if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.manifesto
  const convite = await lerConvite(info.pasta)
  if (!convite) throw new ErroApp('Esse servidor ainda não tem convite. Clique em Convidar amigos.')

  const montagem = join(tmpdir(), `servsquare-manifesto-${randomUUID()}`)
  let arquivos: Manifesto['arquivos'] = []
  let semLink: string[] = []
  let manuais: ArquivoManual[] = []
  const loader: LoaderCliente =
    info.tipo === 'paper' || info.tipo === 'vanilla' ? 'vanilla' : info.tipo
  try {
    // Paper e Vanilla sem extras não têm nada para o jogador: o manifesto vai sem arquivos.
    const pacote = await montarPacoteAmigos(info, montagem, false).catch((e) => {
      if (loader === 'vanilla') return null
      throw e
    })
    if (pacote) {
      // Só referências com link oficial; mods sem link (copiados no .mrpack) viram aviso.
      for (const f of pacote.arquivos) {
        const downloads = f.downloads.filter(downloadPermitido)
        if (!/^(mods|resourcepacks|shaderpacks)\/[^/]+$/.test(f.path) || !downloads.length) {
          semLink.push(f.path.split('/').pop()!)
          continue
        }
        arquivos.push({
          path: f.path,
          sha1: f.hashes.sha1,
          sha512: f.hashes.sha512,
          tamanho: f.fileSize || 0,
          downloads,
          obrigatorio: f.env?.client !== 'optional'
        })
      }
      // Fase D: os baixados à mão vão só como página oficial + hash; o amigo baixa pelo assistente.
      manuais = pacote.baixadosAMao
      const comAssistente = new Set(manuais.map((m) => m.arquivo))
      semLink = [
        ...semLink,
        ...pacote.semModrinth,
        ...pacote.manuais.filter((n) => !comAssistente.has(n))
      ]
    }
  } finally {
    await rm(montagem, { recursive: true, force: true }).catch(() => {})
  }
  // Ordem dos resource packs = ordem em que o dono adicionou (o primeiro fica por cima).
  const packs = arquivos
    .filter((a) => a.path.startsWith('resourcepacks/'))
    .map((a) => a.path.slice('resourcepacks/'.length))
  arquivos = arquivos.sort((a, b) => a.path.localeCompare(b.path))
  const conteudo = {
    formato: 1 as const,
    conviteId: convite.conviteId,
    servidor: info.nome,
    minecraft: info.versao,
    loader,
    versaoLoader: loader === 'vanilla' ? null : (info.versaoLoader ?? null),
    arquivos,
    proibidos: convite.proibidos,
    semLink: [...new Set(semLink)],
    ...(manuais.length && { manuais }),
    packs
  }
  const { versao, hash } = proximaVersao(convite, hashDoConteudo(conteudo))
  if (versao !== convite.versao || hash !== convite.hash) {
    await gravarConvite(info.pasta, { ...convite, versao, hash })
  }
  const manifesto: Manifesto = {
    ...conteudo,
    versao,
    mensagem: convite.mensagem || undefined,
    servidorId: idFixoDe(info), // Fase M7: fora do hash, não sobe a versão
    enderecos: await enderecosDeJogo(info),
    geradoEm: new Date().toISOString()
  }
  manifestos.set(info.pasta, { em: Date.now(), manifesto })
  return manifesto
}

// ---------- Servidor HTTP só de leitura ----------

let servidores: Server[] = []
let escutando: string[] = []
let erroEscuta: string | null = null
let tokens: Map<string, string> | null = null // token → pasta do servidor
const erros = new Map<string, { n: number; ate: number }>()

async function mapaDeTokens(): Promise<Map<string, string>> {
  if (tokens) return tokens
  const mapa = new Map<string, string>()
  for (const s of (await lerIndice()).servidores) {
    const c = await lerConvite(s.pasta).catch(() => null)
    if (c?.token) mapa.set(c.token, s.pasta)
  }
  tokens = mapa
  return mapa
}

async function alvos(): Promise<string[]> {
  const { enderecoPlayit } = await lerConfig()
  const ips = [ipLocal(), ipRadmin(), ipTailscale()].filter((ip): ip is string => !!ip)
  if (enderecoPlayit) ips.push('127.0.0.1') // o agente do playit entrega o túnel no próprio PC
  return [...new Set(ips)]
}

const CABECALHOS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
}

// Token errado, rota errada, corpo inválido ou lista cheia: 20 erros bloqueiam o IP por 15 min.
function contarErro(ip: string): void {
  const e = erros.get(ip) ?? { n: 0, ate: 0 }
  e.n++
  if (e.n >= MAX_ERROS) erros.set(ip, { n: 0, ate: Date.now() + BLOQUEIO_MS })
  else erros.set(ip, e)
}

const bloqueado = (ip: string): boolean => (erros.get(ip)?.ate ?? 0) > Date.now()

async function tratar(
  ip: string,
  metodo: string | undefined,
  url: string | undefined,
  corpo: string | null
): Promise<[number, string]> {
  if (bloqueado(ip)) return [429, '{}']
  const m = (url ?? '').match(
    /^\/convite\/([0-9A-Z]{16})\/(manifesto\.json|pedido(?:\/([0-9a-f]{32}))?)$/
  )
  const pasta = m ? (await mapaDeTokens()).get(m[1]) : undefined
  let rota: 'manifesto' | 'pedido' | 'situacao' | null = null
  if (m && pasta) {
    if (m[2] === 'manifesto.json' && metodo === 'GET') rota = 'manifesto'
    else if (m[2] === 'pedido' && metodo === 'POST' && corpo !== null) rota = 'pedido'
    else if (m[3] && metodo === 'GET') rota = 'situacao'
  }
  if (!pasta || !rota) {
    contarErro(ip)
    return [404, '{}']
  }
  if (rota === 'pedido') {
    const r = await receberPedido(pasta, corpo!)
    if (!r) {
      contarErro(ip)
      return [400, '{}']
    }
    erros.delete(ip)
    return r
  }
  erros.delete(ip)
  if (rota === 'situacao') {
    const uuid = m![3]!.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
    return [200, JSON.stringify({ situacao: situacaoDoPedido(await lerPedidosDe(pasta), uuid) })]
  }
  const item = (await lerIndice()).servidores.find((s) => s.pasta === pasta)
  const info = item ? await lerInfo(item) : null
  if (!info) return [404, '{}']
  return [200, JSON.stringify(await manifestoDoServidor(info))]
}

async function parar(): Promise<void> {
  await Promise.all(servidores.map((s) => new Promise((r) => s.close(() => r(null)))))
  servidores = []
  escutando = []
}

// Modo amigo (Fase M6): suspenso, o convite não escuta. Só o modo completo retoma.
let suspenso = true

export async function suspenderConvites(): Promise<void> {
  suspenso = true
  await parar()
}

export async function retomarConvites(): Promise<void> {
  suspenso = false
  await atualizarEscuta()
}

// Liga (ou religa) a escuta. Sem nenhum convite ativo, fica tudo desligado.
export async function atualizarEscuta(): Promise<void> {
  await parar()
  erroEscuta = null
  if (suspenso || !(await mapaDeTokens()).size) return
  const { porta } = await lerConfig()
  for (const ip of await alvos()) {
    const s = createServer((req, res) => {
      const ip = req.socket.remoteAddress ?? '?'
      const responder = (corpo: string | null): void =>
        void tratar(ip, req.method, req.url, corpo)
          .catch(() => [500, '{}'] as [number, string])
          .then(([status, resposta]) => {
            res.writeHead(status, CABECALHOS)
            res.end(resposta)
          })
      if (req.method !== 'POST' || bloqueado(ip)) return responder(null)
      // Só o pedido (POST) tem corpo, e pequeno: acima de MAX_CORPO corta na hora.
      let tamanho = Number(req.headers['content-length'] ?? 0)
      const recusar = (): void => {
        contarErro(ip)
        res.writeHead(413, { ...CABECALHOS, Connection: 'close' })
        res.end('{}')
        req.destroy()
      }
      if (tamanho > MAX_CORPO) return recusar()
      const partes: Buffer[] = []
      tamanho = 0
      req.on('data', (b: Buffer) => {
        tamanho += b.length
        if (tamanho > MAX_CORPO) {
          if (!res.headersSent) recusar()
        } else partes.push(b)
      })
      req.on('end', () => {
        if (tamanho <= MAX_CORPO) responder(Buffer.concat(partes).toString('utf8'))
      })
    })
    s.requestTimeout = 10_000
    try {
      await new Promise<void>((resolver, falhar) => {
        s.once('error', falhar)
        s.listen(porta, ip, () => resolver())
      })
      servidores.push(s)
      escutando.push(ip)
    } catch (e) {
      erroEscuta =
        (e as NodeJS.ErrnoException).code === 'EADDRINUSE'
          ? `A porta ${porta} já está em uso por outro programa. Escolha outra porta.`
          : `Não consegui abrir o convite em ${ip}.`
    }
  }
}

// Wi-Fi, Radmin e Tailscale podem conectar depois: confere os endereços de tempos em tempos.
setInterval(() => {
  if (suspenso || (!servidores.length && !tokens?.size)) return
  alvos()
    .then((a) => {
      if (a.join() !== escutando.join()) return atualizarEscuta()
      return undefined
    })
    .catch(() => {})
}, 30_000).unref()

app.on('will-quit', () => void parar())

// ---------- Tela do dono ----------

async function enderecosDoManifesto(): Promise<string[]> {
  const { porta, enderecoPlayit } = await lerConfig()
  const lista = escutando.filter((ip) => ip !== '127.0.0.1').map((ip) => `${ip}:${porta}`)
  // Radmin primeiro: é o caminho mais comum para amigos fora de casa.
  const radmin = ipRadmin()
  lista.sort((a, b) => Number(b.startsWith(`${radmin}:`)) - Number(a.startsWith(`${radmin}:`)))
  if (enderecoPlayit) lista.unshift(enderecoPlayit)
  return lista
}

export async function estadoConvite(info: InfoServidor): Promise<ConviteServidor> {
  const c = await lerConvite(info.pasta)
  const { porta, enderecoPlayit } = await lerConfig()
  const enderecos = await enderecosDoManifesto()
  const ativo = !!c?.token
  return {
    ativo,
    codigo: ativo && enderecos[0] ? codigoDoConvite(enderecos[0], c!.token!) : null,
    link: ativo && enderecos.length ? linkDoConvite(enderecos, c!.token!) : null,
    versao: c?.versao ?? 0,
    proibidos: c?.proibidos ?? [],
    enderecosManifesto: enderecos,
    enderecoPlayitManifesto: enderecoPlayit,
    porta,
    erroEscuta,
    aprovarAutomatico: (await lerPedidosDe(info.pasta)).aprovarAutomatico
  }
}

// Convidar amigos (ou revogar e gerar outro): token novo; o id do convite continua o mesmo,
// para quem tiver o convite novo cair na mesma instalação.
export async function novoConvite(info: InfoServidor): Promise<ConviteServidor> {
  const c = await lerConvite(info.pasta)
  await gravarConvite(info.pasta, {
    conviteId: c?.conviteId ?? randomUUID(),
    token: novoToken(),
    versao: c?.versao ?? 0,
    hash: c?.hash ?? '',
    proibidos: c?.proibidos ?? []
  })
  await atualizarEscuta()
  await manifestoDoServidor(info) // já calcula a versão
  return estadoConvite(info)
}

export async function revogarConvite(info: InfoServidor): Promise<ConviteServidor> {
  const c = await lerConvite(info.pasta)
  if (c) await gravarConvite(info.pasta, { ...c, token: null })
  // Revogar apaga os pedidos pendentes deste convite (Fase M4).
  await comPedidos(info.pasta, async (p) => [{ ...p, pendentes: [] }, null])
  await atualizarEscuta()
  return estadoConvite(info)
}

export async function salvarProibidos(
  info: InfoServidor,
  lista: unknown
): Promise<ConviteServidor> {
  if (!Array.isArray(lista) || lista.length > 200)
    throw new ErroApp('Lista de mods proibidos inválida.')
  const proibidos = [
    ...new Set(
      lista
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x.length >= 3 && x.length <= 64)
    )
  ]
  // A lista vale mesmo sem convite (a tela Mods › Proibidos para jogadores pode vir antes).
  const c = (await lerConvite(info.pasta)) ?? {
    conviteId: randomUUID(),
    token: null,
    versao: 0,
    hash: ''
  }
  await gravarConvite(info.pasta, { ...c, proibidos })
  return estadoConvite(info)
}

export async function configurarConvites(porta: unknown, enderecoPlayit: unknown): Promise<void> {
  if (!Number.isInteger(porta) || (porta as number) < 1024 || (porta as number) > 65535) {
    throw new ErroApp('Escolha uma porta entre 1024 e 65535.')
  }
  const playit = typeof enderecoPlayit === 'string' ? enderecoPlayit.trim() : ''
  if (playit && !enderecoValido(playit)) {
    throw new ErroApp(
      'Endereço do túnel inválido. Copie do site do playit.gg, por exemplo "nome.at.ply.gg:12345".'
    )
  }
  await gravarComSeguranca(
    arquivoConfig(),
    JSON.stringify({ porta, enderecoPlayit: playit || null }, null, 2)
  )
  await atualizarEscuta()
}

// Arquivo de convite para mandar por mensagem: endereços, token e uma cópia do manifesto.
export async function exportarConvite(
  info: InfoServidor,
  janela: BrowserWindow | null
): Promise<string | null> {
  const c = await lerConvite(info.pasta)
  if (!c?.token) throw new ErroApp('Clique em Convidar amigos antes de exportar o convite.')
  const manifesto = await manifestoDoServidor(info)
  const opcoes = {
    title: 'Salvar o convite',
    defaultPath: join(app.getPath('downloads'), `Convite - ${info.nome}.hubsquare`),
    filters: [{ name: 'Convite do HubSquare', extensions: ['hubsquare'] }]
  }
  const escolha = janela
    ? await dialog.showSaveDialog(janela, opcoes)
    : await dialog.showSaveDialog(opcoes)
  if (escolha.canceled || !escolha.filePath) return null
  await writeFile(
    escolha.filePath,
    arquivoDeConvite(await enderecosDoManifesto(), c.token, manifesto)
  )
  return escolha.filePath.split(/[\\/]/).pop() ?? null
}

// ---------- Recado do dono (Fase P4) ----------

// ServSquare › Servidores: um recado curto que os amigos veem na tela Jogar (ex.: "Volto às 20 h").
// Vale também com o servidor desligado, porque vem pelo convite (o app precisa estar aberto).
export async function lerMensagem(servidorId: unknown): Promise<string> {
  const item = (await lerIndice()).servidores.find((s) => s.id === servidorId)
  if (!item) throw new ErroApp('Esse servidor não está mais na lista.')
  return (await lerConvite(item.pasta))?.mensagem ?? ''
}

export async function salvarMensagem(servidorId: unknown, texto: unknown): Promise<void> {
  const item = (await lerIndice()).servidores.find((s) => s.id === servidorId)
  if (!item) throw new ErroApp('Esse servidor não está mais na lista.')
  if (typeof texto !== 'string' || texto.length > 200) {
    throw new ErroApp('Escreva um recado de até 200 letras.')
  }
  // eslint-disable-next-line no-control-regex -- sem caracteres de controle
  const mensagem = texto.replace(/[\x00-\x1f]+/g, ' ').trim()
  const c = (await lerConvite(item.pasta)) ?? {
    conviteId: randomUUID(),
    token: null,
    versao: 0,
    hash: '',
    proibidos: []
  }
  await gravarConvite(item.pasta, { ...c, mensagem })
}
