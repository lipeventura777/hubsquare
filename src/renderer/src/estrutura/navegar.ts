import type { Fonte } from '../../../shared/fontes'
import type { Pagina } from './BarraLateral'

// Abre outra tela a partir de qualquer lugar (ex.: o card de atualizações do Painel abre Software).
// O App escuta este evento.
export const EVENTO_ABRIR = 'servsquare:abrir'

export function abrirTela(pagina: Pagina, aba?: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: { pagina, aba } }))
}

// Avisa as telas que o ícone do servidor mudou (cartão da barra lateral, tela Servidores).
export const EVENTO_ICONE = 'servsquare:icone'

export function avisarIconeMudou(): void {
  window.dispatchEvent(new Event(EVENTO_ICONE))
}

// Explorar › Modpacks: abre o "Criar a partir de um modpack" (Fase 17) já com o pack escolhido.
export const EVENTO_CRIAR_MODPACK = 'servsquare:criar-modpack'

export function criarComModpack(projetoId: string, fonte: Fonte = 'modrinth'): void {
  window.dispatchEvent(new CustomEvent(EVENTO_CRIAR_MODPACK, { detail: { id: projetoId, fonte } }))
}

// Fase P5: vai para a outra área (com a mesma animação da troca Serv/Play), numa tela e, no
// PlaySquare, com uma instalação escolhida. Ex.: "Testar no meu jogo" e "Gerenciar no ServSquare".
export const EVENTO_AREA = 'hubsquare:area'
export const CHAVE_INSTALACAO = 'hubsquare:instalacaoEscolhida'

export interface PedidoDeArea {
  area: 'serv' | 'play'
  pagina: string
  instalacaoId?: string
}

export function irPara(pedido: PedidoDeArea): void {
  if (pedido.instalacaoId) {
    try {
      localStorage.setItem(CHAVE_INSTALACAO, pedido.instalacaoId)
    } catch {
      // sem armazenamento: a tela abre na primeira instalação
    }
  }
  window.dispatchEvent(new CustomEvent(EVENTO_AREA, { detail: pedido }))
}

// Modo do app (Fase M6): a tela que troca de modo (Ajustes do jogo) avisa o App.
export const EVENTO_MODO = 'hubsquare:modo'

export function avisarModo(estado: import('../../../shared/tipos').EstadoModo): void {
  window.dispatchEvent(new CustomEvent(EVENTO_MODO, { detail: estado }))
}

// Convite que abriu o app (link ou arquivo): Instalações abre o "Entrar com convite" já colado.
let conviteParaColar: string | null = null

export function guardarConviteParaColar(texto: string | null): void {
  conviteParaColar = texto
}

export function pegarConviteParaColar(): string | null {
  const t = conviteParaColar
  conviteParaColar = null
  if (t) void window.api.conviteUsado()
  return t
}
