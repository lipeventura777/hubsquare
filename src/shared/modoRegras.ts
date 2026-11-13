// Modo do app (Fase M6), sem DOM nem Electron: testado em tests/modoRegras.test.ts.
// "completo": ServSquare e PlaySquare (como sempre). "amigo": só o PlaySquare, sem os serviços
// do ServSquare. A escolha é só de tela: nenhum dado do ServSquare é apagado ao trocar.

export const MODOS_APP = ['completo', 'amigo'] as const
export type ModoApp = (typeof MODOS_APP)[number]

export interface DecisaoModo {
  modo: ModoApp | null // null: primeira abertura, mostra as boas-vindas
  sugerirAmigo: boolean // aberto por um convite: as boas-vindas já sugerem o modo amigo
}

// Ao abrir o app: a escolha salva vale; sem escolha, quem já tem servidores fica no completo
// (nem vê as boas-vindas); sem servidores, as boas-vindas (sugerindo o amigo se veio por convite).
export function decidirModo(e: {
  salvo: ModoApp | null
  temServidores: boolean
  abertoPorConvite: boolean
}): DecisaoModo {
  if (e.salvo) return { modo: e.salvo, sugerirAmigo: false }
  if (e.temServidores) return { modo: 'completo', sugerirAmigo: false }
  return { modo: null, sugerirAmigo: e.abertoPorConvite }
}

// Convite nos argumentos de abertura: o link hubsquare://convite/... ou um arquivo .hubsquare.
export function conviteNosArgumentos(
  argv: string[]
): { link: string } | { arquivo: string } | null {
  for (const a of argv) {
    if (/^hubsquare:\/\/convite\/[A-Za-z0-9_=-]+\/?$/.test(a)) return { link: a.replace(/\/$/, '') }
    if (/\.hubsquare$/i.test(a) && !a.startsWith('-')) return { arquivo: a }
  }
  return null
}

// Voltar ao modo amigo só com o servidor desligado (nada do ServSquare fica rodando escondido).
export const podeUsarModoAmigo = (estadoServidor: string): boolean => estadoServidor === 'desligado'

// Fechar a janela: no modo amigo, sem nada rodando, o app fecha de verdade (não vai para a bandeja).
export const fecharDeVerdade = (modo: ModoApp | null, estadoServidor: string): boolean =>
  modo === 'amigo' && estadoServidor === 'desligado'
