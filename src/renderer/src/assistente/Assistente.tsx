import { ehForgeAntigo } from '../../../shared/forgeAntigoRegras'
import { useEffect, useState } from 'react'
import {
  NOMES_TIPOS,
  type Configuracoes,
  type ErroTela,
  type InfoServidor,
  type LimitesRam,
  type Progresso,
  type TipoId
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeOk } from '../icones'
import { Logo } from '../componentes/Logo'
import { classesBotao } from '../componentes/estilos'
import { BarraProgresso } from '../componentes/movimento'
import { Aviso, Botao, CaixaSelecao, Campo, Secao, Selecao } from '../componentes/ui'
import { CamposDoJogo } from '../configuracoes/CamposDoJogo'
import { ReceberServidor } from '../servidores/PassarServidor'
import { t as tx } from '../../../shared/i18n'

const ETAPAS = [
  tx('assistente.tipo'),
  tx('assistente.versao'),
  tx('assistente.nome'),
  tx('assistente.configuracoes'),
  tx('assistente.eula'),
  tx('assistente.pronto')
] as const

const DESCRICOES: Record<TipoId, string> = {
  paper: tx('assistente.maisRapidoEAceitaPlugins'),
  vanilla: tx('assistente.oServidorOficialSemNenhuma'),
  fabric: tx('assistente.paraModsLevesCadaAmigo'),
  forge: tx('assistente.paraModsGrandesEModpacks'),
  neoforge: tx('assistente.sucessorDoForgeParaMods')
}

