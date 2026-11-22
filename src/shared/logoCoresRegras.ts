import { contraste, hex, luminancia, paraHex, piorContraste, type Rgb } from './contrasteRegras'

// Cores da logo DENTRO do app (sem DOM): testadas em tests/logoCoresRegras.test.ts.
// "Oficiais" devolve sempre as cores da marca (as mesmas de build/logo/). "Acompanhar o fundo"
// parte das cores da cena de cada bioma (LOGO em fundo/biomas.ts, escolhidas à mão), deriva delas
// os detalhes (gravados, grama, água) e só mexe na claridade do que precisar para ficar legível.
// Fundo sem paleta própria (imagem do usuário): as cores oficiais. Fora do app (ícone, bandeja, instalador,
// README) a logo é sempre a oficial: esta regra não é usada lá.

export interface PaletaLogo {
  contorno: string
  topo: string
  topoRealce: string // o realce claro dos anéis (versão completa)
  topoGravado: string // os anéis gravados (completa)
  topoGravadoPequena: string // os anéis da pequena
  esquerda: string
  esquerdaDetalhe: string // grama em degraus e realce do H
  esquerdaLetra: string // H gravado (completa)
  esquerdaLetraPequena: string // H da pequena
  direita: string
  direitaDetalhe: string // reflexos de água e realce do S
  direitaLetra: string // S gravado (completa)
  direitaLetraPequena: string // S da pequena
}

// As cores de build/logo/hubsquare-logo.svg e hubsquare-logo-pequena.svg.
export const OFICIAIS: PaletaLogo = {
  contorno: '#1e2a2f',
  topo: '#bfe3c9',
  topoRealce: '#e6f5ea',
  topoGravado: '#6fae86',
  topoGravadoPequena: '#5e9e76',
  esquerda: '#45a55a',
  esquerdaDetalhe: '#7ccb8a',
  esquerdaLetra: '#2e7a41',
  esquerdaLetraPequena: '#ffffff',
  direita: '#2f95c8',
  direitaDetalhe: '#6ec0e8',
  direitaLetra: '#1f6a93',
  direitaLetraPequena: '#ffffff'
}

// Variável CSS de cada cor (o componente Logo usa estas, com as oficiais como padrão).
export const VARIAVEIS: Record<keyof PaletaLogo, string> = {
  contorno: '--logo-contorno',
  topo: '--logo-topo',
  topoRealce: '--logo-topo-realce',
  topoGravado: '--logo-topo-gravado',
  topoGravadoPequena: '--logo-topo-gravado-pequena',
  esquerda: '--logo-esquerda',
  esquerdaDetalhe: '--logo-esquerda-detalhe',
  esquerdaLetra: '--logo-esquerda-letra',
  esquerdaLetraPequena: '--logo-esquerda-letra-pequena',
  direita: '--logo-direita',
  direitaDetalhe: '--logo-direita-detalhe',
  direitaLetra: '--logo-direita-letra',
  direitaLetraPequena: '--logo-direita-letra-pequena'
}

// As variáveis de uma paleta como estilo de um elemento (ex.: a prévia "Oficiais" em Aparência).
export const estiloDaPaleta = (p: PaletaLogo): Record<string, string> =>
  Object.fromEntries(
    (Object.keys(VARIAVEIS) as (keyof PaletaLogo)[]).map((k) => [VARIAVEIS[k], p[k]])
  )

// As cores da cena de cada fundo para a logo, escolhidas à mão em fundo/biomas.ts (LOGO), sempre
// entre as cores que a própria cena já usa: h = cor principal (face do H, ServSquare), s = a
// secundária que contrasta com ela (face do S, PlaySquare), topo = o tom mais claro da cena e
// contorno = uma versão bem escura do tom dominante.
export interface CoresDaCena {
  h: string
  s: string
  topo: string
  contorno: string
}

// Legibilidade: as letras gravadas H e S com 3:1 sobre a face, também as brancas da versão pequena;
// o nome ("Hub" no tom da face do H, "Square" no da face do S) com 4,5:1 sobre o vidro da barra
// lateral. Quando uma cor falha, só a claridade dela muda, nunca o tom. No vidro escuro as duas
// coisas não cabem na mesma claridade: a face fica escura o bastante para o branco, e o nome usa
// o mesmo tom, mais claro (nomeDaLogo).
export const MIN_NOME = 4.5
export const MIN_LETRA = 3
const BRANCO: Rgb = [255, 255, 255]

// ---------- OKLab: mexer só na claridade, mantendo matiz e croma ----------

const linear = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const srgb = (v: number): number =>
  Math.round(
    255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
  )

export function paraOklab([r, g, b]: Rgb): [number, number, number] {
  const [x, y, z] = [linear(r), linear(g), linear(b)]
  const l = Math.cbrt(0.4122214708 * x + 0.5363325363 * y + 0.0514459929 * z)
  const m = Math.cbrt(0.2119034982 * x + 0.6806995451 * y + 0.1073969566 * z)
  const s = Math.cbrt(0.0883024619 * x + 0.2817188376 * y + 0.6299787005 * z)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}

