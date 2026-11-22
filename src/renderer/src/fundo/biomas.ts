import type { CoresDaCena } from '../../../shared/logoCoresRegras'
import type { Bioma } from '../../../shared/tipos'
import { intervaloRaro, onda, velocidadeMaxima } from '../../../shared/movimentoRegras'

// Os doze biomas (DESIGN.md seção 7): cinco animados (Fases V1 e V2) e sete parados (Fase V5,
// no fim do arquivo). Pixel art original do app,
// desenhada em código num canvas pequeno (LARGURA × ALTURA) que a tela amplia sem suavizar.
// Cada bioma = camadas paradas desenhadas uma vez (céu, morros, prédios), camadas que rolam
// em velocidades diferentes (parallax: as de longe mais lentas) e o que se mexe a cada quadro.
// Partículas num pool criado uma vez só: nenhum objeto novo por quadro.
// Sem DOM na importação: a paleta de cada bioma (TODA cor que aparece, partículas inclusive)
// é o "pior fundo" do teste de contraste (tests/contrasteRegras.test.ts).

export const LARGURA = 320
export const ALTURA = 180

// Uma cena viva: desenha um quadro no tempo t (s), com o passo dt (s).
// particulas: fração do pool em uso (1 completa, 0,5 leve). soParticulas: canvas transparente
// por cima de uma imagem do usuário (só as partículas do bioma).
export interface Cena {
  quadro: (
    c: CanvasRenderingContext2D,
    t: number,
    dt: number,
    particulas: number,
    soParticulas: boolean
  ) => void
  // Todas as partículas da cena (os pools), para o teste dos limites de movimento.
  particulas: Particula[]
}

interface Arte {
  paleta: string[]
  // Pares de cores que se alternam num brilho (teste: no máximo 20% de luz atrás do texto).
  brilhos: [string, string][]
  criar: () => Cena
  // Um quadro parado (miniaturas, banners sem animação e o fundo com a animação desligada).
  desenhar: (c: CanvasRenderingContext2D) => void
}

// ---------- Utilidades ----------

function sorteio(semente: number): () => number {
  let s = semente
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const px = (c: CanvasRenderingContext2D, cor: string, x: number, y: number, w = 1, h = 1): void => {
  c.fillStyle = cor
  c.fillRect(Math.round(x), Math.round(y), w, h)
}

// Uma camada desenhada uma vez num canvas próprio.
function camada(desenho: (c: CanvasRenderingContext2D) => void, h = ALTURA): HTMLCanvasElement {
  const tela = document.createElement('canvas')
  tela.width = LARGURA
  tela.height = h
  desenho(tela.getContext('2d')!)
  return tela
}

// Camada que rola na horizontal (sem emenda: desenha duas vezes).
function rolar(c: CanvasRenderingContext2D, tela: HTMLCanvasElement, x: number, y = 0): void {
  const d = ((x % LARGURA) + LARGURA) % LARGURA
  c.drawImage(tela, -d, y)
  c.drawImage(tela, LARGURA - d, y)
}

// Céu em faixas, com a passagem entre faixas em xadrez (o "degradê" do pixel art).
function ceu(c: CanvasRenderingContext2D, cores: string[], ate: number): void {
  const faixa = ate / cores.length
  cores.forEach((cor, i) => px(c, cor, 0, Math.floor(i * faixa), LARGURA, Math.ceil(faixa) + 1))
  for (let i = 1; i < cores.length; i++) {
    const y = Math.floor(i * faixa)
    for (let x = 0; x < LARGURA; x++) {
      if ((x + y) % 2 === 0) px(c, cores[i - 1], x, y)
      if ((x + y + 1) % 2 === 0) px(c, cores[i], x, y - 1)
    }
  }
}

// Linha de morro: altura em cada coluna, em degraus de 2 px.
function morro(semente: number, base: number, amplitude: number, ondas: number): number[] {
  const fase = sorteio(semente)() * 10
  return Array.from({ length: LARGURA }, (_, x) => {
    const y =
      base -
      amplitude * (0.5 + 0.5 * Math.sin((x / LARGURA) * Math.PI * ondas + fase)) -
      amplitude * 0.35 * Math.sin((x / LARGURA) * Math.PI * ondas * 2.7 + fase * 2)
    return Math.round(y / 2) * 2
  })
}

function preencherMorro(
  c: CanvasRenderingContext2D,
  alturas: number[],
  topo: string,
  corpo: string
): void {
  alturas.forEach((y, x) => {
    px(c, topo, x, y, 1, 2)
    px(c, corpo, x, y + 2, 1, ALTURA - y - 2)
  })
}

function nuvem(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  escala: number,
  clara: string,
  sombra: string
): void {
  px(c, clara, x + 6 * escala, y, 18 * escala, 5 * escala)
  px(c, clara, x, y + 5 * escala, 30 * escala, 5 * escala)
  px(c, sombra, x, y + 10 * escala, 30 * escala, 2 * escala)
}

function terra(
  c: CanvasRenderingContext2D,
  y: number,
  cor: string,
  escura: string,
  semente: number
): void {
  px(c, cor, 0, y, LARGURA, ALTURA - y)
  const r = sorteio(semente)
  for (let i = 0; i < 110; i++) {
    px(c, escura, Math.floor(r() * LARGURA), y + 2 + Math.floor(r() * (ALTURA - y - 2)), 2, 2)
  }
}

// Pool fixo de partículas (criado uma vez; "soltar" reaproveita uma parada).
export interface Particula {
  x: number
  y: number
  vx: number
  vy: number
  vida: number
  max: number
  tipo: number
  fase: number
  raro: boolean // parte de um evento raro: pode passar da velocidade das contínuas
}

function pool(n: number, raro = false): Particula[] {
  return Array.from({ length: n }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    vida: 0,
    max: 1,
    tipo: 0,
    fase: 0,
    raro
  }))
}

function ativas(lista: Particula[]): number {
  let n = 0
  for (const p of lista) if (p.vida > 0) n++
  return n
}

// Uma partícula parada para reaproveitar, se o limite do modo deixar.
function livre(lista: Particula[], fracao: number): Particula | null {
  if (ativas(lista) >= Math.floor(lista.length * fracao)) return null
  for (const p of lista) if (p.vida <= 0) return p
  return null
}

// Movimento contínuo: nada atravessa a tela em menos de 8 s (movimentoRegras.ts).
const VEL = velocidadeMaxima(LARGURA, ALTURA)
const limitar = (v: number, max: number): number => Math.min(max, Math.max(-max, v))

