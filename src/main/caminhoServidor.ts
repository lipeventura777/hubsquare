import { realpath } from 'fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path'

// Única porta da tela Arquivos para o disco (testada em tests/caminhoServidor.test.ts).
// Recebe um caminho relativo à pasta do servidor, com "/" ou "\", e devolve o caminho absoluto.
// Recusa: caminho absoluto, "..", nomes que o Windows trata de jeito especial (CON, NUL, "a:b")
// e qualquer coisa que, seguindo atalhos (links simbólicos ou junções), saia da pasta.

const RESERVADO = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

export class CaminhoRecusado extends Error {}

function dentro(pasta: string, caminho: string): boolean {
  const r = relative(pasta, caminho)
  return r === '' || (!r.startsWith('..') && !isAbsolute(r))
}

// A parte mais funda que já existe, com os atalhos resolvidos (o resto ainda vai ser criado).
async function realExistente(caminho: string): Promise<string> {
  try {
    return await realpath(caminho)
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException).code
    if (codigo !== 'ENOENT' && codigo !== 'ENOTDIR') throw e
    const pai = dirname(caminho)
    if (pai === caminho) throw e
    return join(await realExistente(pai), caminho.slice(pai.length).replace(/^[\\/]+/, ''))
  }
}

export async function caminhoNoServidor(raiz: string, valor: unknown): Promise<string> {
  if (typeof valor !== 'string' || valor.includes('\0')) {
    throw new CaminhoRecusado('caminho inválido')
  }
  const partes = valor.split(/[\\/]+/).filter(Boolean)
  if (isAbsolute(valor) || /^[a-z]:/i.test(valor)) throw new CaminhoRecusado('caminho absoluto')
  for (const p of partes) {
    if (p === '..' || p === '.') throw new CaminhoRecusado(`"${p}" não é permitido`)
    if (p.includes(':') || RESERVADO.test(p) || /[<>"|?*]/.test(p) || /[. ]$/.test(p)) {
      throw new CaminhoRecusado(`nome inválido: ${p}`)
    }
  }
  const base = resolve(raiz)
  const alvo = partes.length ? join(base, ...partes) : base
  if (!dentro(base, alvo)) throw new CaminhoRecusado('fora da pasta do servidor')
  const real = await realExistente(alvo)
  if (!dentro(await realpath(base), real)) throw new CaminhoRecusado('atalho para fora da pasta')
  return alvo
}

// Caminho relativo (com "/") para mostrar na tela.
export const relativoAoServidor = (raiz: string, caminho: string): string =>
  relative(resolve(raiz), caminho).split(sep).join('/')
