// Códigos de formatação do MOTD (§ + caractere). Usado pelo editor, pela prévia e pelo banner.
// Testado em tests/motd.test.ts.

// Cores dos códigos §0 a §f: são o conteúdo do MOTD (o que o jogador vê), não o visual do app.
export const CORES_MOTD: { codigo: string; nome: string; cor: string }[] = [
  { codigo: '0', nome: 'Preto', cor: '#000000' },
  { codigo: '1', nome: 'Azul-escuro', cor: '#0000aa' },
  { codigo: '2', nome: 'Verde-escuro', cor: '#00aa00' },
  { codigo: '3', nome: 'Ciano-escuro', cor: '#00aaaa' },
  { codigo: '4', nome: 'Vermelho-escuro', cor: '#aa0000' },
  { codigo: '5', nome: 'Roxo', cor: '#aa00aa' },
  { codigo: '6', nome: 'Dourado', cor: '#ffaa00' },
  { codigo: '7', nome: 'Cinza', cor: '#aaaaaa' },
  { codigo: '8', nome: 'Cinza-escuro', cor: '#555555' },
  { codigo: '9', nome: 'Azul', cor: '#5555ff' },
  { codigo: 'a', nome: 'Verde', cor: '#55ff55' },
  { codigo: 'b', nome: 'Ciano', cor: '#55ffff' },
  { codigo: 'c', nome: 'Vermelho', cor: '#ff5555' },
  { codigo: 'd', nome: 'Rosa', cor: '#ff55ff' },
  { codigo: 'e', nome: 'Amarelo', cor: '#ffff55' },
  { codigo: 'f', nome: 'Branco', cor: '#ffffff' }
]

export const ESTILOS_MOTD = [
  { codigo: 'l', nome: 'Negrito' },
  { codigo: 'o', nome: 'Itálico' },
  { codigo: 'n', nome: 'Sublinhado' },
  { codigo: 'm', nome: 'Riscado' },
  { codigo: 'r', nome: 'Limpar formatação' }
] as const

// Cabe na lista de servidores do jogo sem cortar (aproximado; a fonte do jogo varia de largura).
export const CARACTERES_POR_LINHA = 45
export const MAX_MOTD = 150 // as duas linhas juntas, com os códigos

export interface TrechoMotd {
  texto: string
  cor: string | null // null: cinza padrão da lista
  negrito: boolean
  italico: boolean
  sublinhado: boolean
  riscado: boolean
}

const COR_POR_CODIGO = new Map(CORES_MOTD.map((c) => [c.codigo, c.cor]))

// Uma linha em trechos com cor e estilo. Como no jogo, uma cor nova limpa os estilos.
export function lerMotd(linha: string): TrechoMotd[] {
  const trechos: TrechoMotd[] = []
  let atual: TrechoMotd = {
    texto: '',
    cor: null,
    negrito: false,
    italico: false,
    sublinhado: false,
    riscado: false
  }
  const fechar = (): void => {
    if (atual.texto) trechos.push(atual)
    atual = { ...atual, texto: '' }
  }
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    const codigo = linha[i + 1]?.toLowerCase()
    if (c !== '§' || codigo === undefined) {
      atual.texto += c
      continue
    }
    i++
    fechar()
    const cor = COR_POR_CODIGO.get(codigo)
    if (cor)
      atual = { ...atual, cor, negrito: false, italico: false, sublinhado: false, riscado: false }
    else if (codigo === 'l') atual.negrito = true
    else if (codigo === 'o') atual.italico = true
    else if (codigo === 'n') atual.sublinhado = true
    else if (codigo === 'm') atual.riscado = true
    else if (codigo === 'r')
      atual = {
        ...atual,
        cor: null,
        negrito: false,
        italico: false,
        sublinhado: false,
        riscado: false
      }
    // §k (texto embaralhado) e códigos desconhecidos: ignorados na prévia
  }
  fechar()
  return trechos
}

// Texto que o jogador vê, sem os códigos (para contar caracteres).
export function semCodigos(linha: string): string {
  return lerMotd(linha)
    .map((t) => t.texto)
    .join('')
}
