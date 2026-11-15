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
import { t } from '../../../shared/i18n'

const DESCRICOES: Record<TipoId, string> = {
  paper: t('telaSoftware.rapidoEAceitaPlugins'),
  vanilla: t('telaSoftware.oServidorOficialSemMudancas'),
  fabric: t('telaSoftware.modsLeves'),
  forge: t('telaSoftware.modsGrandes'),
  neoforge: t('telaSoftware.modsDasVersoesNovas')
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
    ? t('telaSoftware.osDoNaoFuncionamNo', {
        extras,
        v: NOMES_TIPOS[info.tipo],
        v2: NOMES_TIPOS[tipo],
        extras2: extras
      })
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
    <PaginaAjustes grade="grade-software">
      <Secao titulo={t('telaSoftware.atual')}>
        <CardPainel titulo={t('telaSoftware.softwareDoServidor')}>
          <p className="texto-pixel text-[22px]">
            {NOMES_TIPOS[info.tipo]} {info.versao}
          </p>
          <p className="text-[13px] text-muted">{t('telaSoftware.java', { java: info.java })}</p>
        </CardPainel>
      </Secao>

      <Secao titulo={t('telaSoftware.trocar')}>
        {/* Os cinco numa linha quando o bloco tem espaço; senão quebram juntos. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
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

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex w-60 flex-col gap-1 text-[13px]">
            {t('telaSoftware.versaoDoJogo')}
            <Selecao value={versao} disabled={!versoes} onChange={(e) => setVersao(e.target.value)}>
              {!versoes && <option>{t('telaSoftware.carregando')}</option>}
              {versoes?.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Selecao>
          </label>
          <span title={mudou ? undefined : t('telaSoftware.esteJaEOSoftware')}>
            <Botao
              variante="primario"
              disabled={!mudou || !desligado || !versao}
              onClick={() => {
                setEntendi(false)
                setConfirmando(true)
              }}
            >
              {t('telaSoftware.trocarPara', { v: NOMES_TIPOS[tipo], versao })}
            </Botao>
          </span>
        </div>

        {mudou && (
          <Aviso tipo="atencao">
            <span>
              {t('telaSoftware.antesDeTrocarOApp')}
              {voltando && t('telaSoftware.voceEscolheuUmaVersaoMais')}
              {info.tipo === 'paper' && tipo === 'vanilla' && t('telaSoftware.noPaperONetherE')}
              {avisoExtras && ` ${avisoExtras}`}
            </span>
          </Aviso>
        )}

        {!desligado && (
          <p className="text-xs text-muted">{t('telaSoftware.desligueOServidorParaTrocar')}</p>
        )}
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Dialogo
        aberto={confirmando}
        titulo={t('telaSoftware.trocarOSoftware')}
        aoCancelar={() => setConfirmando(false)}
        acao={{
          rotulo: trocando ? t('telaSoftware.trocando') : t('telaSoftware.trocar'),
          variante: voltando ? 'perigo' : 'primario',
          ocupado: trocando,
          desabilitado: voltando && !entendi,
          aoClicar: trocar
        }}
      >
        <div className="flex flex-col gap-3">
          <p>
            {t('telaSoftware.de')}{' '}
            <b>
              {NOMES_TIPOS[info.tipo]} {info.versao}
            </b>{' '}
            {t('telaSoftware.para')}{' '}
            <b>
              {NOMES_TIPOS[tipo]} {versao}
            </b>
            {t('telaSoftware.umBackupDoMundoE')}
          </p>
          {avisoExtras && <p>{avisoExtras}</p>}
          {voltando && (
            <CaixaSelecao marcada={entendi} aoMudar={setEntendi} disabled={trocando}>
              {t('telaSoftware.entendiQueVoltarParaUma')}
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
