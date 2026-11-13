// Contraste do texto sobre o vidro (Fase V1). Sem DOM nem Electron: testado em
// tests/contrasteRegras.test.ts e usado pela tela quando o fundo é uma imagem do usuário.
// Regra: todo texto com pelo menos 4,5:1 (WCAG AA). Se o vidro do bioma não chega lá sobre o
// pior pedaço do fundo, ele fica mais opaco (escurece ou clareia) até chegar.

export type Rgb = [number, number, number]

export const ALVO = 4.5

export function hex(cor: string): Rgb {
  const h = cor.trim().replace('#', '')
  const cheio = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16)) as Rgb
}

export const paraHex = (c: Rgb): string =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

// "12 20 28" (formato dos tokens --vidro-rgb).
export const rgbDeTexto = (t: string): Rgb => t.trim().split(/\s+/).map(Number) as Rgb

export function luminancia([r, g, b]: Rgb): number {
  const canal = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

export function contraste(a: Rgb, b: Rgb): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// Cor translúcida por cima de um fundo (como o navegador mistura, em sRGB).
export const misturar = (topo: Rgb, alfa: number, fundo: Rgb): Rgb =>
  topo.map((v, i) => v * alfa + fundo[i] * (1 - alfa)) as Rgb

export interface Vidro {
  cores: Rgb[] // vidro e as variações (cartões internos, hover)
  textos: Rgb[] // texto e texto apagado
  brilho?: { cor: Rgb; alfa: number } // degradê claro por cima (bioma Mar)
}

// Como o vidro fica sobre cada pedaço do fundo (com e sem o degradê de brilho).
export function superficies(v: Vidro, alfa: number, fundos: Rgb[]): Rgb[] {
  const lista: Rgb[] = []
  for (const f of fundos) {
    for (const c of v.cores) {
      const s = misturar(c, alfa, f)
      lista.push(s)
      if (v.brilho) lista.push(misturar(v.brilho.cor, v.brilho.alfa, s))
    }
  }
  return lista
}

export function piorContraste(textos: Rgb[], sobre: Rgb[]): number {
  let pior = Infinity
  for (const t of textos) for (const s of sobre) pior = Math.min(pior, contraste(t, s))
  return pior
}

// Menor opacidade do vidro (a partir da do bioma) com todo texto em 4,5:1 sobre todo o fundo.
export function alfaNecessario(v: Vidro, fundos: Rgb[], base: number, alvo = ALVO): number {
  for (let a = Math.round(base * 100); a <= 100; a++) {
    if (piorContraste(v.textos, superficies(v, a / 100, fundos)) >= alvo) return a / 100
  }
  return 1
}

// Uma cor usada como texto (destaque, perigo...) ajustada até ter 4,5:1 sobre as superfícies:
// clareia num vidro escuro e escurece num vidro claro, mantendo o tom.
export function corLegivel(cor: Rgb, sobre: Rgb[], clarear: boolean, alvo = ALVO): Rgb {
  const destino: Rgb = clarear ? [255, 255, 255] : [0, 0, 0]
  for (let p = 0; p <= 100; p += 2) {
    const c = misturar(destino, p / 100, cor).map(Math.round) as Rgb
    if (piorContraste([c], sobre) >= alvo) return c
  }
  return destino
}

// O que a tela precisa de um bioma (lido do tokens.css) para conferir o contraste.
export interface TokensBioma {
  vidro: Rgb
  vidro2: Rgb // cartões internos, campos e hover
  alfa: number // opacidade do bioma (mínima)
  texto: Rgb
  textoApagado: Rgb
  brilho?: { cor: Rgb; alfa: number }
}

// Opacidade final do vidro e as cores de texto (destaque, perigo...) ajustadas para o fundo.
export function ajustarAoFundo(
  t: TokensBioma,
  fundos: Rgb[],
  coresDeTexto: Record<string, Rgb>
): { alfa: number; legiveis: Record<string, Rgb> } {
  const vidro: Vidro = {
    cores: [t.vidro, t.vidro2],
    textos: [t.texto, t.textoApagado],
    brilho: t.brilho
  }
  const alfa = alfaNecessario(vidro, fundos, t.alfa)
  const sobre = superficies(vidro, alfa, fundos)
  const legiveis: Record<string, Rgb> = {}
  // Texto claro no bioma (vidro escuro): as cores clareiam; texto escuro: escurecem.
  const clarear = luminancia(t.texto) > 0.5
  for (const [nome, cor] of Object.entries(coresDeTexto)) {
    legiveis[nome] = corLegivel(cor, sobre, clarear)
  }
  return { alfa, legiveis }
}