function mover(lista: Particula[], dt: number): void {
  for (const p of lista) {
    if (p.vida <= 0) continue
    if (!p.raro) {
      p.vx = limitar(p.vx, VEL.x)
      p.vy = limitar(p.vy, VEL.y)
    }
    p.vida -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
}

// Eventos raros: um por vez, de 20 a 40 s depois do anterior acabar (movimentoRegras.ts).
// Devolve uma função que diz, a cada quadro, se é hora de começar um.
function relogioRaro(): (dt: number, ocupado: boolean) => boolean {
  let falta = intervaloRaro(Math.random())
  return (dt, ocupado) => {
    if (ocupado) return false
    falta -= dt
    if (falta > 0) return false
    falta = intervaloRaro(Math.random())
    return true
  }
}

// Vento com rajadas: base lenta + picos de vez em quando (0 a ~1,5).
const vento = (t: number): number =>
  0.5 + 0.5 * Math.sin(t * 0.35) + Math.max(0, Math.sin(t * 0.9 + Math.sin(t * 0.13) * 3)) ** 4

// ---------- Dia e Dia claro ----------

interface PaletaCampo {
  ceu: string[]
  sol: string
  solBorda: string
  nuvem: string
  nuvemSombra: string
  morroLonge: string
  morroLongeCorpo: string
  grama: string
  morro: string
  tronco: string
  folha: string
  folhaEscura: string
  terra: string
  terraEscura: string
  polen: string
  passaro: string
}

function campo(p: PaletaCampo, sol: { x: number; y: number; lado: number }, semente: number): Arte {
  const montar = (): Cena => {
    const r = sorteio(semente)
    const fundo = camada((c) => {
      ceu(c, p.ceu, Math.round(ALTURA * 0.7))
      px(c, p.solBorda, sol.x, sol.y, sol.lado, sol.lado)
      px(c, p.sol, sol.x + 3, sol.y + 3, sol.lado - 6, sol.lado - 6)
    })
    // Nuvens de longe (pequenas, lentas) e de perto (grandes, mais rápidas).
    const nuvensLonge = camada((c) => {
      for (let i = 0; i < 4; i++)
        nuvem(c, i * 80 + r() * 30, 8 + r() * 24, 1, p.nuvem, p.nuvemSombra)
    }, 60)
    const nuvensPerto = camada((c) => {
      for (let i = 0; i < 2; i++)
        nuvem(c, i * 160 + r() * 60, 20 + r() * 20, 2, p.nuvem, p.nuvemSombra)
    }, 70)
    const longe = morro(semente + 1, 118, 22, 2.4)
    const perto = morro(semente + 2, 146, 16, 1.5)
    const morros = camada((c) => {
      preencherMorro(c, longe, p.morroLonge, p.morroLongeCorpo)
      preencherMorro(c, perto, p.grama, p.morro)
      terra(c, 158, p.terra, p.terraEscura, semente + 3)
    })
    const arvores = [22, 96, 172, 228, 286].map((x) => ({ x, chao: perto[x + 6] }))
    const troncos = camada((c) => {
      for (const a of arvores) px(c, p.tronco, a.x + 5, a.chao - 12, 3, 12)
    })
    const lamina: number[] = []
    for (let x = 0; x < LARGURA; x += 3) lamina.push(x)
    const particulas = pool(50)
    const passaros = pool(6, true)
    const bando = relogioRaro()

    return {
      quadro(c, t, dt, fracao, so) {
        const v = vento(t)
        if (!so) {
          c.drawImage(fundo, 0, 0)
          rolar(c, nuvensLonge, t * 2)
          rolar(c, nuvensPerto, t * 5, 6)
          c.drawImage(morros, 0, 0)
          c.drawImage(troncos, 0, 0)
          // Copas balançando com o vento.
          arvores.forEach((a, i) => {
            const d = Math.round(Math.sin(t * 2 + i) * v)
            px(c, p.folha, a.x + d, a.chao - 26, 13, 14)
            px(c, p.folhaEscura, a.x + d, a.chao - 15, 13, 3)
            px(c, p.folha, a.x + 3 + d, a.chao - 29, 7, 3)
          })
          // Grama balançando: uma lâmina a cada 3 px, no alto do morro de perto.
          for (const x of lamina) {
            const d = Math.round(Math.sin(t * 3 + x * 0.15) * v * 1.5)
            px(c, p.grama, x + d, perto[x] - 2, 1, 2)
          }
        }
        // Pássaros ao longe, às vezes (um bando atravessando o céu).
        if (bando(dt, ativas(passaros) > 0)) {
          const y = 24 + Math.random() * 30
          for (let i = 0; i < 5; i++) {
            const b = livre(passaros, fracao)
            if (!b) break
            Object.assign(b, {
              x: -10 - i * 7,
              y: y + (i % 2) * 4,
              vx: 14,
              vy: 0,
              vida: 40,
              max: 40,
              fase: i
            })
          }
        }
        mover(passaros, dt)
        for (const b of passaros) {
          if (b.vida <= 0) continue
          if (b.x > LARGURA + 10) b.vida = 0
          const asa = Math.sin(t * 8 + b.fase) > 0 ? -1 : 0
          px(c, p.passaro, b.x, b.y + asa, 1, 1)
          px(c, p.passaro, b.x + 1, b.y + 1, 1, 1)
          px(c, p.passaro, b.x + 2, b.y + asa, 1, 1)
        }
        // Folhas e pólen voando com o vento.
        const nova = livre(particulas, fracao)
        if (nova && Math.random() < dt * 6) {
          Object.assign(nova, {
            x: -4,
            y: 122 + Math.random() * 50, // embaixo, fora do terço do meio
            vx: 0,
            vy: 0,
            vida: 8 + Math.random() * 6,
            max: 14,
            tipo: Math.random() < 0.4 ? 1 : 0,
            fase: Math.random() * 6
          })
        }
        for (const q of particulas) {
          if (q.vida <= 0) continue
          q.vx = 10 + v * 28
          q.vy = Math.sin(t * 2 + q.fase) * 6
          if (q.x > LARGURA + 4) q.vida = 0
        }
        mover(particulas, dt)
        for (const q of particulas) {
          if (q.vida <= 0) continue
          if (q.tipo === 1) px(c, p.folha, q.x, q.y, 2, 1)
          else px(c, p.polen, q.x, q.y)
        }
      },
      particulas: [...particulas, ...passaros]
    }
  }
  return {
    paleta: Object.values(p).flat(),
    brilhos: [],
    criar: montar,
    desenhar: (c) => montar().quadro(c, 0, 0, 0, false)
  }
}

// ---------- Noite ----------

const NOITE = {
  ceu: ['#070a1c', '#0f1230', '#1b1a45', '#2a2258', '#3a2a6b'],
  lua: '#e8e6ff',
  cratera: '#c9c4f0',
  estrela: '#c4b5fd',
  estrela2: '#5eead4',
  estrelaApagada: '#5b4f8f',
  nuvem: '#2b2557',
  nuvemSombra: '#221d47',
  predio: '#120e26',
  janela: '#ffd27a',
  morro: '#1a1530',
  grama: '#231c40',
  terra: '#130f24',
  terraEscura: '#0c0a18',
  vagalume: '#d9f99d',
  cadente: '#f5f3ff'
}

function noite(): Arte {
  const p = NOITE
  const montar = (): Cena => {
    const r = sorteio(21)
    const fundo = camada((c) => ceu(c, p.ceu, 140))
    const lua = camada((c) => {
      px(c, p.lua, 50, 18, 24, 24)
      px(c, p.cratera, 56, 24, 5, 5)
      px(c, p.cratera, 64, 33, 4, 4)
    }, 60)
    const nuvens = camada((c) => {
      for (let i = 0; i < 3; i++)
        nuvem(c, i * 110 + r() * 40, 14 + r() * 26, 2, p.nuvem, p.nuvemSombra)
    }, 70)
    const janelas: { x: number; y: number; acesa: boolean; troca: number }[] = []
    const predios = camada((c) => {
      for (let x = 0; x < LARGURA;) {
        const w = 12 + Math.floor(r() * 16)
        const h = 14 + Math.floor(r() * 30)
        px(c, p.predio, x, 140 - h, w, h + 6)
        for (let jy = 140 - h + 3; jy < 136; jy += 5) {
          for (let jx = x + 3; jx < x + w - 3; jx += 4) {
            if (r() < 0.3) janelas.push({ x: jx, y: jy, acesa: r() < 0.6, troca: 3 + r() * 12 })
          }
        }
        x += w + Math.floor(r() * 8)
      }
    })
    const chao = camada((c) => {
      preencherMorro(c, morro(9, 154, 8, 1.8), p.grama, p.morro)
      terra(c, 166, p.terra, p.terraEscura, 10)
    })
    // Estrelas num círculo grande abaixo da tela: o céu gira bem devagar em volta dele.
    const cx = LARGURA / 2
    const cy = ALTURA * 1.6
    const estrelas = Array.from({ length: 120 }, () => ({
      raio: 150 + r() * 260,
      angulo: Math.PI / 2 + (r() - 0.5) * 1.6,
      fase: r() * 6,
      cor: r() < 0.3 ? p.estrela2 : p.estrela
    }))
    const vagalumes = pool(24)
    const cadentes = pool(1, true)
    const cadente = cadentes[0]
    const relogio = relogioRaro()

    return {
      quadro(c, t, dt, fracao, so) {
        if (!so) {
          c.drawImage(fundo, 0, 0)
          for (const e of estrelas) {
            const a = e.angulo + t * 0.004
            const x = cx + Math.cos(a) * e.raio
            const y = cy - Math.sin(a) * e.raio
            if (x < 0 || x >= LARGURA || y < 0 || y > 130) continue
            px(c, Math.sin(t * 2.5 + e.fase * 3) < -0.6 ? p.estrelaApagada : e.cor, x, y)
          }
          c.drawImage(lua, 0, 0)
          rolar(c, nuvens, t * 1.5, 4)
          c.drawImage(predios, 0, 0)
          for (const j of janelas) {
            j.troca -= dt
            if (j.troca <= 0) {
              j.acesa = !j.acesa
              j.troca = 4 + Math.random() * 14
            }
            if (j.acesa) px(c, p.janela, j.x, j.y, 2, 2)
          }
          c.drawImage(chao, 0, 0)
        }
        // Estrela cadente de vez em quando.
        if (relogio(dt, cadente.vida > 0)) {
          Object.assign(cadente, {
            x: 120 + Math.random() * 200,
            y: 6 + Math.random() * 30,
            vx: -140,
            vy: 60,
            vida: 0.7,
            max: 0.7
          })
        }
        mover(cadentes, dt)
        if (cadente.vida > 0) {
          for (let k = 0; k < 8; k++) {
            px(c, k < 3 ? p.cadente : p.estrela, cadente.x + k * 2, cadente.y - k)
          }
        }
        // Vaga-lumes perto do chão, piscando.
        const novo = livre(vagalumes, fracao)
        if (novo && Math.random() < dt * 3) {
          Object.assign(novo, {
            x: Math.random() * LARGURA,
            y: 146 + Math.random() * 26,
            vx: (Math.random() - 0.5) * 6,
            vy: 0,
            vida: 6 + Math.random() * 6,
            max: 12,
            fase: Math.random() * 6
          })
        }
        for (const v of vagalumes) if (v.vida > 0) v.vy = Math.sin(t * 1.5 + v.fase) * 4
        mover(vagalumes, dt)
        for (const v of vagalumes) {
          if (v.vida > 0 && Math.sin(t * 3 + v.fase) > 0.2) px(c, p.vagalume, v.x, v.y)
        }
      },
      particulas: [...vagalumes, ...cadentes]
    }
  }
  return {
    paleta: Object.values(p).flat(),
    brilhos: [
      [p.estrela, p.estrelaApagada],
      [p.janela, p.predio]
    ],
    criar: montar,
    desenhar: (c) => montar().quadro(c, 0, 0, 0, false)
  }
}

// ---------- Mar ----------

const MAR = {
  agua: ['#5fd3d0', '#3fb4c1', '#2690a8', '#17708f', '#0e5574', '#0a3d5c'],
  raio: '#8be6e0',
  areia: '#e6d29a',
  areiaEscura: '#cdb57a',
  areiaBrilho: '#f5e6b8',
  alga: '#2f8f4e',
  algaEscura: '#1f6e3a',
  prisma: '#4fa59a',
  prismaEscuro: '#3b8c82',
  coral: '#ff7a8a',
  coral2: '#ffb347',
  bolha: '#c8f5f2',
  peixe: '#f4d35e',
  peixe2: '#ee964b'
}

function mar(): Arte {
  const p = MAR
  const montar = (): Cena => {
    const r = sorteio(31)
    const chao = morro(11, 156, 10, 2)
    const fundo = camada((c) => {
      ceu(c, p.agua, ALTURA)
    })
    const fundoMar = camada((c) => {
      preencherMorro(c, chao, p.areiaEscura, p.areia)
      px(c, p.prismaEscuro, 236, chao[236] - 20, 26, 20)
      px(c, p.prisma, 239, chao[236] - 17, 20, 14)
      px(c, p.prismaEscuro, 50, chao[50] - 13, 20, 13)
      px(c, p.prisma, 53, chao[50] - 10, 14, 7)
      for (const [x, cor] of [
        [136, p.coral],
        [150, p.coral2],
        [206, p.coral],
        [276, p.coral2]
      ] as const) {
        px(c, cor, x, chao[x] - 10, 3, 10)
        px(c, cor, x - 3, chao[x] - 13, 3, 6)
        px(c, cor, x + 3, chao[x] - 16, 3, 9)
      }
    })
    const algas = [16, 84, 106, 168, 188, 296].map((x) => ({
      x,
      h: 24 + Math.floor(r() * 30),
      fase: r() * 6
    }))
    const bolhas = pool(40)
    const cardume = pool(9, true)
    const relogio = relogioRaro()

    return {
      quadro(c, t, dt, fracao, so) {
        if (!so) {
          c.drawImage(fundo, 0, 0)
          // Raios de luz ondulando (faixas em xadrez, que deixam a água aparecer).
          for (let i = 0; i < 5; i++) {
            const x0 = 30 + i * 62
            for (let y = 0; y < 120; y += 2) {
              const x = x0 + y / 3 + Math.sin(t * 0.8 + y * 0.05 + i) * 4
              const deslocado = (Math.floor(t * 4) + y / 2) % 2
              px(c, p.raio, x + deslocado * 2, y, 3, 1)
            }
          }
          c.drawImage(fundoMar, 0, 0)
          // Reflexo de luz se mexendo na areia.
          for (let y = 160; y < ALTURA; y += 3) {
            for (let x = 0; x < LARGURA; x += 6) {
              if (Math.sin(x * 0.3 + t * 1.5 + y) > 0.75 && y > chao[x] + 2)
                px(c, p.areiaBrilho, x, y, 2, 1)
            }
          }
          // Algas balançando.
          for (const a of algas) {
            for (let y = 0; y < a.h; y += 2) {
              const d = Math.round(Math.sin(t * 1.4 + a.fase + y * 0.12) * (y / a.h) * 3)
              px(c, y % 4 === 0 ? p.alga : p.algaEscura, a.x + d, chao[a.x] - y - 2, 3, 2)
            }
          }
        }
        // Cardume passando de vez em quando.
        if (relogio(dt, ativas(cardume) > 0)) {
          const y = 118 + Math.random() * 20 // embaixo, fora do terço do meio
          const direita = Math.random() < 0.5
          for (let i = 0; i < 9; i++) {
            const f = livre(cardume, fracao)
            if (!f) break
            Object.assign(f, {
              x: direita ? -8 - (i % 3) * 6 - i * 3 : LARGURA + 8 + (i % 3) * 6 + i * 3,
              y: y + (i % 3) * 4 + Math.floor(i / 3) * 2,
              vx: direita ? 20 : -20,
              vy: 0,
              vida: 30,
              max: 30,
              tipo: i % 2,
              fase: i
            })
          }
        }
        mover(cardume, dt)
        for (const f of cardume) {
          if (f.vida <= 0) continue
          if (f.x < -40 || f.x > LARGURA + 40) f.vida = 0
          px(c, f.tipo ? p.peixe : p.peixe2, f.x, f.y + Math.sin(t * 4 + f.fase), 3, 1)
        }
        // Bolhas subindo.
        const b = livre(bolhas, fracao)
        if (b && Math.random() < dt * 5) {
          // Só uma em cada cinco sobe até em cima; as outras estouram perto do fundo.
          const vida = Math.random() < 0.2 ? 12 : 1.5 + Math.random() * 2
          Object.assign(b, {
            x: Math.random() * LARGURA,
            y: 170,
            vx: 0,
            vy: -(14 + Math.random() * 16),
            vida,
            max: vida,
            tipo: Math.random() < 0.3 ? 1 : 0,
            fase: Math.random() * 6
          })
        }
        mover(bolhas, dt)
        for (const q of bolhas) {
          if (q.vida <= 0) continue
          if (q.y < 2) q.vida = 0
          const x = q.x + Math.sin(t * 3 + q.fase) * 1.5
          px(c, p.bolha, x, q.y, q.tipo ? 2 : 1, q.tipo ? 2 : 1)
        }
      },
      particulas: [...bolhas, ...cardume]
    }
  }
  return {
    paleta: Object.values(p).flat(),
    brilhos: [[p.areiaBrilho, p.areia]],
    criar: montar,
    desenhar: (c) => montar().quadro(c, 0, 0, 0, false)
  }
}

// ---------- Nether ----------

const NETHER = {
  ceu: ['#1a0606', '#2e0a07', '#4a1208', '#6a1c09', '#8a2a0a'],
  teto: '#3b0d0d',
  tetoClaro: '#5a1414',
  basalto: '#2b2b33',
  basaltoClaro: '#3d3d48',
  lava: '#f97316',
  lavaClara: '#fb923c',
  lavaBrilho: '#ffd166',
  chao: '#4a1010',
  chaoEscuro: '#350b0b',
  cinza: '#7a6a66'
}

function nether(): Arte {
  const p = NETHER
  const montar = (): Cena => {
    const lava = ALTURA - 14
    const fundo = camada((c) => {
      ceu(c, p.ceu, 160)
      const teto = morro(13, 14, 14, 3).map((y) => 40 - y)
      teto.forEach((y, x) => {
        px(c, p.teto, x, 0, 1, Math.max(6, y))
        px(c, p.tetoClaro, x, Math.max(6, y) - 2, 1, 2)
      })
      for (let y = 0; y < ALTURA; y += 6) {
        px(c, p.basalto, 200, y, 22, 6)
        px(c, p.basaltoClaro, 200 + ((y / 6) % 2) * 10, y, 6, 3)
      }
      preencherMorro(c, morro(14, 150, 10, 1.6), p.chaoEscuro, p.chao)
    })
    const brasas = pool(50)
    const bolhas = pool(10)

    return {
      quadro(c, t, dt, fracao, so) {
        if (!so) {
          c.drawImage(fundo, 0, 0)
          // Lava pulsando.
          px(c, p.lava, 0, lava, LARGURA, 14)
          for (let x = 0; x < LARGURA; x += 4) {
            if (Math.sin(t * 1.5 + x * 0.05) > 0.2)
              px(c, p.lavaClara, x, lava + ((x / 4) % 3), 3, 2)
            if (Math.sin(t * 2.3 + x * 0.11) > 0.85) px(c, p.lavaBrilho, x + 1, lava + 5, 2, 1)
          }
          // Bolhas de lava que crescem e estouram.
          const b = livre(bolhas, fracao)
          if (b && Math.random() < dt * 2) {
            Object.assign(b, {
              x: Math.random() * LARGURA,
              y: lava + 4,
              vx: 0,
              vy: 0,
              vida: 1.2,
              max: 1.2
            })
          }
          mover(bolhas, dt)
          for (const q of bolhas) {
            if (q.vida <= 0) continue
            const fase = 1 - q.vida / q.max
            if (fase < 0.8) px(c, p.lavaBrilho, q.x, q.y - fase * 3, 2 + Math.round(fase * 2), 2)
            else {
              px(c, p.lavaClara, q.x - 3, q.y - 4, 1, 1)
              px(c, p.lavaClara, q.x + 4, q.y - 5, 1, 1)
            }
          }
          // Névoa de calor: as linhas logo acima da lava tremem de lado.
          for (let y = lava - 26; y < lava; y++) {
            const d = Math.round(Math.sin(t * 6 + y * 0.7))
            if (d) c.drawImage(c.canvas, 0, y, LARGURA, 1, d, y, LARGURA, 1)
          }
        }
        // Brasas e cinzas subindo.
        const nova = livre(brasas, fracao)
        if (nova && Math.random() < dt * 14) {
          const cinza = Math.random() < 0.35
          Object.assign(nova, {
            x: Math.random() * LARGURA,
            y: lava,
            vx: 0,
            vy: -(cinza ? 6 + Math.random() * 8 : 12 + Math.random() * 18),
            // A maioria apaga perto da lava; poucas sobem alto (fora do terço do meio).
            vida: Math.random() < 0.15 ? 4 + Math.random() * 5 : 1.5 + Math.random() * 2.5,
            max: 9,
            tipo: cinza ? 1 : 0,
            fase: Math.random() * 6
          })
        }
        for (const q of brasas) if (q.vida > 0) q.vx = Math.sin(t * 1.3 + q.fase) * 5
        mover(brasas, dt)
        for (const q of brasas) {
          if (q.vida <= 0) continue
          px(c, q.tipo ? p.cinza : q.vida > 2 ? p.lavaBrilho : p.lavaClara, q.x, q.y)
        }
      },
      particulas: [...brasas, ...bolhas]
    }
  }
  return {
    paleta: Object.values(p).flat(),
    brilhos: [
      [p.lavaClara, p.lava],
      [p.lavaBrilho, p.lava]
    ],
    criar: montar,
    desenhar: (c) => montar().quadro(c, 0, 0, 0, false)
  }
}

// ---------- Os sete da Fase V5 (vivos desde a V6) ----------
// As mesmas cinco camadas dos outros (céu, longe, meio, perto, chão), desenhadas uma vez. O terço
// do meio da tela (y de 60 a 120) fica calmo: só céu, horizonte e formas grandes; detalhes pequenos
// nas bordas (naBorda) e no chão. O quadro no tempo 0 é exatamente a arte parada da V5: tudo o que
// se mexe começa parado (balanço que sai do zero, partículas nas posições da arte) ou fora da tela.

// Uma arte cujo quadro parado é o quadro no tempo 0.
function arte(
  paleta: Record<string, string | string[]>,
  brilhos: [string, string][],
  criar: () => Cena
): Arte {
  return {
    paleta: Object.values(paleta).flat(),
    brilhos,
    criar,
    desenhar: (c) => criar().quadro(c, 0, 0, 0, false)
  }
}

// Uma partícula parada para usar agora, com a chance do quadro (null: nenhuma).
const nova = (lista: Particula[], fracao: number, chance: number): Particula | null =>
  Math.random() < chance ? livre(lista, fracao) : null

// No começo e no fim da vida a partícula aparece apagada (entra e sai sem pular na tela).
const apagada = (q: Particula): boolean => q.vida > q.max * 0.85 || q.vida < q.max * 0.2

// Balanço que vale zero no tempo 0 (vai de -2 a 2).
const balanco = (t: number, hz: number, fase: number): number => onda(t, hz, fase) - Math.sin(fase)

// Anel na água se abrindo (respingos de gota, salto de peixe).
function anel(c: CanvasRenderingContext2D, cor: string, q: Particula): void {
  const r = Math.round(1 + (1 - q.vida / q.max) * 7)
  px(c, cor, q.x - r, q.y, 2, 1)
  px(c, cor, q.x + r - 1, q.y, 2, 1)
}

// Preenchimento em xadrez: a "transparência" do pixel art, sem cor fora da paleta.
function xadrez(
  c: CanvasRenderingContext2D,
  cor: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  for (let j = 0; j < h; j++)
    for (let i = Math.abs(x + y + j) % 2; i < w; i += 2) px(c, cor, x + i, y + j)
}

// Uma coluna sorteada nas faixas dos lados da tela (fora do meio calmo).
const naBorda = (r: () => number): number => Math.floor(r() < 0.5 ? r() * 72 : 248 + r() * 72)

// Teto de caverna recortado: até onde a pedra desce em cada coluna.
const tetoDe = (semente: number, base: number, amplitude: number, ondas: number): number[] =>
  morro(semente, 0, amplitude, ondas).map((y) => base - y)

// ---------- Cerejeira ----------
// Pétalas caindo na diagonal, rajadas de vento (copas, grama e pétalas), nuvens em duas
// distâncias e, rara, uma borboleta voando baixo.

const CEREJEIRA = {
  ceu: ['#a9d8ff', '#d4ddf7', '#ffe3ef', '#ffd0e4'],
  nuvem: '#ffffff',
  nuvemSombra: '#f6e3ee',
  morroLonge: '#eaa5c6',
  grama: '#7fc76b',
  morro: '#6db65b',
  terra: '#8a5a3a',
  terraEscura: '#6e452b',
  copa: '#f7a8cf',
  copaLuz: '#ffd6e8',
  copaSombra: '#ee86bb',
  tronco: '#5a3326',
  petala: '#ff9fcb'
}

function cerejeira(): Arte {
  const p = CEREJEIRA
  const perto = morro(41, 148, 10, 1.5)
  // Quatro cerejeiras, duas de cada lado (x = começo da copa, l = largura).
  const arvores = [
    { x: -14, l: 54 },
    { x: 48, l: 36 },
    { x: 232, l: 40 },
    { x: 278, l: 56 }
  ]
  const copa = (
    c: CanvasRenderingContext2D,
    x: number,
    l: number,
    topo: number,
    h: number
  ): void => {
    px(c, p.copa, x, topo + 4, l, h - 4)
    px(c, p.copa, x + 5, topo, l - 10, 4)
    px(c, p.copa, x - 3, topo + 9, 3, h - 16)
    px(c, p.copa, x + l, topo + 11, 3, h - 17)
    px(c, p.copaSombra, x + l - 7, topo + 8, 7, h - 12)
    px(c, p.copaSombra, x, topo + h - 4, l, 4)
    px(c, p.copaSombra, x + 3, topo + h, 7, 2)
    px(c, p.copaSombra, x + l - 13, topo + h, 9, 2)
    px(c, p.copaLuz, x + 5, topo, l - 16, 2)
    px(c, p.copaLuz, x + 2, topo + 4, Math.round(l / 3), 4)
    px(c, p.copaLuz, x + 7, topo + 11, 4, 2)
  }
  return arte(p, [], () => {
    const fundo = camada((c) => ceu(c, p.ceu, 136))
    const nuvensLonge = camada((c) => {
      nuvem(c, 104, 6, 1, p.nuvem, p.nuvemSombra)
      nuvem(c, 138, 32, 1, p.nuvem, p.nuvemSombra)
    })
    const nuvensPerto = camada((c) => {
      nuvem(c, 30, 10, 2, p.nuvem, p.nuvemSombra)
      nuvem(c, 196, 8, 2, p.nuvem, p.nuvemSombra)
    })
    const longe = camada((c) =>
      preencherMorro(c, morro(42, 128, 12, 2.2), p.morroLonge, p.morroLonge)
    )
    const meio = camada((c) => {
      preencherMorro(c, perto, p.grama, p.morro)
      // Flores brancas pequenas na grama.
      const r = sorteio(43)
      for (let i = 0; i < 30; i++) {
        const x = naBorda(r)
        px(c, p.nuvem, x, perto[x] + 4 + Math.floor(r() * 10))
      }
    })
    const copas: { x: number; l: number; topo: number; h: number }[] = []
    const base = camada((c) => {
      const r = sorteio(44)
      for (const a of arvores) {
        const meio = a.x + a.l / 2
        const chao = perto[meio]
        const h = Math.round(a.l * 0.6)
        const topo = chao - 12 - h
        // Tapete de pétalas caídas embaixo da árvore.
        for (let i = 0; i < a.l / 2; i++)
          px(c, i % 3 ? p.petala : p.copaLuz, a.x - 4 + r() * (a.l + 6), chao + 2 + r() * 7, 2, 1)
        px(c, p.tronco, meio - 2, chao - 14, 4, 16)
        px(c, p.tronco, meio - 5, chao - 16, 3, 3)
        px(c, p.tronco, meio + 2, chao - 17, 3, 4)
        copas.push({ x: a.x, l: a.l, topo, h })
      }
      // Cerca baixa de madeira no canto esquerdo.
      for (let x = 2; x <= 42; x += 10) {
        const y = perto[x] + 5
        px(c, p.tronco, x, y - 9, 2, 9)
        if (x < 42) {
          px(c, p.terra, x + 2, y - 7, 8, 1)
          px(c, p.terra, x + 2, y - 4, 8, 1)
        }
      }
    })
    // As pétalas soltas no ar da arte parada viram as primeiras partículas.
    const petalas = pool(40)
    const chao = camada((c) => {
      terra(c, 162, p.terra, p.terraEscura, 45)
      const r = sorteio(46)
      for (let i = 0; i < 26; i++) {
        Object.assign(petalas[i], { x: naBorda(r), y: 40 + r() * 116 })
        Object.assign(petalas[i], { vida: 8, max: 12, tipo: i % 2, fase: i })
      }
      for (let i = 0; i < 16; i++) px(c, p.petala, r() * LARGURA, 162 + r() * 5, 2, 1)
    })
    const borboletas = pool(1, true)
    const b = borboletas[0]
    const relogio = relogioRaro()
    // Rajadas de vento a cada 15 a 25 s, de 5 s cada (0 sem vento, 1 no pico).
    const RAJADA_S = 5
    let proximaRajada = 15 + Math.random() * 10
    let rajada = 0

    return {
      particulas: [...petalas, ...borboletas],
      quadro(c, t, dt, fracao, so) {
        proximaRajada -= dt
        if (proximaRajada <= 0) {
          proximaRajada = 15 + Math.random() * 10
          rajada = RAJADA_S
        }
        rajada = Math.max(0, rajada - dt)
        const g = rajada > 0 ? Math.sin(Math.PI * (1 - rajada / RAJADA_S)) : 0
        if (!so) {
          c.drawImage(fundo, 0, 0)
          rolar(c, nuvensLonge, t * 1.5)
          rolar(c, nuvensPerto, t * 3)
          c.drawImage(longe, 0, 0)
          c.drawImage(meio, 0, 0)
          // Na rajada, a grama deita com o vento.
          if (g > 0.1) {
            for (let x = 0; x < LARGURA; x += 3) {
              const d = Math.round(g * 1.6 * (0.6 + 0.4 * onda(t, 1.2, x * 0.15)))
              if (d > 0) px(c, p.grama, x + d, perto[x] - 2, 1, 2)
            }
          }
          c.drawImage(base, 0, 0)
          copas.forEach((a, i) =>
            copa(c, a.x + Math.round(g * 2 * (0.6 + 0.4 * onda(t, 0.8, i))), a.l, a.topo, a.h)
          )
          c.drawImage(chao, 0, 0)
        }
        // Pétalas caindo das copas, mais com o vento.
        const q = nova(petalas, fracao, dt * (2.5 + g * 8))
        if (q) {
          const a = copas[Math.floor(Math.random() * copas.length)]
          Object.assign(q, {
            x: a.x + Math.random() * a.l,
            y: a.topo + a.h - 4 + Math.random() * 6,
            vida: 12,
            max: 12,
            tipo: Math.random() < 0.5 ? 1 : 0,
            fase: Math.random() * 6
          })
        }
        for (const q of petalas) {
          if (q.vida <= 0) continue
          q.vx = 3 + g * 30 + onda(t, 0.4, q.fase) * 4
          q.vy = 5 + onda(t, 0.3, q.fase + 1) * 2
          if (q.y > 168 || q.x > LARGURA + 4) q.vida = 0
        }
        mover(petalas, dt)
        for (const q of petalas) {
          if (q.vida > 0) px(c, apagada(q) ? p.copaLuz : p.petala, q.x, q.y, q.tipo ? 2 : 1, 1)
        }
        // Rara: uma borboleta cruzando baixo.
        if (relogio(dt, b.vida > 0)) {
          const direita = Math.random() < 0.5
          Object.assign(b, {
            x: direita ? -6 : LARGURA + 6,
            y: 138 + Math.random() * 14,
            vx: direita ? 16 : -16,
            vida: 24,
            max: 24,
            fase: Math.random() * 6
          })
        }
        if (b.vida > 0) {
          b.vy = onda(t, 0.5, b.fase) * 6
          if (b.x < -10 || b.x > LARGURA + 10) b.vida = 0
        }
        mover(borboletas, dt)
        if (b.vida > 0) {
          px(c, p.tronco, b.x, b.y, 1, 2)
          if (onda(t, 2.5, b.fase) > 0) {
            px(c, p.nuvem, b.x - 1, b.y - 1, 1, 2)
            px(c, p.nuvem, b.x + 1, b.y - 1, 1, 2)
          } else px(c, p.nuvem, b.x, b.y - 2, 1, 2)
        }
      }
    }
  })
}

// ---------- Caverna Exuberante ----------
// Bagas pulsando devagar (cada uma no seu tempo), gotas caindo das estalactites com respingo e
// anéis na poça, esporos flutuando (os de longe mais lentos) e os cipós compridos balançando pouco.

const CAVERNA = {
  ceu: ['#08100c', '#0c1a12', '#112419', '#142c1e', '#183524'],
  teto: '#050a07',
  parede: '#0e2016',
  cipo: '#2f6b2c',
  baga: '#ffb84a',
  bagaLuz: '#ffd27a',
  brilho: '#4a3a1a',
  azaleia: '#e879c7',
  arbusto: '#4a8f3a',
  musgo: '#3f7d2e',
  pedra: '#26342c',
  poca: '#2a7f8a',
  reflexo: '#7fe3ea'
}

function caverna(): Arte {
  const p = CAVERNA
  const teto = tetoDe(52, 14, 12, 3)
  // O chão fica plano onde a poça está.
  const chao = morro(53, 150, 6, 1.2).map((y, x) => (x > 102 && x < 218 ? 150 : y))
  // Cipós: coluna, comprimento e se tem baga. Compridos só nos lados (e só eles balançam).
  const cipos = [
    [8, 74, 1],
    [20, 44, 0],
    [34, 92, 1],
    [66, 16, 0],
    [112, 12, 1],
    [150, 20, 0],
    [190, 12, 1],
    [232, 20, 0],
    [258, 26, 1],
    [284, 46, 0],
    [298, 84, 1],
    [312, 56, 1]
  ]
  const balanca = (comprimento: number): boolean => comprimento >= 40
  const POCA = 151
  // Estalactites em cima da poça: de onde caem as gotas.
  const pingos = [131, 172, 203].map((x) => ({ x: x + 2, y: teto[x] + 9 }))
  const cipo = (c: CanvasRenderingContext2D, x: number, comprimento: number, d: number): void => {
    const fim = teto[x] + comprimento
    for (let y = teto[x] - 2; y < fim; y++) {
      const dx = Math.round((d * (y - teto[x])) / comprimento)
      px(c, p.cipo, x + dx + (Math.floor(y / 5) % 2), y)
      if (y % 6 === 0) px(c, p.cipo, x + dx - 1 + (Math.floor(y / 12) % 2) * 2, y, 2, 1)
    }
  }
  return arte(
    p,
    [
      [p.bagaLuz, p.baga],
      [p.brilho, p.ceu[2]],
      [p.reflexo, p.poca]
    ],
    () => {
      const fundo = camada((c) => {
        ceu(c, p.ceu, ALTURA)
        // Paredes de pedra ao fundo.
        preencherMorro(c, morro(51, 138, 12, 2), p.parede, p.parede)
        px(c, p.parede, 44, 0, 18, ALTURA)
        px(c, p.parede, 258, 0, 22, ALTURA)
      })
      const topo = camada((c) => {
        teto.forEach((y, x) => px(c, p.teto, x, 0, 1, y))
        // Estalactites pequenas.
        for (const x of [18, 47, 92, 131, 172, 203, 247, 290]) {
          px(c, p.teto, x, teto[x] - 1, 5, 4)
          px(c, p.teto, x + 1, teto[x] + 3, 3, 3)
          px(c, p.teto, x + 2, teto[x] + 6, 1, 3)
        }
        for (const [x, comprimento] of cipos) if (!balanca(comprimento)) cipo(c, x, comprimento, 0)
        // Azaleias no teto.
        for (const x of [56, 140, 214, 270]) {
          const y = teto[x + 5]
          px(c, p.arbusto, x, y - 2, 12, 5)
          px(c, p.musgo, x + 1, y + 3, 10, 1)
          px(c, p.azaleia, x + 2, y, 2, 2)
          px(c, p.azaleia, x + 8, y + 1, 2, 2)
        }
      })
      const perto = camada((c) => {
        // Arbustos de azaleia nos cantos.
        for (const x of [4, 30, 286]) {
          const g = chao[x + 8]
          px(c, p.arbusto, x, g - 9, 16, 10)
          px(c, p.arbusto, x + 3, g - 12, 10, 3)
          px(c, p.musgo, x, g - 2, 16, 3)
          px(c, p.azaleia, x + 3, g - 10, 2, 2)
          px(c, p.azaleia, x + 10, g - 7, 2, 2)
          px(c, p.azaleia, x + 6, g - 5, 2, 2)
        }
        // Folhas grandes na borda da poça.
        for (const [x, h] of [
          [98, 16],
          [106, 10],
          [214, 12],
          [222, 18]
        ]) {
          const g = chao[x]
          px(c, p.cipo, x, g - h, 1, h)
          px(c, p.arbusto, x - 4, g - h - 2, 9, 3)
          px(c, p.musgo, x - 3, g - h + 1, 7, 1)
          px(c, p.arbusto, x + 4, g - h + 1, 2, 2)
        }
      })
      const piso = camada((c) => {
        chao.forEach((y, x) => {
          px(c, p.musgo, x, y, 1, 4)
          px(c, p.pedra, x, y + 4, 1, ALTURA - y - 4)
        })
        const r = sorteio(54)
        for (let i = 0; i < 40; i++) {
          const x = Math.floor(r() * LARGURA)
          px(c, p.musgo, x, chao[x] + 4, 1, 1 + Math.floor(r() * 3))
        }
        px(c, p.poca, 108, POCA, 104, 9)
        px(c, p.poca, 114, 160, 92, 2)
        px(c, p.reflexo, 122, 153, 10, 1)
        px(c, p.reflexo, 150, 156, 16, 1)
        px(c, p.reflexo, 184, 153, 8, 1)
        px(c, p.reflexo, 138, 159, 6, 1)
      })
      const esporos = pool(36)
      const agua = pool(12) // gotas (tipo 0), anéis (1) e respingos (2)

      return {
        particulas: [...esporos, ...agua],
        quadro(c, t, dt, fracao, so) {
          if (!so) {
            c.drawImage(fundo, 0, 0)
            c.drawImage(topo, 0, 0)
            cipos.forEach(([x, comprimento, baga], i) => {
              const d = balanca(comprimento) ? balanco(t, 0.15 + (i % 3) * 0.04, i) : 0
              if (balanca(comprimento)) cipo(c, x, comprimento, d)
              if (!baga) return
              // A baga pulsa devagar, cada uma no seu tempo (de 3 a 5 s).
              const fim = teto[x] + comprimento
              const bx = x + Math.round(d)
              const luz = onda(t, 1 / (3 + (i % 3)), Math.PI / 2)
              if (luz > 0.3) xadrez(c, p.brilho, bx - 3, fim - 2, 8, 7)
              px(c, p.baga, bx, fim, 2, 3)
              if (luz > -0.4) px(c, p.bagaLuz, bx, fim)
            })
            c.drawImage(perto, 0, 0)
            c.drawImage(piso, 0, 0)
          }
          // Gotas das estalactites, com respingo e anel na poça.
          const g = nova(agua, fracao, dt * 0.4)
          if (g) {
            const de = pingos[Math.floor(Math.random() * pingos.length)]
            Object.assign(g, { x: de.x, y: de.y, vx: 0, vy: 0, vida: 20, max: 20, tipo: 0 })
          }
          for (const q of agua) {
            if (q.vida <= 0) continue
            if (q.tipo === 0) {
              q.vy += 40 * dt
              if (q.y >= POCA) {
                q.vida = 0
                const a = livre(agua, fracao)
                if (a)
                  Object.assign(a, {
                    x: q.x,
                    y: POCA + 1,
                    vx: 0,
                    vy: 0,
                    vida: 1.6,
                    max: 1.6,
                    tipo: 1
                  })
                for (const lado of [-1, 1]) {
                  const s = livre(agua, fracao)
                  if (s)
                    Object.assign(s, {
                      x: q.x,
                      y: POCA - 1,
                      vx: lado * 10,
                      vy: -14,
                      vida: 0.35,
                      max: 0.35,
                      tipo: 2
                    })
                }
              }
            } else if (q.tipo === 2) q.vy += 60 * dt
          }
          mover(agua, dt)
          for (const q of agua) {
            if (q.vida <= 0) continue
            if (q.tipo === 1) anel(c, q.vida < q.max * 0.4 ? p.poca : p.reflexo, q)
            else px(c, p.reflexo, q.x, q.y, 1, q.tipo === 0 ? 2 : 1)
          }
          // Esporos flutuando, quase todos perto do chão ou do teto.
          const e = nova(esporos, fracao, dt * 4)
          if (e) {
            const vida = 6 + Math.random() * 4
            Object.assign(e, {
              x: Math.random() * LARGURA,
              y: Math.random() < 0.7 ? 128 + Math.random() * 44 : 18 + Math.random() * 36,
              vida,
              max: vida,
              tipo: Math.random() < 0.5 ? 1 : 0,
              fase: Math.random() * 6
            })
          }
          for (const q of esporos) {
            if (q.vida <= 0) continue
            const perto = q.tipo === 1
            q.vx = (perto ? 2.5 : 1) * onda(t, 0.15, q.fase)
            q.vy = (perto ? -1.6 : -0.8) + onda(t, 0.2, q.fase + 2)
          }
          mover(esporos, dt)
          for (const q of esporos) {
            if (q.vida <= 0) continue
            const cor = q.tipo === 1 ? p.arbusto : p.cipo
            px(c, apagada(q) ? (q.tipo === 1 ? p.cipo : p.ceu[4]) : cor, q.x, q.y)
          }
        }
      }
    }
  )
}

// ---------- Deep Dark ----------
// Partículas ciano subindo bem devagar, sensores acendendo e apagando, névoa escura passando no
// horizonte e, raro, um pulso de luz que sai de uma mancha do chão e corre pelos veios.

const DEEP_DARK = {
  ceu: ['#02070a', '#030d11', '#051419', '#061a20', '#072027'],
  teto: '#010405',
  pilar: '#0a1216',
  pilarTopo: '#0d171c',
  ponto: '#7df9ff',
  chao: '#0d1418',
  mancha: '#06323b',
  brilhante: '#29dfeb',
  fraco: '#0e7a85'
}

function deepDark(): Arte {
  const p = DEEP_DARK
  const teto = tetoDe(61, 12, 12, 2.6)
  const piso = 148
  const NEVOA = 130
  // Manchas do chão: x, y e largura.
  const manchas = [
    [26, 154, 36],
    [96, 166, 24],
    [138, 156, 48],
    [212, 168, 30],
    [264, 158, 42]
  ]
  const sensores = [
    [6, piso],
    [116, piso],
    [236, piso],
    [280, 66]
  ]
  // O caminho do pulso: atravessa cada mancha e segue o veio até a próxima.
  const caminho: [number, number][] = []
  const inicioDa: number[] = [] // índice do ponto onde cada mancha começa
  manchas.forEach(([x, y, w], i) => {
    inicioDa.push(caminho.length)
    caminho.push([x, y + 2], [x + w, y + 2])
    const prox = manchas[i + 1]
    if (prox) {
      const meio = Math.round((x + w + prox[0]) / 2)
      caminho.push([meio, y + 2], [meio, prox[1] + 2])
    }
  })
  const trechos = caminho
    .slice(1)
    .map(([x, y], i) => Math.abs(x - caminho[i][0]) + Math.abs(y - caminho[i][1]))
  const distanciaAte = (k: number): number => trechos.slice(0, k).reduce((s, v) => s + v, 0)
  const total = distanciaAte(trechos.length)
  const noCaminho = (s: number): [number, number] => {
    let k = 0
    while (k < trechos.length - 1 && s > trechos[k]) s -= trechos[k++]
    const [x0, y0] = caminho[k]
    const [x1, y1] = caminho[k + 1]
    const f = trechos[k] ? Math.min(1, Math.max(0, s / trechos[k])) : 0
    return [Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f)]
  }
  return arte(
    p,
    [
      [p.ponto, p.pilarTopo],
      [p.brilhante, p.fraco],
      [p.ponto, p.fraco]
    ],
    () => {
      const fundo = camada((c) => {
        ceu(c, p.ceu, 150)
        // Ruínas de muro ao longe (quase da cor do fundo) e a névoa baixa no horizonte.
        for (const [x, w, h] of [
          [58, 34, 22],
          [92, 10, 34],
          [146, 44, 16],
          [190, 8, 28],
          [222, 36, 26]
        ])
          px(c, p.ceu[2], x, 140 - h, w, h)
        px(c, p.ceu[2], 58, 114, 8, 4)
        px(c, p.ceu[2], 240, 110, 10, 4)
        px(c, p.ceu[4], 68, 126, 6, 8)
        px(c, p.ceu[4], 160, 130, 14, 10)
        px(c, p.ceu[4], 234, 124, 6, 8)
        xadrez(c, p.ceu[1], 0, NEVOA, LARGURA, 6)
        px(c, p.ceu[1], 0, 136, LARGURA, 14)
      })
      const pilares = camada((c) => {
        teto.forEach((y, x) => px(c, p.teto, x, 0, 1, y))
        // Pilares: x, largura e topo.
        for (const [x, w, y] of [
          [20, 26, 46],
          [270, 30, 66],
          [62, 10, 104]
        ]) {
          px(c, p.pilar, x, y, w, ALTURA - y)
          px(c, p.pilarTopo, x - 2, y, w + 4, 5)
          px(c, p.pilarTopo, x, y + 5, 3, ALTURA)
          for (let k = y + 16; k < piso; k += 14) px(c, p.teto, x + 3, k, w - 3, 1)
        }
        // Sensores: um bloco baixo com duas antenas e um ponto de luz.
        for (const [x, y] of sensores) {
          px(c, p.fraco, x + 1, y - 9, 1, 4)
          px(c, p.fraco, x + 7, y - 9, 1, 4)
          px(c, p.pilarTopo, x, y - 5, 9, 5)
          px(c, p.ponto, x + 4, y - 4, 1, 2)
        }
      })
      // Os pontos fracos no ar da arte parada viram as primeiras partículas.
      const pontos = pool(30)
      const r = sorteio(63)
      for (let i = 0; i < 24; i++) {
        Object.assign(pontos[i], { x: naBorda(r), y: 30 + r() * 110 })
        Object.assign(pontos[i], { vida: 6 + (i % 6), max: 14, fase: i })
      }
      const chao = camada((c) => {
        px(c, p.chao, 0, piso, LARGURA, ALTURA - piso)
        px(c, p.pilarTopo, 0, piso, LARGURA, 1)
        manchas.forEach(([x, y, w], i) => {
          // Veio fino até a próxima mancha.
          const prox = manchas[i + 1]
          if (prox) {
            const meio = Math.round((x + w + prox[0]) / 2)
            px(c, p.fraco, x + w, y + 2, meio - x - w, 1)
            px(c, p.fraco, meio, Math.min(y, prox[1]) + 2, 1, Math.abs(prox[1] - y) + 1)
            px(c, p.fraco, meio, prox[1] + 2, prox[0] - meio, 1)
          }
          px(c, p.mancha, x, y, w, 4)
          px(c, p.mancha, x + 4, y - 2, w - 12, 2)
          px(c, p.mancha, x + 6, y + 4, w - 10, 3)
          px(c, p.brilhante, x + 5, y + 1)
          px(c, p.brilhante, x + w - 8, y + 3)
          px(c, p.brilhante, x + w / 2, y + 5)
        })
      })
      const pulsos = pool(1, true)
      const pulso = pulsos[0]
      const relogio = relogioRaro()
      const VEL_PULSO = 30

      return {
        particulas: [...pontos, ...pulsos],
        quadro(c, t, dt, fracao, so) {
          if (!so) {
            c.drawImage(fundo, 0, 0)
            // Névoa passando: ondas baixas que sobem do horizonte (entram devagar no começo).
            const altura = 4 * Math.min(1, t / 4)
            for (let x = 0; x < LARGURA; x++) {
              const b = Math.round(altura * Math.max(0, Math.sin(x * 0.045 - t * 0.27)))
              for (let y = NEVOA - b; y < NEVOA; y++) if ((x + y) % 2 === 0) px(c, p.ceu[1], x, y)
            }
            c.drawImage(pilares, 0, 0)
            // Sensores acendendo e apagando devagar (de 5 a 8 s).
            sensores.forEach(([x, y], i) => {
              if (onda(t, 1 / (5 + i), Math.PI / 2) < -0.3) px(c, p.pilarTopo, x + 4, y - 4, 1, 2)
            })
            c.drawImage(chao, 0, 0)
          }
          // Raro: o pulso sai de uma mancha e corre pelos veios até o fim.
          if (relogio(dt, pulso.vida > 0)) {
            const de = distanciaAte(inicioDa[Math.floor(Math.random() * (manchas.length - 1))])
            Object.assign(pulso, { fase: de, vida: (total - de) / VEL_PULSO, max: 1 })
          }
          if (pulso.vida > 0) {
            pulso.fase += VEL_PULSO * dt
            ;[pulso.x, pulso.y] = noCaminho(pulso.fase)
          }
          mover(pulsos, dt)
          if (pulso.vida > 0) {
            for (let k = 3; k >= 0; k--) {
              const [x, y] = noCaminho(pulso.fase - k * 2)
              px(c, k ? p.brilhante : p.ponto, x, y)
            }
          }
          // Pontos ciano subindo bem devagar, embaixo e no alto (fora do meio).
          const q = nova(pontos, fracao, dt * 2.5)
          if (q) {
            const vida = 6 + Math.random() * 4
            const alto = Math.random() < 0.5
            Object.assign(q, {
              x: Math.random() * LARGURA,
              y: alto ? 22 + Math.random() * 30 : 124 + Math.random() * 22,
              vida,
              max: vida,
              fase: Math.random() * 6
            })
          }
          for (const q of pontos) {
            if (q.vida <= 0) continue
            q.vx = onda(t, 0.1, q.fase)
            q.vy = -1.5 - 0.5 * onda(t, 0.13, q.fase + 1)
          }
          mover(pontos, dt)
          for (const q of pontos) if (q.vida > 0) px(c, apagada(q) ? p.mancha : p.fraco, q.x, q.y)
        }
      }
    }
  )
}

