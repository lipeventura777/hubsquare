// Usado pela tela e pelo processo principal (testado em tests/desempenhoRegras.test.ts).

// shortcut: médias de um PC comum (≈30 chunks/s e ≈8 KB por chunk); mostrar como estimativa.
export function estimarPregeracao(raio: number): {
  chunks: number
  segundos: number
  bytes: number
} {
  const lado = Math.ceil((2 * raio) / 16)
  const chunks = lado * lado
  return { chunks, segundos: Math.round(chunks / 30), bytes: chunks * 8 * 1024 }
}
