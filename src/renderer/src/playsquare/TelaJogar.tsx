import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ErroTela,
  EstadoJogo,
  Instalacao,
  LoaderCliente,
  MemoriaJogo,
  Progresso,
  StatusServidorJogo,
  TravamentoMods
} from '../../../shared/tipos'
import { ArteDoBioma, FundoAnimado } from '../fundo/Fundo'
import { CamadaFundo } from '../fundo/CamadaFundo'
import {
  AjustesImagem,
  CartaoFundo,
  escolhaDeImagem,
  GradeBiomas,
  GradeImagens,
  useImagensFundo
} from '../fundo/EscolherFundo'
import { fundoEfetivo, urlDoFundo, type EscolhaFundo } from '../../../shared/fundoRegras'
import { BotaoDiagnostico } from '../componentes/Diagnostico'
import { useAparencia } from '../aparencia/useAparencia'
import { classesBotao } from '../componentes/estilos'
import { IconeAtencao, IconeInstalacoes } from '../componentes/icones'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso, BolinhaStatus, Esqueleto } from '../componentes/movimento'
import { CabecaJogador } from '../componentes/paineis'
import { Aviso, Botao, CaixaSelecao, EstadoVazio, Menu, Selecao, Slider } from '../componentes/ui'
import { abrirDownloads, useDownloads } from '../mods/DownloadsNecessarios'
import { desatualizada, useJogar, type ModoJogar } from './useJogar'
import {
  AcoesDaInstalada,
  JogarEmBreve,
  precisaInstalar,
  rotuloInstalar,
  useAbrirLauncherLigado
} from './Instalar'

// Tela Jogar do PlaySquare (Fase P4, DESIGN.md seção 6.1.3), no modelo do launcher oficial:
// banner com o fundo da instalação, barra de ação (seletor, JOGAR, status do servidor) e os cards
// das instalações embaixo. O JOGAR só abre o jogo: nunca liga nem desliga o servidor. Só o dono
// tem o botão separado "Ligar servidor e jogar".

const NOMES_LOADER: Record<LoaderCliente, string> = {
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  forge: 'Forge',
  neoforge: 'NeoForge'
}
const CHAVE = 'hubsquare:instalacaoEscolhida' // a mesma do Explorar e do Conteúdo