// ---------- Deserto ao pôr do sol ----------
// Faixas de areia sopradas perto do chão, calor ondulando o horizonte, nuvens finas deslizando,
// estrelas aparecendo devagar no roxo e, raro, um bando de pássaros ou um arbusto seco rolando.

const DESERTO = {
  ceu: ['#2b1a4a', '#62272f', '#9a3412', '#c8690f', '#f59e0b', '#fcd34d'],
  sol: '#fff1b8',
  nuvemRosa: '#f0abfc',
  nuvemLaranja: '#fdba74',
  piramide: '#7c2d12',
  duna1: '#b45309',
  duna2: '#92400e',
  duna3: '#6b2a0c',
  cacto: '#14351c'
}

function deserto(): Arte {
  const p = DESERTO
  const d1 = morro(71, 126, 8, 1.6)
  const d2 = morro(72, 142, 10, 1.2)
  const d3 = morro(73, 158, 10, 1)
  const cacto = (c: CanvasRenderingContext2D, x: number, base: number, h: number): void => {
    px(c, p.cacto, x, base - h, 4, h)
    px(c, p.cacto, x - 5, base - h + 6, 2, 6)
    px(c, p.cacto, x - 5, base - h + 10, 5, 2)
    px(c, p.cacto, x + 7, base - h + 3, 2, 6)
    px(c, p.cacto, x + 4, base - h + 7, 5, 2)
  }
  // Estrelas que aparecem uma a uma: posição e quando aparece (s).
  const r = sorteio(76)
  const novas = Array.from({ length: 14 }, (_, k) => ({
    x: Math.floor(r() * LARGURA),
    y: 2 + Math.floor(r() * 22),
    em: 6 + k * 8
  }))
  return arte(
    p,
    [
      [p.sol, p.ceu[0]],
      [p.nuvemRosa, p.ceu[0]]
    ],
    () => {
      const fundo = camada((c) => {
        ceu(c, p.ceu, 132)
        // As primeiras estrelas, na parte roxa.
        const r = sorteio(74)
        for (let i = 0; i < 18; i++) px(c, p.sol, r() * LARGURA, 2 + r() * 20)
        px(c, p.sol, 184, 92, 28, 28)
      })
      // Nuvens finas em faixas, em duas distâncias.
      const nuvensAltas = camada((c) => {
        px(c, p.nuvemRosa, 28, 32, 62, 2)
        px(c, p.nuvemRosa, 44, 35, 30, 1)
        px(c, p.nuvemRosa, 232, 28, 54, 2)
      })
      const nuvensBaixas = camada((c) => {
        px(c, p.nuvemLaranja, 176, 46, 84, 2)
        px(c, p.nuvemLaranja, 204, 49, 40, 1)
        px(c, p.nuvemLaranja, 92, 53, 52, 2)
      })
      const longe = camada((c) => {
        // Pirâmide em degraus, com o lado da sombra.
        for (let i = 0; i < 9; i++) {
          const w = 76 - i * 8
          const y = 122 - i * 4
          px(c, p.piramide, 92 - w / 2, y, w, 4)
          px(c, p.duna3, 92 + w / 2 - Math.ceil(w / 3), y, Math.ceil(w / 3), 4)
        }
        preencherMorro(c, d1, p.duna1, p.duna1)
      })
      const meio = camada((c) => preencherMorro(c, d2, p.duna2, p.duna2))
      const perto = camada((c) => {
        cacto(c, 14, d2[14] + 3, 20)
        cacto(c, 272, d2[272] + 3, 14)
        preencherMorro(c, d3, p.duna3, p.duna3)
        cacto(c, 298, d3[298] + 3, 24)
        cacto(c, 46, d3[46] + 3, 12)
        // Arbustos secos.
        for (const x of [70, 236, 262]) {
          const g = d3[x] + 1
          px(c, p.duna1, x, g - 5, 1, 5)
          px(c, p.duna1, x - 2, g - 3, 1, 3)
          px(c, p.duna1, x + 2, g - 6, 1, 6)
          px(c, p.duna1, x + 4, g - 2, 1, 2)
        }
      })
      const chao = camada((c) => {
        // Pedras e ossos pequenos no chão.
        const r = sorteio(75)
        for (let i = 0; i < 50; i++) px(c, p.piramide, r() * LARGURA, 164 + r() * 16)
        for (const x of [24, 88, 150, 206, 250, 306]) {
          const y = 166 + Math.floor(r() * 10)
          px(c, p.duna2, x, y, 4, 2)
          px(c, p.duna2, x + 1, y - 1, 2, 1)
        }
        for (const x of [58, 128, 228, 284]) {
          const y = 167 + Math.floor(r() * 9)
          px(c, p.sol, x, y, 4, 1)
          px(c, p.sol, x - 1, y - 1)
          px(c, p.sol, x + 4, y + 1)
        }
      })
      const areia = pool(30)
      const raros = pool(6, true) // um bando (5 pássaros) ou um arbusto rolando (tipo 9)
      const relogio = relogioRaro()

      return {
        particulas: [...areia, ...raros],
        quadro(c, t, dt, fracao, so) {
          if (!so) {
            c.drawImage(fundo, 0, 0)
            // Estrelas aparecendo devagar: primeiro fracas, depois acesas.
            for (const e of novas) {
              if (t < e.em) continue
              px(c, t < e.em + 3 ? p.ceu[2] : t < e.em + 6 ? p.nuvemRosa : p.sol, e.x, e.y)
            }
            rolar(c, nuvensAltas, t * 1.2)
            rolar(c, nuvensBaixas, t * 2.4)
            c.drawImage(longe, 0, 0)
            // Calor ondulando o horizonte (entra devagar no começo).
            const calor = Math.min(1, t / 2)
            for (let y = 104; y < 128; y++) {
              const d = Math.round(calor * Math.sin(t * 2.2 + y * 0.9))
              if (d) c.drawImage(c.canvas, 0, y, LARGURA, 1, d, y, LARGURA, 1)
            }
            c.drawImage(meio, 0, 0)
            c.drawImage(perto, 0, 0)
            c.drawImage(chao, 0, 0)
          }
          // Areia soprada em faixas finas, perto do chão.
          const q = nova(areia, fracao, dt * 5)
          if (q) {
            Object.assign(q, {
              x: -8,
              y: 150 + Math.random() * 28,
              vx: 26 + Math.random() * 12,
              vy: 0,
              vida: 14,
              max: 14,
              tipo: 2 + Math.floor(Math.random() * 4)
            })
          }
          for (const q of areia) if (q.vida > 0 && q.x > LARGURA + 6) q.vida = 0
          mover(areia, dt)
          for (const q of areia) {
            if (q.vida > 0) px(c, apagada(q) ? p.duna2 : p.duna1, q.x, q.y, q.tipo, 1)
          }
          // Raro: um bando de pássaros ao longe ou um arbusto seco rolando.
          if (relogio(dt, ativas(raros) > 0)) {
            if (Math.random() < 0.5) {
              const y = 34 + Math.random() * 14
              for (let i = 0; i < 5; i++) {
                const b = livre(raros, fracao)
                if (b)
                  Object.assign(b, {
                    x: -10 - i * 7,
                    y: y + (i % 2) * 4,
                    vx: 12,
                    vy: 0,
                    vida: 40,
                    max: 40,
                    tipo: i,
                    fase: i
                  })
              }
            } else {
              const b = livre(raros, fracao)
              if (b)
                Object.assign(b, { x: -6, y: d3[0], vx: 24, vy: 0, vida: 20, max: 20, tipo: 9 })
            }
          }
          for (const b of raros) {
            if (b.vida <= 0) continue
            if (b.x > LARGURA + 10) b.vida = 0
            if (b.tipo === 9)
              b.y =
                d3[Math.min(LARGURA - 1, Math.max(0, Math.round(b.x)))] -
                3 -
                Math.abs(onda(t, 1, 0)) * 3
          }
          mover(raros, dt)
          for (const b of raros) {
            if (b.vida <= 0) continue
            if (b.tipo === 9) {
              const giro = onda(t, 2, 0) > 0 ? 1 : 0
              px(c, p.duna1, b.x, b.y + giro, 3, 2 - giro)
              px(c, p.duna1, b.x + giro, b.y - 1, 2, 1)
              px(c, p.duna2, b.x + 1 - giro, b.y + 1, 1, 1)
            } else {
              const asa = onda(t, 1.2, b.fase) > 0 ? -1 : 0
              px(c, p.cacto, b.x, b.y + asa)
              px(c, p.cacto, b.x + 1, b.y + 1)
              px(c, p.cacto, b.x + 2, b.y + asa)
            }
          }
        }
      }
    }
  )
}

