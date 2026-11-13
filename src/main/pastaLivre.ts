import type { InfoServidor } from '../shared/tipos'
import { comServidorDesligado, lerEstado } from './servidor'

// PlaySquare (Fase P3): as telas de mods do ServSquare também mexem na pasta de uma instalação
// do jogador. Essa pasta não depende do servidor ligado: mudanças valem na hora.

export function pastaLivre(info: InfoServidor): boolean {
  return !!info.jogador || lerEstado() === 'desligado'
}

export function comPastaLivre<T>(info: InfoServidor, tarefa: () => Promise<T>): Promise<T> {
  return info.jogador ? tarefa() : comServidorDesligado(tarefa)
}
