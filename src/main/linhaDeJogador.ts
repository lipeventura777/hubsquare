import type { AvisoJogador } from '../shared/tipos'

const NOME = '([A-Za-z0-9_]{1,16})'
// O "]: " logo antes evita que alguém finja uma entrada pelo chat ("<Bob> Ana joined the game").
// Minecraft 26.x escreve "System chat: " antes das mensagens do sistema; as versões antigas, não.
const INICIO = '\\]: (?:System chat: )?'
const ENTROU = new RegExp(`${INICIO}${NOME} joined the game$`)
const SAIU = new RegExp(`${INICIO}${NOME} left the game$`)
// Resposta do comando list: "There are 2 of a max of 20 players online: Ana, Bob"
const LISTA = new RegExp(`${INICIO}There are \\d+ of a max of \\d+ players online:(.*)$`)

// Tira cores do terminal (sequências ESC[...), códigos § do jogo e o \r do fim antes de ler.
function limpar(texto: string): string {
  return (
    texto
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/§[0-9a-fk-or]/gi, '')
      .replace(/\r$/, '')
  )
}

export function ehRespostaDoList(texto: string): boolean {
  return LISTA.test(limpar(texto))
}

// Lê uma linha do console e diz como a lista de jogadores online muda (ou null se não muda).
export function interpretarLinha(
  bruto: string,
  atuais: string[]
): { lista: string[]; aviso?: AvisoJogador } | null {
  const texto = limpar(bruto)
  const entrou = texto.match(ENTROU)?.[1]
  if (entrou) {
    return {
      lista: atuais.includes(entrou) ? atuais : [...atuais, entrou],
      aviso: { nome: entrou, tipo: 'entrou' }
    }
  }
  const saiu = texto.match(SAIU)?.[1]
  if (saiu) return { lista: atuais.filter((n) => n !== saiu), aviso: { nome: saiu, tipo: 'saiu' } }
  const lista = texto.match(LISTA)?.[1]
  if (lista !== undefined) {
    return {
      lista: lista
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n !== '')
    }
  }
  return null
}
