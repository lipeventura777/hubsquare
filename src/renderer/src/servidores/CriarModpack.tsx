import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NOMES_TIPOS,
  type AnaliseModpack,
  type ErroTela,
  type InfoServidor,
  type ModpackBusca,
  type Progresso
} from '../../../shared/tipos'
import { BarraDeEtapas } from '../assistente/Assistente'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeMods } from '../componentes/icones'
import { classesBotao } from '../componentes/estilos'
import { Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Aviso, Botao, CaixaSelecao, Campo, EstadoVazio, Secao } from '../componentes/ui'
import { IconeProjeto } from '../mods/TelaMods'
import { ListaManuais, separarManuais } from '../mods/ListaManuais'
import { AndamentoModpack as Andamento } from '../componentes/AndamentoModpack'
import type { Fonte } from '../../../shared/fontes'
import { BarraDePaginas, TopoDaLista } from '../componentes/Paginas'
import { usePreferencia } from '../mods/partesExplorar'
import { tamanhoValido } from '../../../shared/paginaRegras'
import { t, idiomaAtual } from '../../../shared/i18n'

const ETAPAS = [
  t('criarModpack.modpack'),
  t('criarModpack.confirmar'),
  t('criarModpack.pronto')
] as const
const numero = new Intl.NumberFormat(idiomaAtual(), {
  notation: 'compact',
  maximumFractionDigits: 1
})

