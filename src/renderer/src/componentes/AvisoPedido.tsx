import { useEffect, useState } from 'react'
import { abrirTela } from '../estrutura/navegar'
import { Botao } from './ui'

// Aviso dentro do app quando um amigo pede para entrar pelo convite (Fase M4). Nunca notificação
// do Windows. "Ver" abre Jogadores, onde ficam os pedidos do servidor ativo.
export function AvisoPedido(): React.JSX.Element | null {
  const [pedido, setPedido] = useState<{ servidor: string; nick: string } | null>(null)
  useEffect(() => window.api.aoNovoPedido(setPedido), [])
  if (!pedido) return null
  return (
    <div
      role="status"
      className="anim-aviso fixed right-4 bottom-4 z-(--z-avisos) flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2 border border-linha bg-panel p-4"
    >
      <p className="text-[13px]">
        <b>{pedido.nick}</b> pediu para entrar no servidor <b>{pedido.servidor}</b>.
      </p>
      <div className="flex justify-end gap-2">
        <Botao tamanho="pequeno" onClick={() => setPedido(null)}>
          Fechar
        </Botao>
        <Botao
          tamanho="pequeno"
          variante="primario"
          onClick={() => {
            abrirTela('Jogadores', 'Todos')
            setPedido(null)
          }}
        >
          Ver
        </Botao>
      </div>
    </div>
  )
}
