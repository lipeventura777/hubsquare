import { derivarAccent } from './accent'
import { ALTURA, ARTE, LARGURA } from '../fundo/biomas'
import { BIOMAS, type Bioma } from '../../../shared/tipos'
import { ajustarAoFundo, hex, paraHex, rgbDeTexto, type Rgb } from '../../../shared/contrasteRegras'

// Bioma, vidro e cor de destaque na página (Fase V1). O tokens.css tem um conjunto de tokens
// por bioma em [data-bioma]; aqui só trocamos o atributo e as variáveis calculadas.

const CHAVE = 'hubsquare-bioma'

// Antes de desenhar a tela, o último bioma usado (para não piscar outro até as preferências chegarem).
export function aplicarBiomaGuardado(): void {
  try {
    const b = localStorage.getItem(CHAVE)
    if (BIOMAS.includes(b as Bioma)) document.documentElement.dataset.bioma = b!
  } catch {
    // sem armazenamento: fica o bioma padrão até as preferências chegarem
  }
}

export function aplicarBioma(bioma: Bioma, vidroLeve: boolean): void {
  const raiz = document.documentElement
  raiz.dataset.bioma = bioma
  raiz.toggleAttribute('data-vidro-leve', vidroLeve)
  // A arte do bioma como imagem, para os banners e miniaturas sem imagem própria (.banner-padrao).
  const tela = document.createElement('canvas')
  tela.width = LARGURA
  tela.height = ALTURA
  const c = tela.getContext('2d')
  if (c) {
    ARTE[bioma].desenhar(c)
    raiz.style.setProperty('--arte-bioma', `url(${tela.toDataURL()})`)
  }
  try {
    localStorage.setItem(CHAVE, bioma)
  } catch {
    // sem armazenamento: só não lembra na próxima abertura
  }
}

const token = (nome: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(nome).trim()

// Cor de destaque da área: a escolhida pelo usuário ou (null) a do bioma.
export function aplicarAccent(cor: string | null): string {
  const raiz = document.documentElement
  const final = cor ?? token('--accent-padrao')
  const { hover, sombra, textoEscuro } = derivarAccent(final)
  raiz.style.setProperty('--accent', final)
  raiz.style.setProperty('--accent-hover', hover)
  raiz.style.setProperty('--accent-shadow', sombra)
  raiz.style.setProperty(
    '--accent-text',
    textoEscuro ? 'var(--text-on-light)' : 'var(--text-on-dark)'
  )
  return final
}

const AJUSTADAS = [
  '--vidro-alfa',
  '--accent-legivel',
  '--perigo-legivel',
  '--atencao-legivel',
  '--online-legivel'
]

// Opacidade do vidro e cores de texto para o fundo de agora (bioma ou imagem do usuário): todo
// texto com 4,5:1 (contrasteRegras.ts). Chamar depois de aplicarBioma e aplicarAccent.
export function ajustarContraste(fundos: Rgb[], accent: string): void {
  const raiz = document.documentElement
  AJUSTADAS.forEach((v) => raiz.style.removeProperty(v)) // volta aos valores do bioma
  const brilho = /rgb\((\d+ \d+ \d+) \/ ([\d.]+)\)/.exec(token('--brilho-topo'))
  const { alfa, legiveis } = ajustarAoFundo(
    {
      vidro: rgbDeTexto(token('--vidro-rgb')),
      vidro2: rgbDeTexto(token('--vidro-2-rgb')),
      alfa: Number(token('--vidro-alfa')),
      texto: hex(token('--text')),
      textoApagado: hex(token('--text-muted')),
      brilho: brilho ? { cor: rgbDeTexto(brilho[1]), alfa: Number(brilho[2]) } : undefined
    },
    fundos,
    {
      '--accent-legivel': hex(accent),
      '--perigo-legivel': hex(token('--status-error')),
      '--atencao-legivel': hex(token('--warning')),
      '--online-legivel': hex(token('--status-online'))
    }
  )
  raiz.style.setProperty('--vidro-alfa', String(alfa))
  for (const [nome, cor] of Object.entries(legiveis)) raiz.style.setProperty(nome, paraHex(cor))
}

// Cores de uma imagem do usuário (amostra pequena), já com o escurecimento por cima.
export function amostrarImagem(url: string, escurecimento: number): Promise<Rgb[]> {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => {
      const lado = 24
      const tela = document.createElement('canvas')
      tela.width = lado
      tela.height = lado
      const c = tela.getContext('2d')
      if (!c) return ok([])
      c.drawImage(img, 0, 0, lado, lado)
      const dados = c.getImageData(0, 0, lado, lado).data
      const base = hex(token('--fundo-base'))
      const cores: Rgb[] = []
      for (let i = 0; i < dados.length; i += 4) {
        const p: Rgb = [dados[i], dados[i + 1], dados[i + 2]]
        cores.push(p.map((v, k) => base[k] * escurecimento + v * (1 - escurecimento)) as Rgb)
      }
      ok(cores)
    }
    img.onerror = () => ok([])
    img.src = url
  })
}

// As 6 sugestões da seção 7 vêm dos tokens, para não ter cor solta no código.
export const NOMES_SUGESTOES = ['verde', 'azul', 'roxo', 'laranja', 'vermelho', 'ciano'] as const

export function corDaSugestao(nome: (typeof NOMES_SUGESTOES)[number]): string {
  return token(`--sugestao-${nome}`)
}