// ---------- Aurora Nevada ----------
// A aurora ondulando como cortina e mudando de intensidade, estrelas cintilando, neve leve
// (a de longe mais lenta), vento levantando neve dos picos, a luz da janela tremendo e, rara,
// uma estrela cadente.

const AURORA = {
  ceu: ['#040d24', '#081834', '#0c2444', '#112e50', '#16385c'],
  auroraRoxa: '#a78bfa',
  auroraCiano: '#22d3ee',
  auroraVerde: '#34d399',
  estrela: '#e0f2fe',
  montanha: '#7da6d6',
  montanhaSombra: '#5f86b8',
  pico: '#f1f5f9',
  neve: '#e2e8f0',
  neveSombra: '#b6c8dc',
  pinheiro: '#0f3b2e',
  cabana: '#3b2a22',
  janela: '#ffd27a',
  janelaFraca: '#f5c46a'
}

function aurora(): Arte {
  const p = AURORA
  const picos = [
    { x: 44, y: 78, l: 64 },
    { x: 118, y: 96, l: 48 },
    { x: 204, y: 72, l: 80 },
    { x: 288, y: 88, l: 58 }
  ]
  const faixas = [
    { cor: p.auroraRoxa, y: 12, amplitude: 5, ondas: 1.3, fase: 0.5 },
    { cor: p.auroraCiano, y: 23, amplitude: 7, ondas: 1, fase: 2 },
    { cor: p.auroraVerde, y: 34, amplitude: 8, ondas: 0.8, fase: 4 }
  ]
  const ALTO = 64 // altura das camadas da aurora
  const pinheiro = (c: CanvasRenderingContext2D, x: number, base: number, n: number): void => {
    px(c, p.cabana, x - 1, base - 4, 2, 4)
    px(c, p.pinheiro, x - 1, base - 7 - n * 6, 2, 3)
    for (let i = 0; i < n; i++) {
      const w = 6 + i * 4
      const y = base - 4 - (n - i) * 6
      px(c, p.pinheiro, x - w / 2, y, w, 6)
      px(c, p.neve, x - w / 2, y, 2 + i, 2) // neve nos galhos
      px(c, p.neve, x + w / 2 - 2, y, 2, 1)
    }
  }
  return arte(
    p,
    [
      [p.janela, p.janelaFraca],
      [p.estrela, p.montanhaSombra],
      [p.auroraVerde, p.ceu[1]],
      [p.auroraCiano, p.ceu[1]],
      [p.auroraRoxa, p.ceu[1]]
    ],
    () => {
      const estrelas: [number, number][] = []
      const fundo = camada((c) => {
        ceu(c, p.ceu, 146)
        const r = sorteio(84)
        for (let i = 0; i < 46; i++) {
          const e: [number, number] = [r() * LARGURA, 2 + r() * 54]
          estrelas.push(e)
          px(c, p.estrela, e[0], e[1])
        }
        for (let i = 0; i < 12; i++) px(c, p.estrela, naBorda(r), 56 + r() * 30)
      })
      // Cada faixa da aurora numa camada própria (as mesmas da arte parada), que a tela desloca
      // coluna a coluna e com a intensidade de cada momento.
      const telasDaAurora = faixas.map((f) =>
        camada((c) => {
          for (let x = 0; x < LARGURA; x++) {
            const y0 = Math.round(
              f.y + f.amplitude * Math.sin((x / LARGURA) * Math.PI * 2 * f.ondas + f.fase)
            )
            px(c, f.cor, x, y0)
            for (let k = 1; k < 6; k++) if ((x + y0 + k) % 2 === 0) px(c, f.cor, x, y0 + k)
            const cortina = 4 + Math.round(3 * (1 + Math.sin(x * 0.35 + f.fase)))
            if (x % 2 === 0) for (let k = 6; k < 6 + cortina; k += 2) px(c, f.cor, x, y0 + k)
          }
        }, ALTO)
      )
      const auroraAgora = camada(() => {}, ALTO)
      const ac = auroraAgora.getContext('2d')!
      let montada = -1 // quando a aurora foi montada pela última vez (s)
      const montarAurora = (t: number): void => {
        ac.clearRect(0, 0, LARGURA, ALTO)
        telasDaAurora.forEach((tela, i) => {
          // Intensidade de 78% a 100%, num ciclo longo; a cortina ondula em ciclos de 15 a 20 s.
          ac.globalAlpha = 1 - 0.22 * ((1 - onda(t, 0.04 + i * 0.01, Math.PI / 2)) / 2)
          for (let x = 0; x < LARGURA; x += 2) {
            const fase = x * 0.04 + i * 2
            const dy = Math.round(3 * (onda(t, 0.05 + i * 0.01, fase) - Math.sin(fase)))
            ac.drawImage(tela, x, 0, 2, ALTO, x, dy, 2, ALTO)
          }
        })
        ac.globalAlpha = 1
      }
      const montanhas = camada((c) => {
        // Montanhas com o lado da sombra e os picos de neve.
        for (let x = 0; x < LARGURA; x++) {
          let topo = 140
          let dono = picos[0]
          for (const k of picos) {
            const y = k.y + Math.round((Math.abs(x - k.x) * (140 - k.y)) / k.l / 2) * 2
            if (y < topo) {
              topo = y
              dono = k
            }
          }
          if (topo >= 140) continue
          px(c, x > dono.x ? p.montanhaSombra : p.montanha, x, topo, 1, 140 - topo)
          const neve = 12 - (topo - dono.y) + (x % 6 < 3 ? 3 : 0)
          if (neve > 0) px(c, p.pico, x, topo, 1, neve)
        }
      })
      const lago = camada((c) => {
        preencherMorro(c, morro(81, 140, 8, 1.4), p.pico, p.neve)
        // Lago congelado com o reflexo da aurora.
        px(c, p.montanha, 108, 148, 104, 10)
        px(c, p.montanha, 104, 150, 112, 6)
        px(c, p.neveSombra, 120, 150, 20, 1)
        px(c, p.neveSombra, 172, 156, 26, 1)
        px(c, p.auroraVerde, 130, 152, 8, 1)
        px(c, p.auroraVerde, 142, 155, 5, 1)
        px(c, p.auroraCiano, 158, 153, 10, 1)
        px(c, p.auroraRoxa, 186, 152, 6, 1)
      })
      const perto = camada((c) => {
        pinheiro(c, 12, 146, 6)
        pinheiro(c, 34, 150, 4)
        pinheiro(c, 56, 148, 3)
        // Cabana pequena com a janela acesa.
        px(c, p.cabana, 262, 122, 3, 6)
        px(c, p.cabana, 244, 132, 22, 12)
        px(c, p.pico, 242, 127, 26, 4)
        px(c, p.neveSombra, 242, 131, 26, 1)
        px(c, p.janela, 250, 136, 4, 4)
        pinheiro(c, 280, 150, 5)
        pinheiro(c, 304, 148, 6)
      })
      const frente = camada((c) => {
        // Montes de neve na frente.
        const frente = morro(82, 170, 6, 2.2)
        preencherMorro(c, frente, p.pico, p.neve)
        const r = sorteio(83)
        for (let i = 0; i < 14; i++) {
          const x = Math.floor(r() * (LARGURA - 14))
          px(c, p.neveSombra, x, frente[x] + 4 + Math.floor(r() * 6), 6 + Math.floor(r() * 8), 1)
        }
      })
      const neve = pool(34)
      const vento = pool(8) // neve levantada dos picos
      const cadentes = pool(1, true)
      const cadente = cadentes[0]
      const relogio = relogioRaro()
      let proximoVento = 5 + Math.random() * 4

      return {
        particulas: [...neve, ...vento, ...cadentes],
        quadro(c, t, dt, fracao, so) {
          if (!so) {
            c.drawImage(fundo, 0, 0)
            // Estrelas cintilando: uma em cada três apaga por um instante, cada uma no seu tempo.
            estrelas.forEach(([x, y], i) => {
              if (i % 3 === 0 && onda(t, 0.12 + (i % 7) * 0.02, Math.PI / 2) < -0.85)
                px(c, p.montanhaSombra, x, y)
            })
            if (t === 0 || t - montada >= 0.15) {
              montarAurora(t)
              montada = t
            }
            c.drawImage(auroraAgora, 0, 0)
            c.drawImage(montanhas, 0, 0)
            c.drawImage(lago, 0, 0)
            c.drawImage(perto, 0, 0)
            // A luz da janela tremendo de leve.
            if (onda(t, 1.7, 0) + onda(t, 0.9, 1) > 1.3) px(c, p.janelaFraca, 251, 137, 2, 2)
            c.drawImage(frente, 0, 0)
          }
          // Neve leve: em cima ela some antes do meio; embaixo cai até o chão.
          const q = nova(neve, fracao, dt * 5)
          if (q) {
            const longe = Math.random() < 0.5
            const vy = longe ? 4 + Math.random() * 2 : 7 + Math.random() * 3
            const alto = Math.random() < 0.6
            const y = alto ? Math.random() * 6 : 120 + Math.random() * 6
            const vida = ((alto ? 56 : 172) - y) / vy
            Object.assign(q, {
              x: Math.random() * LARGURA,
              y,
              vy,
              vida,
              max: vida,
              tipo: longe ? 0 : 1,
              fase: Math.random() * 6
            })
          }
          for (const q of neve) if (q.vida > 0) q.vx = onda(t, 0.2, q.fase) * (q.tipo ? 3 : 1.5)
          mover(neve, dt)
          for (const q of neve) {
            if (q.vida <= 0) continue
            const cor = q.tipo ? p.neve : p.neveSombra
            px(c, apagada(q) ? (q.tipo ? p.neveSombra : p.montanhaSombra) : cor, q.x, q.y)
          }
          // Vento levantando neve de um pico, de vez em quando.
          proximoVento -= dt
          if (proximoVento <= 0) {
            proximoVento = 5 + Math.random() * 4
            const k = picos[Math.floor(Math.random() * picos.length)]
            for (let i = 0; i < 4; i++) {
              const v = livre(vento, fracao)
              const vida = 1.5 + Math.random()
              if (v)
                Object.assign(v, {
                  x: k.x - 2 + Math.random() * 8,
                  y: k.y + 1 + Math.random() * 3,
                  vx: 10 + Math.random() * 8,
                  vy: -1.5 + Math.random(),
                  vida,
                  max: vida
                })
            }
          }
          mover(vento, dt)
          for (const v of vento) if (v.vida > 0) px(c, apagada(v) ? p.neveSombra : p.pico, v.x, v.y)
          // Rara: uma estrela cadente.
          if (relogio(dt, cadente.vida > 0)) {
            Object.assign(cadente, {
              x: 60 + Math.random() * 220,
              y: 4 + Math.random() * 16,
              vx: -110,
              vy: 35,
              vida: 0.8,
              max: 0.8
            })
          }
          mover(cadentes, dt)
          if (cadente.vida > 0) {
            for (let k = 0; k < 6; k++)
              px(c, k < 2 ? p.estrela : p.neveSombra, cadente.x + k * 2, cadente.y - k * 0.6)
          }
        }
      }
    }
  )
}

