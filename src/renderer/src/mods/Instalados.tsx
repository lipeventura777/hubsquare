import { useCallback, useEffect, useState } from 'react'
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

// Aba Instalados da tela Mods (Fase 23.2): tudo o que o servidor tem, com as mesmas peças do
// Explorar. Remover vai para Removidos recentemente (7 dias), com "Desfazer".

const NOMES_FONTE: Record<FonteInstalado, string> = {
  modrinth: 'Modrinth',
  curseforge: 'CurseForge',
  hangar: 'Hangar',
  manual: 'Manual'
}

type Ordem = 'nome' | 'data' | 'tamanho'
const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'nome', rotulo: 'Nome' },
  { valor: 'data', rotulo: 'Data de instalação' },
  { valor: 'tamanho', rotulo: 'Tamanho' }
]

const PASTA_NO_PACOTE: Record<string, string> = {
  shader: 'shaderpacks',
  resourcepack: 'resourcepacks',
  mod: 'mods'
}

function nomeDaAba(c: CategoriaInstalado, info: InfoServidor): string {
  if (info.jogador && c === 'amigos') return 'Shaders e resource packs'
  switch (c) {
    case 'extras':
      return EXTRAS_TIPOS[info.tipo] === 'plugins' ? 'Plugins' : 'Mods'
    case 'datapack':
      return 'Datapacks'
    case 'resourcepack':
      return 'Resource pack do servidor'
    case 'amigos':
      return 'Pacote pros amigos'
    case 'modpack':
      return 'Modpack'
    case 'outros':
      return 'Outros'
  }
}

function fraseDaAba(c: CategoriaInstalado, info: InfoServidor): string {
  // PlaySquare (Fase P3): a mesma aba, para a instalação do jogador.
  if (info.jogador) {
    if (c === 'extras')
      return 'Mods da pasta mods da instalação. Os marcados "Do servidor" vêm do servidor e os obrigatórios não saem por aqui; os seus a sincronização nunca tira.'
    if (c === 'amigos')
      return 'Shaders e resource packs da instalação: os seus e os que o servidor mandou.'
    if (c === 'outros')
      return 'Arquivos na pasta mods que o app não reconhece (postos à mão). São seus.'
  }
  switch (c) {
    case 'extras':
      return `Arquivos da pasta ${EXTRAS_TIPOS[info.tipo]} do servidor. Remover só acontece com o servidor desligado; ligado, sai quando ele desligar.`
    case 'datapack':
      return 'Datapacks da pasta datapacks de cada mundo. Só o mundo ativo usa os dele.'
    case 'resourcepack':
      return 'O resource pack que o server.properties manda para cada jogador ao entrar.'
    case 'amigos':
      return 'Shaders, resource packs e mods só do jogador que vão no Pacote pros amigos. O servidor não usa nenhum deles.'
    case 'modpack':
      return 'O modpack de onde este servidor veio.'
    case 'outros':
      return 'Arquivos nas pastas mods, plugins e datapacks que o app não reconhece (instalados manualmente).'
  }
}

// Onde o item está, para o diálogo dizer exatamente o que sai.
function onde(i: ItemInstalado): string {
  if (i.categoria === 'resourcepack') return 'server.properties (resource-pack)'
  if (i.categoria === 'amigos' && i.caminho) return i.caminho
  if (i.categoria === 'amigos') return `Pacote pros amigos (${PASTA_NO_PACOTE[i.tipo] ?? 'mods'})`
  return i.caminho ?? 'espera para entrar ao desligar'
}

