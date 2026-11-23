// Fase P7: o conjunto de ícones do HubSquare, "traço limpo com cantos quadradinhos"
// (DESIGN.md, seção 6.11). Só dados: cada ícone é o caminho do traço (2 px, pontas quadradas,
// cantos vivos) numa grade de 24 px com 2 px de margem e, se tiver, um detalhe preenchido a 25%.
// As regras (pontos inteiros entre 3 e 21, retas a 0°, 90° ou 45°) são conferidas em
// tests/iconesRegras.test.ts. Quem desenha na tela é index.tsx.

export interface Forma {
  traco: string // stroke: currentColor
  detalhe?: string // fill: currentColor a 25% (ou 100% no estado "cheio")
}

// Vocabulário comum (DESIGN.md 6.11).
const ponto = (x: number, y: number): string => `M${x} ${y}h2v2h-2z` // bloquinho de 4 px
const seta = {
  direita: 'M9 6l6 6-6 6',
  esquerda: 'M15 6l-6 6 6 6',
  baixo: 'M6 9l6 6 6-6'
}
const olho = 'M3 12l5-5h8l5 5-5 5H8z'

export const FORMAS = {
  // ---------- Marca e áreas ----------
  logo: { traco: 'M3 3h18v18H3zM8 8h8v8H8z', detalhe: 'M8 8h8v8H8z' },

  // ---------- Barra lateral do ServSquare ----------
  servidor: { traco: 'M4 3h16v6H4zM4 15h16v6H4zM7 6h1M7 18h1M12 6h5M12 18h5' },
  configuracoes: { traco: 'M3 7h4M13 7h8M3 17h10M19 17h2M7 4h6v6H7zM13 14h6v6h-6z' },
  console: { traco: 'M3 4h18v16H3zM7 9l3 3-3 3M12 15h5' },
  comandos: { traco: 'M3 4h18v12H9l-4 4v-4H3zM10 12l4-4' },
  registro: { traco: 'M5 3h10l4 4v14H5zM15 3v4h4M8 11h8M8 14h8M8 17h5' },
  jogadores: { traco: 'M9 3h6v6H9zM4 21v-4l3-3h10l3 3v4' },
  software: {
    traco: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
    detalhe: 'M7 7h10v10H7z'
  },
  mods: { traco: 'M4 7h5V4h4v3h5v4h3v4h-3v5H4z' },
  arquivos: { traco: 'M3 5h7l2 2h9v13H3z' },
  mundos: {
    traco: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c-4 4-4 14 0 18M12 3c4 4 4 14 0 18'
  },
  backups: { traco: 'M3 4h18v5H3zM5 9v11h14V9M10 13h4' },
  desempenho: { traco: 'M3 17l5-5 4 4 8-8M15 8h5v5' },
  automacao: { traco: 'M4 4h16v16H4zM12 8v4h4' },
  integracoes: { traco: 'M7 3h10v18H7zM11 18h2' },
  conexao: { traco: 'M4 20v-3M9 20v-7M14 20V9M19 20V5' },
  engrenagem: {
    traco:
      'M8 5h2V3h4v2h2l2-2 3 3-2 2v2h2v4h-2v2l2 2-3 3-2-2h-2v2h-4v-2H8l-2 2-3-3 2-2v-2H3v-4h2V8L3 6l3-3zM10 10h4v4h-4z'
  },

  // ---------- Barra lateral do PlaySquare ----------
  instalacoes: { traco: 'M3 8h13v13H3zM3 8l5-5h13l-5 5M21 3v13l-5 5' },
  explorar: { traco: 'M4 4h11v11H4zM15 15l5 5' },
  conteudo: { traco: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  captura: { traco: 'M3 7h5l2-2h4l2 2h5v13H3zM9 11h6v6H9z' },

  // ---------- Ações ----------
  ligar: { traco: 'M7 3v18l9-9z', detalhe: 'M7 3v18l9-9z' },
  parar: { traco: 'M6 6h12v12H6z', detalhe: 'M6 6h12v12H6z' },
  copiar: { traco: 'M8 8h12v12H8zM16 8V4H4v12h4' },
  editar: { traco: 'M4 20v-4L16 4l4 4L8 20zM13 7l4 4' },
  recarregar: { traco: 'M4 11V6h14M15 3l3 3-3 3M20 13v5H6M9 21l-3-3 3-3' },
  olho: { traco: `${olho}M11 11h2v2h-2z` },
  olhoRiscado: { traco: `${olho}M11 11h2v2h-2zM4 4l16 16` },
  cadeado: { traco: 'M5 11h14v10H5zM8 11V5h8v6M12 15v2' },
  favorito: { traco: 'M6 3h12v18l-6-6-6 6z' }, // marcador de página
  maisAcoes: { traco: ponto(4, 11) + ponto(11, 11) + ponto(18, 11) },
  menu: { traco: ponto(11, 4) + ponto(11, 11) + ponto(11, 18) },
  fechar: { traco: 'M6 6l12 12M18 6L6 18' },

  // ---------- Setas ----------
  seta: { traco: seta.baixo },
  submenu: { traco: seta.direita },
  voltar: { traco: seta.esquerda },
  recolher: { traco: 'M12 6l-6 6 6 6M19 6l-6 6 6 6' },

  // ---------- Estados e avisos ----------
  ok: { traco: 'M4 12l5 5L20 6' },
  erro: { traco: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM9 9l6 6M15 9l-6 6' },
  atencao: { traco: `M12 3l9 9-9 9-9-9zM12 8v4${ponto(11, 15)}` },

  // ---------- Conteúdo do jogo (status do jogador, efeitos) ----------
  coracao: { traco: 'M12 20l-8-8V7l3-3h3l2 2 2-2h3l3 3v5z' },
  apoio: { traco: 'M12 20l-8-8V7l3-3h3l2 2 2-2h3l3 3v5zM12 9v6M9 12h6' }, // coração com um mais
  comida: { traco: 'M4 10l3-3h3l2 2 2-2h3l3 3v6l-5 5H9l-5-5zM12 8V4' }, // maçã em blocos
  pocao: { traco: 'M8 3h8M10 3v5l-5 5v8h14v-8l-5-5V3', detalhe: 'M5 15h14v6H5z' }
} satisfies Record<string, Forma>

export type NomeIcone = keyof typeof FORMAS
export const NOMES_ICONES = Object.keys(FORMAS) as NomeIcone[]
