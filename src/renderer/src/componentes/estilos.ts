// Classes do Tailwind dos componentes base (DESIGN.md, seções 5 e 6.7). As cores vêm dos tokens.

export type Variante = 'primario' | 'secundario' | 'perigo' | 'atencao' | 'destaque'

const CORES: Record<Variante, string> = {
  primario: 'bg-accent text-accent-text border-accent-shadow hover:bg-accent-hover',
  secundario: 'bg-secondary text-on-light border-secondary-shadow hover:brightness-95',
  perigo: 'bg-danger text-on-dark border-danger-shadow hover:brightness-90',
  atencao: 'bg-warning text-on-light border-warning-shadow hover:brightness-95',
  destaque: 'bg-highlight text-on-dark border-highlight-shadow hover:brightness-90'
}

// Relevo: borda de baixo mais escura + brilho em cima. Pressionado: desce 2px e a borda afina.
const RELEVO =
  'inline-flex items-center justify-center gap-2 border-b-[3px] shadow-[inset_0_1px_0_var(--relevo-brilho)] ' +
  'transition-[transform,background-color,border-color,filter] duration-(--dur-fast) ease-(--ease-out) select-none ' +
  'enabled:active:translate-y-[2px] enabled:active:border-b-1 enabled:active:duration-(--dur-instant) ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const MEDIDAS = {
  pequeno: 'h-8 rounded-[calc(var(--raio-pequeno)-2px)] px-3 text-[13px] font-bold',
  normal: 'h-10 rounded-(--raio-pequeno) px-[18px] text-[13px] font-bold',
  // Botão principal da barra de ação (seção 6.4): 232×52, fonte pixel 24px em caixa alta.
  grande:
    'botao-grande h-[52px] w-[232px] rounded-[calc(var(--raio-pequeno)+2px)] font-pixel text-2xl uppercase'
}

export function classesBotao(
  variante: Variante = 'secundario',
  tamanho: keyof typeof MEDIDAS = 'normal'
): string {
  return `${RELEVO} ${MEDIDAS[tamanho]} ${CORES[variante]}`
}

// Campo de texto e select (seção 6.7): 36px, fundo --bg-panel-2, borda --border, foco em --accent.
export const campo =
  'h-9 w-full border border-linha bg-panel-2 px-3 text-[13px] text-texto outline-none ' +
  'transition-colors duration-(--dur-fast) focus:border-accent disabled:opacity-50'

// Rótulo pequeno em caixa alta (seção 4): cabeçalho de seção, título acima das abas, stats.
export const rotuloPequeno = 'text-xs font-bold uppercase tracking-[.02em] text-muted'

export const cartao = 'border border-linha bg-panel p-4'
