import { ehIdioma, type Idioma } from './i18n'

// Fase I1: qual idioma usar ao abrir o app.
// - Já escolhido (idioma.json): ele.
// - Instalação antiga (já tinha dados do app, de antes da tradução): português, sem perguntar.
// - Primeira abertura: pergunta, já marcando o do instalador ou, sem ele, o do Windows.

// Arquivos que só existem se o app já foi usado antes (qualquer um basta).
export const ARQUIVOS_DE_USO = [
  'servidores.json',
  'modo-app.json',
  'aparencia.json',
  'instalacoes.json',
  'ajustes.json',
  'ajustes-jogo.json'
]

// Windows em português (qualquer variante) marca pt-BR; qualquer outro idioma marca English.
export const idiomaDoSistema = (preferidos: readonly string[]): Idioma =>
  /^pt\b/i.test(preferidos[0] ?? '') ? 'pt-BR' : 'en-US'

// O instalador grava "pt-BR"/"en-US" (ou o código do Windows: 1046 = pt-BR, 1033 = en-US).
export function idiomaDoInstalador(texto: string | null): Idioma | null {
  const s = (texto ?? '').trim()
  if (ehIdioma(s)) return s
  if (s === '1046') return 'pt-BR'
  if (s === '1033') return 'en-US'
  return null
}

export function decidirIdioma(e: {
  salvo: unknown
  instalador: Idioma | null
  sistema: Idioma
  usadoAntes: boolean
}): { idioma: Idioma; perguntar: boolean } {
  if (ehIdioma(e.salvo)) return { idioma: e.salvo, perguntar: false }
  if (e.usadoAntes) return { idioma: 'pt-BR', perguntar: false }
  return { idioma: e.instalador ?? e.sistema, perguntar: true }
}
