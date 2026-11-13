import { app } from 'electron'
import { readFile } from 'fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { join } from 'path'
import icone from '../../resources/icon.png?asset'
import {
  NOMES_TIPOS,
  type EstadoCelular,
  type InfoServidor,
  type UsoServidor
} from '../shared/tipos'
import { registrarAcao } from './acoes'
import { lerAparencia } from './aparencia'
import { HTML, JS, MANIFESTO, css } from './celularPagina'
import {
  VALIDADE_SESSAO,
  acharSessao,
  corSegura,
  textoSobre,
  criarHashPin,
  hostPermitido,
  lerCookie,
  nomeDoAparelho,
  novaSessao,
  origemPermitida,
  pinValido,
  tentarLogin,
  type PinSalvo,
  type Sessao,
  type Tentativas
} from './celularRegras'
import { gravarComSeguranca } from './config'
import { estadoConexao, ipLocal, ipRadmin, ipTailscale, lerIpPublico } from './conexao'
import { ErroApp } from './erros'
import { cabecaJogador, lerJogadores, listarTodos } from './jogadores'
import { listarServidores, trocarServidor } from './listaServidores'
import {
  desligar,
  eventos,
  lerConsole,
  lerEstado,
  ligar,
  reiniciar,
  servidorAtual
} from './servidor'

// Integrações › Celular (Fase 20): painel no navegador do celular.
// Escuta só nos IPs da rede local, do Radmin e do Tailscale (nunca em 0.0.0.0) e nunca abre porta
// no roteador. Login por PIN (só o hash fica salvo), sessão por cookie e proteção contra CSRF.

const COOKIE = 'ss_sessao'
const PORTA_PADRAO = 8787
const LIMITE_CORPO = 4096

interface Config {
  ativo: boolean
  porta: number
  pin: PinSalvo | null
  sessoes: Sessao[]
}

const arquivo = (): string => join(app.getPath('userData'), 'celular.json')
let config: Config = { ativo: false, porta: PORTA_PADRAO, pin: null, sessoes: [] }
const tentativas: Tentativas = { falhas: 0, bloqueadoAte: null }
let servidores: Server[] = []
let escutando: string[] = []
let erroEscuta: string | null = null
let ultimoUso: UsoServidor | null = null

eventos.on('uso', (u) => (ultimoUso = u))
eventos.on('estado', (e) => {
  if (e === 'desligado') ultimoUso = null
})

async function lerConfig(): Promise<void> {
  try {
    const d = JSON.parse(await readFile(arquivo(), 'utf8')) as Partial<Config>
    config = {
      ativo: d.ativo === true && !!d.pin,
      porta: Number.isInteger(d.porta) ? (d.porta as number) : PORTA_PADRAO,
      pin: d.pin?.salt && d.pin.hash ? d.pin : null,
      sessoes: Array.isArray(d.sessoes) ? d.sessoes : []
    }
  } catch {
    // primeira vez: fica desligado
  }
}

async function gravar(): Promise<void> {
  const agora = Date.now()
  config.sessoes = config.sessoes.filter((s) => agora - s.criada < VALIDADE_SESSAO)
  await gravarComSeguranca(arquivo(), JSON.stringify(config, null, 2))
}

// ---------- Onde escutar ----------

function enderecosAlvo(): string[] {
  return [...new Set([ipLocal(), ipRadmin(), ipTailscale()].filter((ip): ip is string => !!ip))]
}

async function pararEscuta(): Promise<void> {
  await Promise.all(servidores.map((s) => new Promise((r) => s.close(() => r(null)))))
  servidores = []
  escutando = []
}

async function reiniciarEscuta(): Promise<void> {
  await pararEscuta()
  erroEscuta = null
  if (!config.ativo) return
  for (const ip of enderecosAlvo()) {
    const s = createServer((req, res) => {
      tratar(req, res).catch(() =>
        responder(res, 500, { erro: 'Algo deu errado no PC. Tente de novo.' })
      )
    })
    try {
      await new Promise<void>((resolver, falhar) => {
        s.once('error', falhar)
        s.listen(config.porta, ip, () => resolver())
      })
      servidores.push(s)
      escutando.push(ip)
    } catch (e) {
      erroEscuta =
        (e as NodeJS.ErrnoException).code === 'EADDRINUSE'
          ? `A porta ${config.porta} já está em uso por outro programa. Escolha outra porta.`
          : `Não consegui abrir o painel em ${ip}.`
    }
  }
}

