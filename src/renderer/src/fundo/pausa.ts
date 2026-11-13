import type { EstadoJogo } from '../../../shared/tipos'
import {
  deveAnimar,
  msAtePausaSemFoco,
  type ModoAnimacao,
  type Situacao
} from '../../../shared/animacaoRegras'

// Quando o fundo pode se mexer (Fase V2): um estado só para todos os canvas animados.
// Pausa com a janela minimizada ou na bandeja, sem foco por 30 s, com o Minecraft aberto pelo
// PlaySquare ou com um modpack instalando (animacaoRegras.ts decide).

const estado = {
  modo: 'completa' as ModoAnimacao,
  visivel: !document.hidden,
  janelaVisivel: true, // minimizada ou na bandeja: false (avisado pelo processo principal)
  semFocoDesde: document.hasFocus() ? null : performance.now(),
  jogos: new Set<string>(),
  modpackInstalando: false
}
const ouvintes = new Set<() => void>()
let reavaliar: ReturnType<typeof setTimeout> | undefined

export function situacao(): Situacao {
  return {
    visivel: estado.visivel && estado.janelaVisivel,
    semFocoDesde: estado.semFocoDesde,
    jogoAberto: estado.jogos.size > 0,
    modpackInstalando: estado.modpackInstalando,
    agora: performance.now()
  }
}

export const animando = (): boolean => deveAnimar(estado.modo, situacao())
export const modoAtual = (): ModoAnimacao => estado.modo

function avisar(): void {
  clearTimeout(reavaliar)
  // Sem foco: reavalia quando completar os 30 s (aí pausa sozinho).
  const ms = msAtePausaSemFoco(situacao())
  if (ms !== null && ms > 0) reavaliar = setTimeout(avisar, ms + 10)
  ouvintes.forEach((f) => f())
}

export function ouvirPausa(f: () => void): () => void {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

export function definirModo(modo: ModoAnimacao): void {
  if (estado.modo === modo) return
  estado.modo = modo
  avisar()
}

document.addEventListener('visibilitychange', () => {
  estado.visivel = !document.hidden
  avisar()
})
window.addEventListener('blur', () => {
  estado.semFocoDesde = performance.now()
  avisar()
})
window.addEventListener('focus', () => {
  estado.semFocoDesde = null
  avisar()
})

const marcarJogo = (id: string, e: EstadoJogo | null): void => {
  if (e?.fase === 'jogando') estado.jogos.add(id)
  else estado.jogos.delete(id)
}
window.api.aoMudarJanelaVisivel((v) => {
  estado.janelaVisivel = v
  avisar()
})
window.api.estadosDoJogo().then((r) => {
  if (!r.ok) return
  for (const [id, e] of Object.entries(r.valor)) marcarJogo(id, e)
  avisar()
})
window.api.aoMudarJogo(({ id, estado: e }) => {
  marcarJogo(id, e)
  avisar()
})
window.api.modpackInstalando().then((v) => {
  estado.modpackInstalando = v
  avisar()
})
window.api.aoMudarModpackInstalando((v) => {
  estado.modpackInstalando = v
  avisar()
})
