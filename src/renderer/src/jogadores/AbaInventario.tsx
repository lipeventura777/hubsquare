import { useCallback, useEffect, useRef, useState } from 'react'
import type { ErroTela, InventarioJogador, Progresso, SlotItem } from '../../../shared/tipos'
import { Flutuante } from '../componentes/Flutuante'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeArquivos, IconeJogadores } from '../componentes/icones'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { Acordeao, CardPainel } from '../componentes/paineis'
import { Aviso, Botao, EstadoVazio } from '../componentes/ui'

// Aba Inventário (DESIGN.md, 6.18). Lê o .dat; com o jogador online, o servidor salva antes.
export function AbaInventario({ nome }: { nome: string }): React.JSX.Element {
  const [inventario, setInventario] = useState<InventarioJogador | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [atualizando, setAtualizando] = useState(false)

  const carregar = useCallback(async (): Promise<void> => {
    setAtualizando(true)
    const r = await window.api.inventarioJogador(nome)
    setAtualizando(false)
    if (r.ok) {
      setInventario(r.valor)
      setErro(null)
    } else setErro(r.erro)
  }, [nome])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura do arquivo
    void carregar()
  }, [carregar])

  if (!inventario) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />

  return (
    <div className="flex flex-col gap-4">
      <AvisoIcones aoBaixar={() => void carregar()} />
      {erro && <MensagemErro erro={erro} />}
      {inventario.semDados ? (
        <EstadoVazio
          icone={<IconeJogadores />}
          titulo="Sem inventário ainda"
          texto="Ele aparece depois que o jogador entrar no servidor."
        />
      ) : (
        <>
          <CardPainel
            titulo="Inventário"
            acoes={
              <Botao
                tamanho="pequeno"
                title="Atualizar"
                aria-label="Atualizar"
                disabled={atualizando}
                onClick={() => void carregar()}
              >
                ⟳
              </Botao>
            }
          >
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                {inventario.armadura.map((item, i) => (
                  <Slot key={i} item={item} />
                ))}
                <div className="mt-2">
                  <Slot item={inventario.segundaMao} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Grade itens={inventario.inventario} />
                <Grade itens={inventario.barra} />
              </div>
            </div>
          </CardPainel>
          <Acordeao
            itens={[
              {
                titulo: 'Baú do Ender',
                icone: <IconeArquivos />,
                conteudo: <Grade itens={inventario.ender} />
              }
            ]}
          />
        </>
      )}
    </div>
  )
}

function Grade({ itens }: { itens: SlotItem[] }): React.JSX.Element {
  return (
    <div className="grid w-max grid-cols-9 gap-1">
      {itens.map((item, i) => (
        <Slot key={i} item={item} />
      ))}
    </div>
  )
}

