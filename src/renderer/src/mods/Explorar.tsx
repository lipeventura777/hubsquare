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
import { IconeMods } from '../componentes/icones'
import { Aviso, Botao, CaixaSelecao, EstadoVazio, OpcaoRadio, Selecao } from '../componentes/ui'
import { abrirTela } from '../estrutura/navegar'
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

const numero = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

// As mesmas ordenações nas três fontes; o processo principal traduz para cada API.
function ordens(fonte: Fonte): { valor: OrdemExplorar; rotulo: string }[] {
  return [
    { valor: 'relevance', rotulo: fonte === 'modrinth' ? 'Relevância' : 'Popularidade' },
    { valor: 'downloads', rotulo: 'Downloads' },
    { valor: 'follows', rotulo: SEGUIDORES[fonte].ordem },
    { valor: 'newest', rotulo: 'Mais recentes' },
    { valor: 'updated', rotulo: 'Atualizados recentemente' }
  ]
}

const SEGUIDORES: Record<Fonte, { ordem: string; card: string }> = {
  modrinth: { ordem: 'Seguidores', card: 'seguidores' },
  curseforge: { ordem: 'Avaliação', card: 'curtidas' },
  hangar: { ordem: 'Estrelas', card: 'estrelas' }
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
  if (tipo === 'plugin') return info.tipo === 'paper' ? 'Paper, Spigot e Bukkit' : null
  return null
}

