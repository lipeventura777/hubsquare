import { IconeAtencao, IconeVoltar } from '../icones'
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../componentes/api'
import type {
  DetalhesProjeto,
  ErroTela,
  InfoServidor,
  PlanoMods,
  Progresso,
  Resultado,
  TipoConteudo
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { AndamentoModpack } from '../componentes/AndamentoModpack'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Aviso, Botao, CaixaSelecao, Dialogo } from '../componentes/ui'
import { criarComModpack } from '../estrutura/navegar'
import { FraseCompat } from './FraseCompat'
import { useEstadoServidor } from '../servidor/comandos'
import { classesBotao } from '../componentes/estilos'
import type { Fonte } from '../../../shared/fontes'
import { DialogoPlano } from './DialogoPlano'
import { Markdown } from './Markdown'
import { NOMES_AMBIENTE, nomeLoader } from './nomesModrinth'
import { IconeProjeto } from './TelaMods'
import { t, idiomaAtual } from '../../../shared/i18n'

const numero = new Intl.NumberFormat(idiomaAtual(), {
  notation: 'compact',
  maximumFractionDigits: 1
})
const data = new Intl.DateTimeFormat(idiomaAtual(), { dateStyle: 'short' })

const TIPOS_VERSAO: Record<string, string> = {
  release: t('detalhesProjeto.estavel'),
  beta: t('detalhesProjeto.beta'),
  alpha: t('detalhesProjeto.alfa')
}

// Cabeçalho da página de detalhes (Explorar e Instalados): ícone de 72px, nome e resumo.
export function CabecalhoDetalhes({
  icone,
  titulo,
  resumo,
  linha
}: {
  icone: string | null
  titulo: string
  resumo?: string
  linha: string
}): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-start gap-4">
      <IconeProjeto url={icone} titulo={titulo} tam={72} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="texto-pixel text-[22px]">{titulo}</h2>
        {resumo && <p className="text-[13px]">{resumo}</p>}
        <p className="text-xs text-muted">{linha}</p>
      </div>
    </header>
  )
}

// Card da ação: a frase de para onde vai e os botões.
export function CardAcao({
  frase,
  children
}: {
  frase: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 border border-linha bg-panel p-4">
      <p className="border-l-4 border-accent pl-3 text-[13px]">{frase}</p>
      {children}
    </section>
  )
}