// ---------- Geodo de Ametista ----------
// Brilhos aparecendo e sumindo nos cristais, uma faixa de luz subindo pelos cristais grandes a
// cada 10 a 15 s (com o reflexo do chão acompanhando) e poeira de cristal flutuando.

const AMETISTA = {
  ceu: ['#0f0820', '#190d35', '#24124a', '#2f175c', '#3b1d6e'],
  calcita: '#d9d4ea',
  casca: '#1b1030',
  cristalSombra: '#6d28d9',
  cristal: '#8b5cf6',
  cristalLuz: '#c4b5fd',
  brilho: '#f5f3ff'
}

function ametista(): Arte {
  const p = AMETISTA
  const teto = tetoDe(91, 14, 8, 3)
  const piso = morro(92, 156, 6, 2.2)
  // As linhas de um cristal de ponta (x, y, largura): sobe do chão (lado = -1) ou desce do teto.
  const linhas = (x: number, base: number, w: number, h: number, lado: number): number[][] =>
    Array.from({ length: h }, (_, i) => {
      const wi = i < h - w ? w : Math.max(1, h - i)
      return [x + Math.floor((w - wi) / 2), base + lado * i, wi]
    })
  // Sem "cores", os três tons (luz, base, sombra); com uma cor só, a silhueta de longe.
  const cristal = (
    c: CanvasRenderingContext2D,
    x: number,
    base: number,
    w: number,
    h: number,
    lado: number,
    cor?: string
  ): void => {
    for (const [xi, y, wi] of linhas(x, base, w, h, lado)) {
      const luz = Math.ceil(wi / 3)
      const sombra = Math.floor(wi / 3)
      px(c, cor ?? p.cristal, xi, y, wi, 1)
      if (cor) continue
      px(c, p.cristalLuz, xi, y, luz, 1)
      if (sombra) px(c, p.cristalSombra, xi + wi - sombra, y, sombra, 1)
    }
  }
  // Cristais: x, largura e altura. Os grandes só nos lados.
  const doChao = [
    [4, 7, 30],
    [26, 8, 40],
    [14, 10, 60],
    [38, 6, 22],
    [120, 6, 16],
    [128, 5, 10],
    [156, 5, 12],
    [190, 6, 18],
    [198, 4, 9],
    [262, 6, 20],
    [274, 8, 38],
    [302, 8, 44],
    [286, 12, 66]
  ]
  const doTeto = [
    [22, 9, 44],
    [52, 7, 24],
    [110, 6, 16],
    [150, 5, 10],
    [206, 6, 18],
    [250, 8, 28],
    [296, 10, 48],
    [310, 6, 26]
  ]
  // Os grandes, linha a linha a partir da base: por onde a faixa de luz sobe.
  const grandes = [
    ...doChao.filter(([, , h]) => h > 30).map(([x, w, h]) => linhas(x, piso[x] + 2, w, h, -1)),
    ...doTeto.filter(([, , h]) => h > 40).map(([x, w, h]) => linhas(x, teto[x] - 3, w, h, 1))
  ]
  // Brilhos: os seis da arte parada começam acesos; os outros, apagados.
  const brilhos = [
    [18, 92],
    [291, 86],
    [30, 114],
    [305, 108],
    [26, 54],
    [300, 58],
    [20, 132],
    [288, 122],
    [306, 134],
    [276, 142],
    [30, 66],
    [298, 72],
    [124, 150],
    [194, 146]
  ].map(([x, y], i) => ({
    x,
    y,
    hz: 0.15 + (i % 5) * 0.03,
    fase: i < 6 ? Math.PI / 2 : -Math.PI / 2
  }))
  const SUBIDA_S = 3.5
  return arte(
    p,
    [
      [p.brilho, p.cristal],
      [p.cristalLuz, p.cristalSombra],
      [p.cristalSombra, p.ceu[4]]
    ],
    () => {
      const fundo = camada((c) => {
        ceu(c, p.ceu, ALTURA)
        // Cristais ao longe, quase da cor do fundo.
        for (const [x, w, h] of [
          [70, 14, 46],
          [88, 10, 30],
          [142, 12, 26],
          [222, 14, 40],
          [240, 10, 54]
        ])
          cristal(c, x, 158, w, h, -1, p.ceu[2])
        for (const [x, w, h] of [
          [80, 12, 40],
          [176, 14, 34],
          [232, 10, 44]
        ])
          cristal(c, x, 10, w, h, 1, p.ceu[2])
      })
      const casca = camada((c) => {
        // A casca do geodo em volta e a calcita por fora dela.
        teto.forEach((y, x) => px(c, p.casca, x, 0, 1, y))
        piso.forEach((y, x) => px(c, p.casca, x, y, 1, ALTURA - y))
        for (let y = 0; y < ALTURA; y++) {
          px(c, p.casca, 0, y, 6 + Math.round(2 * Math.sin(y * 0.09)) * 2, 1)
          const w = 6 + Math.round(2 * Math.sin(y * 0.07 + 2)) * 2
          px(c, p.casca, LARGURA - w, y, w, 1)
        }
        for (let x = 0; x < LARGURA; x++) {
          px(c, p.calcita, x, 0, 1, 3 + (x % 7 < 3 ? 1 : 0))
          px(c, p.calcita, x, ALTURA - 3 - (x % 9 < 4 ? 1 : 0), 1, 4)
        }
        px(c, p.calcita, 0, 0, 2, ALTURA)
        px(c, p.calcita, LARGURA - 2, 0, 2, ALTURA)
      })
      const cristais = camada((c) => {
        for (const [x, w, h] of doChao) cristal(c, x, piso[x] + 2, w, h, -1)
        for (const [x, w, h] of doTeto) cristal(c, x, teto[x] - 3, w, h, 1)
      })
      const reflexo = (c: CanvasRenderingContext2D, cor: string): void => {
        for (const [x, w, h] of doChao) if (h > 30) xadrez(c, cor, x - 4, piso[x] + 4, w + 8, 4)
      }
      const chao = camada((c) => {
        // Reflexo lilás fraco no chão, embaixo dos cristais grandes.
        reflexo(c, p.ceu[4])
        // Cristais pequenos brotando nas paredes.
        for (const [x, y] of [
          [8, 70],
          [10, 98],
          [6, 122],
          [306, 62],
          [308, 90],
          [304, 116]
        ]) {
          px(c, p.cristal, x, y, 5, 3)
          px(c, p.cristalLuz, x, y, 3, 1)
          px(c, p.cristalSombra, x + 3, y + 2, 2, 1)
        }
        // Fragmentos caídos no chão.
        const r = sorteio(93)
        const tons = [p.cristalSombra, p.cristal, p.cristalLuz]
        for (let i = 0; i < 22; i++) {
          const x = 8 + Math.floor(r() * (LARGURA - 18))
          px(c, tons[i % 3], x, piso[x] + 5 + Math.floor(r() * 10), 2, 1)
        }
      })
      const poeira = pool(40)
      let proximaSubida = 10 + Math.random() * 5
      let subida = -1 // segundos desde que a faixa começou a subir (-1: parada)

      return {
        particulas: poeira,
        quadro(c, t, dt, fracao, so) {
          proximaSubida -= dt
          if (proximaSubida <= 0) {
            proximaSubida = 10 + Math.random() * 5
            subida = 0
          } else if (subida >= 0) subida = subida + dt > SUBIDA_S ? -1 : subida + dt
          if (!so) {
            c.drawImage(fundo, 0, 0)
            c.drawImage(casca, 0, 0)
            c.drawImage(cristais, 0, 0)
            c.drawImage(chao, 0, 0)
            if (subida >= 0) {
              const u = subida / SUBIDA_S
              // O reflexo do chão acende quando a luz sai da base.
              if (u < 0.3) reflexo(c, p.cristalSombra)
              for (const linhasDoCristal of grandes) {
                const i = Math.floor(u * linhasDoCristal.length)
                for (const [x, y, w] of linhasDoCristal.slice(i, i + 2))
                  px(c, p.cristalLuz, x, y, w, 1)
              }
            }
            // Brilhos aparecendo e sumindo: cruz, ponto ou nada.
            for (const b of brilhos) {
              const v = onda(t, b.hz, b.fase)
              if (v > 0.6) {
                px(c, p.brilho, b.x, b.y - 1, 1, 3)
                px(c, p.brilho, b.x - 1, b.y, 3, 1)
              } else if (v > 0.1) px(c, p.brilho, b.x, b.y)
            }
          }
          // Poeira de cristal flutuando, perto do chão ou do teto.
          const q = nova(poeira, fracao, dt * 4)
          if (q) {
            const vida = 6 + Math.random() * 6
            Object.assign(q, {
              x: 8 + Math.random() * (LARGURA - 16),
              y: Math.random() < 0.6 ? 130 + Math.random() * 36 : 14 + Math.random() * 38,
              vy: -(0.6 + Math.random() * 0.8),
              vida,
              max: vida,
              tipo: Math.random() < 0.5 ? 1 : 0,
              fase: Math.random() * 6
            })
          }
          for (const q of poeira) if (q.vida > 0) q.vx = onda(t, 0.1, q.fase) * 1.5
          mover(poeira, dt)
          for (const q of poeira) {
            if (q.vida <= 0) continue
            px(c, apagada(q) ? p.ceu[4] : q.tipo ? p.cristalLuz : p.cristal, q.x, q.y)
          }
        }
      }
    }
  )
}

