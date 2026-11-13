import { useEffect, useState } from 'react'
import {
  EXTRAS_TIPOS,
  NOMES_TIPOS,
  type ErroTela,
  type InfoServidor,
  type Progresso,
  type TipoId
} from '../../../shared/tipos'
import { compararVersoes } from '../../../shared/versoes'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import {
  Aviso,
  Botao,
  CaixaSelecao,
  Dialogo,
  PaginaAjustes,
  Secao,
  Selecao
} from '../componentes/ui'
import { useEstadoServidor } from '../servidor/comandos'

const DESCRICOES: Record<TipoId, string> = {
  paper: 'Rápido e aceita plugins.',
  vanilla: 'O servidor oficial, sem mudanças.',
  fabric: 'Mods leves.',
  forge: 'Mods grandes.',
  neoforge: 'Mods das versões novas.'
}

// Tela Software: mostra o tipo e a versão atuais e troca, só com o servidor desligado.
export function TelaSoftware(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [info, setInfo] = useState<InfoServidor | null>(null)
  const [tipo, setTipo] = useState<TipoId>('paper')
  const [versoes, setVersoes] = useState<string[] | null>(null)
  const [versao, setVersao] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [entendi, setEntendi] = useState(false)
  const [trocando, setTrocando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  useEffect(() => {
    window.api.servidorAtual().then((r) => {
      if (!r.ok) return setErro(r.erro)
      if (!r.valor) return
      setInfo(r.valor)
      setTipo(r.valor.tipo)
    })
  }, [])

  useEffect(() => {
    if (!info) return
    let ativo = true
    window.api.listarVersoes(tipo).then((r) => {
      if (!ativo) return
      if (!r.ok) return setErro(r.erro)
      setVersoes(r.valor)
      setVersao(r.valor.includes(info.versao) ? info.versao : (r.valor[0] ?? ''))
    })
    return () => {
      ativo = false
    }
  }, [info, tipo])

  if (!info) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }

  const mudou = tipo !== info.tipo || versao !== info.versao
  const voltando = !!versao && compararVersoes(versao, info.versao) < 0
  const desligado = estado === 'desligado'
  // Plugins do Paper não rodam em loaders de mods, e mods de um loader não rodam em outro.
  const extras = tipo !== info.tipo ? EXTRAS_TIPOS[info.tipo] : undefined
  const avisoExtras = extras
    ? `Os ${extras} do ${NOMES_TIPOS[info.tipo]} não funcionam no ${NOMES_TIPOS[tipo]}. Eles continuam guardados na pasta "${extras}", mas não vão carregar.`
    : ''

  async function trocar(): Promise<void> {
    setErro(null)
    setTrocando(true)
    const r = await window.api.trocarSoftware({ tipo, versao, confirmouVersaoAntiga: entendi })
    setTrocando(false)
    setProgresso(null)
    if (!r.ok) {
      setConfirmando(false)
      return setErro(r.erro)
    }
    location.reload() // tipo e versão aparecem em várias telas
  }

  return (
    <PaginaAjustes>
      <Secao titulo="Atual">
        <CardPainel titulo="Software do servidor">
          <p className="texto-pixel text-[22px]">
            {NOMES_TIPOS[info.tipo]} {info.versao}
          </p>
          <p className="text-[13px] text-muted">Java {info.java}</p>
        </CardPainel>
      </Secao>

      <Secao titulo="Trocar">
        <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-5">
          {(Object.keys(NOMES_TIPOS) as TipoId[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`flex flex-col gap-1 border-2 bg-panel p-3 text-left transition-colors duration-(--dur-fast) ${
                tipo === t ? 'border-accent' : 'border-linha hover:border-muted'
              }`}
            >
              <span className="text-[13px] font-bold">{NOMES_TIPOS[t]}</span>
              <span className="text-xs text-muted">{DESCRICOES[t]}</span>
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-[13px]">
          Versão do jogo
          <Selecao value={versao} disabled={!versoes} onChange={(e) => setVersao(e.target.value)}>
            {!versoes && <option>Carregando...</option>}
            {versoes?.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Selecao>
        </label>

        {mudou && (
          <Aviso tipo="atencao">
            <span>
              Antes de trocar, o app faz um backup do mundo.
              {voltando && ' Você escolheu uma versão mais antiga: isso pode estragar o mundo.'}
              {info.tipo === 'paper' &&
                tipo === 'vanilla' &&
                ' No Paper, o Nether e o End ficam em pastas separadas que o Vanilla não lê.'}
              {avisoExtras && ` ${avisoExtras}`}
            </span>
          </Aviso>
        )}

        <Botao
          variante="primario"
          className="self-start"
          disabled={!mudou || !desligado || !versao}
          onClick={() => {
            setEntendi(false)
            setConfirmando(true)
          }}
        >
          Trocar para {NOMES_TIPOS[tipo]} {versao}
        </Botao>
        {!desligado && <p className="text-xs text-muted">Desligue o servidor para trocar.</p>}
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Dialogo
        aberto={confirmando}
        titulo="Trocar o software?"
        aoCancelar={() => setConfirmando(false)}
        acao={{
          rotulo: trocando ? 'Trocando...' : 'Trocar',
          variante: voltando ? 'perigo' : 'primario',
          ocupado: trocando,
          desabilitado: voltando && !entendi,
          aoClicar: trocar
        }}
      >
        <div className="flex flex-col gap-3">
          <p>
            De{' '}
            <b>
              {NOMES_TIPOS[info.tipo]} {info.versao}
            </b>{' '}
            para{' '}
            <b>
              {NOMES_TIPOS[tipo]} {versao}
            </b>
            . Um backup do mundo é feito antes.
          </p>
          {avisoExtras && <p>{avisoExtras}</p>}
          {voltando && (
            <CaixaSelecao marcada={entendi} aoMudar={setEntendi} disabled={trocando}>
              Entendi que voltar para uma versão mais antiga pode estragar o mundo
            </CaixaSelecao>
          )}
          {trocando && progresso && (
            <div className="flex flex-col gap-1 text-[13px]">
              <span>{progresso.etapa}</span>
              <BarraProgresso
                rotulo={progresso.etapa}
                valor={progresso.recebido}
                maximo={progresso.total}
              />
            </div>
          )}
        </div>
      </Dialogo>
    </PaginaAjustes>
  )
}