// Assistente de primeira vez (DESIGN.md, seção 6.10). Só monta os pedidos; quem cria e valida é
// o processo principal, com as mesmas funções da tela Painel e da tela Configurações.
export function Assistente({
  aoConcluir,
  aoCancelar
}: {
  aoConcluir: (info: InfoServidor) => void
  // Quando aberto pelo "+ Criar" da tela Servidores, dá para desistir na primeira etapa.
  aoCancelar?: () => void
}): React.JSX.Element {
  const [etapa, setEtapa] = useState(0)
  const [tipo, setTipo] = useState<TipoId>('paper')
  const [versoes, setVersoes] = useState<string[] | null>(null)
  const [versao, setVersao] = useState('')
  const [nome, setNome] = useState(tx('assistente.meuServidor'))
  const [meuNome, setMeuNome] = useState('')
  const [ram, setRam] = useState<LimitesRam | null>(null)
  const [config, setConfig] = useState<Configuracoes | null>(null)
  const [eula, setEula] = useState(false)
  const [criando, setCriando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [criado, setCriado] = useState<InfoServidor | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [avisoFinal, setAvisoFinal] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  useEffect(() => {
    window.api.limitesRam().then((limites) => {
      setRam(limites)
      setConfig({
        modoDeJogo: 'survival',
        dificuldade: 'easy',
        maxJogadores: 10,
        motd: tx('assistente.servidorFeitoComOHubsquare'),
        pvp: true,
        ramGb: limites.sugerida,
        porta: 25565
      })
    })
  }, [])

  useEffect(() => {
    let ativo = true
    window.api.listarVersoes(tipo).then((r) => {
      if (!ativo) return
      if (r.ok) {
        setVersoes(r.valor)
        setVersao(r.valor[0] ?? '') // a mais nova já vem selecionada
      } else setErro(r.erro)
    })
    return () => {
      ativo = false
    }
  }, [tipo])

  function trocarTipo(novo: TipoId): void {
    if (novo === tipo) return
    setTipo(novo)
    setVersoes(null)
    setErro(null)
  }

  function mudar<K extends keyof Configuracoes>(chave: K, valor: Configuracoes[K]): void {
    setConfig((c) => c && { ...c, [chave]: valor })
  }

  async function criar(): Promise<void> {
    if (!config) return
    setErro(null)
    setCriando(true)
    const r = await window.api.criarServidor({ tipo, versao, nome, aceitouEula: eula })
    if (!r.ok) {
      setCriando(false)
      setProgresso(null)
      return setErro(r.erro)
    }
    // O servidor já existe; se algo abaixo falhar, mostra o aviso no fim e dá para ajustar depois.
    const salvar = await window.api.salvarConfiguracoes(config)
    const whitelist = meuNome.trim()
      ? await window.api.adicionarNaLista('whitelist', meuNome.trim())
      : null
    setCriando(false)
    setProgresso(null)
    if (!salvar.ok) setAvisoFinal(salvar.erro)
    else if (whitelist && !whitelist.ok) setAvisoFinal(whitelist.erro)
    setCriado(r.valor)
    setEtapa(5)
  }

  const podeAvancar =
    (etapa === 1 && !!versao) ||
    (etapa === 2 && !!nome.trim()) ||
    (etapa === 3 && !!config) ||
    etapa === 0

  // Botão principal da barra de baixo: Próximo, depois "Criar servidor" e por fim "Ir para o painel".
  const principal =
    etapa < 4
      ? {
          texto: tx('assistente.proximo'),
          aoClicar: () => setEtapa((e) => e + 1),
          ativo: podeAvancar
        }
      : etapa === 4
        ? {
            texto: criando ? tx('assistente.criando') : tx('assistente.criarServidor'),
            aoClicar: criar,
            ativo: eula && !criando
          }
        : {
            texto: tx('assistente.irParaOPainel'),
            aoClicar: () => criado && aoConcluir(criado),
            ativo: !!criado
          }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="m-2.5 mb-0 flex shrink-0 flex-col gap-5 bg-panel px-10 py-6">
        <div className="flex items-center gap-3">
          <Logo tamanho={32} />
          <div>
            <div className="texto-pixel text-[22px]">{tx('assistente.bemVindoAoHubsquare')}</div>
            <div className="text-[13px] text-muted">{tx('assistente.vamosCriarOSeuServidor')}</div>
          </div>
        </div>
        <BarraDeEtapas etapa={etapa} />
      </header>

      <div className="vidro-painel m-2.5 min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10 p-10">
          {etapa === 0 && (
            <Secao titulo={tx('assistente.queTipoDeServidor')}>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(NOMES_TIPOS) as TipoId[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => trocarTipo(t)}
                    aria-pressed={tipo === t}
                    className={`flex flex-col gap-1 border-2 bg-panel p-4 text-left transition-colors duration-(--dur-fast) ${
                      tipo === t ? 'border-accent' : 'border-linha hover:border-muted'
                    }`}
                  >
                    <span className="text-[13px] font-bold">
                      {NOMES_TIPOS[t]}
                      {t === 'paper' && (
                        <span className="ml-2 bg-accent px-1.5 py-0.5 text-xs text-accent-text">
                          {tx('assistente.recomendado')}
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] text-muted">{DESCRICOES[t]}</span>
                  </button>
                ))}
              </div>
            </Secao>
          )}
          {etapa === 0 && (
            <Secao titulo={tx('assistente.umAmigoPassouUmServidor')}>
              <ReceberServidor bloqueado={false} />
            </Secao>
          )}

          {etapa === 1 && (
            <Secao titulo={tx('assistente.qualVersaoDoJogo')}>
              <p className="text-[13px] text-muted">{tx('assistente.useAMesmaVersaoQue')}</p>
              <Selecao
                value={versao}
                disabled={!versoes}
                onChange={(e) => setVersao(e.target.value)}
                aria-label={tx('assistente.versaoDoJogo')}
              >
                {!versoes && <option>{tx('assistente.carregandoVersoes')}</option>}
                {versoes?.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Selecao>
              {/* Fase F1: Forge de 1.7.10 a 1.12.1 */}
              {tipo === 'forge' && ehForgeAntigo(versao) && (
                <p className="text-xs text-muted">{tx('tipos.forge.estaVersaoUsaJava8')}</p>
              )}
            </Secao>
          )}

          {etapa === 2 && (
            <Secao titulo={tx('assistente.qualONomeDoServidor')}>
              <Campo
                value={nome}
                maxLength={32}
                onChange={(e) => setNome(e.target.value)}
                aria-label={tx('assistente.nomeDoServidor')}
              />
              <p className="text-xs text-muted">{tx('assistente.ate32LetrasNumerosEspacos')}</p>
            </Secao>
          )}

          {etapa === 3 && config && ram && (
            <>
              <CamposDoJogo
                config={config}
                ram={ram}
                mudar={mudar}
                nome={nome.trim() || tx('assistente.meuServidor')}
              />
              <Secao titulo={tx('assistente.whitelist')}>
                <label className="flex flex-col gap-1 text-[13px]">
                  {tx('assistente.seuNomeNoJogoOpcional')}
                  <Campo
                    value={meuNome}
                    maxLength={16}
                    placeholder={tx('assistente.paraVoceJaEntrarNa')}
                    onChange={(e) => setMeuNome(e.target.value)}
                  />
                </label>
                <p className="text-xs text-muted">{tx('assistente.oServidorSoDeixaEntrar')}</p>
              </Secao>
            </>
          )}

          {etapa === 4 && (
            <Secao titulo={tx('assistente.termosDeUsoDoJogo')}>
              <p className="text-[13px] text-muted">{tx('assistente.paraRodarUmServidorVoce')}</p>
              <CaixaSelecao marcada={eula} disabled={criando} aoMudar={setEula}>
                {tx('assistente.liEAceitoO')}{' '}
                <a
                  href="https://aka.ms/MinecraftEULA"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {tx('assistente.eulaDoMinecraft')}
                </a>
              </CaixaSelecao>
              {criando && progresso && (
                <div className="flex flex-col gap-1 text-[13px]">
                  <span>{progresso.etapa}</span>
                  <BarraProgresso
                    rotulo={progresso.etapa}
                    valor={progresso.recebido}
                    maximo={progresso.total}
                  />
                </div>
              )}
            </Secao>
          )}

          {etapa === 5 && criado && (
            <Secao titulo={tx('assistente.tudoPronto')}>
              <Aviso tipo="sucesso">
                {tx('assistente.oServidorFoiCriadoAgora', {
                  nome: criado.nome,
                  v: NOMES_TIPOS[criado.tipo],
                  versao: criado.versao
                })}
              </Aviso>
              {avisoFinal && <MensagemErro erro={avisoFinal} />}
            </Secao>
          )}

          {erro && <MensagemErro erro={erro} />}
        </div>
      </div>

      <footer className="m-2.5 mt-0 flex h-16 shrink-0 items-center justify-between bg-panel px-10">
        {etapa === 5 ? (
          <span />
        ) : etapa === 0 && aoCancelar ? (
          <Botao onClick={aoCancelar}>{tx('assistente.cancelar')}</Botao>
        ) : (
          <Botao onClick={() => setEtapa((e) => e - 1)} disabled={etapa === 0 || criando}>
            {tx('assistente.voltar')}
          </Botao>
        )}
        <button
          type="button"
          onClick={principal.ativo ? principal.aoClicar : undefined}
          disabled={!principal.ativo}
          className={classesBotao('primario', 'grande')}
        >
          <span className={criando ? 'pontos' : ''}>{principal.texto}</span>
        </button>
      </footer>
    </div>
  )
}

// Quadrados numerados ligados por uma linha (seção 6.10): atual e concluídas em --accent.
export function BarraDeEtapas({
  etapa,
  etapas = ETAPAS
}: {
  etapa: number
  etapas?: readonly string[]
}): React.JSX.Element {
  return (
    <ol className="flex items-start" aria-label={tx('assistente.etapas')}>
      {etapas.map((nome, i) => {
        const feita = i < etapa
        const atual = i === etapa
        return (
          <li key={nome} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-20 flex-col items-center gap-1">
              <span
                aria-current={atual ? 'step' : undefined}
                className={`flex h-8 w-8 items-center justify-center text-[13px] font-bold ${
                  feita || atual ? 'bg-accent text-accent-text' : 'bg-panel-2 text-muted'
                }`}
              >
                {feita ? <IconeOk className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-xs ${atual ? 'font-bold' : 'text-muted'}`}>{nome}</span>
            </div>
            {i < etapas.length - 1 && (
              <span
                aria-hidden="true"
                className={`mt-4 h-0.5 flex-1 ${feita ? 'bg-accent' : 'bg-panel-2'}`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
