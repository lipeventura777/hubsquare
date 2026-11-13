// Regras do aviso de versão nova do HubSquare (Fase M2), sem rede nem Electron. Testadas em
// tests/atualizacaoAppRegras.test.ts. O app só AVISA: nunca baixa nem instala sozinho.

export const INTERVALO = 6 * 60 * 60 * 1000 // ao abrir e a cada 6 h
const LEMBRAR_DEPOIS = 24 * 60 * 60 * 1000

import type { ReleaseApp } from '../shared/tipos'
export type { ReleaseApp }

export interface EstadoAviso {
  ligado: boolean
  verificadoEm: number // 0 = nunca
  etag: string | null // pedido condicional: sem mudança, o GitHub responde 304 sem corpo
  release: ReleaseApp | null
  pulada: string | null // "Pular esta versão"
  lembrarDepoisAte: number // "Lembrar depois"
}

export const ESTADO_INICIAL: EstadoAviso = {
  ligado: true,
  verificadoEm: 0,
  etag: null,
  release: null,
  pulada: null,
  lembrarDepoisAte: 0
}

// Semver: "v1.2.3", "1.2.3-beta.1". null = não é uma versão.
function partes(v: string): { nucleo: number[]; pre: string[] } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v.trim())
  if (!m) return null
  return { nucleo: [m[1], m[2], m[3]].map(Number), pre: m[4] ? m[4].split('.') : [] }
}

// Negativo: a é mais antiga que b. Pré-lançamento vem antes da versão final (1.2.0-beta < 1.2.0).
export function compararSemver(a: string, b: string): number {
  const pa = partes(a)
  const pb = partes(b)
  if (!pa || !pb) return 0 // versão estranha: trata como igual (nunca avisa por engano)
  for (let i = 0; i < 3; i++) {
    const d = pa.nucleo[i] - pb.nucleo[i]
    if (d !== 0) return d
  }
  if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i]
    const y = pb.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x)
    const ny = /^\d+$/.test(y)
    if (nx && ny && Number(x) !== Number(y)) return Number(x) - Number(y)
    if (nx !== ny) return nx ? -1 : 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

// Resposta de /releases/latest. Só aceita release publicado do próprio repositório, com versão
// válida e página no github.com (o botão "Baixar" abre só ela).
export function releaseDoGitHub(json: unknown, repositorio: string): ReleaseApp | null {
  const r = json as {
    tag_name?: unknown
    html_url?: unknown
    body?: unknown
    draft?: unknown
    prerelease?: unknown
  } | null
  if (!r || typeof r.tag_name !== 'string' || typeof r.html_url !== 'string') return null
  if (r.draft === true || r.prerelease === true) return null
  if (!partes(r.tag_name)) return null
  if (!r.html_url.startsWith(`https://github.com/${repositorio}/releases/`)) return null
  return {
    versao: r.tag_name.replace(/^v/, ''),
    url: r.html_url,
    notas: typeof r.body === 'string' ? r.body.slice(0, 20_000) : ''
  }
}

export const deveVerificar = (e: EstadoAviso, agora: number): boolean =>
  e.ligado && (agora - e.verificadoEm >= INTERVALO || agora < e.verificadoEm)

// Resposta do GitHub (null = sem internet ou tempo esgotado): novo estado. Sem internet nada muda
// (tenta de novo no próximo ciclo); limite estourado (403/429) espera o próximo ciclo.
export type RespostaGitHub = { status: number; etag: string | null; json: unknown } | null

export function aplicarResposta(
  e: EstadoAviso,
  r: RespostaGitHub,
  repositorio: string,
  agora: number
): EstadoAviso {
  if (!r) return e
  if (r.status === 304) return { ...e, verificadoEm: agora }
  if (r.status === 200) {
    const release = releaseDoGitHub(r.json, repositorio)
    return { ...e, verificadoEm: agora, etag: release ? r.etag : null, release }
  }
  if (r.status === 404) return { ...e, verificadoEm: agora, etag: null, release: null }
  return { ...e, verificadoEm: agora }
}

// O aviso que a tela mostra agora, ou null.
export function avisoParaMostrar(atual: string, e: EstadoAviso, agora: number): ReleaseApp | null {
  const r = e.release
  if (!e.ligado || !r) return null
  if (compararSemver(r.versao, atual) <= 0) return null
  if (e.pulada === r.versao) return null
  if (agora < e.lembrarDepoisAte) return null
  return r
}

export const lembrarDepois = (e: EstadoAviso, agora: number): EstadoAviso => ({
  ...e,
  lembrarDepoisAte: agora + LEMBRAR_DEPOIS
})

export const pularVersao = (e: EstadoAviso): EstadoAviso => ({
  ...e,
  pulada: e.release?.versao ?? e.pulada
})

// Lê o arquivo guardado; qualquer coisa estranha volta ao padrão campo a campo.
export function lerEstado(json: unknown): EstadoAviso {
  const d = (json ?? {}) as Partial<EstadoAviso>
  const r = d.release
  return {
    ligado: d.ligado !== false,
    verificadoEm: typeof d.verificadoEm === 'number' ? d.verificadoEm : 0,
    etag: typeof d.etag === 'string' ? d.etag : null,
    release:
      r && typeof r.versao === 'string' && typeof r.url === 'string' && typeof r.notas === 'string'
        ? r
        : null,
    pulada: typeof d.pulada === 'string' ? d.pulada : null,
    lembrarDepoisAte: typeof d.lembrarDepoisAte === 'number' ? d.lembrarDepoisAte : 0
  }
}
