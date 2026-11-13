import type { Bioma } from '../../../shared/tipos'
import {
  acimaDoOrcamento,
  AMOSTRAS,
  deveDesenhar,
  passo,
  ritmo
} from '../../../shared/animacaoRegras'
import { ALTURA, ARTE, LARGURA, type Cena } from './biomas'
import { animando, modoAtual, ouvirPausa } from './pausa'

// Motor do fundo animado (Fase V2): um canvas 2D pequeno (320×180) ampliado com
// image-rendering: pixelated. Desenha no ritmo do modo (30 ou 15 quadros), com movimento por
// deltaTime. Pausado, o laço para de vez e o canvas fica no último quadro.

const TRANSICAO_S = 0.6

export interface Motor {
  trocarBioma: (bioma: Bioma) => void
  soParticulas: (so: boolean) => void
  destruir: () => void
}

export function criarMotor(
  tela: HTMLCanvasElement,
  bioma: Bioma,
  so: boolean,
  aoPesar?: () => void // o desenho passou do orçamento (4 ms em média): cair para o leve
): Motor {
  tela.width = LARGURA
  tela.height = ALTURA
  const c = tela.getContext('2d')!
  let cena: Cena = ARTE[bioma].criar()
  let soParticulasAgora = so
  let t = 0
  let ultimo = performance.now()
  let id: number | null = null
  const amostras: number[] = []
  let avisou = false
  // Transição: o último quadro do bioma anterior some por cima do novo.
  const antes = document.createElement('canvas')
  antes.width = LARGURA
  antes.height = ALTURA
  let transicao = 1

  function desenhar(dt: number): void {
    if (soParticulasAgora) c.clearRect(0, 0, LARGURA, ALTURA)
    cena.quadro(c, t, dt, ritmo(modoAtual()).particulas, soParticulasAgora)
    if (transicao < 1) {
      transicao = Math.min(1, transicao + dt / TRANSICAO_S)
      c.globalAlpha = 1 - transicao
      c.drawImage(antes, 0, 0)
      c.globalAlpha = 1
    }
  }

  function laco(agora: number): void {
    if (!animando()) {
      id = null // pausado: para de pedir quadros
      return
    }
    id = requestAnimationFrame(laco)
    if (!deveDesenhar(ultimo, agora, ritmo(modoAtual()).fps)) return
    const dt = passo(ultimo, agora)
    ultimo = agora
    t += dt
    const inicio = performance.now()
    desenhar(dt)
    amostras.push(performance.now() - inicio)
    if (amostras.length > AMOSTRAS * 2) amostras.splice(0, AMOSTRAS)
    if (!avisou && modoAtual() === 'completa' && acimaDoOrcamento(amostras)) {
      avisou = true
      aoPesar?.()
    }
  }

  function seguir(): void {
    if (animando() && id === null) {
      ultimo = performance.now()
      id = requestAnimationFrame(laco)
    }
  }

  // Primeiro quadro na hora (mesmo pausado, o fundo não fica vazio).
  desenhar(0)
  const pararDeOuvir = ouvirPausa(seguir)
  seguir()

  return {
    trocarBioma(novo) {
      const ac = antes.getContext('2d')!
      ac.clearRect(0, 0, LARGURA, ALTURA)
      ac.drawImage(tela, 0, 0)
      cena = ARTE[novo].criar()
      transicao = animando() ? 0 : 1
      desenhar(0)
    },
    soParticulas(novo) {
      soParticulasAgora = novo
      desenhar(0)
    },
    destruir() {
      if (id !== null) cancelAnimationFrame(id)
      id = null
      pararDeOuvir()
    }
  }
}