// Página de detalhes de um projeto (Explorar, Fase 23; Instalados, Fase 23.2; fontes, Fase 24).
// `extra` entra na linha de botões (ex.: o Remover da aba Instalados).
export function DetalhesDoProjeto({
  projeto,
  tipo,
  info,
  aoVoltar,
  aoMudar,
  rotuloVoltar = t('detalhesProjeto.voltarAoExplorar'),
  extra,
  semAcaoPrincipal = false,
  fonte = 'modrinth'
}: {
  projeto: { id: string; titulo: string; autor?: string }
  fonte?: Fonte
  tipo: TipoConteudo
  info: InfoServidor
  aoVoltar: () => void
  aoMudar: (instalado: boolean) => Promise<void>
  rotuloVoltar?: string
  extra?: React.ReactNode
  semAcaoPrincipal?: boolean
}): React.JSX.Element {
  const api = useApi()
  const { estado: estadoServidor } = useEstadoServidor()
  // PlaySquare (Fase P3): o alvo é uma instalação do jogador; o servidor ligado não importa.
  const jogo = !!info.jogador
  const ligado = !jogo && estadoServidor !== 'desligado'
  const [d, setD] = useState<DetalhesProjeto | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null) // qual ação está rodando
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [plano, setPlano] = useState<PlanoMods | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [foto, setFoto] = useState(0)

  useEffect(() => api.aoProgredir(setProgresso), [api])

  const carregar = useCallback(async (): Promise<void> => {
    const r = await api.detalhesProjeto(projeto.id, tipo, fonte)
    if (r.ok) setD(r.valor)
    else setErro(r.erro)
  }, [api, projeto.id, tipo, fonte])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura
    void carregar()
  }, [carregar])

  // Roda uma ação, mostra o erro ou o aviso e relê a página.
  async function rodar(
    nome: string,
    acao: () => Promise<Resultado<unknown>>,
    depois?: string
  ): Promise<boolean> {
    setOcupado(nome)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(null)
    setProgresso(null)
    if (!r.ok) {
      setErro(r.erro.cancelado ? null : r.erro)
      return false
    }
    if (depois) setAviso(depois)
    await carregar()
    return true
  }

  const voltar = (
    <Botao tamanho="pequeno" className="self-start" onClick={aoVoltar}>
      <IconeVoltar className="mr-1 inline h-[1em] w-[1em] align-[-0.125em]" />
      {rotuloVoltar}
    </Botao>
  )

  if (!d) {
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={6} />}
      </div>
    )
  }

  const extras = info.tipo === 'paper' ? 'plugins' : 'mods'
  const reiniciar = ligado ? t('detalhesProjeto.comOServidorLigadoEle') : ''

  // ---------- Ações de cada destino ----------

  async function instalarNoServidor(): Promise<void> {
    if (!d) return
    if (d.estado === 'atualizar' && d.arquivo) {
      const arquivo = d.arquivo
      await rodar(
        'principal',
        () => api.atualizarMods([arquivo]),
        t('detalhesProjeto.atualizado', { reiniciar })
      )
      return aoMudar(true)
    }
    setOcupado('principal')
    setErro(null)
    const r = await api.planejarMod(d.id, d.fonte)
    setOcupado(null)
    if (!r.ok) return setErro(r.erro)
    setPlano(r.valor)
  }

  async function confirmarPlano(): Promise<void> {
    if (!plano) return
    const ok = await rodar(
      'plano',
      () => api.instalarMods(plano.token),
      t('detalhesProjeto.instaladoNaPasta', { extras, reiniciar })
    )
    setPlano(null)
    if (ok) await aoMudar(true)
  }

  async function principal(): Promise<void> {
    if (!d) return
    switch (d.destino) {
      case 'servidor':
        return instalarNoServidor()
      case 'datapack':
        if (
          await rodar(
            'principal',
            () => api.instalarDatapack(d.id, d.fonte),
            ligado
              ? t('detalhesProjeto.datapackCopiadoRodeReloadNo')
              : t('detalhesProjeto.datapackCopiadoEleAtivaQuando')
          )
        )
          await aoMudar(true)
        return
      case 'resourcepack':
        if (
          await rodar(
            'principal',
            () => api.usarResourcePack(d.id, d.obrigatorio),
            t('detalhesProjeto.prontoOServerPropertiesAponta', {
              v: ligado ? t('detalhesProjeto.valeDepoisDeReiniciarO') : ''
            })
          )
        )
          await aoMudar(true)
        return
      case 'amigos':
        if (
          await rodar(
            'principal',
            () => api.adicionarAosAmigos(d.id, d.tipo),
            jogo
              ? t('detalhesProjeto.instaladoNaInstalacao', {
                  nome: info.nome,
                  v: d.tipo === 'shader' ? t('detalhesProjeto.oModDeShadersVeio') : ''
                })
              : t('detalhesProjeto.adicionadoGereOPacotePros')
          )
        )
          await aoMudar(true)
        return
      case 'modpack':
        if (jogo) {
          await rodar(
            'principal',
            () => api.criarInstalacaoDeModpack(d.id),
            t('detalhesProjeto.instalacaoCriadaElaApareceEm')
          )
          return
        }
        return criarComModpack(d.id, d.fonte)
      case 'incompativel':
        return
    }
  }

  const rotulosJogo: Record<string, Record<string, string>> = {
    servidor: {
      instalar: t('detalhesProjeto.instalarNoMeuJogo'),
      instalado: t('detalhesProjeto.noMeuJogo'),
      atualizar: t('detalhesProjeto.atualizar')
    },
    amigos: {
      instalar: t('detalhesProjeto.instalarNoMeuJogo'),
      instalado: t('detalhesProjeto.noMeuJogo'),
      atualizar: t('detalhesProjeto.atualizar')
    },
    modpack: { instalar: t('detalhesProjeto.criarInstalacaoComEsteModpack') },
    incompativel: { instalar: t('detalhesProjeto.naoServeParaEstaInstalacao') }
  }
  const rotulos: Record<string, Record<string, string>> = jogo
    ? rotulosJogo
    : {
        servidor: {
          instalar: t('detalhesProjeto.instalar'),
          instalado: t('detalhesProjeto.instalado'),
          atualizar: t('detalhesProjeto.atualizar')
        },
        datapack: {
          instalar: t('detalhesProjeto.instalarNoMundo'),
          instalado: t('detalhesProjeto.instalado'),
          atualizar: t('detalhesProjeto.atualizar')
        },
        resourcepack: {
          instalar: t('detalhesProjeto.usarComoResourcePackDo'),
          instalado: t('detalhesProjeto.emUsoNoServidor'),
          atualizar: t('detalhesProjeto.atualizarNoServidor')
        },
        amigos: {
          instalar: t('detalhesProjeto.adicionarAoPacoteProsAmigos'),
          instalado: t('detalhesProjeto.noPacoteProsAmigos'),
          atualizar: t('detalhesProjeto.atualizarNoPacote')
        },
        modpack: { instalar: t('detalhesProjeto.criarServidorComEsteModpack') },
        incompativel: { instalar: t('detalhesProjeto.naoServeParaEsteServidor') }
      }
  const rotulo =
    ocupado === 'principal'
      ? d.destino === 'servidor' && d.estado === 'instalar'
        ? t('detalhesProjeto.verificando')
        : t('detalhesProjeto.instalando')
      : (rotulos[d.destino][d.estado] ?? rotulos[d.destino].instalar)
  const semVersao = d.destino !== 'modpack' && d.destino !== 'incompativel' && !d.versoes.length
  const desabilitado =
    !!ocupado ||
    d.destino === 'incompativel' ||
    d.estado === 'instalado' ||
    semVersao ||
    !!d.compat?.bloqueia ||
    (jogo && d.destino === 'modpack' && d.fonte !== 'modrinth')

  const imagem = d.galeria[foto]

  return (
    <div className="flex flex-col gap-6">
      {voltar}

      <CabecalhoDetalhes
        icone={d.icone}
        titulo={d.titulo}
        resumo={d.descricao}
        linha={[
          projeto.autor && t('detalhesProjeto.porAutor', { autor: projeto.autor }),
          t('detalhesProjeto.downloads', { n: numero.format(d.downloads) }),
          t('detalhesProjeto.seguidores', { n: numero.format(d.seguidores) }),
          d.ambiente && NOMES_AMBIENTE[d.ambiente]
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      {/* Ação principal e, numa frase, para onde vai. */}
      <CardAcao frase={d.frase}>
        <FraseCompat compat={d.compat} />
        {semVersao && (
          <p className="text-[13px] text-warning">
            <IconeAtencao className="mr-1 inline h-[1em] w-[1em] align-[-0.125em]" />
            {t('detalhesProjeto.naoHaVersaoParaO', { versao: info.versao })}
            {d.destino === 'servidor'
              ? t('detalhesProjeto.com', { nomeLoader: nomeLoader(info.tipo) })
              : ''}
            .
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* O autor não deixa outros apps baixarem: só o link da página (sem baixar). */}
          {!semAcaoPrincipal && d.baixarPeloSite && d.estado !== 'instalado' && (
            <a
              href={d.baixarPeloSite}
              target="_blank"
              rel="noreferrer"
              className={classesBotao('primario')}
            >
              {t('detalhesProjeto.baixePeloSite')}
            </a>
          )}
          {!semAcaoPrincipal && !(d.baixarPeloSite && d.estado !== 'instalado') && (
            <Botao
              variante={d.destino === 'amigos' ? 'destaque' : 'primario'}
              disabled={desabilitado}
              onClick={principal}
            >
              {rotulo}
            </Botao>
          )}
          {extra}

          {/* Na aba Instalados, o Remover vem pelo `extra`. */}
          {!extra && d.destino === 'datapack' && d.estado !== 'instalar' && (
            <Botao variante="perigo" disabled={!!ocupado} onClick={() => setRemovendo(true)}>
              {t('detalhesProjeto.removerDoMundo')}
            </Botao>
          )}
          {d.destino === 'resourcepack' && d.estado !== 'instalar' && (
            <Botao
              disabled={!!ocupado}
              onClick={async () => {
                if (
                  await rodar(
                    'parar',
                    () => api.pararResourcePack(),
                    t('detalhesProjeto.oServidorNaoMandaMais')
                  )
                )
                  await aoMudar(d.noPacote)
              }}
            >
              {t('detalhesProjeto.pararDeUsarNoServidor')}
            </Botao>
          )}
          {/* Resource pack também pode ir para o pacote; nos outros, o principal já é o pacote. */}
          {(d.destino === 'resourcepack' || d.destino === 'amigos') &&
            (d.noPacote ? (
              <Botao
                disabled={!!ocupado}
                onClick={async () => {
                  if (
                    await rodar(
                      'amigos',
                      () => api.removerDosAmigos(d.id),
                      jogo
                        ? t('detalhesProjeto.saiuDaInstalacao')
                        : t('detalhesProjeto.saiuDoPacoteProsAmigos')
                    )
                  )
                    await aoMudar(d.destino === 'resourcepack' && d.estado !== 'instalar')
                }}
              >
                {jogo
                  ? t('detalhesProjeto.tirarDoMeuJogo')
                  : t('detalhesProjeto.tirarDoPacoteProsAmigos')}
              </Botao>
            ) : (
              d.destino === 'resourcepack' && (
                <Botao
                  variante="destaque"
                  disabled={!!ocupado || semVersao}
                  onClick={async () => {
                    if (
                      await rodar(
                        'amigos',
                        () => api.adicionarAosAmigos(d.id, d.tipo),
                        t('detalhesProjeto.adicionadoAoPacoteProsAmigos')
                      )
                    )
                      await aoMudar(true)
                  }}
                >
                  {ocupado === 'amigos'
                    ? t('detalhesProjeto.adicionando')
                    : t('detalhesProjeto.adicionarAoPacoteProsAmigos')}
                </Botao>
              )
            ))}
        </div>

        {d.destino === 'resourcepack' && (
          <CaixaSelecao
            marcada={d.obrigatorio}
            disabled={!!ocupado}
            aoMudar={(v) => {
              // Em uso: grava na hora. Ainda não: vale quando clicar em "Usar".
              if (d.estado === 'instalar') setD({ ...d, obrigatorio: v })
              else
                void rodar(
                  'obrigatorio',
                  () => api.usarResourcePack(d.id, v),
                  v
                    ? t('detalhesProjeto.agoraEObrigatorioQuemRecusar')
                    : t('detalhesProjeto.agoraEOpcionalCadaJogador')
                )
            }}
          >
            {t('detalhesProjeto.obrigatorioParaEntrarQuemRecusar')}
          </CaixaSelecao>
        )}
        {d.tipo === 'shader' && !jogo && (
          <p className="text-xs text-muted">{t('detalhesProjeto.paraUsarShadersSeusAmigos')}</p>
        )}
        {ocupado && jogo && d.tipo === 'modpack' ? (
          <AndamentoModpack progresso={progresso} />
        ) : (
          ocupado &&
          progresso && (
            <div className="flex flex-col gap-1 text-[13px]">
              <span>{progresso.etapa}</span>
              <BarraProgresso
                rotulo={progresso.etapa}
                valor={progresso.recebido}
                maximo={progresso.total}
              />
            </div>
          )
        )}
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && (
          <MensagemErro
            erro={erro}
            aoTentarDeNovo={
              erro.falhas?.length && jogo && d.tipo === 'modpack'
                ? () => void principal()
                : undefined
            }
          />
        )}
      </CardAcao>

      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {imagem && (
            <section aria-label={t('detalhesProjeto.galeria')} className="flex flex-col gap-2">
              <figure className="flex flex-col gap-1">
                <img
                  src={imagem.url}
                  alt={
                    imagem.titulo ??
                    t('detalhesProjeto.imagemDe', { v: foto + 1, titulo: d.titulo })
                  }
                  className="max-h-[420px] w-full bg-panel-2 object-contain"
                />
                {(imagem.titulo || imagem.descricao) && (
                  <figcaption className="text-xs text-muted">
                    {imagem.titulo && <b className="text-texto">{imagem.titulo}</b>}{' '}
                    {imagem.descricao}
                  </figcaption>
                )}
              </figure>
              {d.galeria.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {d.galeria.map((g, i) => (
                    <button
                      key={g.url}
                      type="button"
                      aria-label={t('detalhesProjeto.verImagem', { v: i + 1 })}
                      aria-pressed={i === foto}
                      onClick={() => setFoto(i)}
                      className={`shrink-0 border-2 ${i === foto ? 'border-accent' : 'border-transparent hover:border-muted'}`}
                    >
                      <img src={g.url} alt="" loading="lazy" className="h-16 w-28 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <CardPainel titulo={t('detalhesProjeto.descricao')}>
            {d.corpo ? (
              <Markdown texto={d.corpo} />
            ) : (
              <p className="text-muted">{t('detalhesProjeto.semDescricao')}</p>
            )}
          </CardPainel>

          <CardPainel
            titulo={
              d.destino === 'modpack'
                ? t('detalhesProjeto.versoes')
                : t('detalhesProjeto.versoesPara', {
                    versao: info.versao,
                    v: d.versoes.length ? ` (${d.versoes.length})` : ''
                  })
            }
          >
            {!d.versoes.length ? (
              <p className="text-[13px] text-muted">
                {t('detalhesProjeto.nenhumaVersaoCompativelComEste')}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-linha">
                {d.versoes.map((v, i) => (
                  <li key={v.id} className="py-2">
                    <details open={i === 0}>
                      <summary className="flex cursor-pointer flex-wrap items-baseline gap-2 text-[13px]">
                        <b>{v.numero}</b>
                        <span className="bg-panel-2 px-1.5 text-xs">
                          {TIPOS_VERSAO[v.tipo] ?? v.tipo}
                        </span>
                        <span className="text-xs text-muted">
                          {data.format(new Date(v.data))} · {v.loaders.map(nomeLoader).join(', ')} ·{' '}
                          {v.jogos.slice(-3).join(', ')}
                        </span>
                      </summary>
                      <div className="mt-2 pl-2">
                        {v.changelog ? (
                          <Markdown texto={v.changelog} />
                        ) : (
                          <p className="text-xs text-muted">
                            {t('detalhesProjeto.semNotasDestaVersao')}
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </CardPainel>
        </div>

        <aside className="flex flex-col gap-6">
          <CardPainel titulo={t('detalhesProjeto.licenca')}>
            <p className="text-[13px]">
              {d.licenca.url ? (
                <a
                  href={d.licenca.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  {d.licenca.nome || d.licenca.id}
                </a>
              ) : (
                d.licenca.nome || d.licenca.id
              )}
            </p>
          </CardPainel>

          {d.links.length > 0 && (
            <CardPainel titulo={t('detalhesProjeto.links')}>
              <ul className="flex flex-col gap-2 text-[13px]">
                {d.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      {l.rotulo}
                    </a>
                  </li>
                ))}
                {d.fonte === 'modrinth' && (
                  <li>
                    <a
                      href={`https://modrinth.com/project/${d.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      {t('detalhesProjeto.paginaNoModrinth')}
                    </a>
                  </li>
                )}
              </ul>
            </CardPainel>
          )}

          <CardPainel titulo={t('detalhesProjeto.dependencias')}>
            {!d.dependencias.length ? (
              <p className="text-[13px] text-muted">
                {t('detalhesProjeto.naoPrecisaDeOutrosProjetos')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.dependencias.map((dep) => (
                  <li key={dep.id} className="flex items-center gap-2 text-[13px]">
                    <IconeProjeto url={dep.icone} titulo={dep.titulo} tam={28} />
                    <span className="min-w-0 flex-1 truncate" title={dep.titulo}>
                      {dep.titulo}
                    </span>
                    <span className="bg-panel-2 px-1.5 text-xs">
                      {dep.obrigatoria
                        ? t('detalhesProjeto.necessario')
                        : t('detalhesProjeto.opcional')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {d.destino === 'servidor' && d.dependencias.some((x) => x.obrigatoria) && (
              <p className="mt-3 text-xs text-muted">
                {t('detalhesProjeto.asNecessariasSaoInstaladasJunto')}
              </p>
            )}
          </CardPainel>
        </aside>
      </div>

      {/* Mods e plugins: mesma confirmação da Fase 16, com as dependências. */}
      <DialogoPlano
        plano={plano}
        titulo={t('detalhesProjeto.instalar2', { titulo: d.titulo })}
        extras={extras}
        ocupado={ocupado === 'plano'}
        progresso={progresso}
        aoCancelar={() => setPlano(null)}
        aoConfirmar={confirmarPlano}
      />

      <Dialogo
        aberto={removendo}
        titulo={t('detalhesProjeto.remover', { titulo: d.titulo })}
        aoCancelar={() => setRemovendo(false)}
        acao={{
          rotulo:
            ocupado === 'remover' ? t('detalhesProjeto.removendo') : t('detalhesProjeto.remover2'),
          variante: 'perigo',
          ocupado: ocupado === 'remover',
          aoClicar: async () => {
            let agendado = false
            const ok = await rodar(
              'remover',
              async () => {
                const r = await api.removerDatapack(d.id)
                agendado = r.ok && r.valor
                return r
              },
              t('detalhesProjeto.prontoOArquivoFica7')
            )
            if (ok && agendado) setAviso(t('detalhesProjeto.seraRemovidoAoDesligarO'))
            setRemovendo(false)
            if (ok) await aoMudar(false)
          }
        }}
      >
        <p>
          {t('detalhesProjeto.oDatapackSaiDaPasta')}
          {ligado && t('detalhesProjeto.comOServidorLigadoEle2')}
        </p>
      </Dialogo>
    </div>
  )
}
