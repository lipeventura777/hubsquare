import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '../componentes/api'
import {
  LOADERS_CONTEUDO,
  NOMES_CONTEUDO,
  NOMES_TIPOS,
  TIPOS_POR_FONTE,
  type ErroTela,
  type FiltrosExplorar,
  type InfoServidor,
  type OpcoesExplorar,
  type OrdemExplorar,
  type ProjetoExplorar,
  type TipoConteudo
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeAtencao, IconeMods } from '../icones'
import { Aviso, Botao, CaixaSelecao, EstadoVazio, OpcaoRadio, Selecao } from '../componentes/ui'
import { FONTES, NOMES_FONTES, type Fonte } from '../../../shared/fontes'
import {
  muitosResultados,
  paginaValida,
  tamanhoValido,
  totalAlcancavel,
  totalPaginas
} from '../../../shared/paginaRegras'
import { BarraDePaginas, TopoDaLista } from '../componentes/Paginas'
import type { ResultadoExplorar } from '../../../shared/tipos'
import { DetalhesDoProjeto } from './DetalhesProjeto'
import { NOMES_AMBIENTE, nomeCategoria, nomeGrupo, nomeLoader } from './nomesModrinth'
import {
  AbasDeTipo,
  BarraDeBusca,
  CardProjeto,
  EsqueletoDeCards,
  Etiqueta,
  EtiquetasDeFiltro,
  GrupoFiltro,
  ListaDeCards,
  PainelDeFiltros,
  usePreferencia
} from './partesExplorar'
import { t, idiomaAtual } from '../../../shared/i18n'

const numero = new Intl.NumberFormat(idiomaAtual(), {
  notation: 'compact',
  maximumFractionDigits: 1
})

// As mesmas ordenações nas três fontes; o processo principal traduz para cada API.
function ordens(fonte: Fonte): { valor: OrdemExplorar; rotulo: string }[] {
  return [
    {
      valor: 'relevance',
      rotulo: fonte === 'modrinth' ? t('explorar.relevancia') : t('explorar.popularidade')
    },
    { valor: 'downloads', rotulo: t('explorar.downloads') },
    { valor: 'follows', rotulo: SEGUIDORES[fonte].ordem },
    { valor: 'newest', rotulo: t('explorar.maisRecentes') },
    { valor: 'updated', rotulo: t('explorar.atualizadosRecentemente') }
  ]
}

const SEGUIDORES: Record<Fonte, { ordem: string; card: string }> = {
  modrinth: { ordem: t('explorar.seguidores'), card: 'seguidores' },
  curseforge: { ordem: t('explorar.avaliacao'), card: 'curtidas' },
  hangar: { ordem: t('explorar.estrelas'), card: 'estrelas' }
}

// Loaders que o filtro oferece em cada fonte (o Hangar é só Paper; plugins do CurseForge, Bukkit).
function loadersDoFiltro(fonte: Fonte, tipo: TipoConteudo): string[] {
  if (fonte === 'hangar') return []
  if (fonte === 'curseforge')
    return tipo === 'mod' || tipo === 'modpack' ? LOADERS_CONTEUDO[tipo] : []
  return LOADERS_CONTEUDO[tipo]
}

const temAmbiente = (t: TipoConteudo): boolean => t === 'mod' || t === 'plugin' || t === 'datapack'

const ehDeMods = (info: InfoServidor): boolean =>
  info.tipo === 'fabric' || info.tipo === 'forge' || info.tipo === 'neoforge'

// O loader "do servidor" só existe quando o tipo combina com o software do servidor.
function loaderDoServidor(tipo: TipoConteudo, info: InfoServidor): string | null {
  if (tipo === 'mod' || tipo === 'modpack') return ehDeMods(info) ? NOMES_TIPOS[info.tipo] : null
  if (tipo === 'plugin') return info.tipo === 'paper' ? t('explorar.paperSpigotEBukkit') : null
  return null
}

