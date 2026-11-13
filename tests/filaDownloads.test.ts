import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Cancelado, limitarProgresso, rodarFila } from '../src/main/filaDownloads'

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

test('limite de downloads simultâneos', async () => {
  let agora = 0
  let pico = 0
  const feitos: number[] = []
  const falhas = await rodarFila(
    Array.from({ length: 40 }, (_, i) => i),
    async (i) => {
      agora++
      pico = Math.max(pico, agora)
      await dormir(5)
      agora--
      feitos.push(i)
    },
    { simultaneos: 6 }
  )
  assert.equal(pico, 6)
  assert.equal(feitos.length, 40)
  assert.deepEqual(falhas, [])
})

test('nova tentativa: 3 vezes, com espera crescente, e depois vira falha', async () => {
  const chamadas = new Map<string, number>()
  const esperas: number[] = []
  const falhas = await rodarFila(
    ['instavel', 'quebrado', 'bom'],
    async (x) => {
      const n = (chamadas.get(x) ?? 0) + 1
      chamadas.set(x, n)
      if (x === 'quebrado') throw new Error('sem internet')
      if (x === 'instavel' && n < 3) throw new Error('caiu no meio')
    },
    {
      tentativas: 3,
      espera: (n) => {
        esperas.push(n)
        return n
      }
    }
  )
  assert.equal(chamadas.get('instavel'), 3) // falhou 2 vezes e deu certo na 3ª
  assert.equal(chamadas.get('quebrado'), 3) // nunca mais que 3
  assert.equal(chamadas.get('bom'), 1)
  assert.deepEqual(
    falhas.map((f) => f.item),
    ['quebrado']
  )
  // Espera antes da 2ª e da 3ª tentativa de cada um que falhou.
  assert.deepEqual(esperas.sort(), [2, 2, 3, 3])
  // Padrão: 1 s, depois 2 s (espera crescente).
  const tempos: number[] = []
  let t = Date.now()
  await rodarFila(
    ['x'],
    async () => {
      tempos.push(Date.now() - t)
      t = Date.now()
      throw new Error('falha')
    },
    { tentativas: 2 }
  ).then((f) => assert.equal(f.length, 1))
  assert.ok(tempos[1] >= 900, `esperou ${tempos[1]} ms`)
})

test('cancelamento: para de pegar itens novos e avisa quem está no meio', async () => {
  const controle = new AbortController()
  const comecados: number[] = []
  let viramCancelar = 0
  const promessa = rodarFila(
    Array.from({ length: 100 }, (_, i) => i),
    async (i, sinal) => {
      comecados.push(i)
      if (i === 3) controle.abort()
      await new Promise<void>((r) => {
        const t = setTimeout(r, 50)
        sinal?.addEventListener('abort', () => {
          viramCancelar++
          clearTimeout(t)
          r()
        })
      })
    },
    { simultaneos: 4, sinal: controle.signal }
  )
  await assert.rejects(promessa, Cancelado)
  assert.ok(comecados.length <= 4, `começou ${comecados.length}`)
  assert.ok(viramCancelar >= 3)
  // Cancelar durante a espera de uma nova tentativa também para na hora.
  const c2 = new AbortController()
  const t = Date.now()
  const p2 = rodarFila(
    ['x'],
    async () => {
      setTimeout(() => c2.abort(), 20)
      throw new Error('falha')
    },
    { sinal: c2.signal, espera: () => 10_000 }
  )
  await assert.rejects(p2, Cancelado)
  assert.ok(Date.now() - t < 1000)
})

test('progresso para a tela: no máximo um a cada 250 ms, e o último sempre chega', async () => {
  const enviados: number[] = []
  const avisar = limitarProgresso((n: number) => enviados.push(n), 50)
  for (let i = 1; i <= 1000; i++) avisar(i)
  await dormir(80)
  assert.ok(enviados.length <= 3, `enviou ${enviados.length}`)
  assert.equal(enviados.at(-1), 1000)
})
