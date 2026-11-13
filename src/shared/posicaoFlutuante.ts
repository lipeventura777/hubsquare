// Posição da camada flutuante (Flutuante.tsx), sem tela: testada em tests/posicaoFlutuante.test.ts.

const MARGEM = 8 // distância mínima das bordas da janela
const VAO = 4 // distância do elemento que abriu

export type LadoFlutuante = 'baixo' | 'cima'

export interface Posicao {
  top: number
  left: number
  maxHeight: number
  minWidth?: number
  cima: boolean
}

// Onde a camada cabe: embaixo (ou em cima, se preferir), virando quando o outro lado tem mais espaço.
export function calcularPosicao(
  r: { top: number; bottom: number; left: number; right: number; width: number },
  conteudo: { altura: number; largura: number },
  janela: { largura: number; altura: number },
  lado: LadoFlutuante,
  alinhar: 'inicio' | 'fim' | 'centro'
): Omit<Posicao, 'minWidth'> {
  const baixo = janela.altura - r.bottom - VAO - MARGEM
  const cima = r.top - VAO - MARGEM
  const paraCima =
    lado === 'cima'
      ? !(cima < conteudo.altura && baixo > cima)
      : baixo < conteudo.altura && cima > baixo
  const maxHeight = Math.max(48, paraCima ? cima : baixo)
  const altura = Math.min(conteudo.altura, maxHeight)
  const left = Math.min(
    Math.max(
      MARGEM,
      alinhar === 'fim'
        ? r.right - conteudo.largura
        : alinhar === 'centro'
          ? r.left + r.width / 2 - conteudo.largura / 2
          : r.left
    ),
    Math.max(MARGEM, janela.largura - conteudo.largura - MARGEM)
  )
  return { top: paraCima ? r.top - VAO - altura : r.bottom + VAO, left, maxHeight, cima: paraCima }
}