function deOklab([L, a, b]: [number, number, number]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    srgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ]
}

// A mesma cor (mesmo matiz) com outra claridade (0 a 1). Se a cor nova não cabe na tela (sRGB),
// o croma diminui só o necessário para caber, sem mexer no matiz.
function comClaridade(cor: Rgb, L: number): Rgb {
  const [, a, b] = paraOklab(cor)
  const claridadeNova = Math.min(1, Math.max(0, L))
  const cabe = (k: number): boolean => {
    const l = (claridadeNova + 0.3963377774 * a * k + 0.2158037573 * b * k) ** 3
    const m = (claridadeNova - 0.1055613458 * a * k - 0.0638541728 * b * k) ** 3
    const s = (claridadeNova - 0.0894841775 * a * k - 1.291485548 * b * k) ** 3
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ].every((v) => v >= -0.0005 && v <= 1.0005)
  }
  // Bissecção no fator do croma: 0 (cinza) sempre cabe.
  let [cabeK, naoCabeK] = [0, 1]
  if (cabe(1)) cabeK = 1
  else
    for (let i = 0; i < 20; i++) {
      const meio = (cabeK + naoCabeK) / 2
      if (cabe(meio)) cabeK = meio
      else naoCabeK = meio
    }
  return deOklab([claridadeNova, a * cabeK, b * cabeK])
}
const claridade = (cor: Rgb): number => paraOklab(cor)[0]
const mais = (cor: Rgb, d: number): Rgb => comClaridade(cor, claridade(cor) + d)

// A claridade mais perto da original que passa em todas as condições; sem nenhuma, a original
// (o teste aponta a falha).
function maisPerto(cor: Rgb, passa: (c: Rgb) => boolean): Rgb {
  if (passa(cor)) return cor
  const L0 = claridade(cor)
  for (let d = 0.005; d <= 1; d += 0.005) {
    for (const L of [L0 - d, L0 + d]) {
      if (L < 0 || L > 1) continue
      const c = comClaridade(cor, L)
      if (passa(c)) return c
    }
  }
  return cor
}

// Face: as letras brancas da pequena com 3:1 sobre ela.
const ajustarFace = (cor: Rgb): Rgb => maisPerto(cor, (c) => contraste(BRANCO, c) >= MIN_LETRA)

// O nome na barra lateral: "Hub" no tom da face do H e "Square" no da face do S, na claridade mais
// perto da face que dá 4,5:1 sobre o vidro. Sem a paleta da cena (oficiais), não se usa.
export function nomeDaLogo(p: PaletaLogo, sobre: Rgb[]): { hub: string; square: string } {
  const legivel = (face: string): string =>
    paraHex(maisPerto(hex(face), (c) => piorContraste([c], sobre) >= MIN_NOME))
  return { hub: legivel(p.esquerda), square: legivel(p.direita) }
}

// Letra gravada da completa: a própria face mais escura (ou mais clara, numa face escura).
function letraGravada(face: Rgb): Rgb {
  const L = claridade(face)
  for (let d = 0.1; d <= 1; d += 0.02) {
    for (const alvo of L > 0.45 ? [L - d, L + d] : [L + d, L - d]) {
      if (alvo < 0 || alvo > 1) continue
      const c = comClaridade(face, alvo)
      if (contraste(c, face) >= MIN_LETRA) return c
    }
  }
  return luminancia(face) > 0.18 ? [0, 0, 0] : BRANCO
}

// A paleta da logo a partir das cores da cena.
// Grama, água e os anéis do topo saem das próprias cores (mais claro ou mais escuro).
export function montarPaleta(cena: CoresDaCena): PaletaLogo {
  const esquerda = ajustarFace(hex(cena.h))
  const direita = ajustarFace(hex(cena.s))
  const topo = hex(cena.topo)
  return {
    contorno: cena.contorno,
    topo: paraHex(topo),
    topoRealce: paraHex(mais(topo, 0.06)),
    topoGravado: paraHex(mais(topo, -0.22)),
    topoGravadoPequena: paraHex(mais(topo, -0.28)),
    esquerda: paraHex(esquerda),
    esquerdaDetalhe: paraHex(mais(esquerda, 0.14)),
    esquerdaLetra: paraHex(letraGravada(esquerda)),
    esquerdaLetraPequena: '#ffffff',
    direita: paraHex(direita),
    direitaDetalhe: paraHex(mais(direita, 0.14)),
    direitaLetra: paraHex(letraGravada(direita)),
    direitaLetraPequena: '#ffffff'
  }
}

export type ModoCoresLogo = 'oficiais' | 'fundo'

// A paleta da logo para o fundo efetivo da tela. Sem paleta própria (imagem do usuário) ou com
// "Oficiais": as cores originais da logo.
export function paletaDaLogo(p: { modo: ModoCoresLogo; cena: CoresDaCena | null }): PaletaLogo {
  if (p.modo === 'oficiais' || !p.cena) return OFICIAIS
  return montarPaleta(p.cena)
}
