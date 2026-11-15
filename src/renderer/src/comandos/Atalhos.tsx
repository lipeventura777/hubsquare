import { useEffect, useState } from 'react'
import { VARIAVEL_JOGADOR, comandoDestrutivo, expandirAtalho } from '../../../shared/comandos'
import {
  CORES_ETIQUETA,
  ICONES_ATALHO,
  type Atalho,
  type ErroTela,
  type IconeAtalho,
  type RespostaComando
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import {
  IconeAutomacao,
  IconeComida,
  IconeConsole,
  IconeCoracao,
  IconeDesempenho,
  IconeJogadores,
  IconeMods,
  IconeMundos
} from '../componentes/icones'
import { CardPainel } from '../componentes/paineis'
import { Botao, CaixaSelecao, Campo, Dialogo, Selecao } from '../componentes/ui'
import { COR_ETIQUETA } from '../mods/etiquetas'
import { useJogadores } from '../servidor/comandos'
import { EscolherJogadores, Respostas } from './pecas'
import { t } from '../../../shared/i18n'

const ICONES: Record<
  IconeAtalho,
  { Icone: (p: { className?: string }) => React.JSX.Element; nome: string }
> = {
  mundo: { Icone: IconeMundos, nome: t('atalhos.mundo') },
  jogadores: { Icone: IconeJogadores, nome: t('atalhos.jogadores') },
  coracao: { Icone: IconeCoracao, nome: t('atalhos.coracao') },
  comida: { Icone: IconeComida, nome: t('atalhos.comida') },
  console: { Icone: IconeConsole, nome: t('atalhos.console') },
  automacao: { Icone: IconeAutomacao, nome: t('atalhos.relogio') },
  desempenho: { Icone: IconeDesempenho, nome: t('atalhos.grafico') },
  mods: { Icone: IconeMods, nome: t('atalhos.bloco') }
}

const precisaJogador = (a: Atalho): boolean => a.comandos.some((c) => c.includes(VARIAVEL_JOGADOR))

// Rodar um atalho: escolhe o jogador quando ele usa {jogador} e confirma se apaga coisas.
function useRodarAtalho(ligado: boolean): {
  rodar: (a: Atalho) => void
  dialogos: React.ReactNode
  respostas: RespostaComando[]
  erro: ErroTela | null
  rodando: string | null
} {
  const online = useJogadores()
  const [pedido, setPedido] = useState<{ a: Atalho; jogador: string | null } | null>(null)
  const [respostas, setRespostas] = useState<RespostaComando[]>([])
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [rodando, setRodando] = useState<string | null>(null)

  async function executar(a: Atalho, jogador: string | null, confirmado: boolean): Promise<void> {
    setPedido(null)
    setRodando(a.id)
    setErro(null)
    setRespostas([])
    const r = await window.api.executarAtalho(a.id, jogador, confirmado)
    setRodando(null)
    if (r.ok) setRespostas(r.valor)
    else setErro(r.erro)
  }

  function rodar(a: Atalho): void {
    if (!ligado) return
    if (precisaJogador(a) || a.comandos.some(comandoDestrutivo)) setPedido({ a, jogador: null })
    else void executar(a, null, false)
  }

  const a = pedido?.a
  let comandos: string[]
  try {
    comandos = a ? expandirAtalho(a.comandos, pedido?.jogador ?? null) : []
  } catch {
    comandos = a?.comandos ?? []
  }
  const destrutivo = !!a && a.comandos.some(comandoDestrutivo)
  const faltaJogador = !!a && precisaJogador(a) && !pedido?.jogador

  const dialogos = (
    <Dialogo
      aberto={!!pedido}
      titulo={a ? t('atalhos.usar', { nome: a.nome }) : ''}
      aoCancelar={() => setPedido(null)}
      acao={{
        rotulo: t('atalhos.usar2'),
        variante: destrutivo ? 'perigo' : 'primario',
        desabilitado: faltaJogador,
        aoClicar: () => a && executar(a, pedido?.jogador ?? null, destrutivo)
      }}
    >
      {a && (
        <div className="flex flex-col gap-3 text-[13px]">
          {precisaJogador(a) && (
            <EscolherJogadores
              online={online}
              escolhidos={pedido?.jogador ? [pedido.jogador] : []}
              aoMudar={(n) => setPedido({ a, jogador: n[0] ?? null })}
              umSo
              rotulo={t('atalhos.paraQualJogador')}
            />
          )}
          {destrutivo && <p className="text-warning">{t('atalhos.esteAtalhoApagaCoisasOu')}</p>}
          <p className="font-mono text-xs break-all whitespace-pre-line text-muted">
            {comandos.map((c) => `/${c}`).join('\n')}
          </p>
        </div>
      )}
    </Dialogo>
  )
  return { rodar, dialogos, respostas, erro, rodando }
}

function BotaoAtalho({
  a,
  ligado,
  rodando,
  aoUsar
}: {
  a: Atalho
  ligado: boolean
  rodando: boolean
  aoUsar: () => void
}): React.JSX.Element {
  const { Icone } = ICONES[a.icone] ?? ICONES.console
  return (
    <button
      type="button"
      disabled={!ligado || rodando}
      onClick={aoUsar}
      title={a.comandos.map((c) => `/${c}`).join('\n')}
      className="flex h-8 items-center gap-2 border-b-[3px] bg-panel-2 px-3 text-[13px] font-bold transition-[transform,filter] duration-(--dur-fast) ease-(--ease-out) enabled:hover:brightness-110 enabled:active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderBottomColor: COR_ETIQUETA[a.cor]?.hex }}
    >
      <span style={{ color: COR_ETIQUETA[a.cor]?.hex }}>
        <Icone className="h-4 w-4" />
      </span>
      {rodando ? t('atalhos.usando') : a.nome}
    </button>
  )
}

// Painel: os atalhos com estrela, no lugar dos 4 botões fixos de antes.
export function BotoesAtalhos({ ligado }: { ligado: boolean }): React.JSX.Element {
  const [atalhos, setAtalhos] = useState<Atalho[]>([])
  const { rodar, dialogos, respostas, erro, rodando } = useRodarAtalho(ligado)
  useEffect(() => {
    window.api.listarAtalhos().then((r) => r.ok && setAtalhos(r.valor))
  }, [])
  const comEstrela = atalhos.filter((a) => a.estrela)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" aria-label={t('atalhos.atalhos')}>
        {comEstrela.map((a) => (
          <BotaoAtalho
            key={a.id}
            a={a}
            ligado={ligado}
            rodando={rodando === a.id}
            aoUsar={() => rodar(a)}
          />
        ))}
        {!comEstrela.length && (
          <span className="text-xs text-muted">{t('atalhos.marqueAtalhosComEstrelaEm')}</span>
        )}
      </div>
      <Respostas respostas={respostas} />
      {erro && <MensagemErro erro={erro} />}
      {dialogos}
    </div>
  )
}

