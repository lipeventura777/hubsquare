import { useCallback, useEffect, useRef, useState } from 'react'
import { paginaValida, tamanhoValido } from '../../../shared/paginaRegras'
import { BarraDePaginas, TopoDaLista } from '../componentes/Paginas'
import { useApi } from '../componentes/api'
import { useAvisosOcultos } from './FraseCompat'
import {
  EXTRAS_TIPOS,
  type CategoriaInstalado,
  type ErroTela,
  type EstadoServidor,
  type FonteInstalado,
  type InfoServidor,
  type ItemInstalado,
  type ItemRemovido,
  type ListaInstalados,
  CORES_ETIQUETA,
  type CorEtiqueta,
  type CorrecaoMod,
  type PerfilMods,
  type PlanoMods,
  type Progresso,
  type Resultado,
  type TravamentoMods
} from '../../../shared/tipos'
import { dependentes } from '../../../shared/dependentes'
import { MensagemErro } from '../componentes/MensagemErro'
import { dataHora, tamanho } from '../componentes/formato'
import { IconeMods, IconeAtencao } from '../componentes/icones'
import { CardPainel } from '../componentes/paineis'
import {
  Aviso,
  Botao,
  CaixaSelecao,
  Campo,
  Dialogo,
  EstadoVazio,
  Interruptor,
  OpcaoRadio,
  Selecao
} from '../componentes/ui'
import { CabecalhoDetalhes, CardAcao, DetalhesDoProjeto } from './DetalhesProjeto'
import { DialogoPlano } from './DialogoPlano'
import { COR_ETIQUETA } from './etiquetas'
import { PainelMod } from './PainelMod'
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

// Aba Instalados da tela Mods (Fase 23.2): tudo o que o servidor tem, com as mesmas peças do
// Explorar. Remover vai para Removidos recentemente (7 dias), com "Desfazer".

const NOMES_FONTE: Record<FonteInstalado, string> = {
  modrinth: t('instalados.modrinth'),
  curseforge: 'CurseForge',
  hangar: t('instalados.hangar'),
  manual: t('instalados.manual')
}

type Ordem = 'nome' | 'data' | 'tamanho'
const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'nome', rotulo: t('instalados.nome') },
  { valor: 'data', rotulo: t('instalados.dataDeInstalacao') },
  { valor: 'tamanho', rotulo: t('instalados.tamanho') }
]

const PASTA_NO_PACOTE: Record<string, string> = {
  shader: 'shaderpacks',
  resourcepack: 'resourcepacks',
  mod: 'mods'
}

function nomeDaAba(c: CategoriaInstalado, info: InfoServidor): string {
  if (info.jogador && c === 'amigos') return t('instalados.shadersEResourcePacks')
  switch (c) {
    case 'extras':
      return EXTRAS_TIPOS[info.tipo] === 'plugins' ? t('instalados.plugins') : t('instalados.mods')
    case 'datapack':
      return t('instalados.datapacks')
    case 'resourcepack':
      return t('instalados.resourcePackDoServidor')
    case 'amigos':
      return t('instalados.pacoteProsAmigos')
    case 'modpack':
      return t('instalados.modpack')
    case 'outros':
      return t('instalados.outros')
  }
}

function fraseDaAba(c: CategoriaInstalado, info: InfoServidor): string {
  // PlaySquare (Fase P3): a mesma aba, para a instalação do jogador.
  if (info.jogador) {
    if (c === 'extras') return t('instalados.modsDaPastaModsDa')
    if (c === 'amigos') return t('instalados.shadersEResourcePacksDa')
    if (c === 'outros') return t('instalados.arquivosNaPastaModsQue')
  }
  switch (c) {
    case 'extras':
      return t('instalados.arquivosDaPastaDoServidor', { v: EXTRAS_TIPOS[info.tipo] })
    case 'datapack':
      return t('instalados.datapacksDaPastaDatapacksDe')
    case 'resourcepack':
      return t('instalados.oResourcePackQueO')
    case 'amigos':
      return t('instalados.shadersResourcePacksEMods')
    case 'modpack':
      return t('instalados.oModpackDeOndeEste')
    case 'outros':
      return t('instalados.arquivosNasPastasModsPlugins')
  }
}

// Onde o item está, para o diálogo dizer exatamente o que sai.
function onde(i: ItemInstalado): string {
  if (i.categoria === 'resourcepack') return 'server.properties (resource-pack)'
  if (i.categoria === 'amigos' && i.caminho) return i.caminho
  if (i.categoria === 'amigos')
    return t('instalados.pacoteProsAmigos2', { v: PASTA_NO_PACOTE[i.tipo] ?? 'mods' })
  return i.caminho ?? t('instalados.esperaParaEntrarAoDesligar')
}

function detalheDoCard(i: ItemInstalado): string | undefined {
  if (i.categoria === 'datapack' || (i.categoria === 'outros' && i.mundo)) {
    return t('instalados.mundo', {
      mundo: i.mundo,
      v: i.mundoAtivo ? ' (ativo)' : t('instalados.naoEstaAtivo')
    })
  }
  if (i.categoria === 'resourcepack')
    return i.obrigatorio
      ? t('instalados.obrigatorioParaEntrar')
      : t('instalados.opcionalParaOsJogadores')
  if (i.categoria === 'amigos')
    return t('instalados.vaiNaPastaDoPacote', { v: PASTA_NO_PACOTE[i.tipo] ?? 'mods' })
  if (i.categoria === 'outros') return i.caminho ?? undefined
  return undefined
}

const ehArquivo = (i: ItemInstalado): boolean =>
  i.categoria === 'extras' || i.categoria === 'datapack' || i.categoria === 'outros'