// ---------- Pântano de Vagalumes ----------
// Vagalumes errantes pulsando (mais perto da água), névoa rasteira passando sobre a água, as
// linhas da água deslizando (as de perto mais rápidas), o reflexo da lua tremendo, cipós
// balançando e, raro, um peixe saltando e deixando anéis.

const PANTANO = {
  ceu: ['#13201c', '#1f2f23', '#2c3f2a', '#414f2c', '#56602f'],
  lua: '#eef2c0',
  longe: '#1d3324',
  agua: '#22402f',
  reflexo: '#3b6a4a',
  nevoa: '#2f5240',
  copa: '#2f5d2a',
  cipo: '#3f7a36',
  raiz: '#3b2a1a',
  regia: '#4a9a3f',
  flor: '#f9a8d4',
  vagalume: '#eaff7a'
}

function pantano(): Arte {
  const p = PANTANO
  const agua = 122
  const reflexoDaLua = [
    [126, 0, 22],
    [130, 4, 14],
    [134, 2, 16],
    [139, 7, 8],
    [145, 5, 10],
    [152, 8, 6]
  ]
  // Cipós de cada mangue: a parte de cima fica parada (sob a copa); o resto balança.
  const cipos: { x: number; y: number; h: number }[] = []
  // Árvore de mangue: x = meio, l = largura da copa, base = onde as raízes entram na água.
  const mangue = (
    c: CanvasRenderingContext2D,
    x: number,
    l: number,
    topo: number,
    base: number
  ): void => {
    const h = Math.round(l * 0.45)
    const e = x - l / 2
    px(c, p.raiz, x - 2, topo + h - 2, 5, base - 10 - topo - h)
    for (const lado of [-1, 1])
      for (const k of [1, 2])
        for (let i = 0; i < 8; i++) px(c, p.raiz, x + lado * (1 + i * k), base - 14 + i * 2, 2, 3)
    for (let v = e + 4; v < e + l - 2; v += 7) {
      px(c, p.cipo, v, topo + h, 1, 2)
      cipos.push({ x: v, y: topo + h + 2, h: 3 + (Math.abs(v * 7) % 17) })
    }
    px(c, p.copa, e, topo + 4, l, h - 4)
    px(c, p.copa, e + 6, topo, l - 12, 4)
    px(c, p.longe, e, topo + h - 4, l, 4)
    px(c, p.longe, e + 4, topo + h, 8, 2)
    px(c, p.longe, e + l - 14, topo + h, 10, 2)
    px(c, p.cipo, e + 6, topo, l - 20, 2)
    px(c, p.cipo, e + 2, topo + 4, Math.round(l / 3), 3)
  }
  return arte(
    p,
    [
      [p.vagalume, p.regia],
      [p.lua, p.agua]
    ],
    () => {
      const fundo = camada((c) => {
        ceu(c, p.ceu, agua)
        px(c, p.lua, 222, 18, 22, 22)
      })
      const longe = camada((c) => {
        // Árvores ao longe, numa faixa só.
        morro(101, 112, 10, 5).forEach((y, x) => px(c, p.longe, x, y, 1, agua - y))
        for (let x = 6; x < LARGURA; x += 26) px(c, p.longe, x, 100 + ((x * 3) % 8), 14, 22)
      })
      const lamina = camada((c) => {
        px(c, p.agua, 0, agua, LARGURA, ALTURA - agua)
        xadrez(c, p.longe, 0, agua, LARGURA, 4)
      })
      // As linhas de reflexo da água em duas distâncias: as de perto deslizam mais rápido.
      const linhas: [number, number, number][] = []
      const r = sorteio(102)
      for (let i = 0; i < 40; i++)
        linhas.push([r() * LARGURA, 128 + Math.floor(r() * 48), 6 + Math.floor(r() * 9)])
      const reflexosLonge = camada((c) => {
        for (const [x, y, w] of linhas) if (y < 150) px(c, p.reflexo, x, y, w, 1)
      })
      const reflexosPerto = camada((c) => {
        for (const [x, y, w] of linhas) if (y >= 150) px(c, p.reflexo, x, y, w, 1)
      })
      // Névoa rasteira: três manchas em xadrez que entram pela esquerda e passam devagar.
      const nevoas = [
        [46, 5, 128],
        [60, 4, 136],
        [38, 6, 143]
      ].map(([w, h, y]) => ({
        y,
        w,
        tela: camada((c) => {
          for (let j = 0; j < h; j++) {
            const recuo = Math.abs(j - (h - 1) / 2) * 5
            xadrez(c, p.nevoa, Math.round(recuo), j, Math.round(w - 2 * recuo), 1)
          }
        }, h)
      }))
      const arvores = camada((c) => {
        mangue(c, 86, 32, 90, 130)
        mangue(c, 30, 60, 60, 136)
        mangue(c, 288, 64, 54, 138)
        // Cogumelos pequenos nas raízes.
        for (const [x, y] of [
          [16, 131],
          [44, 133],
          [300, 134],
          [272, 135]
        ]) {
          px(c, p.flor, x, y, 3, 1)
          px(c, p.lua, x + 1, y + 1, 1, 2)
        }
      })
      const vagalumes = pool(36)
      const margem = camada((c) => {
        // Margem nos cantos, com juncos e taboas.
        for (let x = 0; x < 64; x++) {
          px(c, p.longe, x, 166 + Math.round((x * x) / 800) * 2, 1, ALTURA)
          const k = LARGURA - 1 - x
          px(c, p.longe, k, 164 + Math.round((x * x) / 800) * 2, 1, ALTURA)
        }
        for (const x of [4, 9, 15, 22, 30, 41, 278, 286, 293, 300, 308, 315]) {
          const h = 12 + ((x * 5) % 12)
          px(c, p.cipo, x, 170 - h, 1, h)
          if (x % 2) px(c, p.raiz, x, 166 - h, 2, 5)
        }
        // Vitórias-régias, uma com flor.
        for (const [x, y] of [
          [92, 172],
          [118, 160],
          [140, 168],
          [176, 158],
          [204, 170]
        ]) {
          px(c, p.regia, x, y, 7, 2)
          px(c, p.regia, x + 1, y - 1, 5, 1)
          px(c, p.agua, x + 3, y - 1)
        }
        px(c, p.flor, 178, 155, 3, 2)
        // Os vagalumes da arte parada (nos lados e sobre a água) viram as primeiras partículas.
        const r = sorteio(103)
        for (let i = 0; i < 24; i++) {
          const v = vagalumes[i]
          if (i < 16) Object.assign(v, { x: naBorda(r), y: 48 + r() * 100 })
          else Object.assign(v, { x: r() * LARGURA, y: 126 + r() * 40 })
          Object.assign(v, { vida: 6 + (i % 10), max: 20, fase: i * 0.7 })
        }
      })
      const peixes = pool(3, true) // o peixe (tipo 0) e os dois anéis do mergulho (tipo 1)
      const peixe = peixes[0]
      const relogio = relogioRaro()

      return {
        particulas: [...vagalumes, ...peixes],
        quadro(c, t, dt, fracao, so) {
          if (!so) {
            c.drawImage(fundo, 0, 0)
            c.drawImage(longe, 0, 0)
            c.drawImage(lamina, 0, 0)
            rolar(c, reflexosLonge, t * 2)
            rolar(c, reflexosPerto, t * 4)
            // O reflexo da lua tremendo de leve.
            for (const [y, dx, w] of reflexoDaLua) {
              const d = Math.round(1.2 * (onda(t, 0.35, y * 0.7) - Math.sin(y * 0.7)))
              px(c, p.lua, 222 + dx + d, y, w, 1)
            }
            // Névoa entrando pela esquerda e passando devagar sobre a água.
            nevoas.forEach((n, i) => {
              let x = t * 5 - n.w - i * 110
              if (x > LARGURA) x = ((x - LARGURA) % (LARGURA + n.w + 40)) - n.w
              c.drawImage(n.tela, Math.round(x), n.y)
            })
            c.drawImage(arvores, 0, 0)
            cipos.forEach((v, i) => {
              const d = balanco(t, 0.15 + (i % 4) * 0.03, i)
              for (let k = 0; k < v.h; k++)
                px(c, p.cipo, v.x + Math.round((d * (k + 2)) / (v.h + 2)), v.y + k)
            })
            c.drawImage(margem, 0, 0)
          }
          // Raro: um peixe salta e deixa dois anéis.
          if (relogio(dt, ativas(peixes) > 0)) {
            const lado = Math.random() < 0.5 ? 1 : -1
            Object.assign(peixe, {
              x: 100 + Math.random() * 100,
              y: 132,
              vx: 12 * lado,
              vy: -16,
              vida: 1.4,
              max: 1.4,
              tipo: 0
            })
          }
          if (peixe.vida > 0) {
            peixe.vy += 24 * dt
            if (peixe.vida - dt <= 0) {
              for (const [k, a] of [peixes[1], peixes[2]].entries())
                Object.assign(a, {
                  x: peixe.x,
                  y: 134 + k * 3,
                  vx: 0,
                  vy: 0,
                  vida: 1.6 + k * 0.4,
                  max: 1.6 + k * 0.4,
                  tipo: 1
                })
            }
          }
          mover(peixes, dt)
          for (const q of peixes) {
            if (q.vida <= 0) continue
            if (q.tipo === 1) anel(c, q.vida < q.max * 0.4 ? p.reflexo : p.lua, q)
            else px(c, p.lua, q.x, q.y, 2, 1)
          }
          // Vagalumes errantes, mais densos perto da água, com o brilho pulsando.
          const v = nova(vagalumes, fracao, dt * 3)
          if (v) {
            const vida = 10 + Math.random() * 8
            const perto = Math.random() < 0.7
            Object.assign(v, {
              x: perto ? Math.random() * LARGURA : naBorda(Math.random),
              y: perto ? 126 + Math.random() * 36 : 24 + Math.random() * 32,
              vida,
              max: vida,
              fase: Math.random() * 6
            })
          }
          for (const q of vagalumes) {
            if (q.vida <= 0) continue
            q.vx = 5 * onda(t, 0.12, q.fase) + 3 * onda(t, 0.31, q.fase * 2)
            q.vy = 3 * onda(t, 0.15, q.fase + 1) + 2 * onda(t, 0.27, q.fase * 3)
          }
          mover(vagalumes, dt)
          for (const q of vagalumes) {
            if (q.vida <= 0) continue
            const aceso = !apagada(q) && onda(t, 0.3 + (q.fase % 1) * 0.3, Math.PI / 2) > -0.2
            px(c, aceso ? p.vagalume : p.regia, q.x, q.y)
          }
        }
      }
    }
  )
}