function megas(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`
}

// "+ Criar" › "A partir de um modpack" (Fase 17). Mesmo visual do assistente (DESIGN.md, 6.10).
export function CriarModpack({
  projetoInicial,
  aoConcluir,
  aoCancelar
}: {
  projetoInicial?: { id: string; fonte: Fonte } // vindo do Explorar: já abre a confirmação
  aoConcluir: () => void
  aoCancelar: () => void
}): React.JSX.Element {
  const [etapa, setEtapa] = useState(0)
  const [termo, setTermo] = useState('')
  const [itens, setItens] = useState<ModpackBusca[] | null>(null)
  const [total, setTotal] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [abrindo, setAbrindo] = useState<string | null>(null) // id do pack (ou "arquivo")
  const [analise, setAnalise] = useState<AnaliseModpack | null>(null)
  const [nome, setNome] = useState('')
  const [eula, setEula] = useState(false)
  const [criando, setCriando] = useState(false)
  const [criado, setCriado] = useState<InfoServidor | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  // Páginas (Fase V9): só a página aberta; o tamanho fica salvo. A última busca feita fica em
  // "procurado" (o campo pode mudar sem procurar de novo).
  const [tamanhoSalvo, setTamanhoSalvo] = usePreferencia('hubsquare:modpacks-por-pagina', '24')
  const tamanho = tamanhoValido(Number(tamanhoSalvo))
  const [busca, setBusca] = useState({ procurado: '', pagina: 1 })
  const topo = useRef<HTMLDivElement>(null)
  const pedido = useRef(0)

  const buscar = useCallback(
    async (texto: string, pagina: number, porPagina: number): Promise<void> => {
      const meu = ++pedido.current
      setBuscando(true)
      setErro(null)
      setItens(null)
      const r = await window.api.buscarModpacks(texto, pagina, porPagina)
      if (meu !== pedido.current) return // chegou depois de outra página
      setBuscando(false)
      if (!r.ok) return setErro(r.erro)
      setTotal(r.valor.total)
      setItens(r.valor.itens)
    },
    []
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao mudar a página
    void buscar(busca.procurado, busca.pagina, tamanho)
  }, [buscar, busca, tamanho])

  function escolhido(a: AnaliseModpack | null): void {
    if (!a) return
    setAnalise(a)
    setNome(a.nomeSugerido)
    setEula(false)
    setEtapa(1)
  }

  async function abrirDoModrinth(id: string, fonte: Fonte = 'modrinth'): Promise<void> {
    setAbrindo(id)
    setErro(null)
    const r =
      fonte === 'curseforge'
        ? await window.api.analisarModpackCurseForge(id)
        : await window.api.analisarModpackModrinth(id)
    setAbrindo(null)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro.cancelado ? null : r.erro)
    escolhido(r.valor)
  }

  // Vindo do Explorar: analisa o pack escolhido lá e pula para Confirmar.
  const inicial = useRef(projetoInicial)
  useEffect(() => {
    const pack = inicial.current
    inicial.current = undefined
    if (pack) void abrirDoModrinth(pack.id, pack.fonte)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na primeira vez
  }, [])

  async function abrirArquivo(): Promise<void> {
    setAbrindo('arquivo')
    setErro(null)
    const r = await window.api.analisarModpackArquivo()
    setAbrindo(null)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro.cancelado ? null : r.erro)
    escolhido(r.valor)
  }

  async function criar(): Promise<void> {
    if (!analise) return
    setErro(null)
    setCriando(true)
    const r = await window.api.criarDeModpack({ token: analise.token, nome, aceitouEula: eula })
    setCriando(false)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro.cancelado ? null : r.erro)
    setCriado(r.valor)
    setEtapa(2)
  }

  const principal =
    etapa === 1
      ? {
          texto: criando ? t('criarModpack.criando') : t('criarModpack.criarServidor'),
          aoClicar: criar,
          ativo: eula && !!nome.trim() && !criando
        }
      : etapa === 2
        ? { texto: t('criarModpack.irParaOPainel'), aoClicar: aoConcluir, ativo: true }
        : null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="m-2.5 mb-0 flex shrink-0 flex-col gap-5 bg-panel px-10 py-6">
        <div className="flex items-center gap-3">
          <IconeMods className="h-8 w-8 text-accent" />
          <div>
            <div className="texto-pixel text-[22px]">{t('criarModpack.servidorAPartirDeUm')}</div>
            <div className="text-[13px] text-muted">{t('criarModpack.oAppInstalaOLoader')}</div>
          </div>
        </div>
        <BarraDeEtapas etapa={etapa} etapas={ETAPAS} />
      </header>

      <div className="vidro-painel m-2.5 min-h-0 flex-1 overflow-auto">
        <div
          className={`mx-auto flex w-full flex-col gap-10 p-10 ${etapa === 0 ? 'max-w-[1200px]' : 'max-w-[720px]'}`}
        >
          {etapa === 0 && (
            <Secao titulo={t('criarModpack.escolhaOModpack')}>
              <div className="flex flex-wrap gap-2">
                <form
                  className="flex min-w-[320px] flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setBusca({ procurado: termo, pagina: 1 }) // busca nova volta para a página 1
                  }}
                >
                  <Campo
                    aria-label={t('criarModpack.procurarModpacks')}
                    placeholder={t('criarModpack.procurarModpacksNoModrinth')}
                    value={termo}
                    maxLength={100}
                    onChange={(e) => setTermo(e.target.value)}
                    className="flex-1"
                  />
                  <Botao variante="primario" type="submit" disabled={buscando}>
                    {t('criarModpack.procurar')}
                  </Botao>
                </form>
                <Botao onClick={abrirArquivo} disabled={!!abrindo}>
                  {abrindo === 'arquivo'
                    ? t('criarModpack.abrindo')
                    : t('criarModpack.abrirArquivoMrpack')}
                </Botao>
              </div>
              {abrindo && <Andamento progresso={progresso} />}
              {erro && <MensagemErro erro={erro} />}
              <div ref={topo} className="scroll-mt-4">
                <TopoDaLista
                  pagina={busca.pagina}
                  tamanho={tamanho}
                  total={itens ? total : 0}
                  aoMudarTamanho={(t) => {
                    setTamanhoSalvo(String(t))
                    setBusca((b) => ({ ...b, pagina: 1 }))
                  }}
                />
              </div>
              {!itens ? (
                <Esqueleto linhas={6} />
              ) : !itens.length ? (
                <EstadoVazio
                  icone={<IconeMods />}
                  titulo={t('criarModpack.nenhumModpackEncontrado')}
                  texto={t('criarModpack.tenteOutroNomeComoEsta')}
                />
              ) : (
                <ul className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[1300px]:grid-cols-3">
                  {itens.map((p) => (
                    <li
                      key={p.id}
                      className="anim-item flex gap-3 border border-linha bg-panel p-3 transition-colors duration-(--dur-fast) hover:border-muted"
                    >
                      <IconeProjeto url={p.icone} titulo={p.titulo} tam={56} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-sm font-bold" title={p.titulo}>
                          {p.titulo}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {p.versaoJogo
                            ? t('criarModpack.minecraft', { versaoJogo: p.versaoJogo })
                            : t('criarModpack.minecraft2')}{' '}
                          · {p.loaders.map((l) => NOMES_TIPOS[l]).join(', ')}{' '}
                          {t('criarModpack.downloads', { format: numero.format(p.downloads) })}
                        </p>
                        <p className="line-clamp-2 text-[13px]">{p.descricao}</p>
                        <Botao
                          variante="primario"
                          tamanho="pequeno"
                          className="mt-1 self-start"
                          disabled={!!abrindo}
                          onClick={() => abrirDoModrinth(p.id)}
                        >
                          {abrindo === p.id
                            ? t('criarModpack.baixando')
                            : t('criarModpack.escolher')}
                        </Botao>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {itens && (
                <BarraDePaginas
                  pagina={busca.pagina}
                  tamanho={tamanho}
                  total={total}
                  aoIr={(p) => {
                    setBusca((b) => ({ ...b, pagina: p }))
                    topo.current?.scrollIntoView({ block: 'start' })
                  }}
                />
              )}
            </Secao>
          )}

          {etapa === 1 && analise && (
            <>
              <Secao titulo={t('criarModpack.modpack')}>
                <CardPainel titulo={`${analise.nome} ${analise.versaoPack}`}>
                  <div className="flex gap-4">
                    <IconeProjeto url={analise.icone} titulo={analise.nome} tam={72} />
                    <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                      <dt className="text-muted">{t('criarModpack.jogo')}</dt>
                      <dd>{t('criarModpack.minecraft', { versaoJogo: analise.versaoJogo })}</dd>
                      <dt className="text-muted">{t('criarModpack.loader')}</dt>
                      <dd>
                        {NOMES_TIPOS[analise.tipo]} {analise.versaoLoader}
                      </dd>
                      <dt className="text-muted">{t('criarModpack.mods')}</dt>
                      <dd>
                        {t('criarModpack.noServidorArquivosParaBaixar', {
                          mods: analise.mods,
                          arquivos: analise.arquivos,
                          megas: megas(analise.tamanho)
                        })}
                      </dd>
                    </dl>
                  </div>
                  {analise.resumo && (
                    <p className="mt-3 text-[13px] text-muted">{analise.resumo}</p>
                  )}
                </CardPainel>
                <Aviso tipo={analise.ram.explicacao.includes('lento') ? 'atencao' : 'sucesso'}>
                  {t('criarModpack.daParaMudarDepoisEm', { explicacao: analise.ram.explicacao })}
                </Aviso>
                <ListaManuais
                  itens={separarManuais(analise.manuais).comAssistente}
                  texto={t('criarModpack.osAutoresDestesModsNao')}
                />
                <ListaManuais
                  itens={separarManuais(analise.manuais).soLink}
                  texto={t('criarModpack.osAutoresDestesModsNao2')}
                />
              </Secao>
              <Secao titulo={t('criarModpack.nomeDoServidor')}>
                <Campo
                  aria-label={t('criarModpack.nomeDoServidor')}
                  value={nome}
                  maxLength={32}
                  disabled={criando}
                  onChange={(e) => setNome(e.target.value)}
                />
              </Secao>
              <Secao titulo={t('criarModpack.termosDeUsoDoJogo')}>
                <p className="text-[13px] text-muted">
                  {t('criarModpack.paraRodarUmServidorVoce')}
                </p>
                <CaixaSelecao marcada={eula} disabled={criando} aoMudar={setEula}>
                  {t('criarModpack.liEAceitoO')}{' '}
                  <a
                    href="https://aka.ms/MinecraftEULA"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t('criarModpack.eulaDoMinecraft')}
                  </a>
                </CaixaSelecao>
                {criando && <Andamento progresso={progresso} />}
              </Secao>
              {erro && (
                <MensagemErro
                  erro={erro}
                  aoTentarDeNovo={erro.falhas?.length ? criar : undefined}
                />
              )}
            </>
          )}

          {etapa === 2 && criado && (
            <Secao titulo={t('criarModpack.tudoPronto')}>
              <Aviso tipo="sucesso">
                {t('criarModpack.oServidorFoiCriadoAgora', {
                  nome: criado.nome,
                  nome2: analise?.nome,
                  v: NOMES_TIPOS[criado.tipo],
                  versao: criado.versao
                })}
              </Aviso>
              {analise && (
                <ListaManuais
                  itens={separarManuais(analise.manuais).soLink}
                  texto={t('criarModpack.faltaBaixarPeloSiteE')}
                />
              )}
            </Secao>
          )}
        </div>
      </div>

      <footer className="m-2.5 mt-0 flex h-16 shrink-0 items-center justify-between bg-panel px-10">
        {etapa === 2 ? (
          <span />
        ) : etapa === 0 ? (
          <Botao onClick={aoCancelar} disabled={!!abrindo}>
            {t('criarModpack.cancelar')}
          </Botao>
        ) : (
          <Botao
            onClick={() => {
              if (analise) void window.api.descartarModpack(analise.token)
              setAnalise(null)
              setErro(null)
              setEtapa(0)
            }}
            disabled={criando}
          >
            {t('criarModpack.voltar')}
          </Botao>
        )}
        {principal && (
          <button
            type="button"
            onClick={principal.ativo ? principal.aoClicar : undefined}
            disabled={!principal.ativo}
            className={classesBotao('primario', 'grande')}
          >
            <span className={criando ? 'pontos' : ''}>{principal.texto}</span>
          </button>
        )}
      </footer>
    </div>
  )
}
