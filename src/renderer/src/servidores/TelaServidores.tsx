import { useCallback, useEffect, useState } from 'react'
import { NOMES_TIPOS, type ErroTela, type ItemServidor } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeLigar, IconeParar, IconeServidor } from '../componentes/icones'
import { COR_STATUS, Esqueleto } from '../componentes/movimento'
import { TituloPagina } from '../componentes/paineis'
import { Botao, Campo, Dialogo, EstadoVazio, Menu } from '../componentes/ui'
import { classesBotao } from '../componentes/estilos'
import { IconeDoServidor } from '../componentes/IconeDoServidor'
import { DialogoRenomear } from '../estrutura/RenomearServidor'
import { EVENTO_ICONE } from '../estrutura/navegar'
import { ImportarZip } from './ImportarZip'
import { DialogoPassar, ReceberServidor } from './PassarServidor'

const TEXTO_ESTADO = {
  desligado: 'Desligado',
  ligando: 'Ligando…',
  ligado: 'Online',
  desligando: 'Desligando…'
} as const

// Pedido de troca quando outro servidor está ligado: "Desligar X e ligar/abrir Y?"
interface Troca {
  de: ItemServidor
  para: ItemServidor
  ligar: boolean
}

// Tela Servidores (DESIGN.md, seção 6.15). Só um servidor fica ativo e só o ativo liga.
export function TelaServidores({
  aoCriar,
  aoAbrirPainel
}: {
  aoCriar: (modo: 'zero' | 'modpack') => void
  aoAbrirPainel: () => void
}): React.JSX.Element {
  const [lista, setLista] = useState<ItemServidor[] | null>(null)
  const [editando, setEditando] = useState(false)
  const [troca, setTroca] = useState<Troca | null>(null)
  const [renomear, setRenomear] = useState<ItemServidor | null>(null)
  const [recado, setRecado] = useState<ItemServidor | null>(null)
  const [apagar, setApagar] = useState<ItemServidor | null>(null)
  const [passar, setPassar] = useState<ItemServidor | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  const carregar = useCallback((): void => {
    window.api.listarServidores().then((r) => (r.ok ? setLista(r.valor) : setErro(r.erro)))
  }, [])

  useEffect(() => {
    carregar()
    window.addEventListener(EVENTO_ICONE, carregar)
    const parar = window.api.aoMudarEstado(() => carregar())
    return () => {
      parar()
      window.removeEventListener(EVENTO_ICONE, carregar)
    }
  }, [carregar])

  const ligado = lista?.find((s) => s.estado !== 'desligado') ?? null

  // Ações que trocam o servidor ativo recarregam a janela, para todas as telas lerem o novo.
  async function executar(
    acao: () => Promise<{ ok: boolean; erro?: ErroTela }>,
    recarregar: boolean
  ): Promise<void> {
    setErro(null)
    setOcupado(true)
    const r = await acao()
    setOcupado(false)
    if (!r.ok) {
      setErro(r.erro ?? null)
      carregar()
      return
    }
    if (recarregar) location.reload()
    else carregar()
  }

  function abrir(s: ItemServidor): void {
    if (editando) return setRenomear(s)
    if (s.ativo) return aoAbrirPainel()
    if (ligado) return setTroca({ de: ligado, para: s, ligar: false })
    void executar(() => window.api.ativarServidor(s.id), true)
  }

  function ligarOuDesligar(s: ItemServidor): void {
    if (s.estado === 'ligado') return void executar(() => window.api.desligar(), false)
    if (s.ativo) return void executar(() => window.api.ligar(), false)
    if (ligado) return setTroca({ de: ligado, para: s, ligar: true })
    void executar(() => window.api.trocarServidor(s.id, true), true)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[560px] flex-col p-10">
        <div className="flex items-start justify-between gap-3">
          <TituloPagina>Servidores</TituloPagina>
          <div className="flex gap-2">
            <Botao
              aria-pressed={editando}
              title="Renomear servidores"
              onClick={() => setEditando((e) => !e)}
              className={editando ? 'outline-2 outline-accent' : ''}
            >
              ✎
            </Botao>
            <span title={ligado ? 'Desligue o servidor para criar outro' : undefined}>
              <Menu
                rotulo="Criar servidor"
                desabilitado={!!ligado}
                classeBotao={classesBotao('primario')}
                itens={[
                  { rotulo: 'Do zero (assistente)', aoClicar: () => aoCriar('zero') },
                  { rotulo: 'A partir de um modpack', aoClicar: () => aoCriar('modpack') }
                ]}
              >
                + Criar
              </Menu>
            </span>
          </div>
        </div>

        {editando && (
          <p className="mb-3 text-[13px] text-muted">Clique num servidor para mudar o nome dele.</p>
        )}
        {erro && (
          <div className="mb-4">
            <MensagemErro erro={erro} />
          </div>
        )}

        {lista === null ? (
          <Esqueleto linhas={3} />
        ) : lista.length === 0 ? (
          <EstadoVazio icone={<IconeServidor />} titulo="Nenhum servidor ainda">
            <Botao variante="primario" onClick={() => aoCriar('zero')}>
              + Criar servidor
            </Botao>
          </EstadoVazio>
        ) : (
          <ul className="flex flex-col gap-3">
            {lista.map((s, i) => (
              <li
                key={s.id}
                className="anim-item relative flex h-20 items-center gap-3 border border-linha bg-panel pr-3 pl-5 transition-colors duration-(--dur-fast) hover:border-muted"
                style={{ '--ordem': i } as React.CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0 bottom-0 left-0 w-1 ${COR_STATUS[s.estado]}`}
                />
                <IconeDoServidor icone={s.icone} nome={s.nome} tam={40} />
                <button
                  type="button"
                  onClick={() => abrir(s)}
                  disabled={ocupado}
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="truncate text-lg font-bold">
                      {editando && '✎ '}
                      {s.nome}
                    </span>
                    {s.ativo && (
                      <span className="shrink-0 bg-accent px-1.5 text-xs font-bold text-accent-text">
                        Ativo
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] text-muted">
                    {NOMES_TIPOS[s.tipo]} {s.versao} · {TEXTO_ESTADO[s.estado]}
                    {s.emprestado && <b className="text-texto"> · {s.emprestado}</b>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => ligarOuDesligar(s)}
                  disabled={ocupado || s.estado === 'ligando' || s.estado === 'desligando'}
                  aria-label={s.estado === 'ligado' ? `Desligar ${s.nome}` : `Ligar ${s.nome}`}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-b-2 shadow-[inset_0_1px_0_var(--relevo-brilho)] transition-colors duration-(--dur-base) enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${
                    s.estado === 'desligado'
                      ? 'border-accent-shadow bg-accent text-accent-text'
                      : 'border-danger-shadow bg-danger text-on-dark'
                  }`}
                >
                  {s.estado === 'desligado' ? (
                    <IconeLigar className="h-4 w-4" />
                  ) : (
                    <IconeParar className="h-4 w-4" />
                  )}
                </button>
                <Menu
                  rotulo={`Mais ações para ${s.nome}`}
                  classeBotao="flex h-10 w-8 items-center justify-center font-bold hover:bg-tile-active"
                  itens={[
                    { rotulo: 'Renomear', aoClicar: () => setRenomear(s) },
                    { rotulo: 'Recado para os amigos…', aoClicar: () => setRecado(s) },
                    {
                      rotulo:
                        s.estado === 'desligado'
                          ? 'Passar para outro amigo…'
                          : 'Passar para outro amigo (desligue antes)',
                      desabilitado: s.estado !== 'desligado',
                      aoClicar: () => setPassar(s)
                    },
                    {
                      rotulo:
                        s.estado === 'desligado' ? 'Apagar servidor…' : 'Apagar (desligue antes)',
                      desabilitado: s.estado !== 'desligado' || !!ligado,
                      aoClicar: () => {
                        setConfirmacao('')
                        setApagar(s)
                      }
                    }
                  ]}
                >
                  ⋯
                </Menu>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <ImportarZip bloqueado={!!ligado} />
        </div>
        <div className="mt-3">
          <ReceberServidor bloqueado={!!ligado} />
        </div>
      </div>

      <Dialogo
        aberto={troca !== null}
        titulo={troca?.ligar ? `Ligar ${troca.para.nome}?` : `Abrir ${troca?.para.nome ?? ''}?`}
        aoCancelar={() => setTroca(null)}
        acao={{
          rotulo: ocupado ? 'Trocando...' : troca?.ligar ? 'Desligar e ligar' : 'Desligar e abrir',
          variante: 'perigo',
          ocupado,
          aoClicar: () =>
            troca &&
            void executar(() => window.api.trocarServidor(troca.para.id, troca.ligar), true)
        }}
      >
        Desligar <b>{troca?.de.nome}</b> e {troca?.ligar ? 'ligar' : 'abrir'}{' '}
        <b>{troca?.para.nome}</b>? Só um servidor fica ligado por vez. Ao desligar, o backup do
        mundo é feito como sempre.
      </Dialogo>

      <Dialogo
        aberto={apagar !== null}
        titulo={`Apagar ${apagar?.nome ?? ''}?`}
        aoCancelar={() => setApagar(null)}
        acao={{
          rotulo: ocupado ? 'Apagando...' : 'Apagar para sempre',
          variante: 'perigo',
          ocupado,
          desabilitado: confirmacao !== apagar?.nome,
          aoClicar: () =>
            apagar && void executar(() => window.api.apagarServidor(apagar.id, confirmacao), true)
        }}
      >
        <p>
          A pasta do servidor e tudo dentro dela serão apagados. Antes, o app faz um backup final do
          mundo, que fica em Documentos\ServSquare\backups.
        </p>
        <label className="mt-3 flex flex-col gap-1 text-[13px]">
          Para confirmar, digite o nome do servidor: <b>{apagar?.nome}</b>
          <Campo value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoFocus />
        </label>
      </Dialogo>

      <DialogoRenomear servidor={renomear} aoFechar={() => setRenomear(null)} />
      {passar && (
        <DialogoPassar
          key={passar.id}
          servidor={passar}
          aoFechar={(gerou) => {
            setPassar(null)
            if (gerou) carregar()
          }}
        />
      )}
      {recado && (
        <DialogoRecado key={recado.id} servidor={recado} aoFechar={() => setRecado(null)} />
      )}
    </div>
  )
}

// Recado do dono (Fase P4): aparece para os amigos na tela Jogar do PlaySquare quando o servidor
// está desligado (ex.: "Ligo às 20 h"). Vai pelo convite, então precisa do HubSquare aberto.
function DialogoRecado({
  servidor,
  aoFechar
}: {
  servidor: ItemServidor
  aoFechar: () => void
}): React.JSX.Element {
  const [texto, setTexto] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  useEffect(() => {
    window.api
      .mensagemDoServidor(servidor.id)
      .then((r) => (r.ok ? setTexto(r.valor) : setErro(r.erro)))
  }, [servidor.id])
  return (
    <Dialogo
      aberto
      titulo={`Recado para os amigos de ${servidor.nome}`}
      aoCancelar={aoFechar}
      acao={{
        rotulo: 'Salvar',
        variante: 'primario',
        desabilitado: texto === null,
        aoClicar: async () => {
          const r = await window.api.salvarMensagemDoServidor(servidor.id, texto ?? '')
          if (r.ok) aoFechar()
          else setErro(r.erro)
        }
      }}
    >
      <p className="text-[13px]">
        Quem entrou pelo convite vê este recado na tela Jogar do PlaySquare quando o servidor está
        desligado. Deixe vazio para não mostrar nada.
      </p>
      <Campo
        className="mt-3"
        value={texto ?? ''}
        maxLength={200}
        disabled={texto === null}
        placeholder="Ex.: Ligo hoje às 20 h"
        onChange={(e) => setTexto(e.target.value)}
        autoFocus
      />
      {erro && <MensagemErro erro={erro} />}
    </Dialogo>
  )
}
