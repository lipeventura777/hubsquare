// Marca do HubSquare (DESIGN.md, seção Marca), sem DOM: testada em tests/marca.test.ts.
// A versão COMPLETA vale de 56 px para cima; a PEQUENA, de 48 px para baixo (entre 49 e 55 px,
// também a pequena: a completa nunca aparece abaixo de 56 px).
export const MINIMO_COMPLETA = 56

export const versaoDaLogo = (tamanho: number): 'completa' | 'pequena' =>
  tamanho >= MINIMO_COMPLETA ? 'completa' : 'pequena'