// ---------- Os doze ----------

export const ARTE: Record<Bioma, Arte> = {
  diaClaro: campo(
    {
      ceu: ['#8fd0ff', '#a6dbff', '#bce5ff', '#d2efff'],
      sol: '#fff3b0',
      solBorda: '#ffe07a',
      nuvem: '#ffffff',
      nuvemSombra: '#e3f2ff',
      morroLonge: '#8fd18a',
      morroLongeCorpo: '#79c274',
      grama: '#5cc85f',
      morro: '#4caf50',
      tronco: '#7a4a24',
      folha: '#3e9b45',
      folhaEscura: '#2f7d36',
      terra: '#8b5a2b',
      terraEscura: '#6b4423',
      polen: '#fff3b0',
      passaro: '#3b4a5a'
    },
    { x: 250, y: 14, lado: 26 },
    1
  ),
  dia: campo(
    {
      ceu: ['#1f4e79', '#3b6a96', '#6a8fae', '#a7aeb0', '#d6b894', '#f3c88b'],
      sol: '#ffd166',
      solBorda: '#f4a259',
      nuvem: '#f6e2c4',
      nuvemSombra: '#e3c3a0',
      morroLonge: '#3f7a52',
      morroLongeCorpo: '#356a46',
      grama: '#3e8e4a',
      morro: '#2f6b3a',
      tronco: '#5b3a1e',
      folha: '#2e7d32',
      folhaEscura: '#1f5e26',
      terra: '#6b4423',
      terraEscura: '#4a2f18',
      polen: '#ffe8a3',
      passaro: '#1b2a3a'
    },
    { x: 226, y: 84, lado: 30 },
    4
  ),
  noite: noite(),
  mar: mar(),
  nether: nether(),
  cerejeira: cerejeira(),
  caverna: caverna(),
  deepDark: deepDark(),
  deserto: deserto(),
  aurora: aurora(),
  ametista: ametista(),
  pantano: pantano()
}

