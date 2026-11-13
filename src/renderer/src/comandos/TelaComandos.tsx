import { useEffect, useMemo, useState } from 'react'
import { DIFICULDADES, MODOS_JOGO, CORES_TEXTO, type CorTexto } from '../../../shared/comandos'
import type {
  DadosCentral,
  ErroTela,
  EstadoDadosComandos,
  ItemCentral,
  Progresso
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeComandos, IconePocao } from '../componentes/icones'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import {
  Aviso,
  Botao,
  CaixaSelecao,
  Campo,
  EstadoVazio,
  PaginaAjustes,
  Selecao,
  Slider
} from '../componentes/ui'
import { AvisoIcones, IconeItem } from '../jogadores/AbaInventario'
import { useEstadoServidor, useJogadores } from '../servidor/comandos'
import { Atalhos } from './Atalhos'
import { EscolherJogadores, Executar, type Central } from './pecas'
import { RegrasDoJogo } from './RegrasDoJogo'
import { CORES_DO_TEXTO, corDoEfeito } from './textosComandos'

const MB = (b: number): string => `${Math.max(1, Math.round(b / 1024 / 1024))} MB`

// Tela Comandos (Fase 26): quase tudo sem decorar comandos. A sintaxe vem da própria versão.
export function TelaComandos({ aba }: { aba: string }): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const ligado = estado === 'ligado'
  const [preparo, setPreparo] = useState<EstadoDadosComandos | null>(null)
  const [dados, setDados] = useState<DadosCentral | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  async function carregar(): Promise<void> {
    setErro(null)
    const e = await window.api.estadoDadosComandos()
    if (!e.ok) return setErro(e.erro)
    setPreparo(e.valor)
    if (!e.valor.pronto) return
    const d = await window.api.dadosCentral()
    if (d.ok) setDados(d.valor)
    else setErro(d.erro)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura
    void carregar()
  }, [])

  const central = useMemo<Central | null>(
    () =>
      dados && {
        ligado,
        ctx: {
          arvore: dados.arvore,
          itens: new Set(dados.itens.map((i) => i.id)),
          efeitos: new Set(dados.efeitos.map((e) => e.id))
        }
      },
    [dados, ligado]
  )

  if (!preparo) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }

  if (!preparo.pronto) {
    return (
      <PaginaAjustes>
        <EstadoVazio
          icone={<IconeComandos />}
          titulo="Preparar os comandos desta versão"
          texto={`Para saber exatamente quais comandos, itens e efeitos existem na sua versão do Minecraft, o app baixa uma vez o servidor oficial da Mojang (${MB(preparo.tamanho)}) e lê a lista dele. Leva menos de um minuto e fica guardado.`}
        >
          <Botao
            variante="primario"
            disabled={preparando}
            onClick={async () => {
              setPreparando(true)
              setErro(null)
              const r = await window.api.prepararDadosComandos()
              setPreparando(false)
              setProgresso(null)
              if (!r.ok) return setErro(r.erro)
              await carregar()
            }}
          >
            {preparando ? 'Preparando...' : 'Preparar comandos'}
          </Botao>
        </EstadoVazio>
        {preparando && progresso && (
          <BarraProgresso
            rotulo={progresso.etapa}
            valor={progresso.recebido}
            maximo={progresso.total}
          />
        )}
        {erro && <MensagemErro erro={erro} />}
      </PaginaAjustes>
    )
  }

  if (!dados || !central) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }

  return (
    <PaginaAjustes largo>
      {!ligado && aba !== 'Atalhos' && (
        <Aviso tipo="atencao">
          Ligue o servidor para usar os comandos. Dá para olhar e montar tudo antes.
        </Aviso>
      )}
      {erro && <MensagemErro erro={erro} />}
      {aba === 'Mundo' && <AbaMundo central={central} />}
      {aba === 'Regras do jogo' && (
        <RegrasDoJogo central={central} regras={dados.capacidades.gamerules} />
      )}
      {aba === 'Jogadores' && <AbaJogadores central={central} />}
      {aba === 'Itens' && <AbaItens central={central} dados={dados} aoBaixarIcones={carregar} />}
      {aba === 'Efeitos' && <AbaEfeitos central={central} dados={dados} />}
      {aba === 'Mensagens' && <AbaMensagens central={central} />}
      {aba === 'Atalhos' && <Atalhos ligado={ligado} />}
    </PaginaAjustes>
  )
}

