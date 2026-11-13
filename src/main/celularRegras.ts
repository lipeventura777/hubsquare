import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// Regras do painel pelo celular sem rede nem Electron. Testadas em tests/celular.test.ts.

export const TENTATIVAS = 5
export const BLOQUEIO = 15 * 60 * 1000
export const VALIDADE_SESSAO = 7 * 24 * 60 * 60 * 1000

export interface PinSalvo {
  salt: string // base64
  hash: string // base64, scrypt
}

export function pinValido(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{6,8}$/.test(pin)
}

// Só o hash vai para o disco (scrypt com salt aleatório de 16 bytes).
export function criarHashPin(pin: string): PinSalvo {
  const salt = randomBytes(16)
  return { salt: salt.toString('base64'), hash: scryptSync(pin, salt, 32).toString('base64') }
}

export function conferirPin(pin: string, salvo: PinSalvo): boolean {
  const esperado = Buffer.from(salvo.hash, 'base64')
  const obtido = scryptSync(pin, Buffer.from(salvo.salt, 'base64'), esperado.length)
  return timingSafeEqual(esperado, obtido)
}

// ---------- Bloqueio depois de 5 PINs errados ----------

export interface Tentativas {
  falhas: number
  bloqueadoAte: number | null
}

export type ResultadoLogin =
  | { ok: true }
  | { ok: false; motivo: 'errado'; restantes: number }
  | { ok: false; motivo: 'bloqueado'; ate: number }
  | { ok: false; motivo: 'sem-pin' }

// Confere o PIN e atualiza `t` (mesmo objeto). O bloqueio vale para todos os aparelhos.
export function tentarLogin(
  pin: unknown,
  salvo: PinSalvo | null,
  t: Tentativas,
  agora: number
): ResultadoLogin {
  if (!salvo) return { ok: false, motivo: 'sem-pin' }
  if (t.bloqueadoAte && agora < t.bloqueadoAte)
    return { ok: false, motivo: 'bloqueado', ate: t.bloqueadoAte }
  if (t.bloqueadoAte) t.bloqueadoAte = null
  if (pinValido(pin) && conferirPin(pin, salvo)) {
    t.falhas = 0
    return { ok: true }
  }
  t.falhas++
  if (t.falhas >= TENTATIVAS) {
    t.falhas = 0
    t.bloqueadoAte = agora + BLOQUEIO
    return { ok: false, motivo: 'bloqueado', ate: t.bloqueadoAte }
  }
  return { ok: false, motivo: 'errado', restantes: TENTATIVAS - t.falhas }
}

// ---------- Sessões ----------

export interface Sessao {
  id: string // mostrado na tela (não é o token)
  tokenHash: string // sha256 do token; o token mesmo só fica no cookie do celular
  csrf: string
  aparelho: string
  criada: number
  usada: number
}

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

export function novaSessao(aparelho: string, agora: number): { token: string; sessao: Sessao } {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    sessao: {
      id: randomBytes(6).toString('hex'),
      tokenHash: hashToken(token),
      csrf: randomBytes(24).toString('base64url'),
      aparelho,
      criada: agora,
      usada: agora
    }
  }
}

// A sessão vale 7 dias desde o login.
export function acharSessao(sessoes: Sessao[], token: string | null, agora: number): Sessao | null {
  if (!token) return null
  const h = hashToken(token)
  return sessoes.find((s) => s.tokenHash === h && agora - s.criada < VALIDADE_SESSAO) ?? null
}

export function lerCookie(cabecalho: string | undefined, nome: string): string | null {
  for (const parte of (cabecalho ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nome) return v.join('=') || null
  }
  return null
}

// "iPhone · Safari", "Android · Chrome"... só para a lista de aparelhos.
export function nomeDoAparelho(ua: string | undefined): string {
  const u = ua ?? ''
  const sistema = /iPhone/.test(u)
    ? 'iPhone'
    : /iPad/.test(u)
      ? 'iPad'
      : /Android/.test(u)
        ? 'Android'
        : /Windows/.test(u)
          ? 'Windows'
          : /Mac OS/.test(u)
            ? 'Mac'
            : 'Aparelho'
  const navegador = /EdgA?\//.test(u)
    ? 'Edge'
    : /SamsungBrowser/.test(u)
      ? 'Samsung Internet'
      : /Firefox|FxiOS/.test(u)
        ? 'Firefox'
        : /Chrome|CriOS/.test(u)
          ? 'Chrome'
          : /Safari/.test(u)
            ? 'Safari'
            : 'navegador'
  return `${sistema} · ${navegador}`
}

// ---------- Endereços ----------

// O Tailscale usa a faixa 100.64.0.0/10 (100.64 a 100.127).
export function ehIpTailscale(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  return a === 100 && b >= 64 && b <= 127
}

// Contra "DNS rebinding": o Host do pedido precisa ser exatamente um dos endereços em que o
// painel escuta. E, nos pedidos que mudam algo, a Origem (quando vem) também.
export function hostPermitido(host: string | undefined, ips: string[], porta: number): boolean {
  return !!host && ips.some((ip) => host === `${ip}:${porta}`)
}

export function origemPermitida(origem: string | undefined, host: string): boolean {
  return origem === undefined || origem === `http://${host}`
}

// ---------- Cor de destaque na página do celular ----------

export const ACCENT_PADRAO = '#3c8527'

// Só aceita "#rrggbb" (a cor vai direto para o CSS da página).
export function corSegura(hex: unknown): string {
  return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : ACCENT_PADRAO
}

// Texto escuro sobre cores claras (mesma regra do DESIGN.md, seção 3).
export function textoSobre(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#1b1b1b' : '#ffffff'
}
