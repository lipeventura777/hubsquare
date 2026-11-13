import { useCallback, useEffect, useState } from 'react'
import type { ErroTela, JogadorResumo } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeJogadores, IconeMundos, IconeServidor, IconeSubmenu } from '../componentes/icones'
import { Esqueleto } from '../componentes/movimento'
import { BotoesBloco, CabecaJogador, CardPainel } from '../componentes/paineis'
import { Campo, EstadoVazio } from '../componentes/ui'
import { DetalhesJogador } from './DetalhesJogador'
import { PedidosParaEntrar } from './PedidosParaEntrar'

// Jogadores › Todos e Online (DESIGN.md, 6.14 e 6.15): atalhos para as listas, busca e a
// grade de cards. Clicar num card abre os Detalhes do jogador.
export function TelaJogadores({
  aba,
  aoAbrirAba
}: {
  aba: 'Todos' | 'Online'
  aoAbrirAba: (aba: string) => void
}): React.JSX.Element {
  const [jogadores, setJogadores] = useState<JogadorResumo[] | null>(null)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  const carregar = useCallback((): void => {
    window.api.listarTodosJogadores().then((r) => {
      if (r.ok) setJogadores(r.valor)
      else setErro(r.erro)
    })
  }, [])

  useEffect(() => {
    carregar()
    const pararJogadores = window.api.aoMudarJogadores(() => carregar())
    const pararEstado = window.api.aoMudarEstado(() => carregar())
    return () => {
      pararJogadores()
      pararEstado()
    }
  }, [carregar])

  if (aberto) {
    return (
      <DetalhesJogador
        nome={aberto}
        aoVoltar={() => {
          setAberto(null)
          carregar()
        }}
      />
    )
  }

  const termo = busca.trim().toLowerCase()
  const visiveis = (jogadores ?? []).filter(
    (j) => (aba === 'Todos' || j.online) && j.nome.toLowerCase().includes(termo)
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-10">
        <PedidosParaEntrar />
        <CardPainel titulo="Listas">
          <BotoesBloco
            itens={[
              {
                rotulo: 'Whitelist',
                icone: <IconeJogadores />,
                variante: 'primario',
                aoClicar: () => aoAbrirAba('Whitelist')
              },
              {
                rotulo: 'Operadores',
                icone: <IconeServidor />,
                variante: 'primario',
                aoClicar: () => aoAbrirAba('Operadores')
              },
              {
                rotulo: 'Jogadores banidos',
                icone: <IconeJogadores />,
                variante: 'perigo',
                aoClicar: () => aoAbrirAba('Banidos')
              },
              {
                rotulo: 'IPs banidos',
                icone: <IconeMundos />,
                variante: 'perigo',
                aoClicar: () => aoAbrirAba('IPs banidos')
              }
            ]}
          />
        </CardPainel>

        <Campo
          type="search"
          value={busca}
          placeholder="Buscar por nome"
          aria-label="Buscar jogador por nome"
          onChange={(e) => setBusca(e.target.value)}
        />

        {erro && <MensagemErro erro={erro} />}
        {jogadores === null && !erro ? (
          <Esqueleto linhas={3} />
        ) : visiveis.length === 0 ? (
          <EstadoVazio
            icone={<IconeJogadores />}
            titulo={
              termo
                ? 'Ninguém com esse nome'
                : aba === 'Online'
                  ? 'Ninguém online agora'
                  : 'Ninguém entrou no servidor ainda'
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
            {visiveis.map((j, i) => (
              <li
                key={j.nome}
                className="anim-item"
                style={{ '--ordem': i } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => setAberto(j.nome)}
                  className="flex h-[72px] w-full items-center gap-3 border border-linha bg-panel px-4 text-left transition-colors duration-(--dur-fast) hover:border-muted"
                >
                  <CabecaJogador nome={j.nome} uuid={j.uuid} tamanho={40} online={j.online} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-bold" title={j.nome}>
                      {j.nome}
                    </span>
                    <span className="text-xs text-muted">{j.online ? 'Online' : 'Offline'}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-on-light"
                  >
                    <IconeSubmenu className="h-4 w-4" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