// Modo amigo (Fase M6): suspenso, o painel não escuta nem religa sozinho (a configuração fica).
let suspenso = true

export async function suspenderCelular(): Promise<void> {
  suspenso = true
  await pararEscuta()
}

// O Wi-Fi, o Radmin e o Tailscale podem conectar depois: confere os endereços de tempos em tempos.
setInterval(() => {
  if (!config.ativo || suspenso) return
  const alvo = enderecosAlvo()
  if (alvo.length !== escutando.length || alvo.some((ip) => !escutando.includes(ip))) {
    reiniciarEscuta().catch(() => {})
  }
}, 30_000)

export async function iniciarCelular(): Promise<void> {
  suspenso = false
  await lerConfig()
  await reiniciarEscuta()
}

// ---------- Respostas ----------

const CABECALHOS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'"
}

function responder(
  res: ServerResponse,
  status: number,
  corpo: unknown,
  extra: Record<string, string> = {}
): void {
  res.writeHead(status, {
    ...CABECALHOS,
    'Content-Type': 'application/json; charset=utf-8',
    ...extra
  })
  res.end(JSON.stringify(corpo))
}

function arquivoFixo(res: ServerResponse, tipo: string, conteudo: string | Buffer): void {
  res.writeHead(200, { ...CABECALHOS, 'Content-Type': tipo })
  res.end(conteudo)
}

function lerCorpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolver, falhar) => {
    // Só JSON: um formulário de outro site não consegue mandar este tipo sem a permissão do navegador.
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
      return falhar(new ErroApp('Pedido inválido.'))
    }
    let tamanho = 0
    const partes: Buffer[] = []
    req.on('data', (p: Buffer) => {
      tamanho += p.length
      if (tamanho > LIMITE_CORPO) {
        req.destroy()
        falhar(new ErroApp('Pedido grande demais.'))
      } else partes.push(p)
    })
    req.on('end', () => {
      try {
        const v = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')
        resolver(v && typeof v === 'object' ? v : {})
      } catch {
        falhar(new ErroApp('Pedido inválido.'))
      }
    })
  })
}

async function registrar(texto: string): Promise<void> {
  const info = await servidorAtual()
  if (info) await registrarAcao(info, `Celular: ${texto}`)
}

// ---------- Rotas ----------

let gravarUsoDepois: NodeJS.Timeout | undefined

