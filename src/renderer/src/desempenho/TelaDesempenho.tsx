import { useCallback, useEffect, useRef, useState } from 'react'
import { estimarPregeracao } from '../../../shared/desempenho'
import type {
  AmostraDesempenho,
  ErroTela,
  EstadoDiagnostico,
  EstadoMapa,
  EstadoPregeracao,
  Ferramenta,
  PlanoMods,
  Progresso,
  Resultado,
  ResultadoDiagnostico
} from '../../../shared/tipos'
import { Flutuante } from '../componentes/Flutuante'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeDesempenho } from '../componentes/icones'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import {
  Aviso,
  Botao,
  CaixaSelecao,
  Campo,
  Dialogo,
  EstadoVazio,
  LinhaControle,
  PaginaAjustes,
  Secao
} from '../componentes/ui'
import { useEstadoServidor } from '../servidor/comandos'

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const inteiro = new Intl.NumberFormat('pt-BR')

function gb(bytes: number): string {
  return `${decimal.format(bytes / 1024 ** 3)} GB`
}

function duracao(segundos: number): string {
  if (segundos < 60) return 'menos de 1 minuto'
  const min = Math.round(segundos / 60)
  if (min < 60) return `cerca de ${min} min`
  return `cerca de ${decimal.format(min / 60)} h`
}

function tamanho(bytes: number): string {
  return bytes >= 1024 ** 3
    ? gb(bytes)
    : `${inteiro.format(Math.max(1, Math.round(bytes / 1024 ** 2)))} MB`
}

// Pergunta ao processo principal a cada `ms` enquanto a tela está aberta.
// `pedir` precisa ser estável (as funções de window.api são).
function useRepetir<T>(
  pedir: () => Promise<Resultado<T>>,
  ms: number
): {
  valor: T | null
  erro: ErroTela | null
  atualizar: () => void
} {
  const [valor, setValor] = useState<T | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const atualizar = useCallback(() => {
    pedir().then((r) => {
      if (r.ok) {
        setValor(r.valor)
        setErro(null)
      } else setErro(r.erro)
    })
  }, [pedir])
  useEffect(() => {
    atualizar()
    const id = setInterval(atualizar, ms)
    return () => clearInterval(id)
  }, [atualizar, ms])
  return { valor, erro, atualizar }
}

// Tela Desempenho (Fase 18).
export function TelaDesempenho({ aba }: { aba: string }): React.JSX.Element {
  return (
    <PaginaAjustes largo>
      {aba === 'Visão geral' && <AbaVisao />}
      {aba === 'Pré-gerar mundo' && <AbaPregerar />}
      {aba === 'Diagnóstico' && <AbaDiagnostico />}
      {aba === 'Mapa' && <AbaMapa />}
    </PaginaAjustes>
  )
}

// ---------- Gráfico (uma medida por gráfico, só a cor de destaque) ----------

