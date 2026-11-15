import type { Fonte } from './fontes'
import { t, idiomaAtual } from './i18n'

// Páginas nas listas de mods (Fase V9). Sem DOM nem Electron: testado em tests/paginaRegras.test.ts.
// Páginas começam em 1.

export const TAMANHOS_PAGINA = [12, 24, 48, 96] as const
export type TamanhoPagina = (typeof TAMANHOS_PAGINA)[number]
export const TAMANHO_PADRAO: TamanhoPagina = 24

export const tamanhoValido = (v: unknown): TamanhoPagina =>
  TAMANHOS_PAGINA.includes(v as TamanhoPagina) ? (v as TamanhoPagina) : TAMANHO_PADRAO

export const totalPaginas = (total: number, tamanho: number): number =>
  Math.max(1, Math.ceil(Math.max(0, total) / tamanho))

// Página fora do limite volta para a mais próxima válida (a última, se passou do fim).
export const paginaValida = (pagina: number, total: number, tamanho: number): number =>
  Math.min(Math.max(1, Math.floor(pagina) || 1), totalPaginas(total, tamanho))

// Itens mostrados (1 a 1): "Mostrando 25–48 de 1.234". Lista vazia: de 0 a 0.
export function intervalo(
  pagina: number,
  tamanho: number,
  total: number
): { de: number; ate: number } {
  if (total <= 0) return { de: 0, ate: 0 }
  const p = paginaValida(pagina, total, tamanho)
  return { de: (p - 1) * tamanho + 1, ate: Math.min(p * tamanho, total) }
}

export const textoIntervalo = (pagina: number, tamanho: number, total: number): string => {
  const { de, ate } = intervalo(pagina, tamanho, total)
  const n = (v: number): string => v.toLocaleString(idiomaAtual())
  return t('s.paginaRegras.mostrandoDe', { n: n(de), n2: n(ate), n3: n(total) })
}

// Números da barra: sempre a primeira e a última, a atual com uma de cada lado, e "…" no
// lugar do que falta (1 … 4 5 6 … 20). Até 7 páginas, todas aparecem.
export function numerosPaginas(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const meio = Math.min(Math.max(atual, 3), total - 2)
  const lista: (number | '…')[] = [1]
  const ini = Math.max(2, meio - 1)
  const fim = Math.min(total - 1, meio + 1)
  if (ini > 2) lista.push('…')
  for (let i = ini; i <= fim; i++) lista.push(i)
  if (fim < total - 1) lista.push('…')
  lista.push(total)
  return lista
}

// Cada API: o máximo de itens por pedido e, no CurseForge, o máximo que dá para alcançar.
export const MAXIMO_POR_PEDIDO: Record<Fonte, number> = {
  modrinth: 100,
  curseforge: 50,
  hangar: 25
}
export const LIMITE_CURSEFORGE = 10_000

// Os pedidos para abrir uma página (offset/limit; no CurseForge, index/pageSize). Se o tamanho
// da página passa do máximo da API, são vários pedidos para a mesma página. No CurseForge,
// index + pageSize não passa de 10.000: o que ficar além some (lista vazia = página inalcançável).
export function pedidosDaPagina(
  fonte: Fonte,
  pagina: number,
  tamanho: number
): { offset: number; limit: number }[] {
  const max = MAXIMO_POR_PEDIDO[fonte]
  const inicio = (Math.max(1, Math.floor(pagina)) - 1) * tamanho
  const fimPagina =
    fonte === 'curseforge' ? Math.min(inicio + tamanho, LIMITE_CURSEFORGE) : inicio + tamanho
  const pedidos: { offset: number; limit: number }[] = []
  for (let o = inicio; o < fimPagina; o += max)
    pedidos.push({ offset: o, limit: Math.min(max, fimPagina - o) })
  return pedidos
}

// Total que dá para paginar: no CurseForge, só os 10.000 primeiros abrem.
export const totalAlcancavel = (fonte: Fonte, total: number): number =>
  fonte === 'curseforge' ? Math.min(total, LIMITE_CURSEFORGE) : total
export const muitosResultados = (fonte: Fonte, total: number): boolean =>
  fonte === 'curseforge' && total > LIMITE_CURSEFORGE
