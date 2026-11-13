import type { ArquivoManual } from '../shared/tipos'
import { nomeSeguro } from './modsRegras'

// Fase D: como o app reconhece, na pasta Downloads, um arquivo que o usuário baixou à mão.
// Regra: só o hash aceita. O tamanho é o filtro barato; o nome só serve para explicar
// "Arquivo diferente" quando parece o arquivo certo mas o conteúdo não bate.

// Só a página do arquivo no CurseForge ou no Modrinth (o link pode ter vindo do manifesto de um amigo).
export function paginaOficial(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return (
      u.protocol === 'https:' &&
      ['www.curseforge.com', 'curseforge.com', 'modrinth.com'].includes(u.hostname)
    )
  } catch {
    return false
  }
}

const hex = (s: unknown, n: number): s is string =>
  typeof s === 'string' && new RegExp(`^[0-9a-f]{${n}}$`).test(s)

// O manual tem tudo para o app reconhecer o arquivo? (sem hash, fica só o link "Baixe pelo site")
export function reconhecivel(m: ArquivoManual): boolean {
  return (
    !!m &&
    typeof m.titulo === 'string' &&
    paginaOficial(m.url) &&
    nomeSeguro(m.arquivo) &&
    Number.isInteger(m.tamanho) &&
    m.tamanho! > 0 &&
    (hex(m.sha1, 40) || hex(m.md5, 32))
  )
}

export interface Esperado {
  id: string
  arquivo: string // nome exato no CurseForge (fileName)
  tamanho: number // fileLength, em bytes
  sha1: string | null
  md5: string | null
}

// Downloads ainda em andamento (Chrome/Edge, Firefox, Opera, Safari e cópias do Windows).
const TEMPORARIOS = /\.(crdownload|part|partial|tmp|download|opdownload)$/i

export function ehTemporario(nome: string): boolean {
  return TEMPORARIOS.test(nome) || nome.startsWith('~$') || nome.startsWith('.')
}

// "mod (1).jar", "mod(2).jar" e "mod (1)" voltam a "mod.jar" / "mod".
export function nomeOriginal(nome: string): string {
  return nome.replace(/\s?\(\d{1,3}\)(?=\.[^.]+$|$)/, '')
}

const mesmoNome = (nome: string, e: Esperado): boolean =>
  nomeOriginal(nome).toLowerCase() === e.arquivo.toLowerCase()

export type Triagem =
  | { tipo: 'ignorar' }
  | { tipo: 'conferir'; ids: string[] } // tamanho bate: calcular o hash
  | { tipo: 'diferente'; id: string; motivo: string }

const mb = (b: number): string => `${(b / 1024 / 1024).toFixed(2).replace('.', ',')} MB`

// Primeira olhada, sem abrir o arquivo.
export function triar(nome: string, tamanho: number, esperados: Esperado[]): Triagem {
  // 0 bytes: o Firefox cria o arquivo final vazio enquanto baixa o .part.
  if (ehTemporario(nome) || tamanho === 0) return { tipo: 'ignorar' }
  const ids = esperados.filter((e) => e.tamanho === tamanho && (e.sha1 || e.md5)).map((e) => e.id)
  if (ids.length) return { tipo: 'conferir', ids }
  const parecido = esperados.find((e) => mesmoNome(nome, e))
  if (parecido) {
    return {
      tipo: 'diferente',
      id: parecido.id,
      motivo: `O tamanho não bate (${mb(tamanho)} em vez de ${mb(parecido.tamanho)}). Talvez seja outra versão do mod.`
    }
  }
  return { tipo: 'ignorar' }
}

// Depois do hash: qual esperado ele é (ou por que não é nenhum).
export function conferir(
  nome: string,
  hashes: { sha1: string; md5: string },
  esperados: Esperado[]
): { tipo: 'ok'; ids: string[] } | Triagem {
  const ids = esperados
    .filter((e) => (e.sha1 ? e.sha1 === hashes.sha1 : !!e.md5 && e.md5 === hashes.md5))
    .map((e) => e.id)
  if (ids.length) return { tipo: 'ok', ids }
  const parecido = esperados.find((e) => mesmoNome(nome, e))
  return parecido
    ? {
        tipo: 'diferente',
        id: parecido.id,
        motivo:
          'O conteúdo não bate com o arquivo da página oficial (hash diferente). Baixe de novo pela página.'
      }
    : { tipo: 'ignorar' }
}
