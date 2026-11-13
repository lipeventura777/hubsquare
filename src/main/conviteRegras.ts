import { createHash, randomBytes } from 'crypto'
import {
  LOADERS_CLIENTE,
  type ArquivoManifesto,
  type LoaderCliente,
  type Manifesto
} from '../shared/tipos'
import { caminhoDoPack, downloadPermitido } from './modpackRegras'
import { reconhecivel } from './downloadsRegras'

// Regras sem rede nem Electron dos convites (Fase P2): token, código, link, arquivo de convite,
// manifesto (validação, versão e comparação) e o que uma atualização pode apagar.
// Testadas em tests/conviteRegras.test.ts.

// ---------- Token e formatos do convite ----------

// Base32 de Crockford: sem I, L, O e U, para não confundir ao ditar ou copiar.
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const TAMANHO_TOKEN = 16 // 80 bits

export function novoToken(): string {
  const bytes = randomBytes(TAMANHO_TOKEN)
  return [...bytes].map((b) => ALFABETO[b % 32]).join('')
}

export function normalizarToken(texto: unknown): string | null {
  if (typeof texto !== 'string') return null
  const t = texto.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  return t.length === TAMANHO_TOKEN && [...t].every((c) => ALFABETO.includes(c)) ? t : null
}

export const formatarToken = (t: string): string => t.match(/.{1,4}/g)!.join('-')

// "host:porta" sem caminho; o host é IP ou nome (ex.: "26.12.34.56:8788", "x.joinmc.link:4321").
export function enderecoValido(e: unknown): e is string {
  if (typeof e !== 'string' || e.length > 255) return false
  const m = e.match(/^([a-z0-9.-]+):(\d{1,5})$/i)
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 65535 && !m[1].startsWith('.')
}

export const urlDoManifesto = (endereco: string, token: string): string =>
  `http://${endereco}/convite/${token}/manifesto.json`

export function codigoDoConvite(endereco: string, token: string): string {
  return `${endereco}#${formatarToken(token)}`
}

export function linkDoConvite(enderecos: string[], token: string): string {
  const dados = Buffer.from(JSON.stringify({ e: enderecos, t: token })).toString('base64url')
  return `hubsquare://convite/${dados}`
}

export interface ConviteLido {
  enderecos: string[]
  token: string
  manifesto: Manifesto | null // só no arquivo de convite
}

export function arquivoDeConvite(enderecos: string[], token: string, manifesto: Manifesto): string {
  return JSON.stringify({ hubsquare: 'convite', formato: 1, enderecos, token, manifesto }, null, 2)
}

function conviteDe(enderecos: unknown, token: unknown, manifesto: unknown): ConviteLido {
  const t = normalizarToken(token)
  const lista = Array.isArray(enderecos) ? enderecos.filter(enderecoValido).slice(0, 8) : []
  if (!t) throw new Error('O código do convite está incompleto. Peça um convite novo.')
  if (!lista.length && !manifesto) {
    throw new Error('O convite não tem nenhum endereço. Peça um convite novo.')
  }
  return { enderecos: lista, token: t, manifesto: manifesto ? validarManifesto(manifesto) : null }
}

