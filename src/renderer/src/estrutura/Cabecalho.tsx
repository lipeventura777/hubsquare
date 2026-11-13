import { useEffect, useState } from 'react'
import type { EstadoServidor } from '../../../shared/tipos'
import { rotuloPequeno } from '../componentes/estilos'
import { NumeroAnimado, useIndicador } from '../componentes/movimento'
import { useJogadores, useUso } from '../servidor/comandos'

// Cabeçalho da página (DESIGN.md, seção 6.2): título pequeno em caixa alta, abas
// e, com o servidor ligado, a faixa CPU │ RAM │ jogadores.
export function Cabecalho({
  titulo,
  abas,
  aba,
  aoEscolher,
  estado
}: {
  titulo: string
  abas: readonly string[]
  aba: string
  aoEscolher: (aba: string) => void
  estado: EstadoServidor
}): React.JSX.Element {
  // O sublinhado é um só e desliza até a aba ativa (seção 8).
  const { conteiner, indicador } = useIndicador(aba, 'x')

  return (
    <header className="relative m-2.5 mb-0 flex h-20 shrink-0 flex-col rounded-[var(--raio-painel)] border border-[var(--vidro-borda)] bg-panel px-6">
      <div className="flex h-8 items-end">
        <h1 className={rotuloPequeno}>{titulo}</h1>
      </div>
      <div
        ref={conteiner as React.RefObject<HTMLDivElement>}
        role="tablist"
        aria-label={titulo}
        className="relative flex h-12 items-stretch gap-6"
      >
        {abas.map((nome) => {
          const ativa = nome === aba
          return (
            <button
              key={nome}
              type="button"
              role="tab"
              data-indicador={nome}
              aria-selected={ativa}
              onClick={() => aoEscolher(nome)}
              className={`text-base transition-colors duration-(--dur-fast) ${
                ativa ? 'font-bold' : 'text-muted hover:text-texto'
              }`}
            >
              {nome}
            </button>
          )
        })}
        <span
          ref={indicador as React.RefObject<HTMLSpanElement>}
          aria-hidden="true"
          className="absolute bottom-2 left-0 h-[3px] w-6 bg-accent transition-transform duration-(--dur-base) ease-(--ease-out)"
        />
      </div>
      {estado === 'ligado' && <FaixaDeStats />}
    </header>
  )
}

function FaixaDeStats(): React.JSX.Element {
  const uso = useUso()
  const jogadores = useJogadores()
  const [maximo, setMaximo] = useState<number | null>(null)

  useEffect(() => {
    window.api.lerConfiguracoes().then((r) => r.ok && setMaximo(r.valor.configuracoes.maxJogadores))
  }, [])

  const item = (rotulo: string, valor: React.ReactNode): React.JSX.Element => (
    <span>
      <span className="text-muted">{rotulo} </span>
      <b className="text-texto">{valor}</b>
    </span>
  )

  return (
    <div
      aria-label="Uso do servidor"
      className="absolute top-3 right-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[.02em]"
    >
      {item(
        'CPU',
        uso ? <NumeroAnimado valor={uso.cpu} formatar={(v) => `${Math.round(v)}%`} /> : '…'
      )}
      <span className="text-muted">│</span>
      {item(
        'RAM',
        uso ? (
          <NumeroAnimado
            valor={uso.ram / 1024 ** 3}
            formatar={(v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`}
          />
        ) : (
          '…'
        )
      )}
      <span className="text-muted">│</span>
      {item(
        'Jogadores',
        <>
          <NumeroAnimado valor={jogadores.length} />/{maximo ?? '…'}
        </>
      )}
    </div>
  )
}