function Grafico({
  titulo,
  amostras,
  valor,
  maximo,
  formatar
}: {
  titulo: string
  amostras: AmostraDesempenho[]
  valor: (a: AmostraDesempenho) => number | null
  maximo: number
  formatar: (v: number) => string
}): React.JSX.Element {
  const [foco, setFoco] = useState<number | null>(null)
  const pontoDica = useRef<HTMLSpanElement>(null)
  const L = 300
  const A = 64
  // Referência de tempo: a medida mais nova (chegam a cada 10 s).
  const agora = amostras[amostras.length - 1]?.t ?? 0
  const x = (t: number): number => L - ((agora - t) / (10 * 60 * 1000)) * L
  const y = (v: number): number => A - 2 - (Math.min(v, maximo) / maximo) * (A - 4)
  const pontos = amostras.flatMap((a) => {
    const v = valor(a)
    return v === null ? [] : [{ a, v, x: x(a.t), y: y(v) }]
  })
  const atual = pontos[pontos.length - 1]
  const focado = foco !== null ? pontos[foco] : null

  function mover(e: React.MouseEvent<SVGSVGElement>): void {
    if (!pontos.length) return
    const caixa = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - caixa.left) / caixa.width) * L
    let melhor = 0
    pontos.forEach((p, i) => {
      if (Math.abs(p.x - px) < Math.abs(pontos[melhor].x - px)) melhor = i
    })
    setFoco(melhor)
  }

  return (
    <CardPainel titulo={titulo}>
      <p className="texto-pixel text-[22px]">{atual ? formatar(atual.v) : '—'}</p>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${L} ${A}`}
          preserveAspectRatio="none"
          className="h-16 w-full"
          role="img"
          aria-label={`${titulo} nos últimos 10 minutos${atual ? `, agora ${formatar(atual.v)}` : ', sem dados'}`}
          onMouseMove={mover}
          onMouseLeave={() => setFoco(null)}
        >
          <line
            x1="0"
            x2={L}
            y1={A - 2}
            y2={A - 2}
            className="stroke-linha"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {pontos.length > 1 && (
            <polyline
              points={pontos.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {focado && (
            <line
              x1={focado.x}
              x2={focado.x}
              y1="0"
              y2={A}
              className="stroke-muted"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Ponto invisível no alto do gráfico: a dica abre colada nele, na camada flutuante. */}
        <span
          ref={pontoDica}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 h-0 w-0"
          style={{ left: `${((focado?.x ?? 0) / L) * 100}%` }}
        />
        <Flutuante
          ancora={pontoDica}
          aberto={!!focado}
          aoFechar={() => {}}
          fecharAoClicarFora={false}
          lado="cima"
          alinhar="centro"
          role="tooltip"
          className="pointer-events-none"
        >
          {focado && (
            <div className="border border-linha bg-panel px-2 py-0.5 text-xs whitespace-nowrap">
              <b>{formatar(focado.v)}</b>{' '}
              <span className="text-muted">
                {Math.round((agora - focado.a.t) / 60000)
                  ? `há ${Math.round((agora - focado.a.t) / 60000)} min`
                  : 'agora'}
              </span>
            </div>
          )}
        </Flutuante>
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>10 min atrás</span>
        <span>agora</span>
      </div>
    </CardPainel>
  )
}

// ---------- Visão geral ----------

function AbaVisao(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const { valor: v, erro, atualizar } = useRepetir(window.api.visaoDesempenho, 5000)
  const [salvando, setSalvando] = useState(false)
  const [erroJava, setErroJava] = useState<ErroTela | null>(null)

  if (!v) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={6} />

  async function mudarJava(novo: boolean): Promise<void> {
    setSalvando(true)
    setErroJava(null)
    const r = await window.api.definirJavaOtimizado(novo)
    setSalvando(false)
    if (!r.ok) setErroJava(r.erro)
    atualizar()
  }

  const ramMax = v.amostras[v.amostras.length - 1]?.ramMax ?? 1
  const maxJogadores = Math.max(5, ...v.amostras.map((a) => a.jogadores))
  return (
    <>
      {estado !== 'ligado' && (
        <Aviso tipo="atencao">Ligue o servidor para ver os números ao vivo.</Aviso>
      )}
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 min-[1300px]:grid-cols-4">
        <Grafico
          titulo="TPS"
          amostras={v.amostras}
          valor={(a) => a.tps}
          maximo={20}
          formatar={(n) => `${decimal.format(n)} de 20`}
        />
        <Grafico
          titulo="CPU"
          amostras={v.amostras}
          valor={(a) => a.cpu}
          maximo={100}
          formatar={(n) => `${Math.round(n)}%`}
        />
        <Grafico
          titulo="RAM"
          amostras={v.amostras}
          valor={(a) => a.ram}
          maximo={ramMax}
          formatar={gb}
        />
        <Grafico
          titulo="Jogadores"
          amostras={v.amostras}
          valor={(a) => a.jogadores}
          maximo={maxJogadores}
          formatar={(n) => inteiro.format(n)}
        />
      </div>
      {!v.tpsDisponivel && (
        <p className="text-xs text-muted">
          Este software não informa o TPS sozinho. No Fabric, instale o spark (aba Diagnóstico) para
          ver o TPS.
        </p>
      )}

      <Secao titulo="Dicas">
        {v.dicas.length ? (
          <ul className="flex flex-col gap-2">
            {v.dicas.map((d) => (
              <li
                key={d}
                className="anim-item border-l-4 border-accent bg-panel px-4 py-2 text-[13px]"
              >
                {d}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">Tudo certo por aqui.</p>
        )}
      </Secao>

      <Secao titulo="Java">
        <LinhaControle
          rotulo="Usar configuração otimizada do Java"
          ligado={v.javaOtimizado}
          disabled={salvando}
          aoMudar={mudarJava}
        />
        <p className="text-xs text-muted">
          Ajusta a limpeza de memória do Java para pausas mais curtas (as &quot;flags do
          Aikar&quot;, recomendadas pelo PaperMC). Vale na próxima vez que o servidor ligar.
        </p>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted">Ver as flags</summary>
          <pre className="mt-2 overflow-auto bg-console p-3 font-mono whitespace-pre-wrap text-white">
            {v.flags.join(' ')}
          </pre>
        </details>
        {erroJava && <MensagemErro erro={erroJava} />}
      </Secao>
    </>
  )
}

// ---------- Instalar uma ferramenta (mesma lógica da tela Mods) ----------

function InstalarFerramenta({
  ferramenta,
  aoMudar,
  children
}: {
  ferramenta: Ferramenta
  aoMudar: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [plano, setPlano] = useState<PlanoMods | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  async function planejar(): Promise<void> {
    if (!ferramenta.projetoId) return
    setOcupado(true)
    setErro(null)
    const r = await window.api.planejarMod(ferramenta.projetoId)
    setOcupado(false)
    if (!r.ok) return setErro(r.erro)
    setPlano(r.valor)
  }

  async function instalar(): Promise<void> {
    if (!plano) return
    setOcupado(true)
    const r = await window.api.instalarMods(plano.token)
    setOcupado(false)
    setProgresso(null)
    setPlano(null)
    if (!r.ok) setErro(r.erro)
    aoMudar()
  }

  if (ferramenta.estado === 'indisponivel') {
    return (
      <EstadoVazio
        icone={<IconeDesempenho />}
        titulo={`Sem ${ferramenta.nome} aqui`}
        texto={ferramenta.motivo ?? ''}
      />
    )
  }
  if (ferramenta.estado === 'instalado' || ferramenta.estado === 'embutido') return <>{children}</>

  return (
    <div className="flex flex-col gap-3">
      {ferramenta.estado === 'ausente' && (
        <CardPainel titulo={`Precisa do ${ferramenta.nome}`}>
          <p className="mb-3 text-[13px]">
            O app instala o {ferramenta.nome} do Modrinth, na versão certa para este servidor. Ele
            aparece também na tela Mods.
          </p>
          <Botao variante="primario" onClick={planejar} disabled={ocupado}>
            {ocupado ? 'Verificando...' : `Instalar o ${ferramenta.nome}`}
          </Botao>
        </CardPainel>
      )}
      {ferramenta.estado === 'pendente' && (
        <Aviso tipo="atencao">
          <span className="flex-1">Reinicie o servidor para ativar o {ferramenta.nome}.</span>
          {estado === 'ligado' && (
            <Botao variante="atencao" tamanho="pequeno" onClick={() => window.api.reiniciar()}>
              Reiniciar
            </Botao>
          )}
        </Aviso>
      )}
      {ferramenta.estado === 'desativado' && (
        <Aviso tipo="atencao">O {ferramenta.nome} está desativado. Ative ele na tela Mods.</Aviso>
      )}
      {erro && <MensagemErro erro={erro} />}

      <Dialogo
        aberto={!!plano}
        titulo={`Instalar o ${ferramenta.nome}?`}
        aoCancelar={() => !ocupado && setPlano(null)}
        acao={{
          rotulo: ocupado ? 'Instalando...' : 'Instalar',
          variante: 'primario',
          ocupado,
          desabilitado: !plano?.itens.length || !!plano?.problemas.length,
          aoClicar: instalar
        }}
      >
        {plano && (
          <div className="flex flex-col gap-2 text-[13px]">
            <ul>
              {plano.itens.map((i) => (
                <li key={i.arquivo}>
                  <b>{i.titulo}</b> <span className="text-muted">{i.versao}</span>
                  {i.dependencia && ' (necessário)'}
                </li>
              ))}
            </ul>
            {plano.avisos.map((a) => (
              <p key={a} className="text-warning">
                ⚠ {a}
              </p>
            ))}
            {plano.problemas.map((p) => (
              <p key={p} className="text-danger">
                {p}
              </p>
            ))}
            {estado !== 'desligado' && (
              <p className="text-muted">
                Com o servidor ligado, ele entra quando o servidor reiniciar.
              </p>
            )}
            {ocupado && progresso && (
              <BarraProgresso
                rotulo={progresso.etapa}
                valor={progresso.recebido}
                maximo={progresso.total}
              />
            )}
          </div>
        )}
      </Dialogo>
    </div>
  )
}

// ---------- Pré-gerar mundo (Chunky) ----------

const RAIOS = [500, 1000, 2000, 5000]

function AbaPregerar(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const {
    valor: p,
    erro,
    atualizar
  } = useRepetir<EstadoPregeracao>(window.api.estadoPregeracao, 2000)
  const [raio, setRaio] = useState(1000)
  const [cancelando, setCancelando] = useState(false)
  const [erroAcao, setErroAcao] = useState<ErroTela | null>(null)

  if (!p) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />

  async function rodar(acao: () => Promise<Resultado<void>>): Promise<void> {
    setErroAcao(null)
    const r = await acao()
    if (!r.ok) setErroAcao(r.erro)
    atualizar()
  }

  const est = estimarPregeracao(raio)
  const t = p.tarefa
  const ativa = t.estado === 'rodando' || t.estado === 'iniciando'
  return (
    <InstalarFerramenta ferramenta={p.ferramenta} aoMudar={atualizar}>
      <Aviso tipo="atencao">
        Enquanto gera, o servidor fica mais pesado: quem estiver jogando pode sentir lag. O melhor é
        gerar com ninguém online.
      </Aviso>
      <Secao titulo="Tamanho">
        <p className="text-[13px] text-muted">
          Gera o mundo em volta do ponto de nascimento antes de alguém explorar, para não travar
          depois.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {RAIOS.map((r) => (
            <Botao
              key={r}
              tamanho="pequeno"
              variante={raio === r ? 'primario' : 'secundario'}
              onClick={() => setRaio(r)}
              disabled={ativa}
            >
              {inteiro.format(r)} blocos
            </Botao>
          ))}
          <label className="flex items-center gap-2 text-[13px]">
            Outro:
            <Campo
              type="number"
              min={16}
              max={50000}
              step={100}
              value={raio}
              disabled={ativa}
              onChange={(e) =>
                setRaio(Math.max(16, Math.min(50000, Math.round(Number(e.target.value) || 16))))
              }
              className="w-28"
            />
          </label>
        </div>
        <p className="text-[13px]">
          Raio de {inteiro.format(raio)} blocos: {inteiro.format(est.chunks)} chunks,{' '}
          {duracao(est.segundos)} e uns {tamanho(est.bytes)} no disco (estimativa).
        </p>
      </Secao>

      <Secao titulo="Geração">
        {t.estado !== 'parado' && t.estado !== 'pergunta' && (
          <div className="flex flex-col gap-1 text-[13px]">
            <BarraProgresso rotulo="Pré-geração" valor={t.porcentagem} maximo={100} />
            <span>
              {t.estado === 'concluido'
                ? `Pronto! ${inteiro.format(t.chunks)} chunks gerados.`
                : t.estado === 'pausado'
                  ? `Pausado em ${decimal.format(t.porcentagem)}%.`
                  : t.estado === 'iniciando'
                    ? 'Começando...'
                    : `${decimal.format(t.porcentagem)}% · ${inteiro.format(t.chunks)} chunks · faltam ${t.eta} · ${decimal.format(t.velocidade ?? 0)} chunks/s`}
            </span>
          </div>
        )}
        {t.estado === 'pergunta' && t.pergunta && (
          <Aviso tipo="atencao">
            <span className="flex-1">{t.pergunta.texto}</span>
            {t.pergunta.motivo === 'tarefa-antiga' ? (
              <>
                <Botao
                  tamanho="pequeno"
                  onClick={() => rodar(() => window.api.controlarPregeracao('continuar'))}
                >
                  Continuar a anterior
                </Botao>
                <Botao
                  tamanho="pequeno"
                  variante="atencao"
                  onClick={() => rodar(() => window.api.controlarPregeracao('confirmar'))}
                >
                  Começar de novo
                </Botao>
              </>
            ) : (
              <Botao
                tamanho="pequeno"
                variante="atencao"
                onClick={() => rodar(() => window.api.controlarPregeracao('confirmar'))}
              >
                Gerar mesmo assim
              </Botao>
            )}
          </Aviso>
        )}
        <div className="flex flex-wrap gap-2">
          {!ativa && t.estado !== 'pausado' && (
            <Botao
              variante="primario"
              disabled={estado !== 'ligado'}
              onClick={() => rodar(() => window.api.iniciarPregeracao(raio))}
            >
              Iniciar
            </Botao>
          )}
          {ativa && (
            <Botao onClick={() => rodar(() => window.api.controlarPregeracao('pausar'))}>
              Pausar
            </Botao>
          )}
          {t.estado === 'pausado' && (
            <Botao
              variante="primario"
              onClick={() => rodar(() => window.api.controlarPregeracao('continuar'))}
            >
              Continuar
            </Botao>
          )}
          {(ativa || t.estado === 'pausado') && (
            <Botao variante="perigo" onClick={() => setCancelando(true)}>
              Cancelar
            </Botao>
          )}
        </div>
        {estado !== 'ligado' && (
          <p className="text-xs text-muted">Ligue o servidor para pré-gerar.</p>
        )}
        {erroAcao && <MensagemErro erro={erroAcao} />}
      </Secao>

      <Dialogo
        aberto={cancelando}
        titulo="Cancelar a pré-geração?"
        aoCancelar={() => setCancelando(false)}
        acao={{
          rotulo: 'Cancelar a geração',
          variante: 'perigo',
          aoClicar: async () => {
            setCancelando(false)
            await rodar(() => window.api.controlarPregeracao('cancelar'))
          }
        }}
      >
        <p>O que já foi gerado fica no mundo, mas a tarefa não pode ser continuada depois.</p>
      </Dialogo>
    </InstalarFerramenta>
  )
}

// ---------- Diagnóstico (spark) ----------

function AbaDiagnostico(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const {
    valor: d,
    erro,
    atualizar
  } = useRepetir<EstadoDiagnostico>(window.api.estadoDiagnostico, 5000)
  const [resultado, setResultado] = useState<ResultadoDiagnostico | null>(null)
  const [rodando, setRodando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [erroDiag, setErroDiag] = useState<ErroTela | null>(null)

  useEffect(() => {
    if (!rodando) return
    const inicio = Date.now()
    const id = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 500)
    return () => clearInterval(id)
  }, [rodando])

  if (!d) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />

  async function diagnosticar(): Promise<void> {
    setErroDiag(null)
    setResultado(null)
    setSegundos(0)
    setRodando(true)
    const r = await window.api.diagnosticar()
    setRodando(false)
    if (!r.ok) return setErroDiag(r.erro)
    setResultado(r.valor)
  }

  return (
    <InstalarFerramenta ferramenta={d.ferramenta} aoMudar={atualizar}>
      <Secao titulo="Diagnosticar lag">
        <p className="text-[13px] text-muted">
          O spark observa o servidor por 60 segundos e mostra quem está gastando mais tempo.
          Funciona melhor com alguém jogando, na hora em que o lag acontece.
        </p>
        <Botao
          variante="primario"
          className="self-start"
          disabled={estado !== 'ligado' || rodando || !!d.rodandoDesde}
          onClick={diagnosticar}
        >
          {rodando ? 'Diagnosticando...' : 'Diagnosticar lag'}
        </Botao>
        {estado !== 'ligado' && (
          <p className="text-xs text-muted">Ligue o servidor para diagnosticar.</p>
        )}
        {rodando && (
          <div className="flex flex-col gap-1 text-[13px]">
            <BarraProgresso rotulo="Diagnóstico" valor={Math.min(segundos, 60)} maximo={60} />
            <span>
              {segundos < 60
                ? `Observando... faltam ${60 - segundos} s`
                : 'Enviando o relatório...'}
            </span>
          </div>
        )}
        {erroDiag && <MensagemErro erro={erroDiag} />}
      </Secao>

      {resultado && (
        <CardPainel
          titulo="Resultado"
          acoes={
            <a
              href={resultado.link}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] underline"
            >
              Abrir o relatório completo
            </a>
          }
        >
          <p className="mb-3 text-[13px]">{resultado.resumo}</p>
          {resultado.culpados.length > 0 && (
            <ol className="flex flex-col gap-2">
              {resultado.culpados.map((c, i) => (
                <li key={c.nome} className="flex items-center gap-3 text-[13px]">
                  <span className="texto-pixel w-6 text-accent">{i + 1}</span>
                  <span className="flex-1 font-bold">{c.nome}</span>
                  <span className="font-mono">{c.porcentagem}% do tempo</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">{resultado.link}</p>
        </CardPainel>
      )}
    </InstalarFerramenta>
  )
}

// ---------- Mapa (BlueMap ou Dynmap) ----------

function Endereco({ rotulo, url }: { rotulo: string; url: string | null }): React.JSX.Element {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="flex items-center gap-3 bg-panel-2 px-4 py-2 text-[13px]">
      <span className="w-28 text-muted">{rotulo}</span>
      <span className="flex-1 font-mono">{url ?? 'não encontrado'}</span>
      {url && (
        <Botao
          tamanho="pequeno"
          onClick={() => {
            navigator.clipboard.writeText(url)
            setCopiado(true)
          }}
        >
          {copiado ? 'Copiado!' : 'Copiar'}
        </Botao>
      )}
    </div>
  )
}

function AbaMapa(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const { valor: m, erro, atualizar } = useRepetir<EstadoMapa>(window.api.estadoMapa, 5000)
  const [aceito, setAceito] = useState(false)
  const [erroAcao, setErroAcao] = useState<ErroTela | null>(null)

  if (!m) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />

  async function rodar(acao: () => Promise<Resultado<void>>): Promise<void> {
    setErroAcao(null)
    const r = await acao()
    if (!r.ok) setErroAcao(r.erro)
    atualizar()
  }

  const nome = m.ferramenta.nome
  return (
    <InstalarFerramenta ferramenta={m.ferramenta} aoMudar={atualizar}>
      {!m.configCriada ? (
        <Aviso tipo="atencao">
          {estado === 'ligado'
            ? `O ${nome} está preparando a configuração. Espere alguns segundos.`
            : `Ligue o servidor uma vez para o ${nome} criar a configuração.`}
        </Aviso>
      ) : m.precisaAceitar ? (
        <CardPainel titulo="O BlueMap precisa da sua permissão">
          <p className="mb-3 text-[13px]">
            Para desenhar os blocos, o BlueMap baixa um arquivo do jogo direto dos servidores da
            Mojang. Ao aceitar, você confirma que tem o Minecraft Java original e que concorda com o{' '}
            <a
              href="https://aka.ms/MinecraftEULA"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              EULA do Minecraft
            </a>{' '}
            (
            <a
              href="https://bluemap.bluecolored.de/wiki/getting-started/Installation.html"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              explicação do BlueMap
            </a>
            ).
          </p>
          <CaixaSelecao marcada={aceito} aoMudar={setAceito}>
            Aceito que o BlueMap baixe esse arquivo da Mojang
          </CaixaSelecao>
          <Botao
            variante="primario"
            className="mt-3"
            disabled={!aceito}
            onClick={() => rodar(window.api.aceitarTermosMapa)}
          >
            Aceitar e continuar
          </Botao>
        </CardPainel>
      ) : (
        <>
          <Secao titulo="Renderização">
            {estado !== 'ligado' ? (
              <p className="text-[13px] text-muted">Ligue o servidor para o mapa funcionar.</p>
            ) : m.render ? (
              <div className="flex flex-col gap-1 text-[13px]">
                <BarraProgresso
                  rotulo="Renderização do mapa"
                  valor={m.render.porcentagem ?? 0}
                  maximo={100}
                />
                <span>
                  {m.render.ocioso
                    ? 'Mapa em dia. Ele se atualiza sozinho quando o mundo muda.'
                    : `Desenhando o mapa: ${decimal.format(m.render.porcentagem ?? 0)}%`}
                </span>
              </div>
            ) : (
              <p className="text-[13px] text-muted">
                {nome === 'BlueMap'
                  ? 'Perguntando ao BlueMap como está o desenho...'
                  : 'O Dynmap desenha o mapa aos poucos, conforme os jogadores andam pelo mundo.'}
              </p>
            )}
          </Secao>
          <Secao titulo="Endereços do mapa">
            <Botao
              variante="destaque"
              className="self-start"
              disabled={estado !== 'ligado'}
              onClick={() => rodar(window.api.abrirMapa)}
            >
              Abrir mapa
            </Botao>
            <Endereco rotulo="Rede local" url={m.rede} />
            <Endereco rotulo="Radmin VPN" url={m.radmin} />
            <p className="text-xs text-muted">
              Seus amigos abrem esses endereços no navegador. Pela internet (playit.gg ou porta
              aberta), o mapa não fica acessível nesta versão. Se não abrir em outro PC, crie a
              regra do firewall na tela Conexão.
            </p>
          </Secao>
        </>
      )}
      {erroAcao && <MensagemErro erro={erroAcao} />}
    </InstalarFerramenta>
  )
}