function lerEscolhida(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

function guardarEscolhida(id: string): void {
  try {
    localStorage.setItem(CHAVE, id)
  } catch {
    // sem armazenamento: só não lembra
  }
}

function tempo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

function duracaoLonga(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'menos de 1 minuto'
  if (min < 60) return `${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return `${h} h${resto ? ` ${resto} min` : ''}`
}

function bytes(n: number): string {
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

// Velocidade e tempo restante a partir das amostras do progresso (média dos últimos ~3 s).
function useVelocidade(p: Progresso | null): { porSegundo: number; restante: number | null } {
  const amostras = useRef<{ t: number; b: number }[]>([])
  const [r, setR] = useState<{ porSegundo: number; restante: number | null }>({
    porSegundo: 0,
    restante: null
  })
  useEffect(() => {
    if (!p || !p.total) {
      amostras.current = []
      return
    }
    const agora = Date.now()
    const lista = amostras.current.filter((a) => agora - a.t < 3000 && a.b <= p.recebido)
    lista.push({ t: agora, b: p.recebido })
    amostras.current = lista
    const primeira = lista[0]
    const dt = (agora - primeira.t) / 1000
    const porSegundo = dt > 0.3 ? (p.recebido - primeira.b) / dt : 0

    setR({
      porSegundo,
      restante: porSegundo > 0 ? (p.total - p.recebido) / porSegundo : null
    })
  }, [p])
  return r
}

export function TelaJogar(): React.JSX.Element {
  const [lista, setLista] = useState<Instalacao[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [id, setId] = useState<string | null>(lerEscolhida)
  const [estados, setEstados] = useState<Record<string, EstadoJogo>>({})

  const carregar = useCallback(async (): Promise<void> => {
    const r = await window.api.listarInstalacoes()
    if (r.ok) setLista(r.valor)
    else setErro(r.erro)
  }, [])

  useEffect(() => {
    const mostrar = (): Promise<void> =>
      window.api.listarInstalacoes().then((r) => (r.ok ? setLista(r.valor) : setErro(r.erro)))
    void mostrar()
      .then(() => window.api.verificarConvites())
      .then(mostrar)
    window.api.estadosDoJogo().then((r) => r.ok && setEstados(r.valor))
    return window.api.aoMudarJogo(({ id: qual, estado }) =>
      setEstados((e) => {
        const n = { ...e }
        if (estado) n[qual] = estado
        else delete n[qual]
        return n
      })
    )
  }, [])

  const fluxo = useJogar(carregar)
  const escolhida = lista?.find((i) => i.id === id) ?? lista?.[0] ?? null

  if (!lista) {
    return (
      <div className="p-10">{erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={6} />}</div>
    )
  }
  if (!escolhida) {
    return (
      <div className="p-10">
        <EstadoVazio
          icone={<IconeInstalacoes />}
          titulo="Nenhuma instalação ainda"
          texto="Crie uma instalação (ou entre com um convite) na tela Instalações para jogar."
        />
      </div>
    )
  }

  function escolher(novo: string): void {
    setId(novo)
    guardarEscolhida(novo)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Banner i={escolhida} aoMudar={carregar} />
      <BarraJogar
        i={escolhida}
        lista={lista}
        estado={estados[escolhida.id] ?? null}
        ocupado={fluxo.ocupado === escolhida.id}
        outroOcupado={!!fluxo.ocupado && fluxo.ocupado !== escolhida.id}
        progresso={fluxo.progresso}
        aoEscolher={escolher}
        aoJogar={(modo) => void fluxo.jogar(escolhida, undefined, modo)}
      />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-6 py-6">
        {fluxo.erro && <MensagemErro erro={fluxo.erro} />}
        <CardModsFaltando i={escolhida} />
        <CardSessao
          i={escolhida}
          estado={estados[escolhida.id] ?? null}
          aoJogarDeNovo={() => void fluxo.jogar(escolhida)}
        />
        <CardMemoria key={escolhida.id} i={escolhida} />
        <h2 className="mt-2 text-xs font-bold tracking-wider text-muted uppercase">Instalações</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {lista.map((i, n) => (
            <CardInstalacao
              key={i.id}
              i={i}
              ordem={n}
              selecionada={i.id === escolhida.id}
              aoEscolher={() => escolher(i.id)}
            />
          ))}
        </div>
      </div>
      {fluxo.dialogo}
    </div>
  )
}

// ---------- Banner ----------

function Banner({
  i,
  aoMudar
}: {
  i: Instalacao
  aoMudar: () => Promise<void>
}): React.JSX.Element {
  const { aparencia, fundoApp } = useAparencia()
  const imgs = useImagensFundo()
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [falhou, setFalhou] = useState<string | null>(null) // imagem que não abriu
  const [soltando, setSoltando] = useState(false)
  // Prévia ao vivo enquanto mexe nos ajustes (salva logo depois); some quando a instalação recarrega.
  const [previa, setPrevia] = useState<{ id: string; escolha: EscolhaFundo | null } | null>(null)
  const salvar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // O nome só anima quando a instalação muda (na primeira vez a tela já está entrando).
  const [anterior, setAnterior] = useState(i.id)
  const [trocou, setTrocou] = useState(false)
  if (anterior !== i.id) {
    setAnterior(i.id)
    setTrocou(true)
    setPrevia(null)
  }

  // Ordem (fundoRegras.ts): fundo da instalação > fundo do app > bioma padrão.
  const daInstalacao = previa && previa.id === i.id ? previa.escolha : i.fundo
  let efetivo = fundoEfetivo(daInstalacao, fundoApp, aparencia?.bioma ?? 'dia')
  if (efetivo.tipo === 'imagem' && efetivo.imagem === falhou) {
    efetivo = { tipo: 'bioma', bioma: aparencia?.bioma ?? 'dia' }
  }

  // Imagens: a nova entra por cima da anterior com crossfade (a anterior sai depois).
  const nomeImagem = efetivo.tipo === 'imagem' ? efetivo.imagem : null
  const [camadas, setCamadas] = useState<{ nome: string; chave: number; entra: boolean }[]>(() =>
    nomeImagem ? [{ nome: nomeImagem, chave: 0, entra: false }] : []
  )
  const topo = camadas[camadas.length - 1]
  if ((topo?.nome ?? null) !== nomeImagem) {
    setCamadas(
      nomeImagem
        ? [
            ...camadas.slice(-1),
            { nome: nomeImagem, chave: (topo?.chave ?? 0) + 1, entra: camadas.length > 0 }
          ]
        : []
    )
  }
  useEffect(() => {
    if (camadas.length < 2) return
    const t = setTimeout(() => setCamadas((c) => c.slice(-1)), 400) // depois do --dur-slow
    return () => clearTimeout(t)
  }, [camadas.length])
  useEffect(() => () => clearTimeout(salvar.current), [])

  // Guarda a escolha da instalação. "imediato": botão; senão, depois de parar de mexer.
  function definir(escolha: EscolhaFundo | null, imediato = true): void {
    setPrevia({ id: i.id, escolha })
    clearTimeout(salvar.current)
    const id = i.id
    salvar.current = setTimeout(
      async () => {
        const r = await window.api.definirFundoInstalacao(id, escolha)
        setErro(r.ok ? null : r.erro)
        await aoMudar() // a instalação volta com o fundo novo
        setPrevia((p) => (p && p.id === id && p.escolha === escolha ? null : p))
      },
      imediato ? 0 : 300
    )
  }

  async function soltar(e: React.DragEvent): Promise<void> {
    e.preventDefault()
    setSoltando(false)
    const arquivo = e.dataTransfer.files[0]
    if (!arquivo) return
    const nome = await imgs.arrastada(arquivo)
    if (nome) definir(escolhaDeImagem(nome, daInstalacao))
  }

  const imagemEfetiva = efetivo.tipo === 'imagem' ? efetivo : null

  return (
    <section
      aria-label={`Instalação ${i.nome}`}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setSoltando(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setSoltando(false)
      }}
      onDrop={(e) => void soltar(e)}
      className="relative flex h-[42vh] min-h-[260px] shrink-0 items-end overflow-hidden text-on-dark"
    >
      {/* Fundo (Fase V4, seção 7.2): o bioma vivo (troca de instalação com a transição da V2) ou
          a imagem com os ajustes, com crossfade entre imagens. */}
      {efetivo.tipo === 'bioma' && (
        <FundoAnimado bioma={efetivo.bioma} className="absolute inset-0 h-full w-full" />
      )}
      {imagemEfetiva &&
        camadas.map((c) => (
          <CamadaFundo
            key={c.chave}
            escolha={{ ...imagemEfetiva, imagem: c.nome }}
            className={c.entra ? 'anim-fundo' : ''}
            aoFalhar={() => setFalhou(c.nome)}
          />
        ))}
      <div aria-hidden="true" className="banner-gradiente absolute inset-0" />
      <div
        key={i.id}
        className={`relative flex min-w-0 flex-1 items-end gap-4 px-8 pb-6 ${trocou ? 'anim-pagina' : ''}`}
      >
        {i.imagem && (
          <img
            src={i.imagem}
            alt=""
            className="h-16 w-16 shrink-0 border-2 border-linha object-cover [image-rendering:pixelated]"
          />
        )}
        <div className="placa-vidro min-w-0 px-5 py-3 text-texto">
          <h2
            className="texto-pixel truncate text-4xl [text-shadow:3px_3px_0_var(--sombra-texto)]"
            title={i.nome}
          >
            {i.nome}
          </h2>
          <p className="text-[13px] opacity-90">
            {NOMES_LOADER[i.loader]} {i.versao}
            {i.origem.tipo === 'convite' ? ` · convite de ${i.origem.servidor}` : ''}
          </p>
        </div>
      </div>
      {soltando && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 grid place-items-center rounded-(--raio-item) border-2 border-dashed border-accent bg-(--text-on-light)/60 text-[15px] font-bold text-on-dark"
        >
          Solte a imagem para usar como fundo desta instalação
        </div>
      )}
      <div className="absolute top-3 right-3">
        <Menu
          rotulo="Trocar o fundo"
          classeBotao={classesBotao('secundario', 'pequeno')}
          painel={
            <PainelFundo
              i={i}
              daInstalacao={daInstalacao}
              definir={definir}
              imgs={imgs}
              aoErro={setErro}
              aoMudar={aoMudar}
            />
          }
        >
          Fundo
        </Menu>
      </div>
      {(erro ||
        falhou === nomeImagem ||
        (falhou && efetivo.tipo === 'bioma' && i.fundo?.tipo === 'imagem')) && (
        <div className="absolute top-14 right-3 flex max-w-sm flex-col gap-2">
          {erro && <MensagemErro erro={erro} />}
          {falhou && i.fundo?.tipo === 'imagem' && i.fundo.imagem === falhou && (
            <Aviso tipo="atencao">
              <span>A imagem desta instalação não abriu. Mostrando o bioma.</span>
            </Aviso>
          )}
        </div>
      )}
    </section>
  )
}

// Painel "Fundo" da tela Jogar (Fase V4, seção 7.2): Igual ao app, Bioma ou Imagem, com a prévia
// de cada um; embaixo, usar em todas as instalações (com confirmação) e voltar ao fundo do app.
function PainelFundo({
  i,
  daInstalacao,
  definir,
  imgs,
  aoErro,
  aoMudar
}: {
  i: Instalacao
  daInstalacao: EscolhaFundo | null
  definir: (escolha: EscolhaFundo | null, imediato?: boolean) => void
  imgs: ReturnType<typeof useImagensFundo>
  aoErro: (e: ErroTela | null) => void
  aoMudar: () => Promise<void>
}): React.JSX.Element {
  const { aparencia, fundoApp } = useAparencia()
  const [modo, setModo] = useState<'app' | 'bioma' | 'imagem'>(daInstalacao?.tipo ?? 'app')
  const [confirmar, setConfirmar] = useState(false)
  const biomaApp = aparencia?.bioma ?? 'dia'
  const doApp = fundoApp ?? { tipo: 'bioma' as const, bioma: biomaApp }
  const imagem = daInstalacao?.tipo === 'imagem' ? daInstalacao : null

  async function emTodas(): Promise<void> {
    const r = await window.api.usarFundoEmTodas(daInstalacao)
    aoErro(r.ok ? null : r.erro)
    setConfirmar(false)
    await aoMudar()
  }

  const opcoes = [
    {
      modo: 'app' as const,
      rotulo: 'Igual ao app',
      previa: <CamadaFundo escolha={doApp} parado />,
      escolher: () => definir(null)
    },
    {
      modo: 'bioma' as const,
      rotulo: 'Bioma',
      previa: (
        <ArteDoBioma
          bioma={daInstalacao?.tipo === 'bioma' ? daInstalacao.bioma : biomaApp}
          className="absolute inset-0 h-full w-full"
        />
      ),
      escolher: () => daInstalacao?.tipo !== 'bioma' && definir({ tipo: 'bioma', bioma: biomaApp })
    },
    {
      modo: 'imagem' as const,
      rotulo: 'Imagem',
      previa: imagem ? (
        <CamadaFundo escolha={imagem} parado />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-panel-2 px-2 text-center text-xs text-muted">
          Uma imagem sua
        </span>
      ),
      // Escolher "Imagem" sem imagem ainda só abre a lista (nada muda até escolher uma).
      escolher: () => {
        const primeira = imgs.imagens?.[0]
        if (!imagem && primeira) definir(escolhaDeImagem(primeira.nome, daInstalacao))
      }
    }
  ]

  return (
    <div className="flex w-[380px] max-w-[calc(100vw-48px)] flex-col gap-3">
      <p className="font-bold">Fundo de {i.nome}</p>
      <div role="radiogroup" aria-label="Fundo da instalação" className="grid grid-cols-3 gap-2">
        {opcoes.map((o) => (
          <CartaoFundo
            key={o.modo}
            rotulo={o.rotulo}
            marcado={modo === o.modo}
            aoEscolher={() => {
              setModo(o.modo)
              o.escolher()
            }}
          >
            {o.previa}
          </CartaoFundo>
        ))}
      </div>
      {modo === 'app' && (
        <p className="text-xs text-muted">
          Usa o fundo do app (Aparência › Fundo). Mudando lá, muda aqui também.
        </p>
      )}
      {modo === 'bioma' && (
        <GradeBiomas
          atual={daInstalacao?.tipo === 'bioma' ? daInstalacao.bioma : null}
          aoEscolher={(b) => definir({ tipo: 'bioma', bioma: b })}
          pequeno
        />
      )}
      {modo === 'imagem' && (
        <>
          <GradeImagens
            imagens={imgs.imagens}
            atual={imagem?.imagem ?? null}
            aoEscolher={(nome) => definir(escolhaDeImagem(nome, daInstalacao))}
            aoEscolherOutra={async () => {
              const nome = await imgs.escolher()
              if (nome) definir(escolhaDeImagem(nome, daInstalacao))
            }}
            pequeno
          />
          {imgs.erro && <MensagemErro erro={imgs.erro} />}
          {imagem && (
            <AjustesImagem
              url={urlDoFundo(imagem.imagem)}
              ajuste={imagem.ajuste}
              aoMudar={(ajuste) => definir({ ...imagem, ajuste }, false)}
            />
          )}
        </>
      )}
      <div className="flex flex-col items-start gap-1 border-t border-linha pt-3">
        {confirmar ? (
          <div className="flex flex-col gap-2">
            <p>
              Trocar o fundo de todas as instalações por {daInstalacao ? 'este' : '"Igual ao app"'}?
              Cada uma pode ser mudada de novo depois.
            </p>
            <div className="flex gap-2">
              <Botao tamanho="pequeno" variante="primario" onClick={() => void emTodas()}>
                Usar em todas
              </Botao>
              <Botao tamanho="pequeno" onClick={() => setConfirmar(false)}>
                Cancelar
              </Botao>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="text-[13px] underline hover:text-accent"
          >
            Usar este fundo em todas as instalações
          </button>
        )}
        {daInstalacao && (
          <button
            type="button"
            onClick={() => {
              setModo('app')
              definir(null)
            }}
            className="text-[13px] underline hover:text-accent"
          >
            Voltar ao fundo do app
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Barra de ação ----------

function BarraJogar({
  i,
  lista,
  estado,
  ocupado,
  outroOcupado,
  progresso,
  aoEscolher,
  aoJogar
}: {
  i: Instalacao
  lista: Instalacao[]
  estado: EstadoJogo | null
  ocupado: boolean
  outroOcupado: boolean
  progresso: Progresso | null
  aoEscolher: (id: string) => void
  aoJogar: (modo: ModoJogar) => void
}): React.JSX.Element {
  const abrirLigado = useAbrirLauncherLigado()
  const [agora, setAgora] = useState(() => Date.now())
  const jogando = estado?.fase === 'jogando'
  const abrindo = estado?.fase === 'abrindo'
  useEffect(() => {
    if (!jogando) return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [jogando])
  const status = useStatus(i)
  const vel = useVelocidade(ocupado ? progresso : null)

  const texto = ocupado
    ? 'PREPARANDO'
    : abrindo
      ? 'ABRINDO O LAUNCHER'
      : jogando
        ? `JOGANDO · ${tempo(agora - Date.parse(estado.desde))}`
        : desatualizada(i)
          ? 'ATUALIZAR E JOGAR'
          : 'JOGAR'
  const clicavel = !ocupado && !jogando && !outroOcupado
  // Dono com o servidor desligado: o botão separado liga pelo ServSquare e só então prepara o jogo.
  const mostrarLigar =
    abrirLigado && !!status?.dono && !status.online && status.podeLigar && clicavel && !abrindo
  const instalar = precisaInstalar(i) || ocupado

  return (
    <>
      <div className="grid min-h-20 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-y-2 border-linha bg-panel px-6 py-2">
        <Selecao
          aria-label="Instalação"
          value={i.id}
          onChange={(e) => aoEscolher(e.target.value)}
          className="w-full max-w-[280px] justify-self-start"
        >
          {lista.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome} · {NOMES_LOADER[x.loader]} {x.versao}
            </option>
          ))}
        </Selecao>

        {!abrirLigado ? (
          <div className="flex flex-col items-center gap-1">
            {instalar ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={!ocupado && !outroOcupado ? () => aoJogar('instalar') : undefined}
                    aria-disabled={ocupado || outroOcupado}
                    className={`${classesBotao('primario', 'grande')} ${
                      ocupado || outroOcupado
                        ? 'cursor-default active:translate-y-0! active:border-b-[3px]!'
                        : ''
                    } ${ocupado ? 'anim-brilho' : ''}`}
                  >
                    <span
                      key={rotuloInstalar(i, ocupado)}
                      className={`anim-linha ${ocupado ? 'pontos' : ''}`}
                    >
                      {rotuloInstalar(i, ocupado)}
                    </span>
                  </button>
                  <JogarEmBreve />
                </div>
                <span className="text-xs text-muted">
                  {i.instalada
                    ? 'O servidor ou a instalação mudou: atualizar troca só o que veio dele.'
                    : 'Monta a pasta da instalação com os mods, packs e servidores.'}
                </span>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <AcoesDaInstalada key={i.id} i={i} />
                <JogarEmBreve />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clicavel ? () => aoJogar('jogar') : undefined}
                aria-disabled={!clicavel}
                className={`${classesBotao('primario', 'grande')} tabular-nums ${
                  texto.length > 10 ? 'text-lg!' : ''
                } ${
                  // Sem clique (preparando, abrindo, jogando): o relevo não afunda.
                  clicavel ? '' : 'cursor-default active:translate-y-0! active:border-b-[3px]!'
                } ${ocupado || abrindo ? 'anim-brilho' : ''}`}
              >
                <span
                  key={texto.split(' ·')[0]}
                  className={`anim-linha ${ocupado || abrindo ? 'pontos' : ''}`}
                >
                  {texto}
                </span>
              </button>
              {mostrarLigar && (
                <Botao variante="secundario" onClick={() => aoJogar('ligar')}>
                  Ligar servidor e jogar
                </Botao>
              )}
            </div>
            <span className="text-xs text-muted">
              Só abre o jogo pelo Minecraft Launcher. O servidor não liga nem desliga por aqui.
            </span>
            {i.instalada && !ocupado && <AcoesDaInstalada key={i.id} i={i} compacto />}
          </div>
        )}

        <StatusDoServidor
          status={status}
          extra={
            status &&
            !status.dono && (
              <BotaoDiagnostico
                rotulo="Não consigo entrar"
                titulo={`Não consigo entrar em ${i.nome}`}
                tamanho="pequeno"
                rodar={() => window.api.diagnosticarInstalacao(i.id)}
                aoConsertar={async () => {
                  // Único conserto do amigo: atualizar a instalação (mesmo fluxo do ATUALIZAR).
                  aoJogar('instalar')
                  return 'fechar'
                }}
              />
            )
          }
        />
      </div>
      {ocupado && (
        <div className="flex flex-col gap-1 border-b-2 border-linha bg-panel-2 px-6 py-3 text-[13px]">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="min-w-0 truncate">{progresso?.etapa ?? 'Preparando...'}</span>
            {progresso && progresso.total > 0 && (
              <span className="shrink-0 font-mono text-xs text-muted">
                {bytes(progresso.recebido)} de {bytes(progresso.total)}
                {vel.porSegundo > 0 && ` · ${bytes(vel.porSegundo)}/s`}
                {vel.restante !== null && ` · falta ${tempo(vel.restante * 1000)}`}
              </span>
            )}
          </div>
          <BarraProgresso
            rotulo={progresso?.etapa ?? 'Preparando'}
            valor={progresso?.recebido ?? 0}
            maximo={progresso?.total ?? 0}
          />
        </div>
      )}
    </>
  )
}

// Status do servidor da instalação (atualiza a cada 15 s).
function useStatus(i: Instalacao): StatusServidorJogo | null {
  const [s, setS] = useState<{ id: string; valor: StatusServidorJogo | null } | null>(null)
  useEffect(() => {
    let vivo = true
    const ler = (): void => {
      window.api
        .statusDoServidorDoJogo(i.id)
        .then((r) => vivo && setS({ id: i.id, valor: r.ok ? r.valor : null }))
    }
    ler()
    const t = setInterval(ler, 15_000)
    const parar = window.api.aoMudarEstado(() => ler())
    const pararDownloads = window.api.aoMudarDownloads(() => ler()) // mods que faltaram ao ligar
    return () => {
      vivo = false
      clearInterval(t)
      parar()
      pararDownloads()
    }
  }, [i.id])
  return s?.id === i.id ? s.valor : null
}

const TEXTO_PEDIDO: Record<NonNullable<StatusServidorJogo['pedido']>['situacao'], string> = {
  pendente: 'Aguardando o dono aprovar',
  aprovado: 'Aprovado: você está na whitelist',
  recusado: 'Recusado pelo dono',
  desconhecido: 'Aguardando o dono aprovar',
  naoEnviado: 'Pedido para entrar vai quando o dono abrir o HubSquare'
}

function StatusDoServidor({
  status,
  extra
}: {
  status: StatusServidorJogo | null
  extra?: React.ReactNode // Fase M5: "Não consigo entrar" (só para o amigo)
}): React.JSX.Element {
  if (!status) {
    return (
      <span className="justify-self-end text-xs text-muted">
        Sem servidor ligado a esta instalação
      </span>
    )
  }
  const situacao = status.ligando ? 'ligando' : status.online ? 'ligado' : 'desligado'
  return (
    <div className="flex min-w-0 flex-col items-end gap-1 justify-self-end text-right text-[13px]">
      <span className="flex max-w-full min-w-0 items-center gap-2">
        <BolinhaStatus estado={situacao} />
        <b className="min-w-0 truncate" title={status.nome}>
          {status.nome}
        </b>
        <span className="shrink-0 text-muted">
          {status.ligando
            ? 'ligando…'
            : status.online === null
              ? 'sem endereço'
              : status.online
                ? status.contagem
                  ? `${status.contagem.online}/${status.contagem.max} online`
                  : `${status.jogadores.length} online`
                : 'Servidor desligado'}
        </span>
      </span>
      {status.online && status.jogadores.length > 0 && (
        <span className="flex gap-1" aria-label="Jogadores online">
          {status.jogadores.slice(0, 8).map((j) => (
            <span key={j.nome} title={j.nome}>
              <CabecaJogador nome={j.nome} uuid={j.uuid ?? undefined} />
            </span>
          ))}
        </span>
      )}
      {status.endereco && (
        <span className="truncate font-mono text-xs text-muted" title={status.endereco}>
          {status.endereco}
        </span>
      )}
      {!status.online && status.mensagem && (
        <span className="max-w-[320px] text-xs">Recado do dono: “{status.mensagem}”</span>
      )}
      {/* Fase M4: o pedido para entrar na whitelist (só do próprio jogador). */}
      {status.pedido && (
        <span
          className={`text-xs font-bold ${
            status.pedido.situacao === 'aprovado'
              ? 'text-online'
              : status.pedido.situacao === 'recusado'
                ? 'text-danger'
                : 'text-warning'
          }`}
        >
          {TEXTO_PEDIDO[status.pedido.situacao]} ({status.pedido.nick})
        </span>
      )}
      {extra}
    </div>
  )
}

// ---------- Memória ----------

function CardMemoria({ i }: { i: Instalacao }): React.JSX.Element | null {
  const [m, setM] = useState<MemoriaJogo | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const salvar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    window.api.memoriaDoJogo(i.id).then((r) => (r.ok ? setM(r.valor) : setErro(r.erro)))
  }, [i.id])
  if (erro && !m) return <MensagemErro erro={erro} />
  if (!m) {
    return (
      <section className="flex flex-col gap-2 border border-linha bg-panel p-4">
        <p className="text-[13px] font-bold">Memória do jogo</p>
        <p className="text-xs text-muted">Contando mods…</p>
      </section>
    )
  }

  function mudar(ram: number): void {
    setM((x) => x && { ...x, atual: ram, cabe: ram <= x.disponivel })
    clearTimeout(salvar.current)
    salvar.current = setTimeout(() => {
      window.api
        .definirMemoriaDoJogo(i.id, ram)
        .then((r) => (r.ok ? setM(r.valor) : setErro(r.erro)))
    }, 400)
  }

  return (
    <section className="flex flex-col gap-2 border border-linha bg-panel p-4">
      <Slider
        rotulo="Memória do jogo"
        valor={m.atual}
        min={m.min}
        max={m.max}
        aoMudar={mudar}
        formatar={(v) => `${v} GB`}
      />
      <p className="text-xs text-muted">
        Sugerido: {m.sugerida} GB ({m.mods} {m.mods === 1 ? 'mod' : 'mods'} e a memória deste PC).
        {m.servidor !== null &&
          ` O servidor roda neste PC com ${m.servidor} GB; sobram ${m.disponivel} GB para o jogo.`}
        {m.atual !== m.sugerida && (
          <>
            {' '}
            <button
              type="button"
              className="underline hover:text-texto"
              onClick={() => mudar(m.sugerida)}
            >
              Usar a sugestão
            </button>
          </>
        )}
      </p>
      {!m.cabe && (
        <p className="text-[13px] text-warning">
          <IconeAtencao className="inline-block h-3.5 w-3.5 shrink-0 align-[-2px] mr-1" /> Com o
          servidor ligado neste PC, {m.atual} GB para o jogo não cabe: diminua para {m.disponivel}{' '}
          GB ou menos, ou tire memória do servidor em Opções › Gerais.
        </p>
      )}
      {erro && <MensagemErro erro={erro} />}
    </section>
  )
}

// ---------- Depois de fechar o jogo ----------

function CardSessao({
  i,
  estado,
  aoJogarDeNovo
}: {
  i: Instalacao
  estado: EstadoJogo | null
  aoJogarDeNovo: () => void
}): React.JSX.Element | null {
  const [travamento, setTravamento] = useState<TravamentoMods | null>(null)
  const [suspeitos, setSuspeitos] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const fechou = estado?.fase === 'fechou' ? estado : null

  useEffect(() => {
    if (!fechou?.travou) return
    // A mesma análise da Fase 25 (relatório × mods), na pasta da instalação.
    window.api
      .paraInstalacao(i.id)
      .travamentoMods()
      .then((r) => {
        if (!r.ok || !r.valor) return
        setTravamento(r.valor)
        setSuspeitos(new Set(r.valor.suspeitos.map((s) => s.chave)))
      })
  }, [fechou?.travou, fechou?.quando, i.id])

  if (!fechou) return null
  const fechar = (): void => void window.api.dispensarSessao(i.id)
  return (
    <section
      className="anim-item flex flex-col gap-3 border border-linha bg-panel p-4"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 text-[13px]">
          {fechou.travou ? (
            <span className="text-warning">
              <IconeAtencao className="inline-block h-3.5 w-3.5 shrink-0 align-[-2px] mr-1" />O jogo
              fechou com um travamento
            </span>
          ) : (
            'Sessão encerrada'
          )}{' '}
          · você jogou <b>{duracaoLonga(fechou.duracaoMs)}</b>.
        </p>
        <Botao tamanho="pequeno" onClick={fechar}>
          Fechar
        </Botao>
      </div>
      {fechou.travou && travamento && (
        <div className="flex flex-col gap-2 border-t border-linha pt-3 text-[13px]">
          {travamento.causa && <p>{travamento.causa}</p>}
          {travamento.suspeitos.length ? (
            <>
              <p className="text-muted">
                Mods que podem ter causado (pelo relatório de travamento):
              </p>
              {travamento.suspeitos.map((s) => (
                <CaixaSelecao
                  key={s.chave}
                  marcada={suspeitos.has(s.chave)}
                  disabled={ocupado}
                  aoMudar={(v) =>
                    setSuspeitos((x) => {
                      const n = new Set(x)
                      if (v) n.add(s.chave)
                      else n.delete(s.chave)
                      return n
                    })
                  }
                >
                  <b>{s.titulo}</b> <span className="text-muted">— {s.motivo}</span>
                </CaixaSelecao>
              ))}
              <Botao
                className="self-start"
                variante="primario"
                disabled={ocupado || !suspeitos.size}
                onClick={async () => {
                  setOcupado(true)
                  const api = window.api.paraInstalacao(i.id)
                  const r = await api.desativarETentar([...suspeitos], travamento.nome)
                  setOcupado(false)
                  if (!r.ok) return setErro(r.erro)
                  fechar()
                  aoJogarDeNovo()
                }}
              >
                Desativar e tentar de novo
              </Botao>
            </>
          ) : (
            <p className="text-muted">
              O relatório não aponta nenhum mod. Veja o arquivo na pasta crash-reports da
              instalação.
            </p>
          )}
          {erro && <MensagemErro erro={erro} />}
        </div>
      )}
    </section>
  )
}

// ---------- Mods que faltaram ao ligar o servidor ----------

const ESTADO_DO_MOD: Record<string, { texto: string; cor: string }> = {
  aguardando: { texto: 'Aguardando o download', cor: 'text-muted' },
  conferindo: { texto: 'Detectado, conferindo…', cor: 'text-warning' },
  pronto: { texto: 'Instalado ✓', cor: 'text-online' },
  diferente: { texto: 'Arquivo diferente', cor: 'text-danger' }
}

// Só o dono: o servidor desta instalação fechou ao ligar porque faltam mods. Cada mod achado no
// Modrinth tem o link da página; o app reconhece o arquivo baixado (pelo hash) e põe na pasta mods.
function CardModsFaltando({ i }: { i: Instalacao }): React.JSX.Element | null {
  const status = useStatus(i)
  const downloads = useDownloads()
  const [erro, setErro] = useState<ErroTela | null>(null)
  const faltando = status?.dono ? status.faltando : null
  if (!faltando?.mods.length) return null
  const linhas = faltando.mods.map((m) => ({
    m,
    d: m.arquivo ? (downloads.find((x) => x.arquivo === m.arquivo) ?? null) : null
  }))
  const achados = linhas.filter((l) => l.d)
  const tudoPronto =
    achados.length === linhas.length && achados.every((l) => l.d!.estado === 'pronto')
  const abrir = async (r: Promise<{ ok: boolean; erro?: ErroTela }>): Promise<void> => {
    const x = await r
    setErro(x.ok ? null : (x.erro ?? null))
  }
  return (
    <section
      className="anim-item flex flex-col gap-3 border border-warning bg-panel p-4"
      aria-live="polite"
    >
      <p className="text-[13px] text-warning">
        <IconeAtencao className="mr-1 inline-block h-3.5 w-3.5 shrink-0 align-[-2px]" />
        {tudoPronto ? (
          <>
            Tudo instalado. Ligue o servidor <b>{status!.nome}</b> de novo.
          </>
        ) : (
          <>
            O servidor <b>{status!.nome}</b> não ligou: falta{' '}
            {linhas.length === 1 ? '1 mod' : `${linhas.length} mods`}
          </>
        )}
      </p>
      {!tudoPronto && (
        <p className="text-[13px] text-muted">
          Alguns mods do servidor precisam de outros mods que não estão na pasta mods. Abra a página
          de cada um e baixe o arquivo: o HubSquare reconhece o download na pasta Downloads e coloca
          sozinho na pasta mods do servidor.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-linha border-y border-linha">
        {linhas.map(({ m, d }) => {
          const e = d ? ESTADO_DO_MOD[d.estado] : null
          return (
            <li key={m.id} className="flex items-center gap-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1">
                <b>{m.titulo ?? m.id}</b>
                <span className="text-muted">
                  {' '}
                  — pedido por {m.pedidoPor}
                  {m.exige && ` (versão ${m.exige.replace(/ or later$/, ' ou mais nova')})`}
                </span>
                {!d && (
                  <span className="block text-xs text-muted">
                    O app não achou este mod no Modrinth para o Minecraft {i.versao}: procure pelo
                    nome e instale pela tela Mods do servidor.
                  </span>
                )}
              </span>
              {e && <span className={`text-xs ${e.cor}`}>{d?.motivo ?? e.texto}</span>}
              {d && d.estado !== 'pronto' && (
                <Botao
                  tamanho="pequeno"
                  variante="primario"
                  onClick={() => void abrir(window.api.abrirPaginaDownload(d.id))}
                >
                  Abrir página
                </Botao>
              )}
              {!d && (
                <Botao
                  tamanho="pequeno"
                  onClick={() => void abrir(window.api.buscarModFaltando(m.id))}
                >
                  Procurar no Modrinth
                </Botao>
              )}
            </li>
          )
        })}
      </ul>
      {achados.length > 0 && !tudoPronto && (
        <Botao
          className="self-start"
          tamanho="pequeno"
          onClick={() => abrirDownloads(achados[0].d!.alvo)}
        >
          Já baixei, escolher o arquivo
        </Botao>
      )}
      {erro && <MensagemErro erro={erro} />}
    </section>
  )
}

// ---------- Cards das instalações ----------

function quando(iso: string | null): string {
  if (!iso) return 'Nunca jogada'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return dias <= 0 ? 'Jogada hoje' : dias === 1 ? 'Jogada ontem' : `Jogada há ${dias} dias`
}

function CardInstalacao({
  i,
  ordem,
  selecionada,
  aoEscolher
}: {
  i: Instalacao
  ordem: number
  selecionada: boolean
  aoEscolher: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={selecionada}
      style={{ '--ordem': ordem } as React.CSSProperties}
      // Hover: sobe 2px e a imagem dá zoom leve; clique: afunda 1px (seção 6.1.3).
      className={`group anim-item isolate flex flex-col overflow-hidden border-2 bg-panel text-left transition-[transform,border-color] duration-(--dur-fast) ease-(--ease-out) hover:-translate-y-0.5 active:translate-y-px ${
        selecionada ? 'border-accent' : 'border-linha hover:border-muted'
      }`}
    >
      <div className="relative aspect-video overflow-hidden">
        {i.imagem ? (
          <img
            src={i.imagem}
            alt=""
            className="h-full w-full object-cover transition-transform duration-(--dur-fast) group-hover:scale-[1.03] [image-rendering:pixelated]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="banner-padrao h-full w-full transition-transform duration-(--dur-fast) group-hover:scale-[1.03]"
          />
        )}
        <span className="absolute bottom-2 left-2 rounded-[calc(var(--raio-pequeno)/2)] bg-accent px-2 py-0.5 text-xs font-bold text-accent-text">
          {NOMES_LOADER[i.loader]}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <span className="truncate text-[13px] font-bold" title={i.nome}>
          {i.nome}
        </span>
        <span className="text-xs text-muted">
          {i.versao} · {quando(i.ultimoUso)}
        </span>
      </div>
    </button>
  )
}
