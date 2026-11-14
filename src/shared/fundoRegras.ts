import { BIOMAS, type Bioma } from './tipos'

// Regras sem Electron dos fundos (Fase V4): imagens guardadas pelo app (tipo pelos bytes, nome
// pelo hash), o protocolo hubsquare-fundo:// (só a pasta de fundos), a ordem de prioridade
// (instalação > app > bioma padrão), os ajustes da imagem, o tom do vidro e a migração das
// preferências antigas. Testadas em tests/fundoRegras.test.ts.

export const PROTOCOLO_FUNDO = 'hubsquare-fundo'
export const LIMITE_IMAGEM = 25 * 1024 * 1024
export const LADO_MAXIMO = 2560

export interface AjusteImagem {
  enquadrar: 'preencher' | 'inteira'
  focoX: number // 0 a 1: centro do enquadramento
  focoY: number
  desfoque: number // 0 a 20 px
  luz: number // −60 (escurecer 60%) a +60 (clarear 60%)
  particulas: Bioma | null // partículas de um bioma por cima, ou nenhuma
}

export type EscolhaFundo =
  { tipo: 'bioma'; bioma: Bioma } | { tipo: 'imagem'; imagem: string; ajuste: AjusteImagem }

export const AJUSTE_PADRAO: AjusteImagem = {
  enquadrar: 'preencher',
  focoX: 0.5,
  focoY: 0.5,
  desfoque: 0,
  luz: -30,
  particulas: null
}

export const BIOMAS_CLAROS: Bioma[] = ['diaClaro', 'dia', 'mar', 'cerejeira']
export const BIOMAS_ESCUROS: Bioma[] = [
  'noite',
  'nether',
  'caverna',
  'deepDark',
  'deserto',
  'aurora',
  'ametista',
  'pantano'
]
// Vidro claro com texto escuro (menus e campos nativos em modo claro).
export const BIOMAS_DE_VIDRO_CLARO: Bioma[] = ['diaClaro', 'cerejeira']

// ---------- Imagens guardadas ----------

export type TipoImagem = 'png' | 'jpg' | 'webp'

// O tipo vem dos bytes do começo do arquivo, nunca da extensão.
export function tipoDaImagem(b: Uint8Array): TipoImagem | null {
  const igual = (pos: number, bytes: number[]): boolean =>
    b.length >= pos + bytes.length && bytes.every((x, i) => b[pos + i] === x)
  if (igual(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (igual(0, [0xff, 0xd8, 0xff])) return 'jpg'
  if (igual(0, [0x52, 0x49, 0x46, 0x46]) && igual(8, [0x57, 0x45, 0x42, 0x50])) return 'webp'
  return null
}

// Por que a imagem não serve (null: serve). Tamanho em bytes.
export function motivoRecusa(b: Uint8Array, tamanho: number): string | null {
  if (tamanho > LIMITE_IMAGEM) return 'Essa imagem é muito grande. Escolha uma de até 25 MB.'
  if (!tipoDaImagem(b)) return 'Esse arquivo não é uma imagem PNG, JPG ou WEBP. Escolha outro.'
  return null
}

// Nome guardado: o hash do conteúdo (SHA-256 em hexadecimal) e o tipo.
const NOME = /^[0-9a-f]{64}\.(png|jpg|webp)$/
export const nomeValido = (nome: unknown): nome is string =>
  typeof nome === 'string' && NOME.test(nome)

// Tamanho final: o lado maior fica em até LADO_MAXIMO, sem mudar a proporção.
export function tamanhoReduzido(
  largura: number,
  altura: number
): { largura: number; altura: number } | null {
  const maior = Math.max(largura, altura)
  if (maior <= LADO_MAXIMO) return null
  const f = LADO_MAXIMO / maior
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) }
}