// Para onde vai cada tipo, numa frase (requisito da Fase 23).
function fraseDoTipo(tipo: TipoConteudo, info: InfoServidor): string {
  // PlaySquare (Fase P3): tudo vai para a instalação do jogador.
  if (info.jogador) {
    switch (tipo) {
      case 'mod':
        return ehDeMods(info)
          ? `Mods vão para a pasta mods da instalação "${info.nome}", com as dependências.`
          : 'Esta instalação é Vanilla: mods precisam de Fabric, Forge ou NeoForge. Crie outra instalação em Instalações.'
      case 'shader':
        return 'Shaders vão para a pasta shaderpacks. O Iris (ou o Oculus, no Forge) é instalado junto.'
      case 'resourcepack':
        return 'Resource packs vão para a pasta resourcepacks da instalação.'
      case 'modpack':
        return 'Um modpack cria uma instalação nova; esta não muda.'
      default:
        return 'Não serve para o jogo do jogador.'
    }
  }
  switch (tipo) {
    case 'mod':
      return ehDeMods(info)
        ? 'Mods que rodam no servidor vão para a pasta mods; os que são só do jogador vão para o Pacote pros amigos.'
        : `O ${NOMES_TIPOS[info.tipo]} não usa mods: para instalar, troque para Fabric, Forge ou NeoForge na tela Software.`
    case 'plugin':
      return info.tipo === 'paper'
        ? 'Plugins vão para a pasta plugins do servidor.'
        : `O ${NOMES_TIPOS[info.tipo]} não usa plugins: para instalar, troque para Paper na tela Software.`
    case 'modpack':
      return 'Um modpack cria um servidor novo; o servidor atual não muda.'
    case 'resourcepack':
      return 'Um resource pack pode ser o pacote do servidor (vai para o server.properties) ou ir para o Pacote pros amigos.'
    case 'shader':
      return 'O servidor não usa shaders: eles vão para o Pacote pros amigos, na pasta shaderpacks.'
    case 'datapack':
      return 'Datapacks vão para a pasta datapacks do mundo ativo.'
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
  // CurseForge sem a chave do usuário: aviso com "Configurar" no lugar da busca.
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
    ...(filtros.versao ? [{ rotulo: `Minecraft ${filtros.versao}`, tirar: { versao: null } }] : []),
    ...(filtros.loader
      ? [
          {
            rotulo:
              filtros.loader === 'servidor'
                ? `${doServidor} (${info.jogador ? 'da instalação' : 'do servidor'})`
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
    ...(filtros.codigoAberto ? [{ rotulo: 'Código aberto', tirar: { codigoAberto: false } }] : []),
    ...(filtros.esconderInstalados
      ? [{ rotulo: 'Sem os instalados', tirar: { esconderInstalados: false } }]
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
        <span className="text-xs font-bold tracking-[.02em] text-muted uppercase">Fonte</span>
        <div role="group" aria-label="Fonte" className="flex">
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
        rotulo="Tipo de conteúdo"
        abas={TIPOS_POR_FONTE[fonte]
          .filter((t) => !info.jogador || (t !== 'plugin' && t !== 'datapack'))
          .map((t) => ({ id: t, nome: NOMES_CONTEUDO[t] }))}
        ativa={filtros.tipo}
        aoEscolher={trocarTipo}
      />

      {semChave && (
        <Aviso tipo="atencao">
          <span className="flex-1">
            Para procurar no CurseForge, o app precisa da sua chave da API do CurseForge (é grátis e
            leva alguns dias para aprovar).
          </span>
          <Botao
            variante="atencao"
            tamanho="pequeno"
            onClick={() => abrirTela('Opções', 'Integrações')}
          >
            Configurar
          </Botao>
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
          {fonte === 'curseforge' &&
            ' No CurseForge, arquivos que o autor não deixa outros apps baixarem aparecem com "Baixe pelo site".'}
        </p>

        <BarraDeBusca
          painel={painel}
          aoAlternarPainel={() => setPainel(painel ? 'fechado' : 'aberto')}
          termo={termo}
          aoMudarTermo={setTermo}
          aoProcurar={() => mudar({ termo })}
          rotuloBusca={`Procurar ${NOMES_CONTEUDO[filtros.tipo].toLowerCase()} no ${NOMES_FONTES[fonte]}`}
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
              <GrupoFiltro titulo="Versão do Minecraft">
                <Selecao
                  aria-label="Versão do Minecraft"
                  value={filtros.versao ?? ''}
                  onChange={(e) => mudar({ versao: e.target.value || null })}
                >
                  <option value="">Todas</option>
                  {(versoes ?? [info.versao]).map((v) => (
                    <option key={v} value={v}>
                      {v}
                      {v === info.versao ? ' (do servidor)' : ''}
                    </option>
                  ))}
                </Selecao>
              </GrupoFiltro>

              {loadersDoFiltro(fonte, filtros.tipo).length > 0 && (
                <GrupoFiltro titulo="Loader">
                  <Selecao
                    aria-label="Loader"
                    value={filtros.loader ?? ''}
                    onChange={(e) => mudar({ loader: e.target.value || null })}
                  >
                    <option value="">Todos</option>
                    {doServidor && <option value="servidor">Do servidor ({doServidor})</option>}
                    {loadersDoFiltro(fonte, filtros.tipo).map((l) => (
                      <option key={l} value={l}>
                        {nomeLoader(l)}
                      </option>
                    ))}
                  </Selecao>
                </GrupoFiltro>
              )}

              {fonte === 'modrinth' && temAmbiente(filtros.tipo) && (
                <GrupoFiltro titulo="Onde roda">
                  <OpcaoRadio
                    nome="ambiente"
                    marcada={!filtros.ambiente}
                    aoEscolher={() => mudar({ ambiente: null })}
                  >
                    Qualquer lugar
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

              <GrupoFiltro titulo="Outros">
                {fonte === 'modrinth' && (
                  <CaixaSelecao
                    marcada={filtros.codigoAberto}
                    aoMudar={(v) => mudar({ codigoAberto: v })}
                  >
                    Só código aberto
                  </CaixaSelecao>
                )}
                {filtros.tipo !== 'modpack' && (
                  <CaixaSelecao
                    marcada={filtros.esconderInstalados}
                    aoMudar={(v) => mudar({ esconderInstalados: v })}
                  >
                    Esconder o que já está instalado
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
              <Aviso tipo="atencao">Muitos resultados. Use os filtros para refinar a busca.</Aviso>
            )}
            {erro ? (
              // A página que falhou fica com o erro e o "Tentar de novo"; filtros e página continuam.
              <div className="flex flex-col items-start gap-3">
                <MensagemErro erro={erro} />
                <Botao onClick={() => void buscar(filtros)}>Tentar de novo</Botao>
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
                titulo="Nada encontrado"
                texto={`Tire alguns filtros ou procure outro nome, em inglês, como está no ${NOMES_FONTES[fonte]}.`}
              />
            ) : (
              <ListaDeCards vista={vista}>
                {itens.map((p) => (
                  <CardProjeto
                    key={`${p.fonte}:${p.id}`}
                    icone={p.icone}
                    titulo={p.titulo}
                    linha={`por ${p.autor} · ${numero.format(p.downloads)} downloads · ${numero.format(p.seguidores)} ${SEGUIDORES[p.fonte].card}`}
                    descricao={p.descricao}
                    vista={vista}
                    aoAbrir={() => abrir(p)}
                    etiquetas={
                      <>
                        {p.instalado && (
                          <Etiqueta tom="accent">
                            {filtros.tipo === 'shader' ? 'No pacote' : 'Instalado'}
                          </Etiqueta>
                        )}
                        {vista === 'grade' &&
                          p.ambiente === 'jogador' &&
                          filtros.tipo !== 'shader' && (
                            <span className="text-xs text-warning">⚠ Só do jogador</span>
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
            {itens && !erro && (
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
