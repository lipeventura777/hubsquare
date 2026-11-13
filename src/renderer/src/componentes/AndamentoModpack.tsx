import { useState } from 'react'
import type { Progresso } from '../../../shared/tipos'
import { BarraProgresso } from './movimento'
import { Botao } from './ui'

// Etapa atual, "X de Y arquivos" (na frase), barra e Cancelar (para a análise ou a criação).
export function AndamentoModpack({
  progresso
}: {
  progresso: Progresso | null
}): React.JSX.Element {
  const [cancelando, setCancelando] = useState(false)
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      <div className="flex items-center gap-3">
        <span className="flex-1">{progresso?.etapa ?? 'Preparando…'}</span>
        <Botao
          tamanho="pequeno"
          disabled={cancelando}
          onClick={() => {
            setCancelando(true)
            void window.api.cancelarModpack()
          }}
        >
          {cancelando ? 'Cancelando…' : 'Cancelar'}
        </Botao>
      </div>
      <BarraProgresso
        rotulo={progresso?.etapa ?? 'Preparando'}
        valor={progresso?.recebido ?? 0}
        maximo={progresso?.total ?? 0}
      />
    </div>
  )
}
