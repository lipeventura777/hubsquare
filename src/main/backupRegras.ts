// Regras dos backups sem arquivos (testadas em tests/backupRegras.test.ts).

// Rotação: mantém os `manter` mais recentes, contando todos; protegidos nunca saem.
// `lista` vem do mais novo para o mais velho.
export function antigosParaApagar<B extends { protegido: boolean }>(
  lista: B[],
  manter: number
): B[] {
  return lista.slice(manter).filter((b) => !b.protegido)
}
