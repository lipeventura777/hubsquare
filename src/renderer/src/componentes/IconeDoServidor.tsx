import { corDoNome } from './paineis'

// Ícone do servidor (server-icon.png) ou, sem ele, um quadrado com a inicial (como a cabeça do jogador).
export function IconeDoServidor({
  icone,
  nome,
  tam = 40
}: {
  icone: string | null
  nome: string
  tam?: number
}): React.JSX.Element {
  const estilo = { width: tam, height: tam }
  if (icone) {
    return (
      <img src={icone} alt="" style={estilo} className="shrink-0 [image-rendering:pixelated]" />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...estilo, background: corDoNome(nome), fontSize: Math.round(tam * 0.5) }}
      className="texto-pixel flex shrink-0 items-center justify-center text-white"
    >
      {nome.charAt(0).toUpperCase()}
    </span>
  )
}
