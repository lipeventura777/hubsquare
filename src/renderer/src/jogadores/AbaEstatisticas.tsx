import { useCallback, useEffect, useState } from 'react'
import type { ErroTela, EstatisticasJogador, LinhaEstatistica } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeCoracao, IconeJogadores, IconeLigar, IconeRegistro } from '../componentes/icones'
import { Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Botao, EstadoVazio } from '../componentes/ui'
import { AvisoIcones, IconeItem } from './AbaInventario'

const LIMITE = 15
const numero = (n: number, casas = 0): string =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: casas })

// 20 ticks por segundo.
function tempoDeJogo(ticks: number): string {
  const minutos = Math.floor(ticks / 20 / 60)
  const horas = Math.floor(minutos / 60)
  return horas ? `${numero(horas)} h ${minutos % 60} min` : `${minutos} min`
}

// Aba Estatísticas (DESIGN.md, 6.19). Lê stats/<uuid>.json.
export function AbaEstatisticas({ nome }: { nome: string }): React.JSX.Element {
  const [stats, setStats] = useState<EstatisticasJogador | null | undefined>(undefined)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [tudo, setTudo] = useState(false)

  const carregar = useCallback(async (): Promise<void> => {
    const r = await window.api.estatisticasJogador(nome)
    if (r.ok) {
      setStats(r.valor)
      setErro(null)
    } else setErro(r.erro)
  }, [nome])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura do arquivo
    void carregar()
  }, [carregar])

  if (stats === undefined) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />
  if (stats === null) {
    return (
      <EstadoVazio
        icone={<IconeRegistro />}
        titulo="Sem estatísticas ainda"
        texto="Elas aparecem depois que o jogador jogar um pouco. Versões antes da 1.13 não são lidas."
      />
    )
  }

  const destaques = [
    { icone: <IconeLigar />, titulo: 'Tempo de jogo', valor: tempoDeJogo(stats.tempo) },
    { icone: <IconeJogadores />, titulo: 'Abates de jogadores', valor: numero(stats.abates) },
    { icone: <IconeCoracao />, titulo: 'Mortes', valor: numero(stats.mortes) },
    {
      icone: <IconeRegistro />,
      titulo: 'KDR',
      valor: numero(stats.abates / Math.max(1, stats.mortes), 2)
    }
  ]
  const colunas: { titulo: string; linhas: LinhaEstatistica[]; unidade?: string }[] = [
    { titulo: 'Distância percorrida', linhas: stats.distancia, unidade: ' blocos' },
    { titulo: 'Blocos quebrados', linhas: stats.quebrados },
    { titulo: 'Itens usados', linhas: stats.usados },
    { titulo: 'Entidades mortas', linhas: stats.mortos }
  ]
  const temMais = colunas.some((c) => c.linhas.length > LIMITE)

  return (
    <div className="flex flex-col gap-4">
      <AvisoIcones aoBaixar={() => void carregar()} />
      {erro && <MensagemErro erro={erro} />}
      <CardPainel titulo="Destaques">
        <div className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-4">
          {destaques.map((d) => (
            <div key={d.titulo} className="flex items-center gap-3">
              <span aria-hidden="true" className="text-muted [&>svg]:h-10 [&>svg]:w-10">
                {d.icone}
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-bold text-accent">{d.titulo}</span>
                <span className="text-sm">{d.valor}</span>
              </span>
            </div>
          ))}
        </div>
      </CardPainel>

      <div className="grid gap-4 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
        {colunas.map((c) => (
          <CardPainel key={c.titulo} titulo={c.titulo}>
            <Ranking linhas={c.linhas} unidade={c.unidade} tudo={tudo} />
          </CardPainel>
        ))}
      </div>
      {temMais && (
        <Botao variante="primario" className="self-center" onClick={() => setTudo((t) => !t)}>
          {tudo ? 'Mostrar menos' : 'Mostrar tudo'}
        </Botao>
      )}
    </div>
  )
}

function Ranking({
  linhas,
  unidade = '',
  tudo
}: {
  linhas: LinhaEstatistica[]
  unidade?: string
  tudo: boolean
}): React.JSX.Element {
  if (!linhas.length) return <p className="text-[13px] text-muted">Sem dados</p>
  const total = linhas.reduce((s, l) => s + l.valor, 0)
  return (
    <ul className="flex flex-col gap-1 text-[13px]">
      <li className="flex justify-between gap-2 border-b border-linha pb-1 font-bold">
        Total
        <span className="font-mono">
          {numero(total)}
          {unidade}
        </span>
      </li>
      {(tudo ? linhas : linhas.slice(0, LIMITE)).map((l) => (
        <li key={l.id} className="flex items-center gap-2" title={l.id}>
          {!unidade && <IconeItem icone={l.icone} tamanho={20} />}
          <span className="min-w-0 flex-1 truncate" title={l.nome}>
            {l.nome}
          </span>
          <span className="font-mono">
            {numero(l.valor)}
            {unidade}
          </span>
        </li>
      ))}
    </ul>
  )
}
