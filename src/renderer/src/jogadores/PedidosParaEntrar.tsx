import { useCallback, useEffect, useState } from 'react'
import type { ErroTela, PedidoParaEntrar } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { CabecaJogador, CardPainel } from '../componentes/paineis'
import { Botao } from '../componentes/ui'

// Jogadores › "Pedidos para entrar" (Fase M4): quem aceitou o convite e pediu para entrar na
// whitelist. Aprovar põe o nick na whitelist (comando com o servidor ligado; senão o
// whitelist.json com o UUID). Recusar só apaga o pedido. Some quando não há pedidos.
export function PedidosParaEntrar(): React.JSX.Element | null {
  const [pedidos, setPedidos] = useState<PedidoParaEntrar[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  const carregar = useCallback((): void => {
    window.api.listarPedidos().then((r) => (r.ok ? setPedidos(r.valor) : setErro(r.erro)))
  }, [])
  useEffect(() => {
    carregar()
    return window.api.aoMudarPedidos(carregar)
  }, [carregar])

  async function decidir(uuid: string, aprovar: boolean): Promise<void> {
    setOcupado(uuid)
    const r = await window.api.decidirPedido(uuid, aprovar)
    setOcupado(null)
    if (r.ok) {
      setPedidos(r.valor)
      setErro(null)
    } else setErro(r.erro)
  }

  if (!pedidos.length && !erro) return null
  return (
    <CardPainel titulo={`Pedidos para entrar (${pedidos.length})`}>
      <ul className="flex flex-col gap-2" aria-label="Pedidos para entrar">
        {pedidos.map((p) => (
          <li
            key={p.uuid}
            className="anim-item flex flex-wrap items-center gap-3 bg-panel-2 px-3 py-2"
          >
            <CabecaJogador nome={p.nick} uuid={p.uuid} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">{p.nick}</div>
              {p.recado && <div className="text-[13px] break-words">“{p.recado}”</div>}
              <div className="text-xs text-muted">
                Pediu em {new Date(p.em).toLocaleString('pt-BR')}
              </div>
            </div>
            <Botao
              tamanho="pequeno"
              variante="primario"
              disabled={ocupado === p.uuid}
              onClick={() => void decidir(p.uuid, true)}
            >
              Aprovar
            </Botao>
            <Botao
              tamanho="pequeno"
              variante="perigo"
              disabled={ocupado === p.uuid}
              onClick={() => void decidir(p.uuid, false)}
            >
              Recusar
            </Botao>
          </li>
        ))}
      </ul>
      {erro && <MensagemErro erro={erro} />}
    </CardPainel>
  )
}
