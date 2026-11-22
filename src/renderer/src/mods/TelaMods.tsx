import { useCallback, useEffect, useState } from 'react'
import { irPara } from '../estrutura/navegar'
import { ProibidosParaJogadores } from './ProibidosParaJogadores'
import {
  EXTRAS_TIPOS,
  NOMES_TIPOS,
  type AtualizacaoMod,
  type ErroTela,
  type InfoServidor,
  type ListaMods,
  type Progresso
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeMods } from '../icones'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { CardPainel, corDoNome } from '../componentes/paineis'
import { Aviso, Botao, EstadoVazio, PaginaAjustes } from '../componentes/ui'
import { useEstadoServidor } from '../servidor/comandos'
import { Explorar } from './Explorar'
import { classesBotao } from '../componentes/estilos'
import { NOMES_FONTES } from '../../../shared/fontes'
import { Instalados } from './Instalados'
import { BotaoDownloadsPendentes } from './DownloadsNecessarios'
import { AtualizacaoDoModpack, BotaoPacoteAmigos } from './ModpackEAmigos'
import { t } from '../../../shared/i18n'

// Tela Mods (Fase 16): mods ou plugins do servidor ativo, pelo Modrinth.
export function TelaMods({ aba }: { aba: string }): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [info, setInfo] = useState<InfoServidor | null>(null)
  const [lista, setLista] = useState<ListaMods | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.servidorAtual().then((r) => (r.ok ? setInfo(r.valor) : setErro(r.erro)))
  }, [])

  const extras = info ? EXTRAS_TIPOS[info.tipo] : undefined

  const recarregar = useCallback(async (): Promise<void> => {
    const r = await window.api.listarMods()
    if (r.ok) {
      setLista(r.valor)
      setErro(null)
    } else setErro(r.erro)
  }, [])

  // Ao desligar/ligar, as mudanças pendentes são aplicadas: a lista muda.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- relê quando o servidor muda de estado
    if (extras && (estado === 'desligado' || estado === 'ligado')) void recarregar()
  }, [extras, estado, recarregar])

  if (!info) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }

  if (aba === 'Proibidos para jogadores') return <ProibidosParaJogadores />

  // Explorar serve a qualquer servidor (datapacks, resource packs, shaders, modpacks).
  // Instalados também (datapacks, resource pack, Pacote pros amigos).
  if (aba === 'Explorar' && !extras) {
    return (
      <PaginaAjustes largo>
        <TestarNoJogo info={info} />
        <Explorar info={info} aoInstalar={async () => {}} />
      </PaginaAjustes>
    )
  }
  if (aba === 'Instalados' && !extras) {
    return (
      <PaginaAjustes largo>
        <TestarNoJogo info={info} />
        <BotaoPacoteAmigos info={info} ligado={estado === 'ligado'} />
        <Instalados info={info} estado={estado} aoMudar={async () => {}} />
      </PaginaAjustes>
    )
  }

  if (!extras) {
    return (
      <PaginaAjustes>
        <EstadoVazio
          icone={<IconeMods />}
          titulo={t('telaMods.oNaoAceitaModsNem', { v: NOMES_TIPOS[info.tipo] })}
          texto={t('telaMods.paraUsarModsTroqueO')}
        />
      </PaginaAjustes>
    )
  }

  const ligado = estado !== 'desligado'

  return (
    <PaginaAjustes largo>
      {lista && lista.pendentes > 0 && (
        <Aviso tipo="atencao">
          <span className="flex-1">{t('telaMods.reinicieOServidorParaAplicar', { extras })}</span>
          {estado === 'ligado' && (
            <Botao variante="atencao" tamanho="pequeno" onClick={() => window.api.reiniciar()}>
              {t('telaMods.reiniciar')}
            </Botao>
          )}
        </Aviso>
      )}
      {erro && <MensagemErro erro={erro} />}
      <BotaoDownloadsPendentes alvo={info.id} />

      {(aba === 'Instalados' || aba === 'Explorar') && <TestarNoJogo info={info} />}
      {aba === 'Instalados' && <BotaoPacoteAmigos info={info} ligado={estado === 'ligado'} />}
      {aba === 'Instalados' && <Instalados info={info} estado={estado} aoMudar={recarregar} />}
      {aba === 'Explorar' && <Explorar info={info} aoInstalar={recarregar} />}
      {aba === 'Atualizações' && info.modpack && (
        <AtualizacaoDoModpack
          ligado={ligado}
          aoAtualizar={async () => {
            await recarregar()
            const r = await window.api.servidorAtual()
            if (r.ok) setInfo(r.valor)
          }}
        />
      )}
      {aba === 'Atualizações' && <AbaAtualizacoes extras={extras} aoAtualizar={recarregar} />}
    </PaginaAjustes>
  )
}

export function IconeProjeto({
  url,
  titulo,
  tam = 40
}: {
  url: string | null
  titulo: string
  tam?: number
}): React.JSX.Element {
  const [falhou, setFalhou] = useState(false)
  const estilo = { width: tam, height: tam }
  if (url && !falhou) {
    return (
      <img
        src={url}
        alt=""
        // Fase V9: só baixa quando aparece, decodifica fora da tela e reserva o espaço.
        loading="lazy"
        decoding="async"
        width={tam}
        height={tam}
        style={estilo}
        className="shrink-0 bg-panel-2 object-cover"
        onError={() => setFalhou(true)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...estilo, background: corDoNome(titulo) }}
      className="texto-pixel flex shrink-0 items-center justify-center text-white"
    >
      {titulo.charAt(0).toUpperCase()}
    </span>
  )
}