// Slot de 48px em relevo invertido: ícone de 32px, quantidade, barra de durabilidade e dica.
function Slot({ item }: { item: SlotItem }): React.JSX.Element {
  const resta = item?.danoMax && item.dano > 0 ? 1 - item.dano / item.danoMax : null
  const slot = useRef<HTMLDivElement>(null)
  const [dica, setDica] = useState(false)
  return (
    <div
      ref={slot}
      onMouseEnter={() => setDica(true)}
      onMouseLeave={() => setDica(false)}
      onFocus={() => setDica(true)}
      onBlur={() => setDica(false)}
      tabIndex={item ? 0 : undefined}
      aria-label={item ? `${item.nomeProprio ?? item.nome}, ${item.quantidade}` : undefined}
      className="relative flex h-12 w-12 items-center justify-center bg-panel-2 shadow-[inset_0_2px_0_var(--slot-sombra),inset_0_-2px_0_var(--slot-brilho)] focus-visible:outline-2 focus-visible:outline-accent"
    >
      {item && (
        <>
          <IconeItem icone={item.icone} tamanho={32} />
          {item.quantidade > 1 && (
            <span className="texto-pixel absolute right-0.5 bottom-0 text-sm text-on-dark [text-shadow:2px_2px_0_var(--sombra-numero)]">
              {item.quantidade}
            </span>
          )}
          {resta !== null && (
            <span className="absolute right-1.5 bottom-1 left-1.5 h-[3px] bg-black/60">
              <span
                className={`block h-full ${resta > 0.5 ? 'bg-online' : resta > 0.25 ? 'bg-warning' : 'bg-danger'}`}
                style={{ width: `${Math.max(0, resta) * 100}%` }}
              />
            </span>
          )}
          {/* Dica na camada flutuante: não é cortada pela grade e vira para cima perto do fim. */}
          <Flutuante
            ancora={slot}
            aberto={dica}
            aoFechar={() => setDica(false)}
            fecharAoClicarFora={false}
            role="tooltip"
            className="pointer-events-none"
          >
            <div className="flex w-max max-w-64 flex-col gap-0.5 border border-linha bg-panel px-2 py-1.5 text-[13px] shadow-lg">
              <span className="font-bold">
                {item.nomeProprio ?? item.nome}
                {item.quantidade > 1 && ` × ${item.quantidade}`}
              </span>
              {item.nomeProprio && <span className="text-xs">{item.nome}</span>}
              {item.encantamentos.map((e) => (
                <span key={e} className="text-xs text-accent">
                  {e}
                </span>
              ))}
              {item.danoMax && (
                <span className="text-xs">
                  Durabilidade: {item.danoMax - item.dano} / {item.danoMax}
                </span>
              )}
              <span className="font-mono text-xs text-muted">{item.id}</span>
            </div>
          </Flutuante>
        </>
      )}
    </div>
  )
}

// Ícone do item, ou o bloco "?" próprio quando não há ícone (DESIGN.md, seção 1).
export function IconeItem({
  icone,
  tamanho
}: {
  icone: string | null
  tamanho: number
}): React.JSX.Element {
  if (icone) {
    return (
      <img
        src={icone}
        alt=""
        width={tamanho}
        height={tamanho}
        className="shrink-0 [image-rendering:pixelated]"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.6 }}
      className="texto-pixel flex shrink-0 items-center justify-center border-b-2 border-linha bg-tile text-muted"
    >
      ?
    </span>
  )
}

// Oferece baixar ícones e nomes do jogo oficial. Some quando já estão baixados.
export function AvisoIcones({ aoBaixar }: { aoBaixar: () => void }): React.JSX.Element | null {
  const [tamanho, setTamanho] = useState<number | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.estadoIcones().then((r) => {
      if (r.ok && !r.valor.baixados) setTamanho(r.valor.tamanho)
    })
  }, [])
  useEffect(() => window.api.aoProgredir(setProgresso), [])

  async function baixar(): Promise<void> {
    setErro(null)
    setProgresso({ etapa: 'Baixando ícones dos itens', recebido: 0, total: 0 })
    const r = await window.api.baixarIcones()
    setProgresso(null)
    if (!r.ok) return setErro(r.erro)
    setTamanho(null)
    aoBaixar()
  }

  if (tamanho === null) return null
  return (
    <div className="flex flex-col gap-2">
      <Aviso tipo="atencao">
        <span className="flex-1">
          Sem ícones e nomes em português, os itens aparecem com &quot;?&quot; e o nome técnico.
          Eles vêm dos arquivos oficiais do jogo
          {tamanho > 0 && ` (cerca de ${Math.round(tamanho / 1_000_000)} MB para baixar)`}.
        </span>
        <Botao variante="primario" tamanho="pequeno" disabled={!!progresso} onClick={baixar}>
          Baixar ícones
        </Botao>
      </Aviso>
      {progresso && (
        <div className="flex flex-col gap-1 text-xs text-muted">
          {progresso.etapa}
          <BarraProgresso
            rotulo={progresso.etapa}
            valor={progresso.recebido}
            maximo={progresso.total}
          />
        </div>
      )}
      {erro && <MensagemErro erro={erro} />}
    </div>
  )
}
