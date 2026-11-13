import type { Bioma } from '../../../shared/tipos'

// Os cinco biomas animados (Fases V1 e V2, DESIGN.md seção 7). Pixel art original do app,
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
}

interface Arte {
  paleta: string[]
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
interface Particula {
  x: number
  y: number
  vx: number
  vy: number
  vida: number
  max: number
  tipo: number
  fase: number
}

function pool(n: number): Particula[] {
  return Array.from({ length: n }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    vida: 0,
    max: 1,
    tipo: 0,
    fase: 0
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

function mover(lista: Particula[], dt: number): void {
  for (const p of lista) {
    if (p.vida <= 0) continue
    p.vida -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
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
    const passaros = pool(6)
    let proximoBando = 6 + r() * 10

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
        proximoBando -= dt
        if (proximoBando <= 0) {
          proximoBando = 25 + Math.random() * 30
          const y = 24 + Math.random() * 30
          for (let i = 0; i < 5; i++) {
            const b = livre(passaros, 1)
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
            y: 60 + Math.random() * 100,
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
      }
    }
  }
  return {
    paleta: Object.values(p).flat(),
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
    let cadente = { x: 0, y: 0, vida: 0 }
    let proximaCadente = 5 + r() * 8

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
        proximaCadente -= dt
        if (proximaCadente <= 0 && cadente.vida <= 0) {
          proximaCadente = 8 + Math.random() * 14
          cadente = { x: 120 + Math.random() * 200, y: 6 + Math.random() * 30, vida: 0.7 }
        }
        if (cadente.vida > 0) {
          cadente.vida -= dt
          cadente.x -= 140 * dt
          cadente.y += 60 * dt
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
      }
    }
  }
  return {
    paleta: Object.values(p).flat(),
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
    const cardume = pool(9)
    let proximoCardume = 4 + r() * 8

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
        proximoCardume -= dt
        if (proximoCardume <= 0) {
          proximoCardume = 18 + Math.random() * 20
          const y = 50 + Math.random() * 60
          const direita = Math.random() < 0.5
          for (let i = 0; i < 9; i++) {
            const f = livre(cardume, 1)
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
          Object.assign(b, {
            x: Math.random() * LARGURA,
            y: 170,
            vx: 0,
            vy: -(14 + Math.random() * 16),
            vida: 12,
            max: 12,
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
      }
    }
  }
  return {
    paleta: Object.values(p).flat(),
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
    const brasas = pool(60)
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
          const b = livre(bolhas, 1)
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
            vida: 4 + Math.random() * 5,
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
      }
    }
  }
  return {
    paleta: Object.values(p).flat(),
    criar: montar,
    desenhar: (c) => montar().quadro(c, 0, 0, 0, false)
  }
}

// ---------- Os cinco ----------

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
  nether: nether()
}
