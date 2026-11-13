// Fila de trabalhos (downloads de modpack): no máximo N ao mesmo tempo, nova tentativa limitada
// com espera crescente e cancelamento. Uma falha não para as outras: no fim, devolve a lista do
// que falhou (para "Tentar de novo só os que falharam"). Sem rede nem Electron: testada em
// tests/filaDownloads.test.ts.

export class Cancelado extends Error {
  constructor() {
    super('Cancelado.')
  }
}

export interface OpcoesFila {
  simultaneos?: number // padrão 6
  tentativas?: number // padrão 3 (a primeira conta)
  espera?: (tentativa: number) => number // ms antes da tentativa 2, 3...; padrão 1 s, 2 s, 4 s...
  sinal?: AbortSignal
  aoTerminarUm?: (feitos: number, total: number) => void
}

export interface Falha<T> {
  item: T
  erro: unknown
}

const dormir = (ms: number, sinal?: AbortSignal): Promise<void> =>
  new Promise((resolver, falhar) => {
    if (sinal?.aborted) return falhar(new Cancelado())
    const t = setTimeout(() => {
      sinal?.removeEventListener('abort', aoCancelar)
      resolver()
    }, ms)
    const aoCancelar = (): void => {
      clearTimeout(t)
      falhar(new Cancelado())
    }
    sinal?.addEventListener('abort', aoCancelar, { once: true })
  })

export async function rodarFila<T>(
  itens: T[],
  tarefa: (item: T, sinal?: AbortSignal) => Promise<void>,
  o: OpcoesFila = {}
): Promise<Falha<T>[]> {
  const simultaneos = Math.max(1, o.simultaneos ?? 6)
  const tentativas = Math.max(1, o.tentativas ?? 3)
  const espera = o.espera ?? ((n: number) => 1000 * 2 ** (n - 2))
  const fila = [...itens]
  const falhas: Falha<T>[] = []
  let feitos = 0

  const umItem = async (item: T): Promise<void> => {
    for (let n = 1; ; n++) {
      if (o.sinal?.aborted) throw new Cancelado()
      try {
        return await tarefa(item, o.sinal)
      } catch (e) {
        if (o.sinal?.aborted) throw new Cancelado()
        if (n >= tentativas) throw e
        await dormir(espera(n + 1), o.sinal)
      }
    }
  }

  const trabalhador = async (): Promise<void> => {
    while (fila.length) {
      if (o.sinal?.aborted) throw new Cancelado()
      const item = fila.shift()!
      try {
        await umItem(item)
      } catch (e) {
        if (e instanceof Cancelado) throw e
        falhas.push({ item, erro: e })
      }
      o.aoTerminarUm?.(++feitos, itens.length)
    }
  }

  // allSettled: no cancelamento, espera os que estão no meio pararem antes de devolver.
  const r = await Promise.allSettled(
    Array.from({ length: Math.min(simultaneos, itens.length) }, trabalhador)
  )
  if (o.sinal?.aborted || r.some((x) => x.status === 'rejected')) throw new Cancelado()
  return falhas
}

// Avisos de progresso para a tela: no máximo um a cada `ms` (o último sempre chega).
export function limitarProgresso<P>(enviar: (p: P) => void, ms = 250): (p: P) => void {
  let ultimo = 0
  let guardado: P | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  return (p: P) => {
    const agora = Date.now()
    if (agora - ultimo >= ms) {
      ultimo = agora
      guardado = null
      enviar(p)
      return
    }
    guardado = p
    timer ??= setTimeout(
      () => {
        timer = null
        if (guardado) {
          ultimo = Date.now()
          enviar(guardado)
          guardado = null
        }
      },
      ms - (agora - ultimo)
    )
  }
}
