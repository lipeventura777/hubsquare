import { useEffect, useRef, useState } from 'react'
import type { AvisoJogador } from '../../../shared/tipos'
import { animacoesReduzidas } from './movimento'

const MAXIMO = 3
const DURACAO = 5000
const SAIDA = 180 // --dur-base: tempo da animação de saída antes de tirar da tela

type Item = AvisoJogador & { id: number; saindo: boolean }

// Avisos de entrada e saída de jogador (seção 6.3): fundo --accent, texto 12px, botão ✕,
// somem em 5 s e ficam no máximo 3 empilhados. Nunca usa notificação do Windows.
// Na aba Painel ficam dentro do banner; nas outras telas, no canto da janela.
// Animação (seção 8): entram 24px da direita, saem com fade + 8px e mostram a barra de tempo.
export function Avisos({
  className = 'fixed right-4 bottom-4'
}: {
  className?: string
}): React.JSX.Element {
  const [avisos, setAvisos] = useState<Item[]>([])
  // Saída animada; o botão ✕ usa a mesma do tempo esgotado.
  const sairRef = useRef<(id: number) => void>(() => {})

  useEffect(() => {
    let proximo = 0
    const timers = new Set<NodeJS.Timeout>()
    const depois = (ms: number, fazer: () => void): void => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        fazer()
      }, ms)
      timers.add(timer)
    }
    const parar = window.api.aoAvisoJogador((aviso) => {
      const id = proximo++
      setAvisos((a) => [...a, { ...aviso, id, saindo: false }].slice(-MAXIMO))
      depois(DURACAO, () => sair(id))
    })
    // Marca como "saindo" (anima) e só depois tira da lista.
    function sair(id: number): void {
      setAvisos((a) => a.map((x) => (x.id === id ? { ...x, saindo: true } : x)))
      depois(animacoesReduzidas() ? 0 : SAIDA, () => setAvisos((a) => a.filter((x) => x.id !== id)))
    }
    sairRef.current = sair
    return () => {
      parar()
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div aria-live="polite" className={`${className} z-10 flex flex-col items-end gap-2`}>
      {avisos.map((a) => (
        <AvisoDeJogador
          key={a.id}
          aviso={a}
          saindo={a.saindo}
          aoFechar={() => sairRef.current(a.id)}
        />
      ))}
    </div>
  )
}

export function AvisoDeJogador({
  aviso,
  aoFechar,
  saindo = false
}: {
  aviso: AvisoJogador
  aoFechar: () => void
  saindo?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`relative overflow-hidden border-b-2 border-accent-shadow bg-accent text-xs text-accent-text ${
        saindo ? 'anim-aviso-saindo' : 'anim-aviso'
      }`}
    >
      <div className="flex items-center gap-3 py-1 pr-1 pl-3">
        <span>
          <b>{aviso.nome}</b> {aviso.tipo === 'entrou' ? 'entrou no servidor' : 'saiu do servidor'}
        </span>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar aviso"
          className="flex h-8 w-8 items-center justify-center transition-colors duration-(--dur-fast) hover:bg-accent-hover"
        >
          ✕
        </button>
      </div>
      {/* Barra de tempo de 2px que esvazia em 5 s. */}
      <div
        aria-hidden="true"
        className="anim-tempo absolute bottom-0 left-0 h-0.5 w-full bg-accent-text/60"
      />
    </div>
  )
}
