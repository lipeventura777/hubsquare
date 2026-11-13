import { useCallback, useEffect, useState } from 'react'
import {
  MODOS,
  NOMES_MODOS,
  type AcaoJogador,
  type DetalhesJogador as Detalhes,
  type ErroTela,
  type ListaId,
  type Local,
  type ModoDeJogo
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import {
  IconeComida,
  IconeCopiar,
  IconeCoracao,
  IconeJogadores,
  IconeMundos,
  IconeServidor
} from '../componentes/icones'
import { Esqueleto } from '../componentes/movimento'
import { Acordeao, CabecaJogador, CardPainel, TituloPagina } from '../componentes/paineis'
import { Botao, Dialogo, LinhaControle, Selecao } from '../componentes/ui'
import { AbaEstatisticas } from './AbaEstatisticas'
import { AbaInventario } from './AbaInventario'
import { ZonaDePerigo } from './ZonaDePerigo'

const ABAS = ['Visão geral', 'Inventário', 'Estatísticas'] as const
const SO_ONLINE = 'Disponível com o jogador online'

const DIMENSOES: Record<string, string> = {
  'minecraft:overworld': 'Mundo normal',
  'minecraft:the_nether': 'Nether',
  'minecraft:the_end': 'The End'
}

// Detalhes do jogador (DESIGN.md, 6.13 a 6.17 e 6.21). Lê o .dat (só leitura); com o jogador
// online, o servidor salva antes de cada leitura e a tela atualiza a cada 10 s.
export function DetalhesJogador({
  nome,
  aoVoltar
}: {
  nome: string
  aoVoltar: () => void
}): React.JSX.Element {
  const [detalhes, setDetalhes] = useState<Detalhes | null>(null)
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Visão geral')
  const [atualizando, setAtualizando] = useState(false)
  const [matando, setMatando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    setAtualizando(true)
    const r = await window.api.detalhesJogador(nome)
    setAtualizando(false)
    if (r.ok) setDetalhes(r.valor)
    else setErro(r.erro)
  }, [nome])

  useEffect(() => {
    let ativo = true
    window.api.detalhesJogador(nome).then((r) => {
      if (!ativo) return
      if (r.ok) setDetalhes(r.valor)
      else setErro(r.erro)
    })
    return () => {
      ativo = false
    }
  }, [nome])

  const online = detalhes?.online ?? false
  useEffect(() => {
    if (!online) return
    const timer = setInterval(() => void carregar(), 10_000)
    return () => clearInterval(timer)
  }, [online, carregar])

  // Os comandos levam um instante para valer; depois relê o arquivo.
  async function agir(acao: AcaoJogador): Promise<void> {
    setErro(null)
    const r = await window.api.acaoJogador(nome, acao)
    if (!r.ok) return setErro(r.erro)
    setTimeout(() => void carregar(), 1000)
  }

  async function mudarLista(lista: ListaId, entrar: boolean): Promise<void> {
    setErro(null)
    const r = entrar
      ? await window.api.adicionarNaLista(lista, nome)
      : await window.api.removerDaLista(lista, nome)
    if (!r.ok) return setErro(r.erro)
    const campo = lista === 'ops' ? 'op' : lista === 'banidos' ? 'banido' : 'whitelist'
    setDetalhes((d) => d && { ...d, [campo]: entrar })
    setTimeout(() => void carregar(), 1500) // ligado, o servidor grava o .json logo depois
  }

  const dados = detalhes?.dados ?? null

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-10">
        <Botao tamanho="pequeno" className="self-start" onClick={aoVoltar}>
          ← Jogadores
        </Botao>

        <header className="flex flex-wrap items-center gap-4">
          <CabecaJogador nome={nome} uuid={detalhes?.uuid} tamanho={72} online={online} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-3">
              <TituloPagina>{detalhes?.nome ?? nome}</TituloPagina>
              <span
                className={`-mt-6 px-1.5 text-xs font-bold ${
                  online ? 'bg-online text-on-dark' : 'bg-panel-2 text-muted'
                }`}
              >
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
            {detalhes?.uuid && (
              <div className="-mt-5 flex items-center gap-2 font-mono text-xs text-muted">
                {detalhes.uuid}
                <button
                  type="button"
                  title="Copiar UUID"
                  aria-label="Copiar UUID"
                  onClick={() => window.api.copiar(detalhes.uuid)}
                  className="flex h-8 w-8 items-center justify-center hover:bg-tile-active"
                >
                  <IconeCopiar className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1 text-[13px]">
            Modo de jogo
            <Selecao
              value={dados?.modo ?? ''}
              disabled={!online}
              title={online ? undefined : SO_ONLINE}
              onChange={(e) => agir({ tipo: 'modo', modo: e.target.value as ModoDeJogo })}
            >
              {!dados?.modo && <option value="">—</option>}
              {MODOS.map((m) => (
                <option key={m} value={m}>
                  {NOMES_MODOS[m]}
                </option>
              ))}
            </Selecao>
          </label>
        </header>

        <div role="tablist" className="flex gap-1 border-b border-linha">
          {ABAS.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aba === a}
              onClick={() => setAba(a)}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-bold ${
                aba === a ? 'border-accent text-texto' : 'border-transparent text-muted'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {erro && <MensagemErro erro={erro} />}

        {aba === 'Inventário' ? (
          <AbaInventario nome={nome} />
        ) : aba === 'Estatísticas' ? (
          <AbaEstatisticas nome={nome} />
        ) : !detalhes ? (
          !erro && <Esqueleto linhas={4} />
        ) : (
          <div className="grid gap-4 min-[1100px]:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-4">
              <CardPainel
                titulo="Saúde e experiência"
                acoes={
                  <Botao
                    tamanho="pequeno"
                    title="Atualizar"
                    aria-label="Atualizar"
                    disabled={atualizando}
                    onClick={() => void carregar()}
                  >
                    ⟳
                  </Botao>
                }
              >
                {dados ? (
                  <SaudeExperiencia
                    dados={dados}
                    online={online}
                    aoAgir={agir}
                    aoMatar={() => setMatando(true)}
                  />
                ) : (
                  <p className="text-[13px] text-muted">
                    Sem dados ainda. Eles aparecem depois que o jogador entrar no servidor.
                  </p>
                )}
              </CardPainel>

              <CardPainel titulo="Informação">
                <Acordeao
                  itens={[
                    { titulo: 'Posição atual', icone: <IconeMundos />, local: dados?.posicao },
                    {
                      titulo: 'Local de renascimento',
                      icone: <IconeServidor />,
                      local: dados?.renascimento
                    },
                    {
                      titulo: 'Local da última morte',
                      icone: <IconeCoracao />,
                      local: dados?.ultimaMorte
                    }
                  ].map((item) => ({
                    titulo: item.titulo,
                    icone: item.icone,
                    conteudo: (
                      <LinhaLocal
                        local={item.local ?? null}
                        online={online}
                        aoTeleportar={(local) => agir({ tipo: 'teleportar', local })}
                      />
                    )
                  }))}
                />
              </CardPainel>
            </div>

            <CardPainel titulo="Controle" className="self-start">
              <div className="flex flex-col gap-2">
                <LinhaControle
                  icone={<IconeJogadores />}
                  rotulo="Na whitelist"
                  ligado={detalhes.whitelist}
                  aoMudar={(v) => mudarLista('whitelist', v)}
                />
                <LinhaControle
                  icone={<IconeJogadores />}
                  rotulo="Banido"
                  ligado={detalhes.banido}
                  aoMudar={(v) => mudarLista('banidos', v)}
                />
                <LinhaControle
                  icone={<IconeServidor />}
                  rotulo="Operador"
                  ligado={detalhes.op}
                  aoMudar={(v) => mudarLista('ops', v)}
                />
              </div>
            </CardPainel>
            <div className="min-[1100px]:col-span-2">
              <ZonaDePerigo nome={nome} aoApagar={() => void carregar()} />
            </div>
          </div>
        )}
      </div>

      <Dialogo
        aberto={matando}
        titulo={`Matar ${nome}?`}
        aoCancelar={() => setMatando(false)}
        acao={{
          rotulo: 'Matar',
          variante: 'perigo',
          aoClicar: () => {
            setMatando(false)
            void agir({ tipo: 'matar' })
          }
        }}
      >
        O jogador morre na hora e deixa cair os itens, como numa morte normal no jogo.
      </Dialogo>
    </div>
  )
}

// Barras do jogador (6.17): XP com nível, 10 corações e 10 coxas, e as ações dos dois lados.
function SaudeExperiencia({
  dados,
  online,
  aoAgir,
  aoMatar
}: {
  dados: NonNullable<Detalhes['dados']>
  online: boolean
  aoAgir: (acao: AcaoJogador) => void
  aoMatar: () => void
}): React.JSX.Element {
  const dica = online ? undefined : SO_ONLINE
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-center text-[13px] font-bold">Nível {dados.nivel}</span>
        <div
          role="progressbar"
          aria-label="Progresso de experiência"
          aria-valuenow={Math.round(dados.progresso * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-3 bg-panel-2"
        >
          <div className="h-full bg-accent" style={{ width: `${dados.progresso * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Botao
            variante="atencao"
            tamanho="pequeno"
            disabled={!online}
            title={dica}
            onClick={aoMatar}
          >
            Matar
          </Botao>
          <Botao
            variante="atencao"
            tamanho="pequeno"
            disabled={!online}
            title={dica}
            onClick={() => aoAgir({ tipo: 'faminto' })}
          >
            Deixar faminto
          </Botao>
        </div>
        <div className="flex flex-col gap-1">
          <Icones valor={dados.vida} rotulo="Vida" icone={IconeCoracao} cor="text-vida" />
          <Icones valor={dados.fome} rotulo="Fome" icone={IconeComida} cor="text-fome" />
        </div>
        <div className="flex gap-2">
          <Botao
            variante="primario"
            tamanho="pequeno"
            disabled={!online}
            title={dica}
            onClick={() => aoAgir({ tipo: 'curar' })}
          >
            Curar
          </Botao>
          <Botao
            variante="primario"
            tamanho="pequeno"
            disabled={!online}
            title={dica}
            onClick={() => aoAgir({ tipo: 'alimentar' })}
          >
            Alimentar
          </Botao>
        </div>
      </div>
      {!online && <p className="text-xs text-muted">{SO_ONLINE}.</p>}
    </div>
  )
}

// 10 ícones: cheio, meio (cortado) ou vazio (apagado). valor vai de 0 a 20.
function Icones({
  valor,
  rotulo,
  icone: Icone,
  cor
}: {
  valor: number
  rotulo: string
  icone: (p: { className?: string }) => React.JSX.Element
  cor: string
}): React.JSX.Element {
  const meios = Math.round(valor)
  return (
    <div role="img" aria-label={`${rotulo}: ${meios / 2} de 10`} className={`flex ${cor}`}>
      {Array.from({ length: 10 }, (_, i) => {
        const parte = Math.max(0, Math.min(2, meios - i * 2))
        return (
          <span key={i} className="relative h-5 w-5">
            <Icone className="absolute inset-0 h-5 w-5 opacity-25" />
            {parte > 0 && (
              <Icone
                className={`absolute inset-0 h-5 w-5 ${parte === 1 ? '[clip-path:inset(0_50%_0_0)]' : ''}`}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

function LinhaLocal({
  local,
  online,
  aoTeleportar
}: {
  local: Local | null
  online: boolean
  aoTeleportar: (local: Local) => void
}): React.JSX.Element {
  if (!local) return <p className="text-[13px] text-muted">Sem dados</p>
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span>
        <span className="font-mono">
          X {local.x.toFixed(2)} · Y {local.y.toFixed(2)} · Z {local.z.toFixed(2)}
        </span>
        <span className="block text-xs text-muted">
          {DIMENSOES[local.dimensao] ?? local.dimensao}
        </span>
      </span>
      <Botao
        variante="destaque"
        tamanho="pequeno"
        disabled={!online}
        title={online ? undefined : SO_ONLINE}
        onClick={() => aoTeleportar(local)}
      >
        Teleportar
      </Botao>
    </div>
  )
}
