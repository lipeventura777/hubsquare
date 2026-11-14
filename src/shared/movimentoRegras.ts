import { luminancia, misturar, type Rgb } from './contrasteRegras'

// Limites de movimento dos fundos vivos (Fase V6), os mesmos nos doze biomas. Sem DOM: testados em
// tests/movimentoRegras.test.ts, que também roda cada bioma por alguns minutos e confere tudo.

// Partículas vivas ao mesmo tempo: 60 no modo completo, metade no leve.
export const PARTICULAS_MAX = 60
export const limiteDeParticulas = (fracao: number): number => Math.floor(PARTICULAS_MAX * fracao)

// Movimento contínuo: nada atravessa a tela em menos de 8 s (eventos raros podem ser mais rápidos).
export const TRAVESSIA_MIN_S = 8
export const velocidadeMaxima = (largura: number, altura: number): { x: number; y: number } => ({
  x: largura / TRAVESSIA_MIN_S,
  y: altura / TRAVESSIA_MIN_S
})

// Eventos raros (estrela cadente, borboleta, pulso, bando...): um por vez, de 20 a 40 s sorteados.
export const RARO_MIN_S = 20
export const RARO_MAX_S = 40
export const intervaloRaro = (sorteio: number): number =>
  RARO_MIN_S + Math.min(Math.max(sorteio, 0), 1) * (RARO_MAX_S - RARO_MIN_S)

// Nada pisca mais rápido que 3 vezes por segundo: toda oscilação passa por aqui.
export const PISCA_MAX_HZ = 3
export const onda = (t: number, hz: number, fase = 0): number =>
  Math.sin(2 * Math.PI * Math.min(hz, PISCA_MAX_HZ) * t + fase)

// Um brilho (duas cores que se alternam) muda no máximo 20% de luminosidade atrás do texto.
// O texto fica sempre sobre o vidro: conta a luz vista através dele, na opacidade mínima do bioma.
export const BRILHO_MAX = 0.2
export const mudancaAtrasDoVidro = (a: Rgb, b: Rgb, vidro: Rgb, alfa: number): number =>
  Math.abs(luminancia(misturar(vidro, alfa, a)) - luminancia(misturar(vidro, alfa, b)))

// O terço do meio da tela (atrás do banner e da barra de ação) tem no máximo 1/4 das partículas.
export const PARTE_DO_MEIO_MAX = 0.25
export const noMeio = (y: number, altura: number): boolean =>
  y >= altura / 3 && y < (altura * 2) / 3
