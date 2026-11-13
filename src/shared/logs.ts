// Nível de cada linha de um log do servidor (testado em tests/causaTravamento.test.ts).
// Formato: "[12:01:02] [Server thread/WARN]: ..." (ou "[12:01:02 WARN]: ..." no Paper).
// Linhas sem cabeçalho (ex.: o resto de um erro em várias linhas) herdam o nível de cima.

export const NIVEIS = ['INFO', 'WARN', 'ERROR'] as const
export type NivelLog = (typeof NIVEIS)[number]

const CABECALHO = /^\[[^\]]*?\b(INFO|WARN|WARNING|ERROR|SEVERE|FATAL|DEBUG|TRACE)\]/

export function niveisDasLinhas(linhas: string[]): NivelLog[] {
  let atual: NivelLog = 'INFO'
  return linhas.map((l) => {
    const m = l.match(CABECALHO) ?? l.match(/^\[[^\]]*\] \[[^\]]*\/(\w+)\]/)
    if (m) {
      const n = m[1]
      atual = n.startsWith('WARN')
        ? 'WARN'
        : ['ERROR', 'SEVERE', 'FATAL'].includes(n)
          ? 'ERROR'
          : 'INFO'
    }
    return atual
  })
}
