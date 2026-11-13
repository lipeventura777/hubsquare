import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AcaoApp, ArquivoLog, ErroTela, RelatorioTravamento } from '../../../shared/tipos'
import { NIVEIS, niveisDasLinhas, type NivelLog } from '../../../shared/logs'
import { MensagemErro } from '../componentes/MensagemErro'
import { dataHora, tamanho } from '../componentes/formato'
import { IconeRegistro } from '../componentes/icones'
import { Esqueleto } from '../componentes/movimento'
import { Aviso, Botao, CaixaSelecao, Campo, EstadoVazio } from '../componentes/ui'
import { corDaLinha } from '../servidor/comandos'

type Tipo = 'logs' | 'travamentos'

// shortcut: mostra no máximo as últimas 5.000 linhas que passam no filtro, para a tela não
// travar com logs enormes; "Baixar" e "Copiar" levam tudo o que passou no filtro.
const MAX_LINHAS = 5000

// Registro de eventos: abas Logs (latest.log e .log.gz), Relatórios de travamento e Ações do app.
export function TelaRegistro({ aba }: { aba: string }): React.JSX.Element {
  return aba === 'Ações do app' ? <AcoesDoApp /> : <ArquivosDoRegistro aba={aba} />
}

// O que o app fez sozinho (automação), as mais recentes primeiro.
function AcoesDoApp(): React.JSX.Element {
  const [acoes, setAcoes] = useState<AcaoApp[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    const ler = (): void => {
      window.api.listarAcoes().then((r) => (r.ok ? setAcoes(r.valor) : setErro(r.erro)))
    }
    ler()
    const id = setInterval(ler, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-0 flex-1 overflow-auto p-10">
      {erro ? (
        <MensagemErro erro={erro} />
      ) : !acoes ? (
        <Esqueleto linhas={6} />
      ) : !acoes.length ? (
        <EstadoVazio
          icone={<IconeRegistro />}
          titulo="Nada por aqui ainda"
          texto="Quando a tela Automação desligar, reiniciar ou fizer um backup sozinha, isso aparece aqui."
        />
      ) : (
        <ul className="flex max-w-[900px] flex-col divide-y divide-linha border border-linha bg-panel">
          {acoes.map((a, i) => (
            <li key={`${a.data}-${i}`} className="flex gap-4 px-4 py-2 text-[13px]">
              <span className="w-36 shrink-0 font-mono text-xs text-muted">{dataHora(a.data)}</span>
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ArquivosDoRegistro({ aba }: { aba: string }): React.JSX.Element {
  const tipo: Tipo = aba === 'Logs' ? 'logs' : 'travamentos'
  const [arquivos, setArquivos] = useState<ArquivoLog[] | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    const r = tipo === 'logs' ? await window.api.listarLogs() : await window.api.listarTravamentos()
    if (!r.ok) return setErro(r.erro)
    setErro(null)
    setArquivos(r.valor)
    setAberto((a) => (a && r.valor.some((x) => x.nome === a) ? a : (r.valor[0]?.nome ?? null)))
  }, [tipo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura da lista
    void carregar()
  }, [carregar])

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-10">
      <aside className="flex w-60 shrink-0 flex-col border border-linha bg-panel">
        <header className="flex h-12 items-center justify-between border-b border-linha px-4">
          <h2 className="text-sm font-bold">
            {tipo === 'logs' ? 'Arquivos de log' : 'Relatórios'}
          </h2>
          <Botao
            tamanho="pequeno"
            title="Atualizar"
            aria-label="Atualizar"
            onClick={() => void carregar()}
          >
            ⟳
          </Botao>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto">
          {arquivos?.map((a) => (
            <li key={a.nome}>
              <button
                type="button"
                aria-current={a.nome === aberto ? 'true' : undefined}
                onClick={() => setAberto(a.nome)}
                className={`flex w-full flex-col px-4 py-2 text-left text-[13px] hover:bg-tile-active ${
                  a.nome === aberto ? 'bg-tile-active font-bold' : ''
                }`}
              >
                <span className="break-all">{a.nome}</span>
                <span className="text-xs font-normal text-muted">
                  {dataHora(a.data)} · {tamanho(a.tamanho)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {erro && <MensagemErro erro={erro} />}
        {!arquivos ? (
          !erro && <Esqueleto linhas={6} />
        ) : !aberto ? (
          <EstadoVazio
            icone={<IconeRegistro />}
            titulo={tipo === 'logs' ? 'Nenhum log ainda' : 'Nenhum travamento'}
            texto={
              tipo === 'logs'
                ? 'Os logs aparecem depois que o servidor ligar pela primeira vez.'
                : 'Que bom: o servidor nunca travou a ponto de gerar um relatório.'
            }
          />
        ) : tipo === 'logs' ? (
          <VisualizadorLog key={aberto} nome={aberto} />
        ) : (
          <Travamento key={aberto} nome={aberto} />
        )}
      </div>
    </div>
  )
}

function useBaixar(tipo: Tipo, nome: string): { baixar: () => void; erro: ErroTela | null } {
  const [erro, setErro] = useState<ErroTela | null>(null)
  return {
    erro,
    baixar: () => {
      window.api.baixarLog(tipo, nome).then((r) => setErro(r.ok ? null : r.erro))
    }
  }
}

// Visualizador com as cores do console, busca e filtro por nível.
function VisualizadorLog({ nome }: { nome: string }): React.JSX.Element {
  const [texto, setTexto] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [busca, setBusca] = useState('')
  const [niveis, setNiveis] = useState<NivelLog[]>([...NIVEIS])
  const [copiado, setCopiado] = useState(false)
  const download = useBaixar('logs', nome)

  useEffect(() => {
    window.api.lerLog(nome).then((r) => (r.ok ? setTexto(r.valor) : setErro(r.erro)))
  }, [nome])

  const filtradas = useMemo(() => {
    if (texto === null) return []
    const linhas = texto.split(/\r?\n/)
    const nivelDe = niveisDasLinhas(linhas)
    const termo = busca.trim().toLowerCase()
    return linhas.filter(
      (l, i) => niveis.includes(nivelDe[i]) && (!termo || l.toLowerCase().includes(termo))
    )
  }, [texto, busca, niveis])

  if (texto === null) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={6} />

  const visiveis = filtradas.slice(-MAX_LINHAS)
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Campo
          type="search"
          aria-label="Buscar no log"
          placeholder="Buscar…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-64"
        />
        {NIVEIS.map((n) => (
          <CaixaSelecao
            key={n}
            marcada={niveis.includes(n)}
            aoMudar={(sim) => setNiveis((v) => (sim ? [...v, n] : v.filter((x) => x !== n)))}
          >
            {n}
          </CaixaSelecao>
        ))}
        <div className="ml-auto flex gap-2">
          <Botao
            tamanho="pequeno"
            variante="destaque"
            onClick={() => {
              void window.api.copiar(filtradas.join('\n'))
              setCopiado(true)
              setTimeout(() => setCopiado(false), 1500)
            }}
          >
            {copiado ? 'Copiado!' : 'Copiar'}
          </Botao>
          <Botao tamanho="pequeno" onClick={download.baixar}>
            Baixar
          </Botao>
        </div>
      </div>
      {download.erro && <MensagemErro erro={download.erro} />}
      <p className="text-xs text-muted">
        {filtradas.length.toLocaleString('pt-BR')} linhas
        {filtradas.length > MAX_LINHAS &&
          ` (mostrando as últimas ${MAX_LINHAS.toLocaleString('pt-BR')})`}
      </p>
      <pre className="min-h-0 flex-1 overflow-auto bg-console p-3 font-mono text-[13px] leading-5 whitespace-pre-wrap break-all">
        {visiveis.map((l, i) => (
          <div key={i} className={corDaLinha(l)}>
            {l || ' '}
          </div>
        ))}
      </pre>
    </>
  )
}

function Travamento({ nome }: { nome: string }): React.JSX.Element {
  const [relatorio, setRelatorio] = useState<RelatorioTravamento | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const download = useBaixar('travamentos', nome)

  useEffect(() => {
    window.api.lerTravamento(nome).then((r) => (r.ok ? setRelatorio(r.valor) : setErro(r.erro)))
  }, [nome])

  if (!relatorio) return erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={6} />
  return (
    <>
      {relatorio.causa ? (
        <Aviso tipo="atencao">
          <span>
            <strong>Causa provável:</strong> {relatorio.causa}
          </span>
        </Aviso>
      ) : (
        <p className="text-[13px] text-muted">
          Não deu para identificar a causa sozinho. O texto completo está abaixo; ele pode ajudar
          quem entende de servidores.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Botao
          tamanho="pequeno"
          variante="destaque"
          onClick={() => void window.api.copiar(relatorio.texto)}
        >
          Copiar
        </Botao>
        <Botao tamanho="pequeno" onClick={download.baixar}>
          Baixar
        </Botao>
      </div>
      {download.erro && <MensagemErro erro={download.erro} />}
      <pre className="min-h-0 flex-1 overflow-auto bg-console p-3 font-mono text-[13px] leading-5 whitespace-pre-wrap break-all text-console-muted">
        {relatorio.texto}
      </pre>
    </>
  )
}