const VAZIO: Atalho = {
  id: '',
  nome: '',
  icone: 'console',
  cor: 'verde',
  comandos: [],
  intervalo: 0,
  estrela: false
}

// Aba Atalhos: criar, editar e usar botões próprios.
export function Atalhos({ ligado }: { ligado: boolean }): React.JSX.Element {
  const [atalhos, setAtalhos] = useState<Atalho[] | null>(null)
  const [editando, setEditando] = useState<Atalho | null>(null)
  const [texto, setTexto] = useState('')
  const [apagando, setApagando] = useState<Atalho | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const { rodar, dialogos, respostas, erro: erroUso, rodando } = useRodarAtalho(ligado)

  useEffect(() => {
    window.api.listarAtalhos().then((r) => (r.ok ? setAtalhos(r.valor) : setErro(r.erro)))
  }, [])

  function editar(a: Atalho): void {
    setEditando(a)
    setTexto(a.comandos.join('\n'))
    setErro(null)
  }

  async function salvar(): Promise<void> {
    if (!editando) return
    const r = await window.api.salvarAtalho({
      ...editando,
      comandos: texto
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean)
    })
    if (!r.ok) return setErro(r.erro)
    setAtalhos(r.valor)
    setEditando(null)
  }

  async function estrela(a: Atalho): Promise<void> {
    const r = await window.api.salvarAtalho({ ...a, estrela: !a.estrela })
    if (r.ok) setAtalhos(r.valor)
    else setErro(r.erro)
  }

  const linhas = texto
    .split('\n')
    .map((c) => c.trim())
    .filter(Boolean)

  return (
    <div className="flex flex-col gap-6">
      {!ligado && <p className="text-[13px] text-muted">{t('atalhos.comOServidorDesligadoDa')}</p>}
      <Respostas respostas={respostas} />
      {(erro || erroUso) && <MensagemErro erro={(erro ?? erroUso)!} />}

      <CardPainel
        titulo={t('atalhos.seusAtalhos')}
        acoes={
          <Botao tamanho="pequeno" variante="primario" onClick={() => editar(VAZIO)}>
            {t('atalhos.novoAtalho')}
          </Botao>
        }
      >
        {!atalhos?.length ? (
          <p className="text-[13px] text-muted">{t('atalhos.nenhumAtalhoAinda')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-linha">
            {atalhos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                <button
                  type="button"
                  aria-pressed={a.estrela}
                  aria-label={a.estrela ? t('atalhos.tirarDoPainel') : t('atalhos.mostrarNoPainel')}
                  title={a.estrela ? t('atalhos.apareceNoPainel') : t('atalhos.mostrarNoPainel')}
                  onClick={() => estrela(a)}
                  className={`text-lg ${a.estrela ? 'text-warning' : 'text-muted'}`}
                >
                  {a.estrela ? '★' : '☆'}
                </button>
                <BotaoAtalho
                  a={a}
                  ligado={ligado}
                  rodando={rodando === a.id}
                  aoUsar={() => rodar(a)}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
                  {a.comandos.map((c) => `/${c}`).join('  ·  ')}
                </span>
                <Botao tamanho="pequeno" onClick={() => editar(a)}>
                  {t('atalhos.editar')}
                </Botao>
                <Botao tamanho="pequeno" variante="perigo" onClick={() => setApagando(a)}>
                  {t('atalhos.apagar')}
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </CardPainel>

      {editando && (
        <CardPainel
          titulo={
            editando.id ? t('atalhos.editar2', { nome: editando.nome }) : t('atalhos.novoAtalho')
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 min-[900px]:grid-cols-[1fr_200px_160px]">
              <label className="flex flex-col gap-1 text-[13px]">
                {t('atalhos.nome')}
                <Campo
                  maxLength={24}
                  value={editando.nome}
                  onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                {t('atalhos.icone')}
                <Selecao
                  value={editando.icone}
                  onChange={(e) =>
                    setEditando({ ...editando, icone: e.target.value as IconeAtalho })
                  }
                >
                  {ICONES_ATALHO.map((i) => (
                    <option key={i} value={i}>
                      {ICONES[i].nome}
                    </option>
                  ))}
                </Selecao>
              </label>
              <label className="flex flex-col gap-1 text-[13px]">
                {t('atalhos.intervaloEntreComandosS')}
                <Campo
                  inputMode="decimal"
                  value={String(editando.intervalo)}
                  onChange={(e) =>
                    setEditando({
                      ...editando,
                      intervalo: Number(e.target.value.replace(',', '.')) || 0
                    })
                  }
                />
              </label>
            </div>
            <div
              className="flex flex-wrap items-center gap-2"
              role="radiogroup"
              aria-label={t('atalhos.cor')}
            >
              {CORES_ETIQUETA.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={editando.cor === c}
                  aria-label={COR_ETIQUETA[c].nome}
                  onClick={() => setEditando({ ...editando, cor: c })}
                  style={{ background: COR_ETIQUETA[c].hex }}
                  className={`h-7 w-7 border-2 ${editando.cor === c ? 'border-texto' : 'border-transparent'}`}
                />
              ))}
            </div>
            <label className="flex flex-col gap-1 text-[13px]">
              {t('atalhos.comandosUmPorLinhaUse', { VARIAVEL_JOGADOR })}
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={
                  'give {jogador} minecraft:bread 16\neffect give {jogador} minecraft:speed 60 1\nsay Kit entregue!'
                }
                className="h-32 resize-y border border-linha bg-panel-2 px-3 py-2 font-mono text-[13px] text-texto outline-none focus:border-accent"
              />
            </label>
            {linhas.some(comandoDestrutivo) && (
              <p className="text-xs text-warning">{t('atalhos.temComandoQueApagaCoisas')}</p>
            )}
            <CaixaSelecao
              marcada={editando.estrela}
              aoMudar={(v) => setEditando({ ...editando, estrela: v })}
            >
              {t('atalhos.mostrarNoPainelEstrela')}
            </CaixaSelecao>
            <div className="flex justify-end gap-2">
              <Botao onClick={() => setEditando(null)}>{t('atalhos.cancelar')}</Botao>
              <Botao
                variante="primario"
                disabled={!editando.nome.trim() || !linhas.length}
                onClick={salvar}
              >
                {t('atalhos.salvarAtalho')}
              </Botao>
            </div>
          </div>
        </CardPainel>
      )}

      {dialogos}
      <Dialogo
        aberto={!!apagando}
        titulo={t('atalhos.apagarOAtalho', { v: apagando?.nome ?? '' })}
        aoCancelar={() => setApagando(null)}
        acao={{
          rotulo: t('atalhos.apagar'),
          variante: 'perigo',
          aoClicar: async () => {
            if (!apagando) return
            const r = await window.api.apagarAtalho(apagando.id)
            setApagando(null)
            if (r.ok) setAtalhos(r.valor)
            else setErro(r.erro)
          }
        }}
      >
        <p>{t('atalhos.soOBotaoSaiNada')}</p>
      </Dialogo>
    </div>
  )
}