function detalheDoCard(i: ItemInstalado): string | undefined {
  if (i.categoria === 'datapack' || (i.categoria === 'outros' && i.mundo)) {
    return `Mundo "${i.mundo}"${i.mundoAtivo ? ' (ativo)' : ' (não está ativo)'}`
  }
  if (i.categoria === 'resourcepack')
    return i.obrigatorio ? 'Obrigatório para entrar' : 'Opcional para os jogadores'
  if (i.categoria === 'amigos') return `Vai na pasta ${PASTA_NO_PACOTE[i.tipo] ?? 'mods'} do pacote`
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
        n && `${n} ${n === 1 ? 'item removido' : 'itens removidos'}.`,
        agendados &&
          `${agendados} ${agendados === 1 ? 'será removido' : 'serão removidos'} ao desligar o servidor.`,
        'Fica tudo 7 dias em Removidos recentemente.'
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

  const aoDesligar = ligado ? ' Com o servidor ligado, vale quando ele desligar.' : ''

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
      `${alvo.titulo} trocado para uma versão compatível. A de antes ficou guardada.${aoDesligar}`
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
    else setAviso(`Instalado.${aoDesligar}`)
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
        `${mudar.length} ${quer ? 'ativados' : 'desativados'}.${aoDesligar}`
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
        notas && `${notas} etiquetas e notas aplicadas.`,
        faltam.length &&
          `Sem fonte para baixar (instalados à mão no outro servidor): ${faltam.join(', ')}.`,
        !p && 'Nada novo para instalar.'
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
          : a.titulo.localeCompare(b.titulo, 'pt-BR')
    )
  const podeSelecionar = (i: ItemInstalado): boolean => i.removivel && !i.removerAoDesligar
  const escolhidos = todos.filter((i) => selecionados.has(i.chave) && podeSelecionar(i))

  const ativos = [
    ...(fonte ? [{ rotulo: `Fonte: ${NOMES_FONTE[fonte]}`, aoTirar: () => setFonte(null) }] : []),
    ...(temEstado && situacao
      ? [
          {
            rotulo: situacao === 'ativos' ? 'Só ativos' : 'Só desativados',
            aoTirar: () => setSituacao(null)
          }
        ]
      : []),
    ...(comAtualizacao
      ? [{ rotulo: 'Com atualização', aoTirar: () => setComAtualizacao(false) }]
      : []),
    ...(mundo ? [{ rotulo: `Mundo: ${mundo}`, aoTirar: () => setMundo(null) }] : []),
    ...(comProblema ? [{ rotulo: 'Com problema', aoTirar: () => setComProblema(false) }] : []),
    ...(categoriaFiltro
      ? [{ rotulo: `Categoria: ${categoriaFiltro}`, aoTirar: () => setCategoriaFiltro(null) }]
      : []),
    ...(corFiltro
      ? [{ rotulo: `Etiqueta: ${COR_ETIQUETA[corFiltro].nome}`, aoTirar: () => setCorFiltro(null) }]
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
        {i.removerAoDesligar ? 'Será removido ao desligar' : 'Remover'}
      </Botao>
    )

  const etiquetas = (i: ItemInstalado): React.ReactNode => (
    <>
      {info.jogador &&
        (i.doServidor ? <Etiqueta tom="accent">Do servidor</Etiqueta> : <Etiqueta>Meu</Etiqueta>)}
      {i.cor && (
        <span
          title={COR_ETIQUETA[i.cor].nome}
          aria-label={`Etiqueta ${COR_ETIQUETA[i.cor].nome}`}
          className="inline-block h-4 w-4 shrink-0"
          style={{ background: COR_ETIQUETA[i.cor].hex }}
        />
      )}
      {i.problemas.length > 0 && (
        <Etiqueta tom="aviso">
          <IconeAtencao className="inline-block h-3.5 w-3.5 shrink-0 align-[-2px]" />{' '}
          {i.problemas.length} {i.problemas.length === 1 ? 'problema' : 'problemas'}
        </Etiqueta>
      )}
      {i.travado && <Etiqueta>Versão travada</Etiqueta>}
      {i.removerAoDesligar && <Etiqueta tom="aviso">Será removido ao desligar</Etiqueta>}
      {i.pendente === 'instalar' && <Etiqueta tom="aviso">Entra ao desligar</Etiqueta>}
      {(i.pendente === 'ativar' || i.pendente === 'desativar') && (
        <Etiqueta tom="aviso">Muda ao desligar</Etiqueta>
      )}
      {i.atualizacao && <Etiqueta tom="accent">Atualização disponível</Etiqueta>}
      {i.mundoAtivo && <Etiqueta tom="accent">Mundo ativo</Etiqueta>}
      {temEstado && !i.ativo && <Etiqueta>Desativado</Etiqueta>}
      {i.obrigatorio && <Etiqueta>Obrigatório</Etiqueta>}
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
      i.versao ?? (i.categoria === 'outros' ? 'Instalado manualmente' : 'Sem versão'),
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
      titulo={tudo.length === 1 ? `Remover ${tudo[0].titulo}?` : `Remover ${tudo.length} itens?`}
      aoCancelar={() => !ocupado && setConfirmar(null)}
      acao={{
        rotulo: ocupado
          ? 'Removendo...'
          : quebram.length
            ? `Remover todos (${tudo.length})`
            : 'Remover',
        variante: 'perigo',
        ocupado,
        aoClicar: () => remover(tudo)
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p>Isto sai:</p>
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
              Estes itens dependem do que vai sair e param de funcionar sem ele:
            </p>
            <ul className="flex flex-col gap-1">
              {quebram.map((i) => (
                <li key={i.chave}>
                  <b>{i.titulo}</b> — {onde(i)}
                </li>
              ))}
            </ul>
            <p>Para continuar, eles saem juntos. Se não quiser, cancele.</p>
          </div>
        )}
        {ligado && tudo.some(ehArquivo) && (
          <p>Com o servidor ligado, os arquivos só saem quando ele desligar.</p>
        )}
        {tudo.some((i) => i.categoria === 'resourcepack') && (
          <p>O server.properties fica sem resource pack (vale depois de reiniciar o servidor).</p>
        )}
        {tudo.some((i) => i.categoria === 'amigos') && (
          <p>O Pacote pros amigos perde o item; o servidor não muda.</p>
        )}
        <p className="text-muted">Tudo fica 7 dias em Removidos recentemente, para desfazer.</p>
      </div>
    </Dialogo>
  )

  const avisos = (
    <>
      {feito && (
        <Aviso tipo="sucesso">
          <span className="flex-1">{feito.texto}</span>
          <Botao tamanho="pequeno" onClick={desfazer}>
            Desfazer
          </Botao>
        </Aviso>
      )}
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
      {erro && <MensagemErro erro={erro} />}
    </>
  )

  // ---------- Detalhes ----------

  if (aberto) {
    const voltar = (): void => setAberto(null)
    const extra = (
      <>
        {botaoRemover(aberto, false)}
        {aberto.removerAoDesligar && (
          <span className="text-xs text-warning">Será removido ao desligar o servidor.</span>
        )}
      </>
    )
    const arquivo = (
      <CardPainel titulo="No servidor">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-muted">Onde</dt>
          <dd className="break-all">{onde(aberto)}</dd>
          <dt className="text-muted">Fonte</dt>
          <dd>{NOMES_FONTE[aberto.fonte]}</dd>
          <dt className="text-muted">Versão</dt>
          <dd>{aberto.versao ?? '—'}</dd>
          <dt className="text-muted">Tamanho</dt>
          <dd>{aberto.tamanho !== null ? tamanho(aberto.tamanho) : '—'}</dd>
          <dt className="text-muted">Instalado em</dt>
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
              ‹ Voltar aos Instalados
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
        rotulo="O que está instalado"
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
      {lista.semInternet && (
        <Aviso tipo="atencao">
          Sem conexão com o Modrinth: alguns nomes, ícones e atualizações podem faltar.
        </Aviso>
      )}
      {travamento && (
        <section
          aria-label="Travamento"
          className="flex flex-col gap-3 border-l-4 border-danger bg-danger/12 px-4 py-3 text-[13px]"
        >
          <p>
            <b>{info.jogador ? 'O jogo travou' : 'O servidor travou'}</b> em{' '}
            {dataHora(travamento.data)}.{travamento.causa && ` ${travamento.causa}`}
          </p>
          {travamento.suspeitos.length ? (
            <>
              <p>Mods que aparecem no relatório (marque os que quer desativar):</p>
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
            <p>
              Não achei nenhum mod no relatório. Veja em Registro de eventos › Relatórios de
              travamento.
            </p>
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
                    'Mods desativados. O servidor está ligando de novo.'
                  )
                }
              >
                Desativar e tentar de novo
              </Botao>
            )}
            <Botao
              tamanho="pequeno"
              onClick={async () => {
                await api.dispensarTravamento(travamento.nome)
                setTravamento(null)
              }}
            >
              Dispensar
            </Botao>
          </div>
        </section>
      )}
      {deMods && aba === 'extras' && comProblemas > 0 && !comProblema && (
        <Aviso tipo="atencao">
          <span className="flex-1">
            {comProblemas} {comProblemas === 1 ? 'mod tem' : 'mods têm'} problema. Clique no mod
            para ver o que é e corrigir.
          </span>
          <Botao variante="atencao" tamanho="pequeno" onClick={() => setComProblema(true)}>
            Ver só esses
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
              else if (r.valor) setAviso(`Lista salva em ${r.valor}.`)
            }}
          >
            Exportar lista
          </Botao>
          <Botao tamanho="pequeno" onClick={importar}>
            Importar lista
          </Botao>
        </div>
      )}

      <BarraDeBusca
        painel={painel}
        aoAlternarPainel={() => setPainel(painel ? 'fechado' : 'aberto')}
        termo={termo}
        aoMudarTermo={setTermo}
        rotuloBusca={`Procurar em ${nomeDaAba(aba, info)}`}
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
            <GrupoFiltro titulo="Fonte">
              <Selecao
                aria-label="Fonte"
                value={fonte ?? ''}
                onChange={(e) => setFonte((e.target.value || null) as FonteInstalado | null)}
              >
                <option value="">Todas</option>
                {(Object.keys(NOMES_FONTE) as FonteInstalado[]).map((f) => (
                  <option key={f} value={f}>
                    {NOMES_FONTE[f]}
                  </option>
                ))}
              </Selecao>
            </GrupoFiltro>
            {temEstado && (
              <GrupoFiltro titulo="Situação">
                <OpcaoRadio
                  nome="situacao"
                  marcada={!situacao}
                  aoEscolher={() => setSituacao(null)}
                >
                  Todos
                </OpcaoRadio>
                <OpcaoRadio
                  nome="situacao"
                  marcada={situacao === 'ativos'}
                  aoEscolher={() => setSituacao('ativos')}
                >
                  Ativos
                </OpcaoRadio>
                <OpcaoRadio
                  nome="situacao"
                  marcada={situacao === 'desativados'}
                  aoEscolher={() => setSituacao('desativados')}
                >
                  Desativados
                </OpcaoRadio>
              </GrupoFiltro>
            )}
            {(aba === 'datapack' || aba === 'outros') && mundos.length > 0 && (
              <GrupoFiltro titulo="Mundo">
                <Selecao
                  aria-label="Mundo"
                  value={mundo ?? ''}
                  onChange={(e) => setMundo(e.target.value || null)}
                >
                  <option value="">Todos</option>
                  {mundos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Selecao>
              </GrupoFiltro>
            )}
            <GrupoFiltro titulo="Outros">
              <CaixaSelecao marcada={comAtualizacao} aoMudar={setComAtualizacao}>
                Só com atualização
              </CaixaSelecao>
              {temEstado && (
                <CaixaSelecao marcada={comProblema} aoMudar={setComProblema}>
                  Só com problema
                </CaixaSelecao>
              )}
            </GrupoFiltro>
            {categorias.length > 0 && (
              <GrupoFiltro titulo="Categoria">
                <Selecao
                  aria-label="Categoria"
                  value={categoriaFiltro ?? ''}
                  onChange={(e) => setCategoriaFiltro(e.target.value || null)}
                >
                  <option value="">Todas</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Selecao>
              </GrupoFiltro>
            )}
            {temEstado && (
              <GrupoFiltro titulo="Etiqueta">
                <Selecao
                  aria-label="Etiqueta"
                  value={corFiltro ?? ''}
                  onChange={(e) => setCorFiltro((e.target.value || null) as CorEtiqueta | null)}
                >
                  <option value="">Todas</option>
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

        <div className="flex min-w-0 flex-1 flex-col gap-3">
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
                Selecionar todos
              </CaixaSelecao>
              {modsEscolhidos.length > 0 && (
                <>
                  <Botao
                    tamanho="pequeno"
                    disabled={ocupado}
                    onClick={() => emLote('ativar', modsEscolhidos)}
                  >
                    Ativar
                  </Botao>
                  <Botao
                    tamanho="pequeno"
                    disabled={ocupado}
                    onClick={() => emLote('desativar', modsEscolhidos)}
                  >
                    Desativar
                  </Botao>
                  {modsEscolhidos.some((m) => m.atualizacao) && (
                    <Botao
                      tamanho="pequeno"
                      variante="primario"
                      disabled={ocupado}
                      onClick={() => emLote('atualizar', modsEscolhidos)}
                    >
                      Atualizar ({modsEscolhidos.filter((m) => m.atualizacao).length})
                    </Botao>
                  )}
                </>
              )}
              {escolhidos.length > 0 && (
                <Botao
                  variante="perigo"
                  tamanho="pequeno"
                  disabled={ocupado}
                  onClick={() => setConfirmar(escolhidos)}
                >
                  Remover selecionados ({escolhidos.length})
                </Botao>
              )}
            </div>
          )}

          {!visiveis.length ? (
            <EstadoVazio
              icone={<IconeMods />}
              titulo={contar(aba) ? 'Nada com esses filtros' : 'Nada aqui ainda'}
              texto={
                contar(aba)
                  ? 'Tire alguns filtros para ver o resto.'
                  : 'Procure no Explorar e instale com um clique.'
              }
            />
          ) : (
            <ListaDeCards vista={vista}>
              {visiveis.map((i) => (
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
                        ? setAberto(i)
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
                          rotulo={`${i.titulo}: ${i.ativo ? 'ativo' : 'desativado'}`}
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
        </div>
      </div>

      {deMods && aba === 'extras' && (
        <CardPainel titulo="Perfis de mods">
          <p className="mb-3 text-xs text-muted">
            Um perfil guarda quais mods estão ativos agora (ex.: &quot;Leve&quot;,
            &quot;Completo&quot;). Usar um perfil ativa os mods dele e desativa o resto; só com o
            servidor desligado.
          </p>
          {perfis.length > 0 && (
            <ul className="mb-3 flex flex-col divide-y divide-linha">
              {perfis.map((pf) => (
                <li key={pf.nome} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" title={pf.nome}>
                      {pf.nome}
                    </p>
                    <p className="text-xs text-muted">
                      {pf.ativos} ativos · salvo em {dataHora(pf.criado)}
                    </p>
                  </div>
                  <Botao
                    tamanho="pequeno"
                    variante="primario"
                    disabled={ocupado || ligado}
                    title={ligado ? 'Desligue o servidor para trocar de perfil' : undefined}
                    onClick={async () => {
                      setOcupado(true)
                      const r = await api.aplicarPerfilMods(pf.nome)
                      setOcupado(false)
                      if (!r.ok) setErro(r.erro)
                      else
                        setAviso(
                          `Perfil "${pf.nome}" em uso: ${r.valor.mudados} mudaram.${r.valor.faltam ? ` ${r.valor.faltam} mods do perfil não estão mais instalados.` : ''}`
                        )
                      await depoisDeMudar()
                    }}
                  >
                    Usar
                  </Botao>
                  <Botao
                    tamanho="pequeno"
                    variante="perigo"
                    disabled={ocupado}
                    onClick={() => rodar(() => api.apagarPerfilMods(pf.nome))}
                  >
                    Apagar
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
                  `Perfil "${nomePerfil.trim()}" salvo.`
                )
              )
                setNomePerfil('')
            }}
          >
            <Campo
              aria-label="Nome do perfil"
              placeholder="Nome do perfil (ex.: Leve)"
              maxLength={32}
              value={nomePerfil}
              onChange={(e) => setNomePerfil(e.target.value)}
              className="flex-1"
            />
            <Botao type="submit" disabled={ocupado || !nomePerfil.trim()}>
              Salvar perfil atual
            </Botao>
          </form>
        </CardPainel>
      )}

      {removidos.length > 0 && (
        <CardPainel titulo={`Removidos recentemente (${removidos.length})`}>
          <p className="mb-3 text-xs text-muted">
            Ficam 7 dias na pasta de backups do servidor e depois somem.
          </p>
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
                      {nomeDaAba(r.categoria, info)} · removido em {dataHora(r.quando)} · some em{' '}
                      {dias} {dias === 1 ? 'dia' : 'dias'}
                    </p>
                  </div>
                  <Botao tamanho="pequeno" onClick={() => restaurar(r.id)}>
                    Restaurar
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
        titulo="Instalar?"
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