export function Instalados({
  info,
  estado,
  aoMudar
}: {
  info: InfoServidor
  estado: EstadoServidor
  aoMudar: () => Promise<void>
}): React.JSX.Element {
  const api = useApi()
  const ligado = estado !== 'desligado'
  const [avisosOcultos] = useAvisosOcultos()
  const [lista, setLista] = useState<ListaInstalados | null>(null)
  const [removidos, setRemovidos] = useState<ItemRemovido[]>([])
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aba, setAba] = useState<CategoriaInstalado>(
    EXTRAS_TIPOS[info.tipo] ? 'extras' : info.jogador ? 'amigos' : 'datapack'
  )
  const [termo, setTermo] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('nome')
  const [fonte, setFonte] = useState<FonteInstalado | null>(null)
  const [situacao, setSituacao] = useState<'ativos' | 'desativados' | null>(null)
  const [comAtualizacao, setComAtualizacao] = useState(false)
  const [mundo, setMundo] = useState<string | null>(null)
  const [vista, setVista] = usePreferencia('servsquare:instalados-vista', 'grade')
  const [painelSalvo, setPainel] = usePreferencia('servsquare:instalados-filtros', 'aberto')
  const painel = painelSalvo === 'aberto'
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [confirmar, setConfirmar] = useState<ItemInstalado[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [feito, setFeito] = useState<{ texto: string; lote: string } | null>(null)
  const [aberto, setAberto] = useState<ItemInstalado | null>(null)
  // Páginas na memória (Fase V9): o tamanho fica salvo por tela; a página volta para a 1 quando
  // a aba, a busca, um filtro, a ordem ou o tamanho mudam (a chave abaixo).
  const [tamanhoSalvo, setTamanhoSalvo] = usePreferencia(
    `hubsquare:instalados-por-pagina:${info.jogador ? 'play' : 'serv'}`,
    '24'
  )
  const tamanhoPagina = tamanhoValido(Number(tamanhoSalvo))
  const [paginaDe, setPaginaDe] = useState({ chave: '', pagina: 1 })
  const topo = useRef<HTMLDivElement>(null)
  const rolagemAntes = useRef<number | null>(null)
  // Voltar dos detalhes: a lista reaparece na mesma posição da rolagem.
  useEffect(() => {
    if (aberto || rolagemAntes.current === null) return
    const r = topo.current?.closest<HTMLElement>('.overflow-auto')
    if (r) r.scrollTop = rolagemAntes.current
    rolagemAntes.current = null
  }, [aberto])
  const [agora, setAgora] = useState(() => Date.now())
  // Fase 25
  const [modAberto, setModAberto] = useState<string | null>(null) // painel lateral (chave)
  const [comProblema, setComProblema] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
  const [corFiltro, setCorFiltro] = useState<CorEtiqueta | null>(null)
  const [plano, setPlano] = useState<PlanoMods | null>(null)
  const [instalando, setInstalando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [travamento, setTravamento] = useState<TravamentoMods | null>(null)
  const [suspeitos, setSuspeitos] = useState<Set<string>>(new Set())
  const [perfis, setPerfis] = useState<PerfilMods[]>([])
  const [nomePerfil, setNomePerfil] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const deMods = !!EXTRAS_TIPOS[info.tipo]

  useEffect(() => api.aoProgredir(setProgresso), [api])

  const carregar = useCallback(async (): Promise<void> => {
    const [r, rem] = await Promise.all([api.listarTudoInstalado(), api.listarRemovidos()])
    setAgora(Date.now()) // para "some em N dias"
    if (r.ok) {
      setLista(r.valor)
      setErro(null)
      // O item aberto nos detalhes segue a lista (ex.: passou a "Será removido ao desligar").
      setAberto((a) => (a ? (r.valor.itens.find((i) => i.chave === a.chave) ?? null) : null))
    } else setErro(r.erro)
    if (rem.ok) setRemovidos(rem.valor)
    if (EXTRAS_TIPOS[info.tipo]) {
      const [t, pf] = await Promise.all([api.travamentoMods(), api.listarPerfisMods()])
      if (t.ok) {
        setTravamento(t.valor)
        setSuspeitos(new Set(t.valor?.suspeitos.map((x) => x.chave) ?? []))
      }
      if (pf.ok) setPerfis(pf.valor)
    }
  }, [api, info.tipo])

  // Ao desligar, as remoções agendadas acontecem logo depois do backup.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- relê quando o servidor muda de estado
    void carregar()
    if (estado !== 'desligado') return
    const t = setTimeout(() => void carregar(), 3000)
    return () => clearTimeout(t)
  }, [estado, carregar])
  useEffect(() => api.aoMudarBackups(() => void carregar()), [api, carregar])

  async function depoisDeMudar(): Promise<void> {
    await Promise.all([carregar(), aoMudar()])
  }

  async function remover(itens: ItemInstalado[]): Promise<void> {
    setOcupado(true)
    setErro(null)
    const r = await api.removerInstalados(
      itens.map(({ chave, titulo, categoria }) => ({ chave, titulo, categoria }))
    )
    setOcupado(false)
    setConfirmar(null)
    if (!r.ok) {
      setErro(r.erro)
      await depoisDeMudar()
      return
    }
    const { removidos: n, agendados, lote } = r.valor
    setSelecionados(new Set())
    setFeito({
      lote,
      texto: [
        n && `${n} ${n === 1 ? 'item removido' : t('instalados.itensRemovidos')}.`,
        agendados &&
          t('instalados.aoDesligarOServidor', {
            agendados,
            v: agendados === 1 ? t('instalados.seraRemovido') : t('instalados.seraoRemovidos')
          }),
        t('instalados.ficaTudo7DiasEm')
      ]
        .filter(Boolean)
        .join(' ')
    })
    await depoisDeMudar()
  }

  async function desfazer(): Promise<void> {
    if (!feito) return
    const r = await api.desfazerRemocao(feito.lote)
    setFeito(null)
    if (!r.ok) setErro(r.erro)
    await depoisDeMudar()
  }

  async function restaurar(id: string): Promise<void> {
    setErro(null)
    const r = await api.restaurarRemovido(id)
    if (!r.ok) setErro(r.erro)
    await depoisDeMudar()
  }

  async function alternar(i: ItemInstalado, ativo: boolean): Promise<void> {
    const r = await api.alternarMod(i.chave.slice('extras:'.length), ativo)
    if (!r.ok) setErro(r.erro)
    await depoisDeMudar()
  }

  const arquivoDe = (i: ItemInstalado): string => i.chave.slice('extras:'.length)

  async function rodar(acao: () => Promise<Resultado<unknown>>, depois?: string): Promise<boolean> {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(false)
    setProgresso(null)
    if (!r.ok) setErro(r.erro)
    else if (depois) setAviso(depois)
    await depoisDeMudar()
    return r.ok
  }

  const aoDesligar = ligado ? t('instalados.comOServidorLigadoVale') : ''

  // Correção de um problema com um clique.
  async function corrigir(c: CorrecaoMod): Promise<void> {
    setErro(null)
    if (c.tipo === 'instalar') {
      setOcupado(true)
      const r = c.projeto ? await api.planejarMod(c.id) : await api.planejarModPorId(c.id)
      setOcupado(false)
      if (!r.ok) return setErro(r.erro)
      setPlano(r.valor)
      return
    }
    const alvo = lista?.itens.find((i) => i.chave === c.chave)
    if (!alvo) return
    if (c.tipo === 'remover') return setConfirmar([alvo])
    if (c.tipo === 'desativar') {
      await rodar(
        () => api.alternarMod(arquivoDe(alvo), false),
        `${alvo.titulo} desativado.${aoDesligar}`
      )
      return
    }
    await rodar(
      () => api.trocarParaCompativel(arquivoDe(alvo)),
      t('instalados.trocadoParaUmaVersaoCompativel', { titulo: alvo.titulo, aoDesligar })
    )
  }

  async function instalarPlano(): Promise<void> {
    if (!plano) return
    setInstalando(true)
    const r = await api.instalarMods(plano.token)
    setInstalando(false)
    setProgresso(null)
    setPlano(null)
    if (!r.ok) setErro(r.erro)
    else setAviso(t('instalados.instalado', { aoDesligar }))
    await depoisDeMudar()
  }

  // Ações em lote nos mods/plugins selecionados.
  async function emLote(
    acao: 'ativar' | 'desativar' | 'atualizar',
    mods: ItemInstalado[]
  ): Promise<void> {
    if (acao === 'atualizar') {
      const arquivos = mods.filter((m) => m.atualizacao).map(arquivoDe)
      await rodar(() => api.atualizarMods(arquivos), `${arquivos.length} atualizados.${aoDesligar}`)
    } else {
      const quer = acao === 'ativar'
      const mudar = mods.filter((m) => m.ativo !== quer)
      await rodar(
        async () => {
          for (const m of mudar) {
            const r = await api.alternarMod(arquivoDe(m), quer)
            if (!r.ok) return r
          }
          return { ok: true, valor: undefined }
        },
        `${mudar.length} ${quer ? t('instalados.ativados') : t('instalados.desativados')}.${aoDesligar}`
      )
    }
    setSelecionados(new Set())
  }

  async function importar(): Promise<void> {
    setErro(null)
    setAviso(null)
    const r = await api.importarListaMods()
    if (!r.ok) return setErro(r.erro)
    if (!r.valor) return
    const { plano: p, notas, faltam } = r.valor
    setAviso(
      [
        notas && t('instalados.etiquetasENotasAplicadas', { notas }),
        faltam.length && t('instalados.semFonteParaBaixarInstalados', { join: faltam.join(', ') }),
        !p && t('instalados.nadaNovoParaInstalar')
      ]
        .filter(Boolean)
        .join(' ')
    )
    if (p) setPlano(p)
    await depoisDeMudar()
  }

  if (!lista) return <EsqueletoDeCards vista={vista} />

  const todos = lista.itens
  const contar = (c: CategoriaInstalado): number => todos.filter((i) => i.categoria === c).length
  const abas = (
    ['extras', 'datapack', 'resourcepack', 'amigos', 'modpack', 'outros'] as const
  ).filter((c) =>
    info.jogador
      ? c === 'amigos' || c === 'outros' || (c === 'extras' && !!EXTRAS_TIPOS[info.tipo])
      : c === 'extras'
        ? !!EXTRAS_TIPOS[info.tipo]
        : c !== 'modpack' || contar(c) > 0
  )
  const mundos = [...new Set(todos.flatMap((i) => (i.mundo ? [i.mundo] : [])))]
  const temEstado = aba === 'extras' || aba === 'outros'

  const visiveis = todos
    .filter((i) => i.categoria === aba)
    .filter((i) => !termo || i.titulo.toLowerCase().includes(termo.trim().toLowerCase()))
    .filter((i) => !fonte || i.fonte === fonte)
    .filter((i) => !temEstado || !situacao || i.ativo === (situacao === 'ativos'))
    .filter((i) => !comAtualizacao || i.atualizacao)
    .filter((i) => !mundo || i.mundo === mundo)
    .filter((i) => !comProblema || i.problemas.length > 0)
    .filter((i) => !categoriaFiltro || i.categorias.includes(categoriaFiltro))
    .filter((i) => !corFiltro || i.cor === corFiltro)
    .sort((a, b) =>
      ordem === 'tamanho'
        ? (b.tamanho ?? 0) - (a.tamanho ?? 0)
        : ordem === 'data'
          ? (b.data ?? '').localeCompare(a.data ?? '')
          : a.titulo.localeCompare(b.titulo, idiomaAtual())
    )
  // A busca e os filtros valem antes de dividir em páginas.
  const chaveFiltros = JSON.stringify([
    aba,
    termo,
    ordem,
    fonte,
    situacao,
    comAtualizacao,
    mundo,
    comProblema,
    categoriaFiltro,
    corFiltro,
    tamanhoPagina
  ])
  const pagina = paginaValida(
    paginaDe.chave === chaveFiltros ? paginaDe.pagina : 1,
    visiveis.length,
    tamanhoPagina
  )
  const naPagina = visiveis.slice((pagina - 1) * tamanhoPagina, pagina * tamanhoPagina)
  function abrirItem(i: ItemInstalado): void {
    rolagemAntes.current = topo.current?.closest<HTMLElement>('.overflow-auto')?.scrollTop ?? 0
    setAberto(i)
  }
  function irPara(p: number): void {
    setPaginaDe({ chave: chaveFiltros, pagina: p })
    topo.current?.scrollIntoView({ block: 'start' })
  }
  const podeSelecionar = (i: ItemInstalado): boolean => i.removivel && !i.removerAoDesligar
  const escolhidos = todos.filter((i) => selecionados.has(i.chave) && podeSelecionar(i))

  const ativos = [
    ...(fonte
      ? [
          {
            rotulo: t('instalados.fonte', { v: NOMES_FONTE[fonte] }),
            aoTirar: () => setFonte(null)
          }
        ]
      : []),
    ...(temEstado && situacao
      ? [
          {
            rotulo:
              situacao === 'ativos' ? t('instalados.soAtivos') : t('instalados.soDesativados'),
            aoTirar: () => setSituacao(null)
          }
        ]
      : []),
    ...(comAtualizacao
      ? [{ rotulo: t('instalados.comAtualizacao'), aoTirar: () => setComAtualizacao(false) }]
      : []),
    ...(mundo
      ? [{ rotulo: t('instalados.mundo2', { mundo }), aoTirar: () => setMundo(null) }]
      : []),
    ...(comProblema
      ? [{ rotulo: t('instalados.comProblema'), aoTirar: () => setComProblema(false) }]
      : []),
    ...(categoriaFiltro
      ? [
          {
            rotulo: t('instalados.categoria', { categoriaFiltro }),
            aoTirar: () => setCategoriaFiltro(null)
          }
        ]
      : []),
    ...(corFiltro
      ? [
          {
            rotulo: t('instalados.etiqueta', { nome: COR_ETIQUETA[corFiltro].nome }),
            aoTirar: () => setCorFiltro(null)
          }
        ]
      : [])
  ]
  const categorias = [
    ...new Set(todos.filter((i) => i.categoria === aba).flatMap((i) => i.categorias))
  ].sort()
  const comProblemas = todos.filter((i) => i.problemas.length > 0).length
  const modsEscolhidos = escolhidos.filter(
    (i) => i.chave.startsWith('extras:') && i.pendente !== 'instalar'
  )

  function marcar(i: ItemInstalado, v: boolean): void {
    setSelecionados((s) => {
      const novo = new Set(s)
      if (v) novo.add(i.chave)
      else novo.delete(i.chave)
      return novo
    })
  }

  const botaoRemover = (i: ItemInstalado, pequeno = true): React.ReactNode =>
    i.removivel && (
      <Botao
        variante="perigo"
        tamanho={pequeno ? 'pequeno' : 'normal'}
        disabled={ocupado || i.removerAoDesligar}
        onClick={() => setConfirmar([i])}
      >
        {i.removerAoDesligar ? t('instalados.seraRemovidoAoDesligar') : t('instalados.remover')}
      </Botao>
    )

  const etiquetas = (i: ItemInstalado): React.ReactNode => (
    <>
      {info.jogador &&
        (i.doServidor ? (
          <Etiqueta tom="accent">{t('instalados.doServidor')}</Etiqueta>
        ) : (
          <Etiqueta>{t('instalados.meu')}</Etiqueta>
        ))}
      {i.cor && (
        <span
          title={COR_ETIQUETA[i.cor].nome}
          aria-label={t('instalados.etiqueta2', { nome: COR_ETIQUETA[i.cor].nome })}
          className="inline-block h-4 w-4 shrink-0"
          style={{ background: COR_ETIQUETA[i.cor].hex }}
        />
      )}
      {i.problemas.length > 0 && (
        <Etiqueta tom="aviso">
          <IconeAtencao className="inline-block h-3.5 w-3.5 shrink-0 align-[-2px]" />{' '}
          {i.problemas.length}{' '}
          {i.problemas.length === 1 ? t('instalados.problema') : t('instalados.problemas')}
        </Etiqueta>
      )}
      {i.travado && <Etiqueta>{t('instalados.versaoTravada')}</Etiqueta>}
      {i.removerAoDesligar && (
        <Etiqueta tom="aviso">{t('instalados.seraRemovidoAoDesligar')}</Etiqueta>
      )}
      {i.pendente === 'instalar' && (
        <Etiqueta tom="aviso">{t('instalados.entraAoDesligar')}</Etiqueta>
      )}
      {(i.pendente === 'ativar' || i.pendente === 'desativar') && (
        <Etiqueta tom="aviso">{t('instalados.mudaAoDesligar')}</Etiqueta>
      )}
      {i.atualizacao && <Etiqueta tom="accent">{t('instalados.atualizacaoDisponivel')}</Etiqueta>}
      {i.mundoAtivo && <Etiqueta tom="accent">{t('instalados.mundoAtivo')}</Etiqueta>}
      {temEstado && !i.ativo && <Etiqueta>{t('instalados.desativado')}</Etiqueta>}
      {i.obrigatorio && <Etiqueta>{t('instalados.obrigatorio')}</Etiqueta>}
    </>
  )

  // PlaySquare: a frase de compatibilidade no card (some se o jogador escondeu esse aviso).
  const fraseNoJogo = (i: ItemInstalado): string | undefined => {
    const c = i.compat
    if (!info.jogador || !c) return undefined
    if (c.aviso && !c.bloqueia && avisosOcultos.includes(c.aviso)) return undefined
    return c.frase
  }

  const linha = (i: ItemInstalado): string =>
    [
      i.versao ??
        (i.categoria === 'outros'
          ? t('instalados.instaladoManualmente')
          : t('instalados.semVersao')),
      NOMES_FONTE[i.fonte],
      i.tamanho !== null && tamanho(i.tamanho),
      i.data && dataHora(i.data)
    ]
      .filter(Boolean)
      .join(' · ')

  // ---------- Diálogo de remoção ----------

  const alvos = confirmar ?? []
  const quebram = confirmar
    ? dependentes(
        todos,
        alvos.map((a) => a.chave)
      )
    : []
  const tudo = [...alvos, ...quebram]
  const dialogo = (
    <Dialogo
      aberto={!!confirmar}
      titulo={
        tudo.length === 1
          ? t('instalados.remover2', { titulo: tudo[0].titulo })
          : t('instalados.removerItens', { length: tudo.length })
      }
      aoCancelar={() => !ocupado && setConfirmar(null)}
      acao={{
        rotulo: ocupado
          ? t('instalados.removendo')
          : quebram.length
            ? t('instalados.removerTodos', { length: tudo.length })
            : t('instalados.remover'),
        variante: 'perigo',
        ocupado,
        aoClicar: () => remover(tudo)
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p>{t('instalados.istoSai')}</p>
        <ul className="flex max-h-48 flex-col gap-1 overflow-auto">
          {alvos.map((i) => (
            <li key={i.chave}>
              <b>{i.titulo}</b> <span className="text-muted">— {onde(i)}</span>
            </li>
          ))}
        </ul>
        {quebram.length > 0 && (
          <div className="flex flex-col gap-1 text-warning">
            <p>
              <IconeAtencao className="inline-block h-3.5 w-3.5 shrink-0 align-[-2px] mr-1 text-warning" />
              {t('instalados.estesItensDependemDoQue')}
            </p>
            <ul className="flex flex-col gap-1">
              {quebram.map((i) => (
                <li key={i.chave}>
                  <b>{i.titulo}</b> — {onde(i)}
                </li>
              ))}
            </ul>
            <p>{t('instalados.paraContinuarElesSaemJuntos')}</p>
          </div>
        )}
        {ligado && tudo.some(ehArquivo) && <p>{t('instalados.comOServidorLigadoOs')}</p>}
        {tudo.some((i) => i.categoria === 'resourcepack') && (
          <p>{t('instalados.oServerPropertiesFicaSem')}</p>
        )}
        {tudo.some((i) => i.categoria === 'amigos') && (
          <p>{t('instalados.oPacoteProsAmigosPerde')}</p>
        )}
        <p className="text-muted">{t('instalados.tudoFica7DiasEm')}</p>
      </div>
    </Dialogo>
  )

  const avisos = (
    <>
      {feito && (
        <Aviso tipo="sucesso">
          <span className="flex-1">{feito.texto}</span>
          <Botao tamanho="pequeno" onClick={desfazer}>
            {t('instalados.desfazer')}
          </Botao>
        </Aviso>
      )}
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erro && <MensagemErro erro={erro} />}
    </>
  )

  // ---------- Detalhes ----------

  if (aberto) {
    const voltar = (): void => setAberto(null) // a lista volta na mesma página e posição
    const extra = (
      <>
        {botaoRemover(aberto, false)}
        {aberto.removerAoDesligar && (
          <span className="text-xs text-warning">{t('instalados.seraRemovidoAoDesligarO')}</span>
        )}
      </>
    )
    const arquivo = (
      <CardPainel titulo={t('instalados.noServidor')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-muted">{t('instalados.onde')}</dt>
          <dd className="break-all">{onde(aberto)}</dd>
          <dt className="text-muted">{t('instalados.fonte2')}</dt>
          <dd>{NOMES_FONTE[aberto.fonte]}</dd>
          <dt className="text-muted">{t('instalados.versao')}</dt>
          <dd>{aberto.versao ?? '—'}</dd>
          <dt className="text-muted">{t('instalados.tamanho')}</dt>
          <dd>{aberto.tamanho !== null ? tamanho(aberto.tamanho) : '—'}</dd>
          <dt className="text-muted">{t('instalados.instaladoEm')}</dt>
          <dd>{aberto.data ? dataHora(aberto.data) : '—'}</dd>
        </dl>
      </CardPainel>
    )
    return (
      <div className="flex flex-col gap-4">
        {avisos}
        {aberto.projetoId && aberto.fonte !== 'manual' ? (
          <>
            <DetalhesDoProjeto
              key={aberto.chave}
              projeto={{ id: aberto.projetoId, titulo: aberto.titulo }}
              fonte={aberto.fonte}
              tipo={aberto.tipo}
              info={info}
              rotuloVoltar="‹ Voltar aos Instalados"
              aoVoltar={voltar}
              aoMudar={depoisDeMudar}
              extra={extra}
              semAcaoPrincipal={aberto.categoria === 'modpack'}
            />
            {arquivo}
          </>
        ) : (
          // Fonte desconhecida: o mesmo layout, só com o que o app sabe do arquivo.
          <div className="flex flex-col gap-6">
            <Botao tamanho="pequeno" className="self-start" onClick={voltar}>
              {t('instalados.voltarAosInstalados')}
            </Botao>
            <CabecalhoDetalhes icone={aberto.icone} titulo={aberto.titulo} linha={linha(aberto)} />
            <CardAcao frase={fraseDaAba(aberto.categoria, info)}>
              <div className="flex flex-wrap items-center gap-2">{extra}</div>
            </CardAcao>
            {arquivo}
          </div>
        )}
        {dialogo}
      </div>
    )
  }

  // ---------- Lista ----------

  const modItem = modAberto ? todos.find((i) => i.chave === modAberto) : undefined

  return (
    <div className="flex flex-col gap-4">
      <AbasDeTipo
        rotulo={t('instalados.oQueEstaInstalado')}
        abas={abas.map((c) => ({ id: c, nome: nomeDaAba(c, info), contador: contar(c) }))}
        ativa={aba}
        aoEscolher={(c) => {
          setAba(c)
          setSelecionados(new Set())
        }}
      />
      <p className="border-l-4 border-accent bg-panel px-4 py-2 text-[13px]">
        {fraseDaAba(aba, info)}
      </p>
      {lista.semInternet && <Aviso tipo="atencao">{t('instalados.semConexaoComOModrinth')}</Aviso>}
      {travamento && (
        <section
          aria-label={t('instalados.travamento')}
          className="isolate flex flex-col gap-3 overflow-hidden rounded-(--raio-pequeno) border-l-4 border-danger bg-danger/12 px-4 py-3 text-[13px]"
        >
          <p>
            <b>{info.jogador ? t('instalados.oJogoTravou') : t('instalados.oServidorTravou')}</b>{' '}
            {t('instalados.em', { dataHora: dataHora(travamento.data) })}
            {travamento.causa && ` ${travamento.causa}`}
          </p>
          {travamento.suspeitos.length ? (
            <>
              <p>{t('instalados.modsQueAparecemNoRelatorio')}</p>
              <ul className="flex flex-col gap-1">
                {travamento.suspeitos.map((x) => (
                  <li key={x.chave}>
                    <CaixaSelecao
                      marcada={suspeitos.has(x.chave)}
                      aoMudar={(v) =>
                        setSuspeitos((s) => {
                          const n = new Set(s)
                          if (v) n.add(x.chave)
                          else n.delete(x.chave)
                          return n
                        })
                      }
                    >
                      <b>{x.titulo}</b> <span className="text-muted">— {x.motivo}</span>
                    </CaixaSelecao>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t('instalados.naoAcheiNenhumModNo')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {travamento.suspeitos.length > 0 && (
              <Botao
                variante="perigo"
                tamanho="pequeno"
                disabled={ocupado || ligado || !suspeitos.size}
                onClick={() =>
                  rodar(
                    () => api.desativarETentar([...suspeitos], travamento.nome),
                    t('instalados.modsDesativadosOServidorEsta')
                  )
                }
              >
                {t('instalados.desativarETentarDeNovo')}
              </Botao>
            )}
            <Botao
              tamanho="pequeno"
              onClick={async () => {
                await api.dispensarTravamento(travamento.nome)
                setTravamento(null)
              }}
            >
              {t('instalados.dispensar')}
            </Botao>
          </div>
        </section>
      )}
      {deMods && aba === 'extras' && comProblemas > 0 && !comProblema && (
        <Aviso tipo="atencao">
          <span className="flex-1">
            {comProblemas} {comProblemas === 1 ? t('instalados.modTem') : t('instalados.modsTem')}{' '}
            {t('instalados.problemaCliqueNoModPara')}
          </span>
          <Botao variante="atencao" tamanho="pequeno" onClick={() => setComProblema(true)}>
            {t('instalados.verSoEsses')}
          </Botao>
        </Aviso>
      )}
      {avisos}
      {deMods && aba === 'extras' && (
        <div className="flex flex-wrap gap-2">
          <Botao
            tamanho="pequeno"
            onClick={async () => {
              const r = await api.exportarListaMods()
              if (!r.ok) setErro(r.erro)
              else if (r.valor) setAviso(t('instalados.listaSalvaEm', { valor: r.valor }))
            }}
          >
            {t('instalados.exportarLista')}
          </Botao>
          <Botao tamanho="pequeno" onClick={importar}>
            {t('instalados.importarLista')}
          </Botao>
        </div>
      )}

      <BarraDeBusca
        painel={painel}
        aoAlternarPainel={() => setPainel(painel ? 'fechado' : 'aberto')}
        termo={termo}
        aoMudarTermo={setTermo}
        rotuloBusca={t('instalados.procurarEm', { nomeDaAba: nomeDaAba(aba, info) })}
        ordens={ORDENS}
        ordem={ordem}
        aoOrdenar={setOrdem}
        vista={vista}
        aoMudarVista={setVista}
      />
      <EtiquetasDeFiltro
        itens={ativos}
        aoLimpar={() => {
          setFonte(null)
          setSituacao(null)
          setComAtualizacao(false)
          setMundo(null)
          setComProblema(false)
          setCategoriaFiltro(null)
          setCorFiltro(null)
        }}
      />

      <div className="flex items-start gap-6">
        {painel && (
          <PainelDeFiltros>
            <GrupoFiltro titulo={t('instalados.fonte2')}>
              <Selecao
                aria-label={t('instalados.fonte2')}
                value={fonte ?? ''}
                onChange={(e) => setFonte((e.target.value || null) as FonteInstalado | null)}
              >
                <option value="">{t('instalados.todas')}</option>
                {(Object.keys(NOMES_FONTE) as FonteInstalado[]).map((f) => (
                  <option key={f} value={f}>
                    {NOMES_FONTE[f]}
                  </option>
                ))}
              </Selecao>
            </GrupoFiltro>
            {temEstado && (
              <GrupoFiltro titulo={t('instalados.situacao')}>
                <OpcaoRadio
                  nome="situacao"
                  marcada={!situacao}
                  aoEscolher={() => setSituacao(null)}
                >
                  {t('instalados.todos')}
                </OpcaoRadio>
                <OpcaoRadio
                  nome="situacao"
                  marcada={situacao === 'ativos'}
                  aoEscolher={() => setSituacao('ativos')}
                >
                  {t('instalados.ativos')}
                </OpcaoRadio>
                <OpcaoRadio
                  nome="situacao"
                  marcada={situacao === 'desativados'}
                  aoEscolher={() => setSituacao('desativados')}
                >
                  {t('instalados.desativados2')}
                </OpcaoRadio>
              </GrupoFiltro>
            )}
            {(aba === 'datapack' || aba === 'outros') && mundos.length > 0 && (
              <GrupoFiltro titulo={t('instalados.mundo3')}>
                <Selecao
                  aria-label={t('instalados.mundo3')}
                  value={mundo ?? ''}
                  onChange={(e) => setMundo(e.target.value || null)}
                >
                  <option value="">{t('instalados.todos')}</option>
                  {mundos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Selecao>
              </GrupoFiltro>
            )}
            <GrupoFiltro titulo={t('instalados.outros')}>
              <CaixaSelecao marcada={comAtualizacao} aoMudar={setComAtualizacao}>
                {t('instalados.soComAtualizacao')}
              </CaixaSelecao>
              {temEstado && (
                <CaixaSelecao marcada={comProblema} aoMudar={setComProblema}>
                  {t('instalados.soComProblema')}
                </CaixaSelecao>
              )}
            </GrupoFiltro>
            {categorias.length > 0 && (
              <GrupoFiltro titulo={t('instalados.categoria2')}>
                <Selecao
                  aria-label={t('instalados.categoria2')}
                  value={categoriaFiltro ?? ''}
                  onChange={(e) => setCategoriaFiltro(e.target.value || null)}
                >
                  <option value="">{t('instalados.todas')}</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Selecao>
              </GrupoFiltro>
            )}
            {temEstado && (
              <GrupoFiltro titulo={t('instalados.etiqueta3')}>
                <Selecao
                  aria-label={t('instalados.etiqueta3')}
                  value={corFiltro ?? ''}
                  onChange={(e) => setCorFiltro((e.target.value || null) as CorEtiqueta | null)}
                >
                  <option value="">{t('instalados.todas')}</option>
                  {CORES_ETIQUETA.map((c) => (
                    <option key={c} value={c}>
                      {COR_ETIQUETA[c].nome}
                    </option>
                  ))}
                </Selecao>
              </GrupoFiltro>
            )}
          </PainelDeFiltros>
        )}

        <div ref={topo} className="flex min-w-0 flex-1 scroll-mt-4 flex-col gap-3">
          {visiveis.length > 0 && (
            <TopoDaLista
              pagina={pagina}
              tamanho={tamanhoPagina}
              total={visiveis.length}
              aoMudarTamanho={(t) => setTamanhoSalvo(String(t))}
            />
          )}
          {visiveis.some(podeSelecionar) && (
            <div className="flex flex-wrap items-center gap-3">
              <CaixaSelecao
                marcada={visiveis.filter(podeSelecionar).every((i) => selecionados.has(i.chave))}
                aoMudar={(v) =>
                  setSelecionados(
                    new Set(v ? visiveis.filter(podeSelecionar).map((i) => i.chave) : [])
                  )
                }
              >
                {t('instalados.selecionarTodos')}
              </CaixaSelecao>
              {modsEscolhidos.length > 0 && (
                <>
                  <Botao
                    tamanho="pequeno"
                    disabled={ocupado}
                    onClick={() => emLote('ativar', modsEscolhidos)}
                  >
                    {t('instalados.ativar')}
                  </Botao>
                  <Botao
                    tamanho="pequeno"
                    disabled={ocupado}
                    onClick={() => emLote('desativar', modsEscolhidos)}
                  >
                    {t('instalados.desativar')}
                  </Botao>
                  {modsEscolhidos.some((m) => m.atualizacao) && (
                    <Botao
                      tamanho="pequeno"
                      variante="primario"
                      disabled={ocupado}
                      onClick={() => emLote('atualizar', modsEscolhidos)}
                    >
                      {t('instalados.atualizar')}
                      {modsEscolhidos.filter((m) => m.atualizacao).length})
                    </Botao>
                  )}
                </>
              )}
              {selecionados.size > 0 && (
                <>
                  {/* A seleção vale entre páginas. */}
                  <span aria-live="polite" className="text-xs text-muted">
                    {selecionados.size}{' '}
                    {selecionados.size === 1
                      ? t('instalados.selecionado')
                      : t('instalados.selecionados')}
                  </span>
                  <Botao tamanho="pequeno" onClick={() => setSelecionados(new Set())}>
                    {t('instalados.limparSelecao')}
                  </Botao>
                </>
              )}
              {escolhidos.length > 0 && (
                <Botao
                  variante="perigo"
                  tamanho="pequeno"
                  disabled={ocupado}
                  onClick={() => setConfirmar(escolhidos)}
                >
                  {t('instalados.removerSelecionados', { length: escolhidos.length })}
                </Botao>
              )}
            </div>
          )}

          {!visiveis.length ? (
            <EstadoVazio
              icone={<IconeMods />}
              titulo={
                contar(aba) ? t('instalados.nadaComEssesFiltros') : t('instalados.nadaAquiAinda')
              }
              texto={
                contar(aba)
                  ? t('instalados.tireAlgunsFiltrosParaVer')
                  : t('instalados.procureNoExplorarEInstale')
              }
            />
          ) : (
            <ListaDeCards vista={vista}>
              {naPagina.map((i) => (
                <CardProjeto
                  key={i.chave}
                  icone={i.icone}
                  titulo={i.titulo}
                  linha={linha(i)}
                  descricao={i.nota || fraseNoJogo(i) || detalheDoCard(i)}
                  vista={vista}
                  aoAbrir={() =>
                    i.chave.startsWith('extras:')
                      ? setModAberto(i.chave)
                      : i.projetoId
                        ? abrirItem(i)
                        : undefined
                  }
                  etiquetas={etiquetas(i)}
                  selecao={
                    podeSelecionar(i)
                      ? { marcada: selecionados.has(i.chave), aoMudar: (v) => marcar(i, v) }
                      : undefined
                  }
                  acoes={
                    <>
                      {i.chave.startsWith('extras:') && i.pendente !== 'instalar' && (
                        <Interruptor
                          ligado={i.ativo}
                          rotulo={`${i.titulo}: ${i.ativo ? t('instalados.ativo') : t('instalados.desativado2')}`}
                          disabled={
                            ocupado || i.removerAoDesligar || (i.doServidor && !i.removivel)
                          }
                          aoMudar={(v) => alternar(i, v)}
                        />
                      )}
                      {botaoRemover(i)}
                    </>
                  }
                />
              ))}
            </ListaDeCards>
          )}
          <BarraDePaginas
            pagina={pagina}
            tamanho={tamanhoPagina}
            total={visiveis.length}
            aoIr={irPara}
          />
        </div>
      </div>

      {deMods && aba === 'extras' && (
        <CardPainel titulo={t('instalados.perfisDeMods')}>
          <p className="mb-3 text-xs text-muted">{t('instalados.umPerfilGuardaQuaisMods')}</p>
          {perfis.length > 0 && (
            <ul className="mb-3 flex flex-col divide-y divide-linha">
              {perfis.map((pf) => (
                <li key={pf.nome} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" title={pf.nome}>
                      {pf.nome}
                    </p>
                    <p className="text-xs text-muted">
                      {t('instalados.ativosSalvoEm', {
                        ativos: pf.ativos,
                        dataHora: dataHora(pf.criado)
                      })}
                    </p>
                  </div>
                  <Botao
                    tamanho="pequeno"
                    variante="primario"
                    disabled={ocupado || ligado}
                    title={ligado ? t('instalados.desligueOServidorParaTrocar') : undefined}
                    onClick={async () => {
                      setOcupado(true)
                      const r = await api.aplicarPerfilMods(pf.nome)
                      setOcupado(false)
                      if (!r.ok) setErro(r.erro)
                      else
                        setAviso(
                          t('instalados.perfilEmUsoMudaram', {
                            nome: pf.nome,
                            mudados: r.valor.mudados,
                            v: r.valor.faltam
                              ? t('instalados.modsDoPerfilNaoEstao', { faltam: r.valor.faltam })
                              : ''
                          })
                        )
                      await depoisDeMudar()
                    }}
                  >
                    {t('instalados.usar')}
                  </Botao>
                  <Botao
                    tamanho="pequeno"
                    variante="perigo"
                    disabled={ocupado}
                    onClick={() => rodar(() => api.apagarPerfilMods(pf.nome))}
                  >
                    {t('instalados.apagar')}
                  </Botao>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex max-w-[480px] gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await rodar(
                  () => api.salvarPerfilMods(nomePerfil),
                  t('instalados.perfilSalvo', { trim: nomePerfil.trim() })
                )
              )
                setNomePerfil('')
            }}
          >
            <Campo
              aria-label={t('instalados.nomeDoPerfil')}
              placeholder={t('instalados.nomeDoPerfilExLeve')}
              maxLength={32}
              value={nomePerfil}
              onChange={(e) => setNomePerfil(e.target.value)}
              className="flex-1"
            />
            <Botao type="submit" disabled={ocupado || !nomePerfil.trim()}>
              {t('instalados.salvarPerfilAtual')}
            </Botao>
          </form>
        </CardPainel>
      )}

      {removidos.length > 0 && (
        <CardPainel titulo={t('instalados.removidosRecentemente', { length: removidos.length })}>
          <p className="mb-3 text-xs text-muted">{t('instalados.ficam7DiasNaPasta')}</p>
          <ul className="flex flex-col divide-y divide-linha">
            {removidos.map((r) => {
              const dias = Math.max(1, 7 - Math.floor((agora - Date.parse(r.quando)) / 86_400_000))
              return (
                <li key={r.id} className="anim-item flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" title={r.titulo}>
                      {r.titulo}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {t('instalados.removidoEmSomeEm', {
                        nomeDaAba: nomeDaAba(r.categoria, info),
                        dataHora: dataHora(r.quando),
                        dias
                      })}{' '}
                      {dias === 1 ? t('instalados.dia') : t('instalados.dias')}
                    </p>
                  </div>
                  <Botao tamanho="pequeno" onClick={() => restaurar(r.id)}>
                    {t('instalados.restaurar')}
                  </Botao>
                </li>
              )
            })}
          </ul>
        </CardPainel>
      )}

      {modItem && (
        <PainelMod
          key={modItem.chave}
          item={modItem}
          ligado={ligado}
          ocupado={ocupado}
          aoFechar={() => setModAberto(null)}
          aoMudar={depoisDeMudar}
          aoCorrigir={corrigir}
          aoRemover={() => setConfirmar([modItem])}
          aoAlternar={(v) => alternar(modItem, v)}
          aoAbrirPagina={
            modItem.projetoId && modItem.fonte !== 'manual'
              ? () => {
                  setModAberto(null)
                  setAberto(modItem)
                }
              : null
          }
        />
      )}
      <DialogoPlano
        plano={plano}
        titulo={t('instalados.instalar')}
        extras={EXTRAS_TIPOS[info.tipo] ?? 'mods'}
        ocupado={instalando}
        progresso={progresso}
        aoCancelar={() => setPlano(null)}
        aoConfirmar={instalarPlano}
      />
      {dialogo}
    </div>
  )
}