// Para onde vai cada tipo, numa frase (requisito da Fase 23).
function fraseDoTipo(tipo: TipoConteudo, info: InfoServidor): string {
  // PlaySquare (Fase P3): tudo vai para a instalação do jogador.
  if (info.jogador) {
    switch (tipo) {
      case 'mod':
        return ehDeMods(info)
          ? t('explorar.modsVaoParaAPasta', { nome: info.nome })
          : t('explorar.estaInstalacaoEVanillaMods')
      case 'shader':
        return t('explorar.shadersVaoParaAPasta')
      case 'resourcepack':
        return t('explorar.resourcePacksVaoParaA')
      case 'modpack':
        return t('explorar.umModpackCriaUmaInstalacao')
      default:
        return t('explorar.naoServeParaOJogo')
    }
  }
  switch (tipo) {
    case 'mod':
      return ehDeMods(info)
        ? t('explorar.modsQueRodamNoServidor')
        : t('explorar.oNaoUsaModsPara', { v: NOMES_TIPOS[info.tipo] })
    case 'plugin':
      return info.tipo === 'paper'
        ? t('explorar.pluginsVaoParaAPasta')
        : t('explorar.oNaoUsaPluginsPara', { v: NOMES_TIPOS[info.tipo] })
    case 'modpack':
      return t('explorar.umModpackCriaUmServidor')
    case 'resourcepack':
      return t('explorar.umResourcePackPodeSer')
    case 'shader':
      return t('explorar.oServidorNaoUsaShaders')
    case 'datapack':
      return t('explorar.datapacksVaoParaAPasta')
  }
}

// Páginas já vistas (Fase V9): a mesma busca, filtros, página e tamanho por 5 minutos.
const GUARDAR_MS = 5 * 60_000
const guardadas = new Map<string, { quando: number; valor: ResultadoExplorar }>()
const guardada = (chave: string): ResultadoExplorar | null => {
  const g = guardadas.get(chave)
  return g && Date.now() - g.quando < GUARDAR_MS ? g.valor : null
}

function filtrosIniciais(
  tipo: TipoConteudo,
  info: InfoServidor,
  termo = '',
  fonte: Fonte = 'modrinth',
  tamanho = 24
): FiltrosExplorar {
  return {
    fonte,
    tipo,
    termo,
    versao: info.versao,
    loader: loaderDoServidor(tipo, info) && loadersDoFiltro(fonte, tipo).length ? 'servidor' : null,
    categorias: [],
    ambiente: null,
    codigoAberto: false,
    esconderInstalados: false,
    ordem: 'relevance',
    pagina: 1,
    tamanho
  }
}

