// Regras do fundo animado (Fase V2), sem DOM: testadas em tests/animacaoRegras.test.ts.
// Quando animar, em que ritmo, e quando cair para o modo leve por desempenho.

export const MODOS_ANIMACAO = ['completa', 'leve', 'desligada'] as const
export type ModoAnimacao = (typeof MODOS_ANIMACAO)[number]

export const SEM_FOCO_MS = 30_000 // janela sem foco por 30 s: pausa
export const ORCAMENTO_MS = 4 // desenho médio acima disso: cai para leve
export const AMOSTRAS = 60 // quadros na média do orçamento
const DT_MAXIMO = 0.1 // s: depois de uma pausa, o movimento não dá um salto

export interface Situacao {
  visivel: boolean // false: minimizada ou na bandeja
  semFocoDesde: number | null // ms (relógio da tela) em que a janela perdeu o foco
  jogoAberto: boolean // Minecraft aberto pelo PlaySquare
  modpackInstalando: boolean
  agora: number
}

// Sem preferência salva: completa, ou leve se o Windows pede menos movimento.
export const modoInicial = (
  salvo: ModoAnimacao | undefined,
  reduzMovimento: boolean
): ModoAnimacao => salvo ?? (reduzMovimento ? 'leve' : 'completa')

export function deveAnimar(modo: ModoAnimacao, s: Situacao): boolean {
  if (modo === 'desligada' || !s.visivel || s.jogoAberto || s.modpackInstalando) return false
  return s.semFocoDesde === null || s.agora - s.semFocoDesde < SEM_FOCO_MS
}

// Quantos ms até a pausa por falta de foco (para reavaliar na hora certa); null se não se aplica.
export const msAtePausaSemFoco = (s: Situacao): number | null =>
  s.semFocoDesde === null ? null : Math.max(0, s.semFocoDesde + SEM_FOCO_MS - s.agora)

// Leve = metade das partículas a 15 quadros por segundo.
export const ritmo = (modo: ModoAnimacao): { fps: number; particulas: number } =>
  modo === 'leve' ? { fps: 15, particulas: 0.5 } : { fps: 30, particulas: 1 }

// O navegador chama a 60, 144 Hz...: só desenha quando já passou o intervalo do ritmo.
// A tolerância de 1 ms evita perder quadros por arredondamento do relógio.
export const deveDesenhar = (ultimoMs: number, agoraMs: number, fps: number): boolean =>
  agoraMs - ultimoMs >= 1000 / fps - 1

// Passo de tempo em segundos (movimento por deltaTime), limitado depois de pausas.
export const passo = (ultimoMs: number, agoraMs: number): number =>
  Math.min(DT_MAXIMO, Math.max(0, (agoraMs - ultimoMs) / 1000))

// Média móvel do tempo de desenho. Só decide com a janela cheia de amostras.
export function acimaDoOrcamento(amostras: number[], limite = ORCAMENTO_MS): boolean {
  if (amostras.length < AMOSTRAS) return false
  const ultimas = amostras.slice(-AMOSTRAS)
  return ultimas.reduce((s, v) => s + v, 0) / ultimas.length > limite
}
