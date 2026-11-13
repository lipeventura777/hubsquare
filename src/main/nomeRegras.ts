// Regras sem rede nem Electron dos nomes de exibição (Fase V3): servidores e instalações mostram o
// nome original, com os pontos da versão ("Cobbleverse 1.7.42"); a pasta no disco continua a de
// sempre. Testadas em tests/nomeRegras.test.ts.

// Nome sugerido a partir de um arquivo ou do nome de um pack: letras, números, espaço, "-", "_"
// e ".", sem ponto no fim (o Windows não aceita pasta terminando em ponto).
export function nomeLimpo(texto: string, max = 32): string {
  return texto
    .replace(/[^\p{L}\p{N} ._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, '')
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Instalações antigas: o nome veio com a versão do modpack "esmagada" ("COBBLEVERSE-1 7 42-CF").
// Com o pack conhecido, a versão volta com pontos; nome escolhido pelo jogador fica igual.
export function nomeDeExibicao(
  nome: string,
  pack: { nome: string; versao: string } | null | undefined
): string {
  const v = pack?.versao
  if (!v || !/^\d+(\.\d+)+$/.test(v) || nome.includes(v)) return nome
  const esmagada = new RegExp(
    `(^|[^\\p{N}])${v.split('.').map(escapar).join('[\\s_-]')}(?![\\p{N}])`,
    'u'
  )
  return nome.replace(esmagada, (_m, antes: string) => `${antes}${v}`)
}