// ---------- Atualizações ----------

function AbaAtualizacoes({
  extras,
  aoAtualizar
}: {
  extras: 'mods' | 'plugins'
  aoAtualizar: () => Promise<void>
}): React.JSX.Element {
  const [itens, setItens] = useState<AtualizacaoMod[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [atualizando, setAtualizando] = useState<string | 'todos' | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  const procurar = useCallback(async (): Promise<void> => {
    setErro(null)
    const r = await window.api.listarAtualizacoesMods()
    if (r.ok) setItens(r.valor)
    else {
      setItens([])
      setErro(r.erro)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura da lista
    void procurar()
  }, [procurar])

  async function atualizar(arquivo?: string): Promise<void> {
    setAtualizando(arquivo ?? 'todos')
    setErro(null)
    const r = await window.api.atualizarMods(arquivo ? [arquivo] : undefined)
    setAtualizando(null)
    setProgresso(null)
    if (!r.ok) setErro(r.erro)
    await Promise.all([procurar(), aoAtualizar()])
  }

  if (!itens) return <Esqueleto linhas={4} />

  return (
    <div className="flex flex-col gap-4">
      {erro && <MensagemErro erro={erro} />}
      {!itens.length && !erro ? (
        <EstadoVazio
          icone={<IconeMods />}
          titulo={t('telaMods.tudoEmDia')}
          texto={t('telaMods.osDoModrinthJaEstao', { extras })}
        >
          <Botao onClick={procurar}>{t('telaMods.procurarDeNovo')}</Botao>
        </EstadoVazio>
      ) : (
        itens.length > 0 && (
          <CardPainel
            titulo={`${itens.length} ${itens.length === 1 ? t('telaMods.atualizacao') : t('telaMods.atualizacoes')}`}
            acoes={
              <Botao
                variante="primario"
                tamanho="pequeno"
                disabled={!!atualizando || itens.every((a) => a.manual)}
                onClick={() => atualizar()}
              >
                {atualizando === 'todos' ? t('telaMods.atualizando') : t('telaMods.atualizarTodos')}
              </Botao>
            }
          >
            <p className="mb-3 text-xs text-muted">
              {t('telaMods.antesDeAtualizarOApp', { extras })}
            </p>
            <ul className="flex flex-col divide-y divide-linha">
              {itens.map((a) => (
                <li key={a.arquivo} className="anim-item flex items-center gap-3 py-2">
                  <IconeProjeto url={a.icone} titulo={a.titulo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" title={a.titulo}>
                      {a.titulo}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {a.versaoAtual} → <span className="text-texto">{a.versaoNova}</span> ·{' '}
                      {NOMES_FONTES[a.fonte]}
                    </p>
                  </div>
                  {a.manual ? (
                    // O autor não deixa outros apps baixarem: o app só mostra a página.
                    <a
                      href={a.manual}
                      target="_blank"
                      rel="noreferrer"
                      className={classesBotao('secundario', 'pequeno')}
                    >
                      {t('telaMods.baixePeloSite')}
                    </a>
                  ) : (
                    <Botao
                      tamanho="pequeno"
                      disabled={!!atualizando}
                      onClick={() => atualizar(a.arquivo)}
                    >
                      {atualizando === a.arquivo
                        ? t('telaMods.atualizando')
                        : t('telaMods.atualizar')}
                    </Botao>
                  )}
                </li>
              ))}
            </ul>
          </CardPainel>
        )
      )}
      {atualizando && progresso && (
        <div className="flex flex-col gap-1 text-[13px]">
          <span>{progresso.etapa}</span>
          <BarraProgresso
            rotulo={progresso.etapa}
            valor={progresso.recebido}
            maximo={progresso.total}
          />
        </div>
      )}
    </div>
  )
}

// Fase P5: "Testar no meu jogo" deixa a instalação deste servidor igual a ele (mods, packs) e troca
// para o PlaySquare, no Jogar, com ela escolhida (mesma animação da troca Serv/Play).
function TestarNoJogo({ info }: { info: InfoServidor }): React.JSX.Element {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  useEffect(() => window.api.aoProgredir(setProgresso), [])
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 border border-linha bg-panel p-3">
        <p className="flex-1 text-[13px] text-muted">{t('telaMods.querVerComoFicouNo')}</p>
        <Botao
          variante="destaque"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            setErro(null)
            const r = await window.api.prepararTeste(info.id)
            setOcupado(false)
            if (!r.ok) return setErro(r.erro)
            irPara({ area: 'play', pagina: t('telaMods.jogar'), instalacaoId: r.valor })
          }}
        >
          {ocupado ? t('telaMods.preparando') : t('telaMods.testarNoMeuJogo')}
        </Botao>
      </div>
      {ocupado && progresso && (
        <BarraProgresso
          rotulo={progresso.etapa}
          valor={progresso.recebido}
          maximo={progresso.total}
        />
      )}
      {erro && <MensagemErro erro={erro} />}
    </div>
  )
}
