import type { CorEtiqueta } from '../../../shared/tipos'

// Cores das etiquetas dos mods (Fase 25). São conteúdo do usuário (como as cores do MOTD),
// não cores da interface: ficam iguais no tema claro e no escuro. Os valores estão no tokens.css.
export const COR_ETIQUETA: Record<CorEtiqueta, { hex: string; nome: string }> = {
  vermelho: { hex: 'var(--etiqueta-vermelho)', nome: 'Vermelho' },
  laranja: { hex: 'var(--etiqueta-laranja)', nome: 'Laranja' },
  amarelo: { hex: 'var(--etiqueta-amarelo)', nome: 'Amarelo' },
  verde: { hex: 'var(--etiqueta-verde)', nome: 'Verde' },
  azul: { hex: 'var(--etiqueta-azul)', nome: 'Azul' },
  roxo: { hex: 'var(--etiqueta-roxo)', nome: 'Roxo' },
  cinza: { hex: 'var(--etiqueta-cinza)', nome: 'Cinza' }
}
