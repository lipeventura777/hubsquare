import { useEffect, useState } from 'react'
import type { Compat, TipoAviso } from '../../../shared/tipos'
import { IconeErro, IconeOk } from '../componentes/icones'

// PlaySquare (Fase P3, DESIGN.md seção 6.1.5): se o item vai funcionar no jogo do jogador e por
// quê, numa frase. Cada tipo de aviso tem "Não mostrar de novo" (reativável em Ajustes do jogo);
// os que impedem a instalação aparecem sempre.

// Lista de avisos escondidos, lida uma vez e compartilhada por todas as frases da tela.
let ocultos: TipoAviso[] | null = null
const ouvintes = new Set<(o: TipoAviso[]) => void>()

function publicar(o: TipoAviso[]): void {
  ocultos = o
  for (const f of ouvintes) f(o)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAvisosOcultos(): [TipoAviso[], (tipo: TipoAviso, ocultar: boolean) => void] {
  const [lista, setLista] = useState<TipoAviso[]>(ocultos ?? [])
  useEffect(() => {
    ouvintes.add(setLista)
    if (!ocultos) {
      window.api.lerAjustesJogo().then((r) => r.ok && publicar(r.valor.avisosOcultos))
    }
    return () => {
      ouvintes.delete(setLista)
    }
  }, [])
  const mudar = (tipo: TipoAviso, ocultar: boolean): void => {
    window.api.ocultarAviso(tipo, ocultar).then((r) => r.ok && publicar(r.valor.avisosOcultos))
  }
  return [lista, mudar]
}

export function FraseCompat({
  compat,
  compacta = false
}: {
  compat: Compat | undefined
  compacta?: boolean // nos cards: só a frase, sem o botão
}): React.JSX.Element | null {
  const [lista, mudar] = useAvisosOcultos()
  if (!compat) return null
  if (compat.aviso && !compat.bloqueia && lista.includes(compat.aviso)) return null
  const cor = compat.vai ? (compat.aviso ? 'text-warning' : 'text-online') : 'text-danger'
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] ${compacta ? 'text-xs' : ''}`}
    >
      <span className={`shrink-0 ${cor}`} aria-hidden="true">
        {compat.vai ? (
          <IconeOk className="inline-block h-3.5 w-3.5 shrink-0 align-[-2px]" />
        ) : (
          <IconeErro className="inline-block h-3.5 w-3.5 shrink-0 align-[-2px]" />
        )}
      </span>
      <span className="min-w-0 flex-1">{compat.frase}</span>
      {!compacta && compat.aviso && !compat.bloqueia && (
        <button
          type="button"
          onClick={() => mudar(compat.aviso!, true)}
          className="text-xs text-muted underline hover:text-texto"
        >
          Não mostrar de novo
        </button>
      )}
    </div>
  )
}
