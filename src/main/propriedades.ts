// Lê e altera o server.properties sem mexer nas outras linhas nem nos comentários.
// Segue as regras de escape dos arquivos .properties do Java (ex.: "\:" vira ":").
// shortcut: não trata valores quebrados em várias linhas com "\" no fim; o Minecraft não gera isso.

function chaveDaLinha(linha: string): { chave: string; resto: string } | null {
  const texto = linha.trimStart()
  if (!texto || texto.startsWith('#') || texto.startsWith('!')) return null
  const fim = texto.search(/[=:\s]/)
  if (fim === -1) return { chave: texto, resto: '' }
  // Pula espaços, um "=" ou ":" e mais espaços entre a chave e o valor.
  const resto = texto.slice(fim).replace(/^\s*[=:]?\s*/, '')
  return { chave: texto.slice(0, fim), resto }
}

const ESCAPES: Record<string, string> = { t: '\t', n: '\n', r: '\r', f: '\f' }

function decodificar(valor: string): string {
  return valor.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, c: string) =>
    c.length === 5 ? String.fromCharCode(parseInt(c.slice(1), 16)) : (ESCAPES[c] ?? c)
  )
}

function codificar(valor: string): string {
  return (
    valor
      .replace(/[\\=:#!]/g, (c) => `\\${c}`)
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\f/g, '\\f')
      .replace(/^ /, '\\ ')
      // Acentos, § e emojis viram \uXXXX: o servidor lê certo, seja ele de UTF-8 ou de ISO-8859-1.
      .replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  )
}

export function lerPropriedades(texto: string): Map<string, string> {
  const valores = new Map<string, string>()
  for (const linha of texto.split(/\r?\n/)) {
    const par = chaveDaLinha(linha)
    if (par) valores.set(par.chave, decodificar(par.resto))
  }
  return valores
}

// Troca só as chaves pedidas; as que não existem vão para o fim do arquivo.
export function mudarPropriedades(texto: string, mudancas: Record<string, string>): string {
  const quebra = texto.includes('\r\n') ? '\r\n' : '\n'
  const faltam = new Set(Object.keys(mudancas))
  const linhas = texto === '' ? [] : texto.split(/\r?\n/)
  if (linhas.at(-1) === '') linhas.pop()
  const novas = linhas.map((linha) => {
    const par = chaveDaLinha(linha)
    if (!par || !Object.hasOwn(mudancas, par.chave)) return linha
    faltam.delete(par.chave)
    return `${par.chave}=${codificar(mudancas[par.chave])}`
  })
  for (const chave of faltam) novas.push(`${chave}=${codificar(mudancas[chave])}`)
  return novas.join(quebra) + quebra
}

// Para o formulário de configs dos mods (Fase 25), que lê e grava .properties de qualquer mod.
export const decodificarPropriedade = decodificar
export const codificarPropriedade = codificar
