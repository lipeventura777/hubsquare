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
import { IconeComandos, IconePocao } from '../icones'
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
import { t } from '../../../shared/i18n'

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
          titulo={t('telaComandos.prepararOsComandosDestaVersao')}
          texto={t('telaComandos.paraSaberExatamenteQuaisComandos', { MB: MB(preparo.tamanho) })}
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
            {preparando ? t('telaComandos.preparando') : t('telaComandos.prepararComandos')}
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
        <Aviso tipo="atencao">{t('telaComandos.ligueOServidorParaUsar')}</Aviso>
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
      <CardPainel titulo={t('telaComandos.tempo')}>
        <div className="flex flex-col gap-4">
          {(
            [
              [t('telaComandos.dia'), 1000],
              ['Meio-dia', 6000],
              [t('telaComandos.noite'), 13000],
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
            rotulo={t('telaComandos.horaExataTicks')}
            valor={ticks}
            min={0}
            max={24000}
            passo={250}
            aoMudar={setTicks}
            formatar={(v) =>
              `${v} · ${String(Math.floor(((v + 6000) % 24000) / 1000)).padStart(2, '0')}h`
            }
          />
          <Executar
            central={central}
            rotulo={t('telaComandos.mudarAHora')}
            acao={{ tipo: 'tempo', ticks }}
          />
        </div>
      </CardPainel>

      <CardPainel titulo={t('telaComandos.clima')}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-[13px]">
            {t('telaComandos.duracaoEmMinutosVazioO')}
            <Campo
              inputMode="numeric"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </label>
          {(
            [
              [t('telaComandos.tempoLimpo'), 'clear'],
              [t('telaComandos.chuva'), 'rain'],
              [t('telaComandos.tempestade'), 'thunder']
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

      <CardPainel titulo={t('telaComandos.dificuldade')}>
        <div className="flex flex-col gap-3">
          {DIFICULDADES.map((d) => (
            <Executar
              key={d}
              central={central}
              variante="secundario"
              rotulo={
                {
                  peaceful: t('telaComandos.pacifica'),
                  easy: t('telaComandos.facil'),
                  normal: t('telaComandos.normal'),
                  hard: t('telaComandos.dificil')
                }[d]
              }
              acao={{ tipo: 'dificuldade', valor: d }}
            />
          ))}
          <p className="text-xs text-muted">{t('telaComandos.aoReiniciarVoltaParaA')}</p>
        </div>
      </CardPainel>

      <CardPainel titulo={t('telaComandos.spawnDoMundo')}>
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
            rotulo={t('telaComandos.definirNasCoordenadas')}
            acao={{ tipo: 'spawn', x: num(spawn.x), y: num(spawn.y), z: num(spawn.z) }}
          />
          <EscolherJogadores
            online={online}
            escolhidos={spawnJogador}
            aoMudar={setSpawnJogador}
            umSo
            rotulo={t('telaComandos.ouOndeEstaOJogador')}
          />
          {spawnJogador[0] && (
            <Executar
              central={central}
              rotulo={t('telaComandos.definirOndeEsta', { v: spawnJogador[0] })}
              acao={{ tipo: 'spawnJogador', jogador: spawnJogador[0] }}
            />
          )}
        </div>
      </CardPainel>

      <CardPainel titulo={t('telaComandos.bordaDoMundo')}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[13px]">
              {t('telaComandos.tamanhoBlocosDeLado')}
              <Campo
                inputMode="numeric"
                value={borda.tamanho}
                onChange={(e) => setBorda({ ...borda, tamanho: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              {t('telaComandos.mudarAosPoucosEmSegundos')}
              <Campo
                inputMode="numeric"
                value={borda.segundos}
                placeholder={t('telaComandos.naHora')}
                onChange={(e) => setBorda({ ...borda, segundos: e.target.value })}
              />
            </label>
          </div>
          <Executar
            central={central}
            rotulo={t('telaComandos.mudarOTamanho')}
            acao={{
              tipo: 'borda',
              tamanho: num(borda.tamanho),
              segundos: borda.segundos.trim() ? num(borda.segundos) : null
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            {(['x', 'z'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-[13px]">
                {t('telaComandos.centro', { toUpperCase: k.toUpperCase() })}
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
            rotulo={t('telaComandos.mudarOCentro')}
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
    survival: t('telaComandos.sobrevivencia'),
    creative: t('telaComandos.criativo'),
    adventure: t('telaComandos.aventura'),
    spectator: t('telaComandos.espectador')
  }

  return (
    <div className="flex flex-col gap-6">
      <EscolherJogadores online={online} escolhidos={jogadores} aoMudar={setEscolhidos} />
      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <CardPainel titulo={t('telaComandos.modoDeJogo')}>
          <div className="flex flex-col gap-3">
            <Selecao
              aria-label={t('telaComandos.modoDeJogo')}
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
              rotulo={t('telaComandos.aplicarOModo')}
              acao={{ tipo: 'modo', modo, jogadores }}
            />
          </div>
        </CardPainel>

        <CardPainel titulo={t('telaComandos.teleportar')}>
          <div className="flex flex-col gap-3">
            <EscolherJogadores
              online={online}
              escolhidos={alvo}
              aoMudar={setAlvo}
              umSo
              rotulo={t('telaComandos.ateOJogador')}
            />
            {alvo[0] && (
              <Executar
                central={central}
                rotulo={t('telaComandos.levarAte', { v: alvo[0] })}
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
              rotulo={t('telaComandos.levarAteAsCoordenadas')}
              acao={{ tipo: 'tpCoord', jogadores, x: num(xyz.x), y: num(xyz.y), z: num(xyz.z) }}
            />
          </div>
        </CardPainel>

        <CardPainel titulo={t('telaComandos.vidaFomeEXp')}>
          <div className="flex flex-col gap-3">
            <Executar
              central={central}
              rotulo={t('telaComandos.curar')}
              acao={{ tipo: 'curar', jogadores }}
            />
            <Executar
              central={central}
              rotulo={t('telaComandos.alimentar')}
              acao={{ tipo: 'alimentar', jogadores }}
            />
            <div className="flex gap-2">
              <Campo
                aria-label={t('telaComandos.quantidadeDeXp')}
                inputMode="numeric"
                value={xp}
                onChange={(e) => setXp(e.target.value)}
                className="w-28"
              />
              <Selecao
                aria-label={t('telaComandos.pontosOuNiveis')}
                value={unidade}
                onChange={(e) => setUnidade(e.target.value as typeof unidade)}
                className="w-40"
              >
                <option value="levels">{t('telaComandos.niveis')}</option>
                <option value="points">{t('telaComandos.pontos')}</option>
              </Selecao>
            </div>
            <Executar
              central={central}
              rotulo={t('telaComandos.darXp')}
              acao={{ tipo: 'xp', jogadores, quantidade: num(xp), unidade }}
            />
          </div>
        </CardPainel>

        <CardPainel titulo={t('telaComandos.moderacao')}>
          <div className="flex flex-col gap-3">
            <Executar
              central={central}
              rotulo={t('telaComandos.darOp')}
              acao={{ tipo: 'op', jogadores }}
              confirmar={t('telaComandos.oJogadorViraOperadorPode')}
            />
            <Executar
              central={central}
              rotulo={t('telaComandos.limparInventario')}
              acao={{ tipo: 'limpar', jogadores }}
              confirmar={t('telaComandos.todosOsItensDoInventario')}
            />
            <label className="flex flex-col gap-1 text-[13px]">
              {t('telaComandos.motivoOpcional')}
              <Campo value={motivo} maxLength={100} onChange={(e) => setMotivo(e.target.value)} />
            </label>
            <Executar
              central={central}
              rotulo={t('telaComandos.expulsar')}
              acao={{ tipo: 'kick', jogadores, motivo }}
              confirmar={t('telaComandos.oJogadorSaiDoServidor')}
            />
            <Executar
              central={central}
              rotulo={t('telaComandos.banir')}
              acao={{ tipo: 'ban', jogadores, motivo }}
              confirmar={t('telaComandos.oJogadorNaoConsegueMais')}
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
        <CardPainel titulo={t('telaComandos.itens', { length: dados.itens.length })}>
          <Campo
            aria-label={t('telaComandos.procurarItem')}
            placeholder={t('telaComandos.procurarPeloNomeExDiamante')}
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
            <p className="mt-3 text-[13px] text-muted">{t('telaComandos.nenhumItemComEsseNome')}</p>
          )}
        </CardPainel>
        <CardPainel titulo={t('telaComandos.dar')}>
          <div className="flex flex-col gap-4">
            <p className="text-[13px]">
              {item ? <b>{item.nome}</b> : t('telaComandos.escolhaUmItemNaLista')}
            </p>
            <label className="flex flex-col gap-1 text-[13px]">
              {t('telaComandos.quantidade1A6400')}
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
              rotulo={t('telaComandos.paraQuem')}
            />
            {item && (
              <Executar
                central={central}
                rotulo={t('telaComandos.dar')}
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
        <CardPainel titulo={t('telaComandos.efeitos', { length: dados.efeitos.length })}>
          <Campo
            aria-label={t('telaComandos.procurarEfeito')}
            placeholder={t('telaComandos.procurarEfeito')}
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
        <CardPainel titulo={t('telaComandos.aplicar')}>
          <div className="flex flex-col gap-4">
            <p className="text-[13px]">
              {efeito ? <b>{efeito.nome}</b> : t('telaComandos.escolhaUmEfeitoNaLista')}
            </p>
            <Slider
              rotulo={t('telaComandos.nivel')}
              valor={nivel}
              min={1}
              max={10}
              passo={1}
              aoMudar={setNivel}
              formatar={(v) => String(v)}
            />
            <label className="flex flex-col gap-1 text-[13px]">
              {t('telaComandos.duracaoSegundos')}
              <Campo
                inputMode="numeric"
                value={segundos}
                disabled={infinito}
                onChange={(e) => setSegundos(e.target.value)}
              />
            </label>
            {dados.capacidades.efeitoInfinito && (
              <CaixaSelecao marcada={infinito} aoMudar={setInfinito}>
                {t('telaComandos.semFimInfinito')}
              </CaixaSelecao>
            )}
            <CaixaSelecao marcada={ocultar} aoMudar={setOcultar}>
              {t('telaComandos.esconderAsParticulas')}
            </CaixaSelecao>
            {efeito && (
              <Executar
                central={central}
                rotulo={t('telaComandos.aplicarOEfeito')}
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
              rotulo={t('telaComandos.removerTodosOsEfeitos')}
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
      <CardPainel titulo={t('telaComandos.corEDestino')}>
        <div className="flex flex-col gap-3">
          <div
            className="flex flex-wrap gap-1"
            role="radiogroup"
            aria-label={t('telaComandos.corDoTexto')}
          >
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
            {t('telaComandos.negritoChatEBarraDe')}
          </CaixaSelecao>
          <EscolherJogadores
            online={online}
            escolhidos={jogadores}
            aoMudar={setEscolhidos}
            rotulo={t('telaComandos.paraQuemNinguemMarcadoTodos')}
          />
        </div>
      </CardPainel>

      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <CardPainel titulo={t('telaComandos.chatComoOServidor')}>
          <div className="flex flex-col gap-3">
            <Campo
              aria-label={t('telaComandos.mensagem')}
              maxLength={256}
              value={say}
              onChange={(e) => setSay(e.target.value)}
              placeholder={t('telaComandos.apareceComoServerMensagem')}
            />
            <Executar
              central={central}
              rotulo={t('telaComandos.enviar')}
              acao={{ tipo: 'say', texto: say }}
            />
          </div>
        </CardPainel>
        <CardPainel titulo={t('telaComandos.chatColorido')}>
          <div className="flex flex-col gap-3">
            <Campo
              aria-label={t('telaComandos.mensagemColorida')}
              maxLength={256}
              value={chat}
              onChange={(e) => setChat(e.target.value)}
            />
            <Previa3 cor={hex} negrito={negrito}>
              {chat}
            </Previa3>
            <Executar
              central={central}
              rotulo={t('telaComandos.enviar')}
              acao={{ tipo: 'chat', texto: chat, cor, negrito, jogadores }}
            />
          </div>
        </CardPainel>
        <CardPainel titulo={t('telaComandos.tituloNaTela')}>
          <div className="flex flex-col gap-3">
            <Campo
              aria-label={t('telaComandos.titulo')}
              maxLength={64}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={t('telaComandos.titulo')}
            />
            <Campo
              aria-label={t('telaComandos.subtitulo')}
              maxLength={96}
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder={t('telaComandos.subtituloOpcional')}
            />
            <div className="flex flex-col items-center gap-1 bg-console px-4 py-6 text-center">
              <span className="text-2xl font-bold" style={{ color: hex }}>
                {titulo || t('telaComandos.titulo')}
              </span>
              {subtitulo && <span style={{ color: hex }}>{subtitulo}</span>}
            </div>
            <Executar
              central={central}
              rotulo={t('telaComandos.mostrar')}
              acao={{ tipo: 'titulo', titulo, subtitulo, cor, jogadores }}
            />
          </div>
        </CardPainel>
        <CardPainel titulo={t('telaComandos.barraDeAcao')}>
          <div className="flex flex-col gap-3">
            <Campo
              aria-label={t('telaComandos.textoDaBarraDeAcao')}
              maxLength={128}
              value={barra}
              onChange={(e) => setBarra(e.target.value)}
              placeholder={t('telaComandos.textoAcimaDaBarraDe')}
            />
            <Previa3 cor={hex} negrito={negrito}>
              {barra}
            </Previa3>
            <Executar
              central={central}
              rotulo={t('telaComandos.mostrar')}
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
      {children || <span className="text-console-muted">{t('telaComandos.previa')}</span>}
    </div>
  )
}