async function tratar(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host
  // Contra "DNS rebinding": só responde pelos próprios endereços.
  if (!hostPermitido(host, escutando, config.porta)) {
    return responder(res, 403, { erro: 'Endereço não permitido.' })
  }
  const url = new URL(req.url ?? '/', `http://${host}`)
  const rota = `${req.method} ${url.pathname}`

  if (req.method === 'GET') {
    if (url.pathname === '/') return arquivoFixo(res, 'text/html; charset=utf-8', HTML)
    if (url.pathname === '/app.js') return arquivoFixo(res, 'text/javascript; charset=utf-8', JS)
    if (url.pathname === '/app.css') {
      const destaque = corSegura((await lerAparencia().catch(() => null))?.destaque)
      return arquivoFixo(res, 'text/css; charset=utf-8', css(destaque, textoSobre(destaque)))
    }
    if (url.pathname === '/manifest.webmanifest') {
      return arquivoFixo(res, 'application/manifest+json', MANIFESTO)
    }
    if (url.pathname === '/icone.png') return arquivoFixo(res, 'image/png', await readFile(icone))
  }

  // Tudo que muda algo: a Origem (quando o navegador manda) precisa ser este mesmo endereço.
  if (req.method === 'POST' && !origemPermitida(req.headers.origin, host as string)) {
    return responder(res, 403, { erro: 'Pedido de outro site recusado.' })
  }

  if (rota === 'POST /api/login') return login(req, res)

  const sessao = acharSessao(config.sessoes, lerCookie(req.headers.cookie, COOKIE), Date.now())
  if (!sessao) return responder(res, 401, { erro: 'Entre com o PIN.' })
  sessao.usada = Date.now()
  gravarUsoDepois ??= setTimeout(() => {
    gravarUsoDepois = undefined
    gravar().catch(() => {})
  }, 60_000)

  if (rota === 'GET /api/estado') return responder(res, 200, await estado(sessao))
  if (rota === 'GET /api/cabeca') return cabeca(res, url.searchParams.get('uuid'))

  if (req.method === 'POST') {
    // CSRF: o token da sessão precisa vir no cabeçalho (outro site não consegue ler nem mandar).
    if (req.headers['x-csrf'] !== sessao.csrf)
      return responder(res, 403, { erro: 'Recarregue a página.' })
    const corpo = await lerCorpo(req).catch(() => null)
    if (!corpo) return responder(res, 400, { erro: 'Pedido inválido.' })
    if (url.pathname === '/api/acao') return acao(res, sessao, corpo.acao)
    if (url.pathname === '/api/trocar') return trocar(res, sessao, corpo.id, corpo.ligar)
    if (url.pathname === '/api/sair') {
      config.sessoes = config.sessoes.filter((s) => s.id !== sessao.id)
      await gravar()
      await registrar(`${sessao.aparelho} saiu.`)
      return responder(
        res,
        200,
        {},
        { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` }
      )
    }
  }
  responder(res, 404, { erro: 'Não encontrado.' })
}

async function login(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const corpo = await lerCorpo(req).catch(() => null)
  if (!corpo) return responder(res, 400, { erro: 'Pedido inválido.' })
  const aparelho = nomeDoAparelho(req.headers['user-agent'])
  const bloqueioAntes = tentativas.bloqueadoAte
  const r = tentarLogin(corpo.pin, config.pin, tentativas, Date.now())
  if (!r.ok) {
    if (r.motivo === 'bloqueado') {
      const min = Math.max(1, Math.ceil((r.ate - Date.now()) / 60_000))
      // Registra só quando o bloqueio começa (não a cada tentativa durante ele).
      if (r.ate !== bloqueioAntes)
        await registrar(`PIN errado 5 vezes (${aparelho}). Painel bloqueado por 15 min.`)
      return responder(res, 429, {
        erro: `Muitas tentativas erradas. Tente de novo em ${min} min.`
      })
    }
    if (r.motivo === 'sem-pin')
      return responder(res, 403, { erro: 'Crie o PIN no app, em Integrações › Celular.' })
    return responder(res, 401, {
      erro: `PIN errado. ${r.restantes === 1 ? 'Falta 1 tentativa' : `Faltam ${r.restantes} tentativas`} antes de bloquear por 15 min.`
    })
  }
  const { token, sessao } = novaSessao(aparelho, Date.now())
  config.sessoes.push(sessao)
  await gravar()
  await registrar(`entrada pelo ${aparelho}.`)
  responder(
    res,
    200,
    { csrf: sessao.csrf },
    {
      'Set-Cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${VALIDADE_SESSAO / 1000}`
    }
  )
}

// Nome → UUID dos jogadores (para as cabeças), lido no máximo a cada 30 s.
let uuids: { quando: number; mapa: Map<string, string> } = { quando: 0, mapa: new Map() }

async function uuidDe(info: InfoServidor, nome: string): Promise<string | null> {
  if (Date.now() - uuids.quando > 30_000) {
    const todos = await listarTodos(info).catch(() => [])
    uuids = {
      quando: Date.now(),
      mapa: new Map(todos.map((j): [string, string] => [j.nome, j.uuid]))
    }
  }
  return uuids.mapa.get(nome) || null
}

// Endereço que os amigos usam, igual ao da janela do app (tela Conexão).
let ipPublico: { quando: number; ip: string | null } = { quando: 0, ip: null }

async function enderecoAtivo(): Promise<string | null> {
  if (lerEstado() !== 'ligado') return null
  const c = await estadoConexao().catch(() => null)
  if (!c) return null
  if (c.modo === 'playit') return c.playit.endereco
  if (c.modo === 'radmin') return c.radminIp && `${c.radminIp}:${c.porta}`
  if (c.modo === 'lan') return c.lanIp && `${c.lanIp}:${c.porta}`
  if (Date.now() - ipPublico.quando > 5 * 60_000) {
    ipPublico = { quando: Date.now(), ip: await lerIpPublico().catch(() => null) }
  }
  return ipPublico.ip && `${ipPublico.ip}:${c.porta}`
}

async function estado(sessao: Sessao): Promise<unknown> {
  const info = await servidorAtual()
  const lista = await listarServidores().catch(() => [])
  const ligado = lerEstado() !== 'desligado'
  return {
    csrf: sessao.csrf,
    aparelho: sessao.aparelho,
    estado: lerEstado(),
    servidor: info && { nome: info.nome, descricao: `${NOMES_TIPOS[info.tipo]} ${info.versao}` },
    servidores: lista.map((s) => ({ id: s.id, nome: s.nome, ativo: s.ativo })),
    jogadores: info
      ? await Promise.all(
          lerJogadores().map(async (nome) => ({ nome, uuid: await uuidDe(info, nome) }))
        )
      : [],
    uso: ligado ? ultimoUso : null,
    endereco: await enderecoAtivo(),
    // Só leitura: o painel não manda comandos ao console nesta fase.
    console: lerConsole()
      .historico.slice(-50)
      .map((l) => l.texto)
  }
}

async function cabeca(res: ServerResponse, uuid: string | null): Promise<void> {
  const info = await servidorAtual()
  const dataUrl = info && uuid ? await cabecaJogador(info, uuid).catch(() => null) : null
  if (!dataUrl) return responder(res, 404, { erro: 'Sem cabeça.' })
  arquivoFixo(res, 'image/png', Buffer.from(dataUrl.split(',')[1], 'base64'))
}

async function acao(res: ServerResponse, sessao: Sessao, qual: unknown): Promise<void> {
  const quem = sessao.aparelho
  try {
    if (qual === 'ligar') {
      await ligar()
      await registrar(`${quem} ligou o servidor.`)
    } else if (qual === 'desligar') {
      await registrar(`${quem} desligou o servidor.`)
      // Desligar leva até 30 s; o painel acompanha pelo estado.
      void desligar().catch(() => {})
    } else if (qual === 'reiniciar') {
      await registrar(`${quem} reiniciou o servidor.`)
      void reiniciar().catch(() => {})
    } else return responder(res, 400, { erro: 'Ação desconhecida.' })
    responder(res, 200, {})
  } catch (e) {
    responder(res, 409, {
      erro: e instanceof ErroApp ? e.message : 'Não deu certo. Tente de novo.'
    })
  }
}

async function trocar(
  res: ServerResponse,
  sessao: Sessao,
  id: unknown,
  ligarDepois: unknown
): Promise<void> {
  const alvo = (await listarServidores()).find((s) => s.id === id)
  if (!alvo) return responder(res, 404, { erro: 'Esse servidor não existe mais.' })
  await registrar(
    `${sessao.aparelho} trocou para o servidor ${alvo.nome}${ligarDepois === true ? ' e ligou' : ''}.`
  )
  // Desligar o atual (com backup) pode demorar; o painel acompanha pelo estado.
  void trocarServidor(id, ligarDepois === true).catch(() => {})
  responder(res, 200, {})
}

// ---------- Tela Integrações › Celular ----------

export function estadoCelular(): EstadoCelular {
  const url = (ip: string | null): string | null => (ip ? `http://${ip}:${config.porta}` : null)
  const agora = Date.now()
  return {
    ativo: config.ativo,
    porta: config.porta,
    temPin: !!config.pin,
    enderecos: [
      { rotulo: 'Rede local (Wi-Fi de casa)', ip: ipLocal() },
      { rotulo: 'Radmin VPN', ip: ipRadmin() },
      { rotulo: 'Tailscale (fora de casa)', ip: ipTailscale() }
    ].map((e) => ({
      rotulo: e.rotulo,
      url: url(e.ip),
      escutando: !!e.ip && escutando.includes(e.ip)
    })),
    erro: erroEscuta,
    aparelhos: config.sessoes
      .filter((s) => agora - s.criada < VALIDADE_SESSAO)
      .map(({ id, aparelho, criada, usada }) => ({ id, aparelho, criada, usada }))
  }
}

// Trocar o PIN desconecta todos os aparelhos.
export async function definirPin(pin: unknown): Promise<EstadoCelular> {
  if (!pinValido(pin)) throw new ErroApp('O PIN precisa ter de 6 a 8 números.')
  config.pin = criarHashPin(pin)
  config.sessoes = []
  await gravar()
  return estadoCelular()
}

export async function ativarCelular(valor: unknown): Promise<EstadoCelular> {
  if (valor === true && !config.pin) throw new ErroApp('Crie o PIN antes de ligar o painel.')
  config.ativo = valor === true
  await gravar()
  await reiniciarEscuta()
  return estadoCelular()
}

export async function definirPortaCelular(valor: unknown): Promise<EstadoCelular> {
  if (!Number.isInteger(valor) || (valor as number) < 1024 || (valor as number) > 65535) {
    throw new ErroApp('Escolha uma porta entre 1024 e 65535.')
  }
  config.porta = valor as number
  await gravar()
  await reiniciarEscuta()
  return estadoCelular()
}

export async function desconectarTodos(): Promise<EstadoCelular> {
  config.sessoes = []
  await gravar()
  await registrar('todos os aparelhos foram desconectados pelo app.')
  return estadoCelular()
}