// Aceita o link, o código ou o conteúdo do arquivo de convite.
export function lerConvite(texto: unknown): ConviteLido {
  if (typeof texto !== 'string' || !texto.trim() || texto.length > 2_000_000) {
    throw new Error('Cole o código ou o link do convite.')
  }
  const s = texto.trim()
  if (s.startsWith('{')) {
    let d: Record<string, unknown>
    try {
      d = JSON.parse(s)
    } catch {
      throw new Error('Esse arquivo de convite está estragado. Peça um novo.')
    }
    if (d.hubsquare !== 'convite') throw new Error('Esse arquivo não é um convite do HubSquare.')
    return conviteDe(d.enderecos, d.token, d.manifesto)
  }
  const link = s.match(/^hubsquare:\/\/convite\/([A-Za-z0-9_-]+)$/)
  if (link) {
    let d: { e?: unknown; t?: unknown }
    try {
      d = JSON.parse(Buffer.from(link[1], 'base64url').toString('utf8'))
    } catch {
      throw new Error('Esse link de convite está cortado. Copie o link inteiro de novo.')
    }
    return conviteDe(d.e, d.t, null)
  }
  const codigo = s.match(/^([^#\s]+)#([0-9A-Za-z-]+)$/)
  if (codigo) return conviteDe([codigo[1]], codigo[2], null)
  throw new Error('Não reconheci esse convite. Cole o código (endereço#código) ou o link inteiro.')
}

// ---------- Manifesto ----------

const hex = (s: unknown, n: number): s is string =>
  typeof s === 'string' && new RegExp(`^[0-9a-f]{${n}}$`).test(s)

// Confere tudo o que vem de fora: caminhos dentro da pasta, hashes e links só de sites aceitos.
export function validarManifesto(dado: unknown): Manifesto {
  const m = dado as Partial<Manifesto> | null
  const erro = (o: string): never => {
    throw new Error(`O manifesto do servidor veio com problema (${o}). Peça um convite novo.`)
  }
  if (!m || typeof m !== 'object' || m.formato !== 1) erro('formato')
  if (typeof m!.conviteId !== 'string' || !/^[\w-]{8,64}$/.test(m!.conviteId)) erro('id')
  if (!Number.isInteger(m!.versao) || m!.versao! < 1) erro('versão')
  if (typeof m!.minecraft !== 'string' || !/^[\w.+-]{1,40}$/.test(m!.minecraft)) erro('Minecraft')
  if (!LOADERS_CLIENTE.includes(m!.loader as LoaderCliente)) erro('loader')
  if (
    m!.versaoLoader !== null &&
    !(typeof m!.versaoLoader === 'string' && /^[\w.+-]{1,40}$/.test(m!.versaoLoader))
  )
    erro('versão do loader')
  if (!Array.isArray(m!.arquivos) || m!.arquivos.length > 2000) erro('arquivos')
  const arquivos: ArquivoManifesto[] = m!.arquivos!.map((a) => {
    if (!caminhoDoPack(a?.path) || !/^(mods|resourcepacks|shaderpacks)\/[^/]+$/.test(a.path))
      erro('caminho')
    if (!hex(a.sha1, 40) || !hex(a.sha512, 128)) erro('hash')
    const downloads = Array.isArray(a.downloads) ? a.downloads.filter(downloadPermitido) : []
    if (!downloads.length) erro('link')
    return {
      path: a.path,
      sha1: a.sha1,
      sha512: a.sha512,
      tamanho: Number.isFinite(a.tamanho) ? Math.max(0, a.tamanho) : 0,
      downloads,
      obrigatorio: a.obrigatorio !== false
    }
  })
  const textos = (v: unknown, max: number): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.length <= max).slice(0, 200)
      : []
  return {
    formato: 1,
    conviteId: m!.conviteId!,
    versao: m!.versao!,
    servidor: typeof m!.servidor === 'string' ? m!.servidor.slice(0, 48) : 'Servidor',
    minecraft: m!.minecraft!,
    loader: m!.loader!,
    versaoLoader: m!.versaoLoader ?? null,
    arquivos,
    proibidos: textos(m!.proibidos, 64)
      .map((p) => p.toLowerCase())
      .filter(Boolean),
    semLink: textos(m!.semLink, 200),
    // Fase D: só página do CurseForge, nome seguro e hash; nada além disso passa.
    ...(Array.isArray(m!.manuais) && {
      manuais: m!.manuais
        .slice(0, 200)
        .filter(reconhecivel)
        .map((x) => ({
          titulo: x.titulo.slice(0, 120),
          url: x.url,
          arquivo: x.arquivo,
          tamanho: x.tamanho,
          sha1: x.sha1,
          md5: x.md5
        }))
    }),
    enderecos: textos(m!.enderecos, 255).filter(enderecoValido),
    // Só nomes de resource packs que estão na lista de arquivos.
    packs: textos(m!.packs, 200).filter((p) =>
      arquivos.some((a) => a.path === `resourcepacks/${p}`)
    ),
    geradoEm: typeof m!.geradoEm === 'string' ? m!.geradoEm : '',
    mensagem:
      typeof m!.mensagem === 'string' && m!.mensagem ? m!.mensagem.slice(0, 200) : undefined,
    // Fase M7: id fixo do servidor (o mesmo quando ele passa para outro dono).
    ...(typeof m!.servidorId === 'string' &&
      /^[\w-]{8,64}$/.test(m!.servidorId) && { servidorId: m!.servidorId.toLowerCase() })
  }
}

// O que conta como "mudou": jogo, loader e arquivos. Endereços e data não sobem a versão
// (o Radmin ligar e desligar não pode obrigar o amigo a atualizar).
export function hashDoConteudo(m: Omit<Manifesto, 'versao' | 'geradoEm' | 'enderecos'>): string {
  const arquivos = [...m.arquivos]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((a) => [a.path, a.sha1, a.obrigatorio])
  const conteudo = [
    m.minecraft,
    m.loader,
    m.versaoLoader,
    arquivos,
    [...m.proibidos].sort(),
    m.packs ?? [],
    // Fase D: só entra quando existe, para não subir a versão dos convites antigos.
    ...(m.manuais?.length ? [m.manuais.map((x) => x.sha1 ?? x.md5).sort()] : [])
  ]
  return createHash('sha256').update(JSON.stringify(conteudo)).digest('hex')
}

export function proximaVersao(
  anterior: { versao: number; hash: string } | null,
  hash: string
): { versao: number; hash: string } {
  if (!anterior) return { versao: 1, hash }
  return anterior.hash === hash ? anterior : { versao: anterior.versao + 1, hash }
}

export function precisaAtualizar(aplicada: number, disponivel: number): boolean {
  return disponivel > aplicada
}

// Arquivos que o amigo vai ter: os obrigatórios e os recomendados que ele não recusou.
export function arquivosDesejados(m: Manifesto, recusados: string[]): ArquivoManifesto[] {
  return m.arquivos.filter((a) => a.obrigatorio || !recusados.includes(a.path))
}

const nome = (p: string): string => p.split('/').pop() ?? p

// O que entra e o que sai entre o que está aplicado e o manifesto novo (por caminho + hash).
export function compararManifestos(
  aplicado: Manifesto | null,
  novo: Manifesto,
  recusados: string[]
): { entra: string[]; sai: string[] } {
  const chave = (a: ArquivoManifesto): string => `${a.path}|${a.sha1}`
  const antes = new Set(aplicado ? arquivosDesejados(aplicado, recusados).map(chave) : [])
  const depois = arquivosDesejados(novo, recusados)
  const depoisChaves = new Set(depois.map(chave))
  return {
    entra: depois.filter((a) => !antes.has(chave(a))).map((a) => nome(a.path)),
    sai: aplicado
      ? arquivosDesejados(aplicado, recusados)
          .filter((a) => !depoisChaves.has(chave(a)))
          .map((a) => nome(a.path))
      : []
  }
}

// Mods do jogador (não postos pelo app) que batem com a lista de proibidos do servidor.
export function modsProibidos(meus: string[], proibidos: string[]): string[] {
  return meus.filter((m) => proibidos.some((p) => p && m.toLowerCase().includes(p)))
}

// ---------- O que uma atualização pode mexer ----------

// Pastas cujos arquivos o app gerencia. O resto (config, options.txt, saves, screenshots) é do
// jogador: só é criado se não existir.
export const GERIDAS = /^(mods|resourcepacks|shaderpacks)\//

// Só sai o que o app mesmo pôs (estava no registro anterior) e não faz mais parte.
// Arquivos do jogador ("meus"), mundos, prints e configurações nunca estão no registro.
export function aRemover(
  registroAntes: Record<string, string>,
  registroNovo: Record<string, string>
): string[] {
  return Object.keys(registroAntes).filter(
    (c) => !registroNovo[c] && GERIDAS.test(c) && caminhoDoPack(c)
  )
}

// Override (configuração do pack): arquivos geridos são trocados; os outros só entram se faltam.
export function sobrescreverOverride(caminho: string, existe: boolean): boolean {
  return GERIDAS.test(caminho) || !existe
}

// ---------- Pedidos para entrar (Fase M4) ----------
// O amigo, ao aceitar o convite, pede para entrar na whitelist. A rota de escrita do servidor
// do convite SÓ guarda um pedido pendente; quem aprova é o dono (ou a opção automática).

export const MAX_PEDIDOS = 20 // pendentes por servidor
export const MAX_CORPO = 1024 // bytes do corpo do POST
export const MAX_RECADO = 100
const MAX_RESPOSTAS = 200 // aprovados/recusados lembrados (para o amigo saber a resposta)

import type { SituacaoPedido } from '../shared/tipos'
export type { SituacaoPedido }

export interface PedidoEntrada {
  nick: string
  uuid: string // com tracinhos, minúsculo
  recado: string
  em: string // ISO
}

export interface PedidosServidor {
  aprovarAutomatico: boolean
  pendentes: PedidoEntrada[]
  respostas: Record<string, 'aprovado' | 'recusado'> // uuid → resposta do dono
}

export const PEDIDOS_VAZIO: PedidosServidor = {
  aprovarAutomatico: false,
  pendentes: [],
  respostas: {}
}

// UUID da Mojang com ou sem tracinhos → com tracinhos e minúsculo. null se não for um UUID.
export function normalizarUuid(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const h = valor.trim().toLowerCase().replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/.test(h)) return null
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const nickValido = (n: unknown): n is string =>
  typeof n === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(n)

// Corpo do POST: só nick, uuid e recado (opcional). Qualquer outra coisa é recusada.
export function validarPedido(corpo: unknown): Omit<PedidoEntrada, 'em'> {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new Error('corpo inválido')
  const c = corpo as Record<string, unknown>
  if (Object.keys(c).some((k) => !['nick', 'uuid', 'recado'].includes(k))) {
    throw new Error('campo desconhecido')
  }
  if (!nickValido(c.nick)) throw new Error('nick inválido')
  const uuid = normalizarUuid(c.uuid)
  if (!uuid) throw new Error('uuid inválido')
  const recado = c.recado === undefined ? '' : c.recado
  if (typeof recado !== 'string') throw new Error('recado inválido')
  const limpo = recado.trim()
  // Sem controle, quebras, caracteres invisíveis de direção e afins (\p{C}); emoji e acentos podem.
  if ([...limpo].length > MAX_RECADO || /\p{C}/u.test(limpo)) throw new Error('recado inválido')
  return { nick: c.nick, uuid, recado: limpo }
}

export type ResultadoPedido = 'guardado' | 'aprovar' | 'repetido' | 'cheio' | 'ja-aprovado'

// Guarda um pedido válido. "aprovar": a opção automática está ligada (quem chama põe na
// whitelist e chama decidir). Nunca mexe em nada além da lista de pedidos.
export function guardarPedido(
  p: PedidosServidor,
  novo: Omit<PedidoEntrada, 'em'>,
  agora: string
): { pedidos: PedidosServidor; resultado: ResultadoPedido } {
  if (p.respostas[novo.uuid] === 'aprovado') return { pedidos: p, resultado: 'ja-aprovado' }
  if (p.pendentes.some((x) => x.uuid === novo.uuid)) return { pedidos: p, resultado: 'repetido' }
  if (p.aprovarAutomatico) return { pedidos: p, resultado: 'aprovar' }
  if (p.pendentes.length >= MAX_PEDIDOS) return { pedidos: p, resultado: 'cheio' }
  const respostas = { ...p.respostas }
  delete respostas[novo.uuid] // recusado antes pode pedir de novo
  return {
    pedidos: { ...p, respostas, pendentes: [...p.pendentes, { ...novo, em: agora }] },
    resultado: 'guardado'
  }
}

// Aprovar ou recusar: o pedido sai dos pendentes e a resposta fica para o amigo consultar.
export function decidir(p: PedidosServidor, uuid: string, aprovado: boolean): PedidosServidor {
  const respostas: Record<string, 'aprovado' | 'recusado'> = {
    ...p.respostas,
    [uuid]: aprovado ? 'aprovado' : 'recusado'
  }
  const chaves = Object.keys(respostas)
  for (const k of chaves.slice(0, Math.max(0, chaves.length - MAX_RESPOSTAS))) delete respostas[k]
  return { ...p, respostas, pendentes: p.pendentes.filter((x) => x.uuid !== uuid) }
}

// Só sobre o UUID de quem pergunta.
export function situacaoDoPedido(p: PedidosServidor, uuid: string): SituacaoPedido {
  if (p.pendentes.some((x) => x.uuid === uuid)) return 'pendente'
  return p.respostas[uuid] ?? 'desconhecido'
}

// Arquivo guardado (servsquare-pedidos.json): qualquer coisa estranha volta ao vazio.
export function lerPedidos(json: unknown): PedidosServidor {
  const d = (json ?? {}) as Partial<PedidosServidor>
  const pendentes = Array.isArray(d.pendentes)
    ? d.pendentes.filter(
        (x): x is PedidoEntrada =>
          !!x &&
          nickValido(x.nick) &&
          normalizarUuid(x.uuid) === x.uuid &&
          typeof x.recado === 'string'
      )
    : []
  const respostas: PedidosServidor['respostas'] = {}
  if (d.respostas && typeof d.respostas === 'object') {
    for (const [k, v] of Object.entries(d.respostas)) {
      if (normalizarUuid(k) === k && (v === 'aprovado' || v === 'recusado')) respostas[k] = v
    }
  }
  return {
    aprovarAutomatico: d.aprovarAutomatico === true,
    pendentes: pendentes.slice(0, MAX_PEDIDOS),
    respostas
  }
}

export const urlDoPedido = (endereco: string, token: string): string =>
  `http://${endereco}/convite/${token}/pedido`

export const urlDaSituacao = (endereco: string, token: string, uuid: string): string =>
  `http://${endereco}/convite/${token}/pedido/${uuid.replace(/-/g, '')}`
