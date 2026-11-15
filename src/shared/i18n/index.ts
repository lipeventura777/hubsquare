// Tradução do app (Fase I1): pt-BR é a base, en-US tem as mesmas chaves (conferido pelo build e
// por tests/idioma.test.ts). Cada processo (principal, preload e tela) guarda o próprio idioma
// atual; o principal avisa os outros quando ele muda.
import { ptBR } from './pt-BR'
import { enUS } from './en-US'

export type Idioma = 'pt-BR' | 'en-US'
export const IDIOMAS: readonly Idioma[] = ['pt-BR', 'en-US']
export type Chave = keyof typeof ptBR
export type Texto = string | { one: string; other: string }

export const TEXTOS: Record<Idioma, Record<Chave, Texto>> = { 'pt-BR': ptBR, 'en-US': enUS }

let atual: Idioma = 'pt-BR'

export const ehIdioma = (v: unknown): v is Idioma => v === 'pt-BR' || v === 'en-US'

export function definirIdioma(idioma: Idioma): void {
  atual = idioma
}

export const idiomaAtual = (): Idioma => atual

// Troca {nome} pelas variáveis; com { one, other }, escolhe pelo plural da variável count.
export function t(chave: Chave, vars?: Record<string, unknown>): string {
  const v = TEXTOS[atual][chave] ?? ptBR[chave] ?? chave
  const s =
    typeof v === 'string'
      ? v
      : new Intl.PluralRules(atual).select(Number(vars?.count ?? 0)) === 'one'
        ? v.one
        : v.other
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

// Nomes de telas e abas: no código eles são identificadores em português (ex.: 'Ajustes do
// jogo'); na tela aparecem pela chave nome.<identificador>. Sem chave, mostra o próprio nome.
export function tNome(nome: string): string {
  const chave = `nome.${nome}` as Chave
  return chave in ptBR ? t(chave) : nome
}

export const numero = (n: number, opcoes?: Intl.NumberFormatOptions): string =>
  n.toLocaleString(atual, opcoes)

export const dataHora = (d: string | number | Date): string =>
  new Date(d).toLocaleString(atual, { dateStyle: 'short', timeStyle: 'short' })

export const data = (d: string | number | Date): string =>
  new Date(d).toLocaleDateString(atual, { dateStyle: 'short' })

export const hora = (d: string | number | Date): string =>
  new Date(d).toLocaleTimeString(atual, { timeStyle: 'short' })

export function tamanho(bytes: number): string {
  const unidades = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < unidades.length - 1) {
    n /= 1024
    i++
  }
  return `${numero(n, { maximumFractionDigits: i ? 1 : 0 })} ${unidades[i]}`
}