// ---------- Cores da logo e do nome na barra lateral (DESIGN.md 1.1) ----------
// Escolhidas à mão, só entre as cores que a própria cena usa acima: h = cor principal (face do
// H, ServSquare), s = a secundária que contrasta com ela (face do S, PlaySquare), topo = o tom
// mais claro da cena e contorno = o tom dominante bem escuro (perto do #1E2A2F oficial). A
// claridade de h e s ainda é ajustada pela logoCoresRegras.ts, se faltar contraste.
export const LOGO: Record<Bioma, CoresDaCena> = {
  // Campo de dia: a folhagem, o céu e o sol; contorno no azul do céu.
  diaClaro: { h: '#3e9b45', s: '#8fd0ff', topo: '#fff3b0', contorno: '#16283a' },
  // Pôr do sol: a grama, a borda laranja do sol e a nuvem dourada; contorno no azul do céu alto.
  dia: { h: '#3e8e4a', s: '#f4a259', topo: '#f6e2c4', contorno: '#0f2236' },
  noite: { h: NOITE.estrela, s: NOITE.estrela2, topo: NOITE.lua, contorno: '#0a0a20' },
  mar: { h: MAR.agua[2], s: MAR.peixe, topo: MAR.bolha, contorno: '#06283a' },
  nether: { h: NETHER.ceu[4], s: NETHER.lava, topo: NETHER.lavaBrilho, contorno: '#1f0808' },
  cerejeira: {
    h: CEREJEIRA.copaSombra,
    s: CEREJEIRA.ceu[0],
    topo: CEREJEIRA.copaLuz,
    contorno: '#2b1020'
  },
  caverna: { h: CAVERNA.musgo, s: CAVERNA.baga, topo: CAVERNA.bagaLuz, contorno: '#08130c' },
  deepDark: {
    h: DEEP_DARK.brilhante,
    s: DEEP_DARK.fraco,
    topo: DEEP_DARK.ponto,
    contorno: '#03090c'
  },
  deserto: { h: DESERTO.duna1, s: DESERTO.ceu[4], topo: DESERTO.sol, contorno: '#2a1206' },
  aurora: { h: AURORA.auroraVerde, s: AURORA.auroraRoxa, topo: AURORA.pico, contorno: '#061230' },
  ametista: {
    h: AMETISTA.cristal,
    s: AMETISTA.calcita,
    topo: AMETISTA.brilho,
    contorno: '#0f0820'
  },
  pantano: { h: PANTANO.regia, s: PANTANO.flor, topo: PANTANO.lua, contorno: '#0d1a14' }
}