export function Explorar({
  info,
  aoInstalar
}: {
  info: InfoServidor
  aoInstalar: () => Promise<void>
}): React.JSX.Element {
  const api = useApi()
  // O tamanho da página fica salvo por tela (ServSquare e PlaySquare).
  const [tamanhoSalvo, setTamanhoSalvo] = usePreferencia(
    `hubsquare:explorar-por-pagina:${info.jogador ? 'play' : 'serv'}`,
    '24'
  )
  const tamanho = tamanhoValido(Number(tamanhoSalvo))
  const [filtros, setFiltros] = useState<FiltrosExplorar>(() =>
    filtrosIniciais('mod', info, '', 'modrinth', tamanho)
  )
  const [termo, setTermo] = useState('')
  const [opcoes, setOpcoes] = useState<OpcoesExplorar | null>(null)
  const [itens, setItens] = useState<ProjetoExplorar[] | null>(null)
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [vista, setVista] = usePreferencia('servsquare:explorar-vista', 'grade')
  const [painelSalvo, setPainel] = usePreferencia('servsquare:explorar-filtros', 'aberto')
  const painel = painelSalvo === 'aberto'
  const [aberto, setAberto] = useState<ProjetoExplorar | null>(null)
  const controle = useRef<AbortController | null>(null)
  const topo = useRef<HTMLDivElement>(null)
  const rolagemAntes = useRef(0)
  // CurseForge sem a chave oficial no build (Fase L1): "em breve" no lugar da busca.
  const [temChave, setTemChave] = useState<boolean | null>(null)
  const fonte = filtros.fonte
  const semChave = fonte === 'curseforge' && temChave === false
  const pronta = fonte !== 'curseforge' || temChave === true

  useEffect(() => {
    api.temChaveCurseForge().then((r) => setTemChave(r.ok && r.valor))
  }, [api, fonte])

  // Opções reais da fonte (categorias e versões) para o tipo escolhido.
  useEffect(() => {
    if (!pronta) return
    let vivo = true
    api.opcoesExplorar(filtros.tipo, fonte).then((r) => {
      if (!vivo) return
      if (r.ok) setOpcoes(r.valor)
      else setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [api, filtros.tipo, fonte, pronta])

  // A chave da página guardada: os filtros (com página e tamanho) e o servidor ou instalação.
  const chaveDe = useCallback(
    (f: FiltrosExplorar): string => `${info.id}|${JSON.stringify(f)}`,
    [info.id]
  )

  // Só a página aberta. Trocar de página cancela o que a anterior ainda esperava: o processo
  // principal aborta os pedidos, e os cards (e as imagens) da anterior saem da tela.
  const buscar = useCallback(
    async (f: FiltrosExplorar): Promise<void> => {
      controle.current?.abort()
      const c = new AbortController()
      controle.current = c
      setErro(null)
      const pronto = guardada(chaveDe(f))
      if (pronto) {
        setCarregando(false)
        setTotal(pronto.total)
        setItens(pronto.itens)
        return
      }
      setItens(null)
      setCarregando(true)
      const r = await api.buscarExplorar(f)
      if (c.signal.aborted) return // chegou depois de outra página
      setCarregando(false)
      if (!r.ok) return setErro(r.erro)
      guardadas.set(chaveDe(f), { quando: Date.now(), valor: r.valor })
      setTotal(r.valor.total)
      setItens(r.valor.itens)
    },
    [api, chaveDe]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao mudar os filtros
    if (pronta) void buscar(filtros)
  }, [filtros, buscar, pronta])

  // Com o app parado, adianta só os dados da próxima página (as imagens, nunca).
  const alcancavel = totalAlcancavel(fonte, total)
  useEffect(() => {
    if (!itens || carregando || !pronta) return
    const proxima = { ...filtros, pagina: filtros.pagina + 1 }
    if (proxima.pagina > totalPaginas(alcancavel, filtros.tamanho)) return
    if (guardada(chaveDe(proxima))) return
    const id = requestIdleCallback(
      () =>
        void api.buscarExplorar(proxima).then((r) => {
          if (r.ok) guardadas.set(chaveDe(proxima), { quando: Date.now(), valor: r.valor })
        }),
      { timeout: 3000 }
    )
    return () => cancelIdleCallback(id)
  }, [api, alcancavel, carregando, chaveDe, filtros, itens, pronta])

  // Busca, filtro, ordem ou tamanho novos: volta para a página 1.
  function mudar(parcial: Partial<FiltrosExplorar>): void {
    setFiltros((f) => ({ ...f, ...parcial, pagina: 1 }))
  }

  // Trocar de página mantém os filtros e leva a lista para o topo.
  function irPara(pagina: number): void {
    setFiltros((f) => ({ ...f, pagina: paginaValida(pagina, alcancavel, f.tamanho) }))
    topo.current?.scrollIntoView({ block: 'start' })
  }

  // Os detalhes abrem no lugar da lista; voltar devolve a mesma página e a mesma posição.
  const rolagem = (): HTMLElement | null =>
    topo.current?.closest<HTMLElement>('.overflow-auto') ?? null
  function abrir(p: ProjetoExplorar): void {
    rolagemAntes.current = rolagem()?.scrollTop ?? 0
    setAberto(p)
  }
  function voltar(): void {
    setAberto(null)
    requestAnimationFrame(() => {
      const r = rolagem()
      if (r) r.scrollTop = rolagemAntes.current
    })
  }

  function trocarTipo(tipo: TipoConteudo): void {
    setOpcoes(null)
    setAberto(null)
    setFiltros(filtrosIniciais(tipo, info, filtros.termo, fonte, tamanho))
  }

  function trocarFonte(nova: Fonte): void {
    const tipos = TIPOS_POR_FONTE[nova]
    setOpcoes(null)
    setAberto(null)
    setItens(null)
    setErro(null)
    setTemChave(null)
    setFiltros(
      filtrosIniciais(
        tipos.includes(filtros.tipo) ? filtros.tipo : tipos[0],
        info,
        filtros.termo,
        nova,
        tamanho
      )
    )
  }

  // Modrinth deixa marcar várias categorias; CurseForge e Hangar, uma só.
  const umaCategoria = fonte !== 'modrinth'
  const rotuloCategoria = (c: string): string =>
    opcoes?.categorias.find((x) => x.nome === c)?.rotulo ?? nomeCategoria(c)
  // O Hangar só aparece em servidores Paper.
  // shortcut: no PlaySquare só o Modrinth (shaders e packs do jogador vêm só de lá); liberar o
  // CurseForge para mods quando alguém pedir.
  const fontes = info.jogador
    ? FONTES.filter((f) => f === 'modrinth')
    : FONTES.filter((f) => f !== 'hangar' || info.tipo === 'paper')

  // Etiquetas dos filtros ativos, cada uma com o jeito de tirar.
  const doServidor = loaderDoServidor(filtros.tipo, info)
  const ativos: { rotulo: string; tirar: Partial<FiltrosExplorar> }[] = [
    ...(filtros.versao
      ? [{ rotulo: t('explorar.minecraft', { versao: filtros.versao }), tirar: { versao: null } }]
      : []),
    ...(filtros.loader
      ? [
          {
            rotulo:
              filtros.loader === 'servidor'
                ? `${doServidor} (${info.jogador ? t('explorar.daInstalacao') : t('explorar.doServidor')})`
                : nomeLoader(filtros.loader),
            tirar: { loader: null }
          }
        ]
      : []),
    ...filtros.categorias.map((c) => ({
      rotulo: rotuloCategoria(c),
      tirar: { categorias: filtros.categorias.filter((x) => x !== c) }
    })),
    ...(filtros.ambiente
      ? [{ rotulo: NOMES_AMBIENTE[filtros.ambiente], tirar: { ambiente: null } }]
      : []),
    ...(filtros.codigoAberto
      ? [{ rotulo: t('explorar.codigoAberto'), tirar: { codigoAberto: false } }]
      : []),
    ...(filtros.esconderInstalados
      ? [{ rotulo: t('explorar.semOsInstalados'), tirar: { esconderInstalados: false } }]
      : [])
  ]

  const grupos = opcoes
    ? [...new Set(opcoes.categorias.map((c) => c.grupo))].map((g) => ({
        grupo: g,
        nomes: opcoes.categorias.filter((c) => c.grupo === g).map((c) => c.nome)
      }))
    : []
  const versoes =
    opcoes && !opcoes.versoes.includes(info.versao)
      ? [info.versao, ...opcoes.versoes]
      : opcoes?.versoes

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor de fonte (Fase 24), no mesmo desenho do "Grade | Lista". */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold tracking-[.02em] text-muted uppercase">
          {t('explorar.fonte')}
        </span>
        <div role="group" aria-label={t('explorar.fonte')} className="flex">
          {fontes.map((f) => (
            <Botao
              key={f}
              tamanho="pequeno"
              variante={fonte === f ? 'primario' : 'secundario'}
              aria-pressed={fonte === f}
              onClick={() => fonte !== f && trocarFonte(f)}
            >
              {NOMES_FONTES[f]}
            </Botao>
          ))}
        </div>
      </div>

      <AbasDeTipo
        rotulo={t('explorar.tipoDeConteudo')}
        abas={TIPOS_POR_FONTE[fonte]
          .filter((t) => !info.jogador || (t !== 'plugin' && t !== 'datapack'))
          .map((t) => ({ id: t, nome: NOMES_CONTEUDO[t] }))}
        ativa={filtros.tipo}
        aoEscolher={trocarTipo}
      />

      {semChave && (
        <Aviso tipo="atencao">
          <span className="flex-1">{t('explorar.paraProcurarNoCurseforgeO')}</span>
        </Aviso>
      )}

      {aberto && (
        <DetalhesDoProjeto
          key={`${aberto.fonte}:${aberto.id}`}
          fonte={aberto.fonte}
          projeto={aberto}
          tipo={filtros.tipo}
          info={info}
          aoVoltar={voltar}
          aoMudar={async (instalado) => {
            guardadas.clear() // o "Instalado" das páginas guardadas mudou
            setItens(
              (atuais) => atuais?.map((p) => (p.id === aberto.id ? { ...p, instalado } : p)) ?? null
            )
            await aoInstalar()
          }}
        />
      )}

      {/* A lista fica montada atrás dos detalhes: voltar não perde a rolagem nem os resultados. */}
      <div className={aberto || semChave ? 'hidden' : 'flex flex-col gap-4'}>
        <p className="border-l-4 border-accent bg-panel px-4 py-2 text-[13px]">
          {fraseDoTipo(filtros.tipo, info)}
          {fonte === 'curseforge' && t('explorar.noCurseforgeArquivosQueO')}
        </p>

        <BarraDeBusca
          painel={painel}
          aoAlternarPainel={() => setPainel(painel ? 'fechado' : 'aberto')}
          termo={termo}
          aoMudarTermo={setTermo}
          aoProcurar={() => mudar({ termo })}
          rotuloBusca={t('explorar.procurarNo', {
            toLowerCase: NOMES_CONTEUDO[filtros.tipo].toLowerCase(),
            v: NOMES_FONTES[fonte]
          })}
          ordens={ordens(fonte)}
          ordem={filtros.ordem}
          aoOrdenar={(o) => mudar({ ordem: o })}
          vista={vista}
          aoMudarVista={setVista}
        />

        <EtiquetasDeFiltro
          itens={ativos.map((e) => ({ rotulo: e.rotulo, aoTirar: () => mudar(e.tirar) }))}
          aoLimpar={() =>
            mudar({
              versao: null,
              loader: null,
              categorias: [],
              ambiente: null,
              codigoAberto: false,
              esconderInstalados: false
            })
          }
        />

        <div className="flex items-start gap-6">
          {painel && (
            <PainelDeFiltros>
              <GrupoFiltro titulo={t('explorar.versaoDoMinecraft')}>
                <Selecao
                  aria-label={t('explorar.versaoDoMinecraft')}
                  value={filtros.versao ?? ''}
                  onChange={(e) => mudar({ versao: e.target.value || null })}
                >
                  <option value="">{t('explorar.todas')}</option>
                  {(versoes ?? [info.versao]).map((v) => (
                    <option key={v} value={v}>
                      {v}
                      {v === info.versao ? t('explorar.doServidor2') : ''}
                    </option>
                  ))}
                </Selecao>
              </GrupoFiltro>

              {loadersDoFiltro(fonte, filtros.tipo).length > 0 && (
                <GrupoFiltro titulo={t('explorar.loader')}>
                  <Selecao
                    aria-label={t('explorar.loader')}
                    value={filtros.loader ?? ''}
                    onChange={(e) => mudar({ loader: e.target.value || null })}
                  >
                    <option value="">{t('explorar.todos')}</option>
                    {doServidor && (
                      <option value="servidor">{t('explorar.doServidor3', { doServidor })}</option>
                    )}
                    {loadersDoFiltro(fonte, filtros.tipo).map((l) => (
                      <option key={l} value={l}>
                        {nomeLoader(l)}
                      </option>
                    ))}
                  </Selecao>
                </GrupoFiltro>
              )}

              {fonte === 'modrinth' && temAmbiente(filtros.tipo) && (
                <GrupoFiltro titulo={t('explorar.ondeRoda')}>
                  <OpcaoRadio
                    nome="ambiente"
                    marcada={!filtros.ambiente}
                    aoEscolher={() => mudar({ ambiente: null })}
                  >
                    {t('explorar.qualquerLugar')}
                  </OpcaoRadio>
                  {(['servidor', 'jogador', 'ambos'] as const).map((a) => (
                    <OpcaoRadio
                      key={a}
                      nome="ambiente"
                      marcada={filtros.ambiente === a}
                      aoEscolher={() => mudar({ ambiente: a })}
                    >
                      {NOMES_AMBIENTE[a]}
                    </OpcaoRadio>
                  ))}
                </GrupoFiltro>
              )}

              <GrupoFiltro titulo={t('explorar.outros')}>
                {fonte === 'modrinth' && (
                  <CaixaSelecao
                    marcada={filtros.codigoAberto}
                    aoMudar={(v) => mudar({ codigoAberto: v })}
                  >
                    {t('explorar.soCodigoAberto')}
                  </CaixaSelecao>
                )}
                {filtros.tipo !== 'modpack' && (
                  <CaixaSelecao
                    marcada={filtros.esconderInstalados}
                    aoMudar={(v) => mudar({ esconderInstalados: v })}
                  >
                    {t('explorar.esconderOQueJaEsta')}
                  </CaixaSelecao>
                )}
              </GrupoFiltro>

              {grupos.map((g) => (
                <GrupoFiltro key={g.grupo} titulo={nomeGrupo(g.grupo)}>
                  {g.nomes.map((c) => (
                    <CaixaSelecao
                      key={c}
                      marcada={filtros.categorias.includes(c)}
                      aoMudar={(v) =>
                        mudar({
                          categorias: v
                            ? umaCategoria
                              ? [c]
                              : [...filtros.categorias, c]
                            : filtros.categorias.filter((x) => x !== c)
                        })
                      }
                    >
                      {rotuloCategoria(c)}
                    </CaixaSelecao>
                  ))}
                </GrupoFiltro>
              ))}
            </PainelDeFiltros>
          )}

          <div ref={topo} className="flex min-w-0 flex-1 scroll-mt-4 flex-col gap-3">
            <TopoDaLista
              pagina={filtros.pagina}
              tamanho={filtros.tamanho}
              total={itens ? alcancavel : 0}
              aoMudarTamanho={(t) => {
                setTamanhoSalvo(String(t))
                mudar({ tamanho: t })
              }}
            />
            {itens && muitosResultados(fonte, total) && (
              <Aviso tipo="atencao">{t('explorar.muitosResultadosUseOsFiltros')}</Aviso>
            )}
            {erro ? (
              // A página que falhou fica com o erro e o "Tentar de novo"; filtros e página continuam.
              <div className="flex flex-col items-start gap-3">
                <MensagemErro erro={erro} />
                <Botao onClick={() => void buscar(filtros)}>{t('explorar.tentarDeNovo')}</Botao>
              </div>
            ) : !itens ? (
              <EsqueletoDeCards
                vista={vista}
                quantos={Math.min(
                  filtros.tamanho,
                  Math.max(1, alcancavel - (filtros.pagina - 1) * filtros.tamanho) ||
                    filtros.tamanho
                )}
              />
            ) : !itens.length ? (
              <EstadoVazio
                icone={<IconeMods />}
                titulo={t('explorar.nadaEncontrado')}
                texto={t('explorar.tireAlgunsFiltrosOuProcure', { v: NOMES_FONTES[fonte] })}
              />
            ) : (
              <ListaDeCards vista={vista}>
                {itens.map((p) => (
                  <CardProjeto
                    key={`${p.fonte}:${p.id}`}
                    icone={p.icone}
                    titulo={p.titulo}
                    linha={t('explorar.porDownloads', {
                      autor: p.autor,
                      format: numero.format(p.downloads),
                      format2: numero.format(p.seguidores),
                      card: SEGUIDORES[p.fonte].card
                    })}
                    descricao={p.descricao}
                    vista={vista}
                    aoAbrir={() => abrir(p)}
                    etiquetas={
                      <>
                        {p.instalado && (
                          <Etiqueta tom="accent">
                            {filtros.tipo === 'shader'
                              ? t('explorar.noPacote')
                              : t('explorar.instalado')}
                          </Etiqueta>
                        )}
                        {vista === 'grade' &&
                          p.ambiente === 'jogador' &&
                          filtros.tipo !== 'shader' && (
                            <span className="text-xs text-warning">
                              <IconeAtencao className="mr-1 inline h-[1em] w-[1em] align-[-0.125em]" />
                              {t('explorar.soDoJogador')}
                            </span>
                          )}
                        {vista === 'grade' &&
                          p.categorias
                            .slice(0, 3)
                            .map((c) => <Etiqueta key={c}>{rotuloCategoria(c)}</Etiqueta>)}
                      </>
                    }
                  />
                ))}
              </ListaDeCards>
            )}
            {/* Fica enquanto a página nova carrega (com o total já conhecido): dá para trocar de
                novo, e a troca cancela a anterior (seção 6.9.2 do DESIGN). */}
            {total > 0 && !erro && (
              <BarraDePaginas
                pagina={filtros.pagina}
                tamanho={filtros.tamanho}
                total={alcancavel}
                aoIr={irPara}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