const num = (v: string): number => (v.trim() === '' ? NaN : Number(v))

// ---------- Mundo ----------

function AbaMundo({ central }: { central: Central }): React.JSX.Element {
  const online = useJogadores()
  const [ticks, setTicks] = useState(6000)
  const [duracao, setDuracao] = useState('')
  const [spawn, setSpawn] = useState({ x: '0', y: '64', z: '0' })
  const [spawnJogador, setSpawnJogador] = useState<string[]>([])
  const [borda, setBorda] = useState({ tamanho: '1000', segundos: '', x: '0', z: '0' })
  const segundos = duracao.trim() ? Math.round(num(duracao) * 60) : null

  return (
    <div className="grid gap-6 min-[1100px]:grid-cols-2">
      <CardPainel titulo="Tempo">
        <div className="flex flex-col gap-4">
          {(
            [
              ['Dia', 1000],
              ['Meio-dia', 6000],
              ['Noite', 13000],
              ['Meia-noite', 18000]
            ] as const
          ).map(([rotulo, t]) => (
            <Executar
              key={rotulo}
              central={central}
              rotulo={rotulo}
              variante="secundario"
              acao={{ tipo: 'tempo', ticks: t }}
            />
          ))}
          <Slider
            rotulo="Hora exata (ticks)"
            valor={ticks}
            min={0}
            max={24000}
            passo={250}
            aoMudar={setTicks}
            formatar={(v) =>
              `${v} · ${String(Math.floor(((v + 6000) % 24000) / 1000)).padStart(2, '0')}h`
            }
          />
          <Executar central={central} rotulo="Mudar a hora" acao={{ tipo: 'tempo', ticks }} />
        </div>
      </CardPainel>

      <CardPainel titulo="Clima">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-[13px]">
            Duração em minutos (vazio: o jogo decide)
            <Campo
              inputMode="numeric"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </label>
          {(
            [
              ['Tempo limpo', 'clear'],
              ['Chuva', 'rain'],
              ['Tempestade', 'thunder']
            ] as const
          ).map(([rotulo, clima]) => (
            <Executar
              key={clima}
              central={central}
              rotulo={rotulo}
              variante="secundario"
              acao={{ tipo: 'clima', clima, segundos }}
            />
          ))}
        </div>
      </CardPainel>

      <CardPainel titulo="Dificuldade">
        <div className="flex flex-col gap-3">
          {DIFICULDADES.map((d) => (
            <Executar
              key={d}
              central={central}
              variante="secundario"
              rotulo={{ peaceful: 'Pacífica', easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[d]}
              acao={{ tipo: 'dificuldade', valor: d }}
            />
          ))}
          <p className="text-xs text-muted">
            Ao reiniciar, volta para a do server.properties (Opções).
          </p>
        </div>
      </CardPainel>

      <CardPainel titulo="Spawn do mundo">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {(['x', 'y', 'z'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-[13px] uppercase">
                {k}
                <Campo
                  inputMode="numeric"
                  value={spawn[k]}
                  onChange={(e) => setSpawn({ ...spawn, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <Executar
            central={central}
            rotulo="Definir nas coordenadas"
            acao={{ tipo: 'spawn', x: num(spawn.x), y: num(spawn.y), z: num(spawn.z) }}
          />
          <EscolherJogadores
            online={online}
            escolhidos={spawnJogador}
            aoMudar={setSpawnJogador}
            umSo
            rotulo="Ou onde está o jogador"
          />
          {spawnJogador[0] && (
            <Executar
              central={central}
              rotulo={`Definir onde ${spawnJogador[0]} está`}
              acao={{ tipo: 'spawnJogador', jogador: spawnJogador[0] }}
            />
          )}
        </div>
      </CardPainel>

      <CardPainel titulo="Borda do mundo">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[13px]">
              Tamanho (blocos de lado)
              <Campo
                inputMode="numeric"
                value={borda.tamanho}
                onChange={(e) => setBorda({ ...borda, tamanho: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              Mudar aos poucos em (segundos)
              <Campo
                inputMode="numeric"
                value={borda.segundos}
                placeholder="na hora"
                onChange={(e) => setBorda({ ...borda, segundos: e.target.value })}
              />
            </label>
          </div>
          <Executar
            central={central}
            rotulo="Mudar o tamanho"
            acao={{
              tipo: 'borda',
              tamanho: num(borda.tamanho),
              segundos: borda.segundos.trim() ? num(borda.segundos) : null
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            {(['x', 'z'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-[13px]">
                Centro {k.toUpperCase()}
                <Campo
                  inputMode="numeric"
                  value={borda[k]}
                  onChange={(e) => setBorda({ ...borda, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <Executar
            central={central}
            rotulo="Mudar o centro"
            acao={{ tipo: 'centroBorda', x: num(borda.x), z: num(borda.z) }}
          />
        </div>
      </CardPainel>
    </div>
  )
}

// ---------- Jogadores ----------

function AbaJogadores({ central }: { central: Central }): React.JSX.Element {
  const online = useJogadores()
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [modo, setModo] = useState<(typeof MODOS_JOGO)[number]>('survival')
  const [alvo, setAlvo] = useState<string[]>([])
  const [xyz, setXyz] = useState({ x: '0', y: '80', z: '0' })
  const [xp, setXp] = useState('10')
  const [unidade, setUnidade] = useState<'levels' | 'points'>('levels')
  const [motivo, setMotivo] = useState('')
  const jogadores = escolhidos.filter((n) => online.includes(n))
  const NOMES_MODO = {
    survival: 'Sobrevivência',
    creative: 'Criativo',
    adventure: 'Aventura',
    spectator: 'Espectador'
  }

  return (
    <div className="flex flex-col gap-6">
      <EscolherJogadores online={online} escolhidos={jogadores} aoMudar={setEscolhidos} />
      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <CardPainel titulo="Modo de jogo">
          <div className="flex flex-col gap-3">
            <Selecao
              aria-label="Modo de jogo"
              value={modo}
              onChange={(e) => setModo(e.target.value as typeof modo)}
            >
              {MODOS_JOGO.map((m) => (
                <option key={m} value={m}>
                  {NOMES_MODO[m]}
                </option>
              ))}
            </Selecao>
            <Executar
              central={central}
              rotulo="Aplicar o modo"
              acao={{ tipo: 'modo', modo, jogadores }}
            />
          </div>
        </CardPainel>

        <CardPainel titulo="Teleportar">
          <div className="flex flex-col gap-3">
            <EscolherJogadores
              online={online}
              escolhidos={alvo}
              aoMudar={setAlvo}
              umSo
              rotulo="Até o jogador"
            />
            {alvo[0] && (
              <Executar
                central={central}
                rotulo={`Levar até ${alvo[0]}`}
                acao={{ tipo: 'tpJogador', alvo: alvo[0], jogadores }}
              />
            )}
            <div className="grid grid-cols-3 gap-2">
              {(['x', 'y', 'z'] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1 text-[13px] uppercase">
                  {k}
                  <Campo
                    inputMode="decimal"
                    value={xyz[k]}
                    onChange={(e) => setXyz({ ...xyz, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <Executar
              central={central}
              rotulo="Levar até as coordenadas"
              acao={{ tipo: 'tpCoord', jogadores, x: num(xyz.x), y: num(xyz.y), z: num(xyz.z) }}
            />
          </div>
        </CardPainel>

        <CardPainel titulo="Vida, fome e XP">
          <div className="flex flex-col gap-3">
            <Executar central={central} rotulo="Curar" acao={{ tipo: 'curar', jogadores }} />
            <Executar
              central={central}
              rotulo="Alimentar"
              acao={{ tipo: 'alimentar', jogadores }}
            />
            <div className="flex gap-2">
              <Campo
                aria-label="Quantidade de XP"
                inputMode="numeric"
                value={xp}
                onChange={(e) => setXp(e.target.value)}
                className="w-28"
              />
              <Selecao
                aria-label="Pontos ou níveis"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value as typeof unidade)}
                className="w-40"
              >
                <option value="levels">níveis</option>
                <option value="points">pontos</option>
              </Selecao>
            </div>
            <Executar
              central={central}
              rotulo="Dar XP"
              acao={{ tipo: 'xp', jogadores, quantidade: num(xp), unidade }}
            />
          </div>
        </CardPainel>

        <CardPainel titulo="Moderação">
          <div className="flex flex-col gap-3">
            <Executar
              central={central}
              rotulo="Dar OP"
              acao={{ tipo: 'op', jogadores }}
              confirmar="O jogador vira operador: pode usar todos os comandos."
            />
            <Executar
              central={central}
              rotulo="Limpar inventário"
              acao={{ tipo: 'limpar', jogadores }}
              confirmar="Todos os itens do inventário somem e não voltam."
            />
            <label className="flex flex-col gap-1 text-[13px]">
              Motivo (opcional)
              <Campo value={motivo} maxLength={100} onChange={(e) => setMotivo(e.target.value)} />
            </label>
            <Executar
              central={central}
              rotulo="Expulsar"
              acao={{ tipo: 'kick', jogadores, motivo }}
              confirmar="O jogador sai do servidor (pode entrar de novo)."
            />
            <Executar
              central={central}
              rotulo="Banir"
              acao={{ tipo: 'ban', jogadores, motivo }}
              confirmar="O jogador não consegue mais entrar, até ser desbanido em Jogadores › Banidos."
            />
          </div>
        </CardPainel>
      </div>
    </div>
  )
}

// ---------- Itens ----------

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function useBusca(lista: ItemCentral[], termo: string, maximo: number): ItemCentral[] {
  return useMemo(() => {
    const t = semAcento(termo.trim())
    const achados = t
      ? lista.filter((i) => semAcento(i.nome).includes(t) || i.id.includes(t))
      : lista
    return achados.slice(0, maximo)
  }, [lista, termo, maximo])
}

function AbaItens({
  central,
  dados,
  aoBaixarIcones
}: {
  central: Central
  dados: DadosCentral
  aoBaixarIcones: () => void
}): React.JSX.Element {
  const online = useJogadores()
  const [termo, setTermo] = useState('')
  const [item, setItem] = useState<ItemCentral | null>(null)
  const [quantidade, setQuantidade] = useState('64')
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [icones, setIcones] = useState<Record<string, string | null>>({})
  const resultados = useBusca(dados.itens, termo, 60)

  // Ícones (cache da Fase 13) só dos itens que estão na tela.
  useEffect(() => {
    const faltam = resultados.map((r) => r.id).filter((id) => !(id in icones))
    if (!faltam.length || !dados.iconesBaixados) return
    window.api.iconesDosItens(faltam).then((r) => r.ok && setIcones((a) => ({ ...a, ...r.valor })))
  }, [resultados, icones, dados.iconesBaixados])

  return (
    <div className="flex flex-col gap-6">
      {!dados.iconesBaixados && <AvisoIcones aoBaixar={aoBaixarIcones} />}
      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_420px]">
        <CardPainel titulo={`Itens (${dados.itens.length})`}>
          <Campo
            aria-label="Procurar item"
            placeholder="Procurar pelo nome (ex.: diamante) ou pelo id"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
          <ul className="mt-3 grid grid-cols-1 gap-1 min-[700px]:grid-cols-2">
            {resultados.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setItem(i)}
                  aria-pressed={item?.id === i.id}
                  className={`flex w-full items-center gap-2 border-2 px-2 py-1 text-left text-[13px] ${
                    item?.id === i.id
                      ? 'border-accent bg-panel-2'
                      : 'border-transparent hover:bg-panel-2'
                  }`}
                >
                  <IconeItem icone={icones[i.id] ?? null} tamanho={28} />
                  <span className="min-w-0 flex-1 truncate" title={i.nome}>
                    {i.nome}
                  </span>
                  <span className="truncate font-mono text-xs text-muted">
                    {i.mod ? i.id : i.id.slice(10)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!resultados.length && (
            <p className="mt-3 text-[13px] text-muted">Nenhum item com esse nome.</p>
          )}
        </CardPainel>
        <CardPainel titulo="Dar">
          <div className="flex flex-col gap-4">
            <p className="text-[13px]">{item ? <b>{item.nome}</b> : 'Escolha um item na lista.'}</p>
            <label className="flex flex-col gap-1 text-[13px]">
              Quantidade (1 a 6400)
              <Campo
                inputMode="numeric"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </label>
            <EscolherJogadores
              online={online}
              escolhidos={escolhidos.filter((n) => online.includes(n))}
              aoMudar={setEscolhidos}
              rotulo="Para quem"
            />
            {item && (
              <Executar
                central={central}
                rotulo="Dar"
                acao={{
                  tipo: 'dar',
                  item: item.id,
                  quantidade: num(quantidade),
                  jogadores: escolhidos.filter((n) => online.includes(n))
                }}
              />
            )}
          </div>
        </CardPainel>
      </div>
    </div>
  )
}

// ---------- Efeitos ----------

function AbaEfeitos({
  central,
  dados
}: {
  central: Central
  dados: DadosCentral
}): React.JSX.Element {
  const online = useJogadores()
  const [termo, setTermo] = useState('')
  const [efeito, setEfeito] = useState<ItemCentral | null>(null)
  const [nivel, setNivel] = useState(1)
  const [segundos, setSegundos] = useState('60')
  const [infinito, setInfinito] = useState(false)
  const [ocultar, setOcultar] = useState(false)
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const resultados = useBusca(dados.efeitos, termo, 80)
  const jogadores = escolhidos.filter((n) => online.includes(n))

  return (
    <div className="flex flex-col gap-6">
      <EscolherJogadores online={online} escolhidos={jogadores} aoMudar={setEscolhidos} />
      <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_420px]">
        <CardPainel titulo={`Efeitos (${dados.efeitos.length})`}>
          <Campo
            aria-label="Procurar efeito"
            placeholder="Procurar efeito"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
          <ul className="mt-3 grid grid-cols-1 gap-1 min-[700px]:grid-cols-2">
            {resultados.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setEfeito(e)}
                  aria-pressed={efeito?.id === e.id}
                  className={`flex w-full items-center gap-2 border-2 px-2 py-1 text-left text-[13px] ${
                    efeito?.id === e.id
                      ? 'border-accent bg-panel-2'
                      : 'border-transparent hover:bg-panel-2'
                  }`}
                >
                  <span style={{ color: corDoEfeito(e.id) }}>
                    <IconePocao className="h-7 w-7" />
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={e.nome}>
                    {e.nome}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardPainel>
        <CardPainel titulo="Aplicar">
          <div className="flex flex-col gap-4">
            <p className="text-[13px]">
              {efeito ? <b>{efeito.nome}</b> : 'Escolha um efeito na lista.'}
            </p>
            <Slider
              rotulo="Nível"
              valor={nivel}
              min={1}
              max={10}
              passo={1}
              aoMudar={setNivel}
              formatar={(v) => String(v)}
            />
            <label className="flex flex-col gap-1 text-[13px]">
              Duração (segundos)
              <Campo
                inputMode="numeric"
                value={segundos}
                disabled={infinito}
                onChange={(e) => setSegundos(e.target.value)}
              />
            </label>
            {dados.capacidades.efeitoInfinito && (
              <CaixaSelecao marcada={infinito} aoMudar={setInfinito}>
                Sem fim (infinito)
              </CaixaSelecao>
            )}
            <CaixaSelecao marcada={ocultar} aoMudar={setOcultar}>
              Esconder as partículas
            </CaixaSelecao>
            {efeito && (
              <Executar
                central={central}
                rotulo="Aplicar o efeito"
                acao={{
                  tipo: 'efeito',
                  efeito: efeito.id,
                  nivel,
                  segundos: infinito ? null : num(segundos),
                  ocultar,
                  jogadores
                }}
              />
            )}
            <Executar
              central={central}
              rotulo="Remover todos os efeitos"
              variante="secundario"
              acao={{ tipo: 'limparEfeitos', jogadores }}
            />
          </div>
        </CardPainel>
      </div>
    </div>
  )
}

// ---------- Mensagens ----------

function AbaMensagens({ central }: { central: Central }): React.JSX.Element {
  const online = useJogadores()
  const [say, setSay] = useState('')
  const [chat, setChat] = useState('')
  const [titulo, setTitulo] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [barra, setBarra] = useState('')
  const [cor, setCor] = useState<CorTexto>('gold')
  const [negrito, setNegrito] = useState(false)
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const jogadores = escolhidos.filter((n) => online.includes(n))
  const hex = CORES_DO_TEXTO[cor].hex

  return (
    <div className="flex flex-col gap-6">
      <CardPainel titulo="Cor e destino">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Cor do texto">
            {CORES_TEXTO.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cor === c}
                aria-label={CORES_DO_TEXTO[c].nome}
                title={CORES_DO_TEXTO[c].nome}
                onClick={() => setCor(c)}
                style={{ background: CORES_DO_TEXTO[c].hex }}
                className={`h-6 w-6 border-2 ${cor === c ? 'border-texto' : 'border-linha'}`}
              />
            ))}
          </div>
          <CaixaSelecao marcada={negrito} aoMudar={setNegrito}>
            Negrito (chat e barra de ação)
          </CaixaSelecao>
          <EscolherJogadores
            online={online}
            escolhidos={jogadores}
            aoMudar={setEscolhidos}
            rotulo="Para quem (ninguém marcado: todos)"
          />
        </div>
      </CardPainel>

      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <CardPainel titulo="Chat como o servidor">
          <div className="flex flex-col gap-3">
            <Campo
              aria-label="Mensagem"
              maxLength={256}
              value={say}
              onChange={(e) => setSay(e.target.value)}
              placeholder="Aparece como [Server] mensagem"
            />
            <Executar central={central} rotulo="Enviar" acao={{ tipo: 'say', texto: say }} />
          </div>
        </CardPainel>
        <CardPainel titulo="Chat colorido">
          <div className="flex flex-col gap-3">
            <Campo
              aria-label="Mensagem colorida"
              maxLength={256}
              value={chat}
              onChange={(e) => setChat(e.target.value)}
            />
            <Previa3 cor={hex} negrito={negrito}>
              {chat}
            </Previa3>
            <Executar
              central={central}
              rotulo="Enviar"
              acao={{ tipo: 'chat', texto: chat, cor, negrito, jogadores }}
            />
          </div>
        </CardPainel>
        <CardPainel titulo="Título na tela">
          <div className="flex flex-col gap-3">
            <Campo
              aria-label="Título"
              maxLength={64}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título"
            />
            <Campo
              aria-label="Subtítulo"
              maxLength={96}
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Subtítulo (opcional)"
            />
            <div className="flex flex-col items-center gap-1 bg-console px-4 py-6 text-center">
              <span className="text-2xl font-bold" style={{ color: hex }}>
                {titulo || 'Título'}
              </span>
              {subtitulo && <span style={{ color: hex }}>{subtitulo}</span>}
            </div>
            <Executar
              central={central}
              rotulo="Mostrar"
              acao={{ tipo: 'titulo', titulo, subtitulo, cor, jogadores }}
            />
          </div>
        </CardPainel>
        <CardPainel titulo="Barra de ação">
          <div className="flex flex-col gap-3">
            <Campo
              aria-label="Texto da barra de ação"
              maxLength={128}
              value={barra}
              onChange={(e) => setBarra(e.target.value)}
              placeholder="Texto acima da barra de itens"
            />
            <Previa3 cor={hex} negrito={negrito}>
              {barra}
            </Previa3>
            <Executar
              central={central}
              rotulo="Mostrar"
              acao={{ tipo: 'barra', texto: barra, cor, negrito, jogadores }}
            />
          </div>
        </CardPainel>
      </div>
    </div>
  )
}

// Prévia do texto como ele aparece no jogo (fundo escuro, a cor escolhida).
function Previa3({
  cor,
  negrito,
  children
}: {
  cor: string
  negrito: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className="bg-console px-3 py-2 text-[13px]"
      style={{ color: cor, fontWeight: negrito ? 700 : 400 }}
    >
      {children || <span className="text-console-muted">Prévia</span>}
    </div>
  )
}
