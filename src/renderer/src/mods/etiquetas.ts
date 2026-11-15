import type { CorEtiqueta } from '../../../shared/tipos'
import { t } from '../../../shared/i18n'

// Cores das etiquetas dos mods (Fase 25). São conteúdo do usuário (como as cores do MOTD),
// não cores da interface: ficam iguais no tema claro e no escuro. Os valores estão no tokens.css.
export const COR_ETIQUETA: Record<CorEtiqueta, { hex: string; nome: string }> = {
  vermelho: { hex: 'var(--etiqueta-vermelho)', nome: t('etiquetas.vermelho') },
  laranja: { hex: 'var(--etiqueta-laranja)', nome: t('etiquetas.laranja') },
  amarelo: { hex: 'var(--etiqueta-amarelo)', nome: t('etiquetas.amarelo') },
  verde: { hex: 'var(--etiqueta-verde)', nome: t('etiquetas.verde') },
  azul: { hex: 'var(--etiqueta-azul)', nome: t('etiquetas.azul') },
  roxo: { hex: 'var(--etiqueta-roxo)', nome: t('etiquetas.roxo') },
  cinza: { hex: 'var(--etiqueta-cinza)', nome: t('etiquetas.cinza') }
}