// hubsquare-fundo://img/<hash>.<tipo> → o nome do arquivo na pasta de fundos (ou null: recusado).
// Nada de "..", barras, outras pastas ou nomes que o app não gerou.
export function arquivoDoProtocolo(url: string): string | null {
  // Antes de o URL normalizar: qualquer ".." (ou "%2e") recusa o pedido inteiro.
  if (/\.\.|%2e/i.test(url)) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== `${PROTOCOLO_FUNDO}:` || u.hostname !== 'img') return null
  const nome = decodeURIComponent(u.pathname.replace(/^\//, ''))
  return nomeValido(nome) ? nome : null
}

export const urlDoFundo = (nome: string): string => `${PROTOCOLO_FUNDO}://img/${nome}`

// ---------- Escolhas ----------

const num = (v: unknown, min: number, max: number, padrao: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao

export function validarAjuste(v: unknown): AjusteImagem {
  const a = (v ?? {}) as Partial<AjusteImagem>
  return {
    enquadrar: a.enquadrar === 'inteira' ? 'inteira' : 'preencher',
    focoX: num(a.focoX, 0, 1, 0.5),
    focoY: num(a.focoY, 0, 1, 0.5),
    desfoque: Math.round(num(a.desfoque, 0, 20, 0)),
    luz: Math.round(num(a.luz, -60, 60, AJUSTE_PADRAO.luz)),
    particulas: BIOMAS.includes(a.particulas as Bioma) ? (a.particulas as Bioma) : null
  }
}

// null: "Igual ao app" (só para a instalação). Lança erro com escolha inválida.
export function validarEscolha(v: unknown): EscolhaFundo | null {
  if (v === null) return null
  const e = v as Partial<{ tipo: string; bioma: unknown; imagem: unknown; ajuste: unknown }>
  if (e?.tipo === 'bioma' && BIOMAS.includes(e.bioma as Bioma)) {
    return { tipo: 'bioma', bioma: e.bioma as Bioma }
  }
  if (e?.tipo === 'imagem' && nomeValido(e.imagem)) {
    return { tipo: 'imagem', imagem: e.imagem, ajuste: validarAjuste(e.ajuste) }
  }
  throw new Error('Escolha um bioma ou uma imagem da lista.')
}

// Ordem: fundo da instalação > fundo do app > bioma padrão.
export function fundoEfetivo(
  instalacao: EscolhaFundo | null | undefined,
  app: EscolhaFundo | null | undefined,
  biomaPadrao: Bioma
): EscolhaFundo {
  return instalacao ?? app ?? { tipo: 'bioma', bioma: biomaPadrao }
}

export const mesmaEscolha = (a: EscolhaFundo | null, b: EscolhaFundo | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

// Tom do vidro sobre uma imagem: claro (Dia claro) se a imagem é clara, senão escuro (Dia).
// O contraste de 4,5:1 vem depois, pela regra da V1 (contrasteRegras.ts) com a amostra da imagem.
export const tomDoVidro = (luminanciaMedia: number): Bioma =>
  luminanciaMedia > 0.45 ? 'diaClaro' : 'dia'

// A luz do ajuste como camada por cima da imagem: cor (preto ou branco) e opacidade.
export function camadaDeLuz(luz: number): { cor: 'preto' | 'branco'; opacidade: number } | null {
  if (!luz) return null
  return { cor: luz < 0 ? 'preto' : 'branco', opacidade: Math.min(60, Math.abs(luz)) / 100 }
}

// ---------- Migração (preferências de antes da V4) ----------

// App: só a imagem que já valia no app inteiro vira o fundo do app; o resto, o bioma.
export function fundoAppAntigo(salvo: {
  bioma: Bioma
  fundoEmTodoApp?: boolean
  escurecimento?: number
  particulasSobreImagem?: boolean
}): { usarImagemAntiga: boolean; ajuste: AjusteImagem } {
  return {
    usarImagemAntiga: salvo.fundoEmTodoApp === true,
    ajuste: {
      ...AJUSTE_PADRAO,
      luz: -Math.min(60, Math.round((salvo.escurecimento ?? 0.3) * 100)),
      particulas: salvo.particulasSobreImagem === false ? null : salvo.bioma
    }
  }
}

// Instalação: bioma próprio > imagem própria > fundo padrão antigo de todas > igual ao app.
export function fundoInstalacaoAntigo(i: {
  bannerBioma?: Bioma | null
  imagemPropria: 'existe' | 'sumiu' | null
  padraoAntigo: boolean
}): 'bioma' | 'imagem' | 'padrao' | 'igual' | 'sumiu' {
  if (i.bannerBioma && BIOMAS.includes(i.bannerBioma)) return 'bioma'
  if (i.imagemPropria === 'existe') return 'imagem'
  if (i.imagemPropria === 'sumiu') return 'sumiu'
  return i.padraoAntigo ? 'padrao' : 'igual'
}
