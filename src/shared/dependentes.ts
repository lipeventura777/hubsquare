// Aba Instalados (Fase 23.2): usada pela tela (aviso no diálogo) e testada em
// tests/instaladosRegras.test.ts.

// Itens que deixam de funcionar se os `alvos` saírem (inclui quem depende de quem depende).
export function dependentes<
  T extends { chave: string; projetoId: string | null; dependencias: string[] }
>(itens: T[], alvos: string[]): T[] {
  const saem = new Set(alvos)
  const ids = new Set(
    itens.filter((i) => saem.has(i.chave) && i.projetoId).map((i) => i.projetoId!)
  )
  const achados: T[] = []
  for (let mudou = true; mudou;) {
    mudou = false
    for (const i of itens) {
      if (saem.has(i.chave) || !i.dependencias.some((d) => ids.has(d))) continue
      saem.add(i.chave)
      if (i.projetoId) ids.add(i.projetoId)
      achados.push(i)
      mudou = true
    }
  }
  return achados
}
