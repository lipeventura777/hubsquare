import { useEffect, useState } from 'react'
import {
  NOMES_TIPOS,
  type AnaliseZip,
  type ErroTela,
  type Progresso,
  type TipoId
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso } from '../componentes/movimento'
import { Botao, CaixaSelecao, Campo, Dialogo, Selecao } from '../componentes/ui'
import { t } from '../../../shared/i18n'

// "Importar de arquivo .zip": escolhe o arquivo, mostra o que foi achado (servidor inteiro ou
// só o mundo) e pergunta nome, tipo, versão e o EULA antes de criar o servidor novo.
export function ImportarZip({ bloqueado }: { bloqueado: boolean }): React.JSX.Element {
  const [analise, setAnalise] = useState<AnaliseZip | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoId>('paper')
  const [versoes, setVersoes] = useState<string[] | null>(null)
  const [versao, setVersao] = useState('')
  const [eula, setEula] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [criando, setCriando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [erroDialogo, setErroDialogo] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  // Lista de versões do tipo escolhido; sugere a versão do mundo, se ela estiver na lista.
  useEffect(() => {
    if (!analise) return
    let ativo = true
    window.api.listarVersoes(tipo).then((r) => {
      if (!ativo) return
      if (!r.ok) return setErroDialogo(r.erro)
      setVersoes(r.valor)
      const sugerida = analise.loader?.versao ?? analise.versaoDoMundo
      setVersao(sugerida && r.valor.includes(sugerida) ? sugerida : (r.valor[0] ?? ''))
    })
    return () => {
      ativo = false
    }
  }, [analise, tipo])

  async function escolher(): Promise<void> {
    setErro(null)
    setAbrindo(true)
    const r = await window.api.analisarZip()
    setAbrindo(false)
    if (!r.ok) return setErro(r.erro)
    if (!r.valor) return // cancelou
    setAnalise(r.valor)
    setNome(r.valor.nomeSugerido)
    // Server pack: já vem com o loader detectado (o usuário pode trocar).
    if (r.valor.loader) setTipo(r.valor.loader.tipo)
    setVersoes(null)
    setEula(false)
    setErroDialogo(null)
  }

  async function criar(): Promise<void> {
    if (!analise) return
    setErroDialogo(null)
    setCriando(true)
    const r = await window.api.criarDeZip({
      token: analise.token,
      nome,
      tipo,
      versao,
      aceitouEula: eula
    })
    setCriando(false)
    setProgresso(null)
    if (!r.ok) return setErroDialogo(r.erro)
    location.reload() // o servidor novo vira o ativo; todas as telas leem de novo
  }

  return (
    <>
      <Botao onClick={escolher} disabled={bloqueado || abrindo} className="w-full">
        {abrindo ? t('importarZip.abrindo') : t('importarZip.importarDeArquivoZip')}
      </Botao>
      {bloqueado && (
        <p className="mt-2 text-xs text-muted">{t('importarZip.desligueOServidorParaImportar')}</p>
      )}
      {erro && (
        <div className="mt-3">
          <MensagemErro erro={erro} />
        </div>
      )}

      <Dialogo
        aberto={analise !== null}
        titulo={t('importarZip.importarServidor')}
        aoCancelar={() => setAnalise(null)}
        acao={{
          rotulo: criando ? t('importarZip.criando') : t('importarZip.criarServidor'),
          ocupado: criando,
          desabilitado: !eula || !versao || !nome.trim(),
          aoClicar: criar
        }}
      >
        {analise && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>
              {t('importarZip.em')} <b>{analise.arquivo}</b> {t('importarZip.achei')}{' '}
              {analise.conteudo === 'servidor'
                ? t('importarZip.umServidorInteiroComServer')
                : t('importarZip.umMundoComLevelDat')}
              {analise.versaoDoMundo &&
                t('importarZip.oMundoEDaVersao', { versaoDoMundo: analise.versaoDoMundo })}
            </p>
            <label className="flex flex-col gap-1">
              {t('importarZip.nomeDoServidor')}
              <Campo value={nome} maxLength={32} onChange={(e) => setNome(e.target.value)} />
            </label>
            {analise.loader && (
              <p className="text-xs text-muted">
                {t('importarZip.pelosArquivosDoPackEle', { v: NOMES_TIPOS[analise.loader.tipo] })}
                {analise.loader.versao ? ` ${analise.loader.versao}` : ''}
                {t('importarZip.oAppInstalaAMesma')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                {t('importarZip.tipo')}
                <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as TipoId)}>
                  {(Object.keys(NOMES_TIPOS) as TipoId[]).map((t) => (
                    <option key={t} value={t}>
                      {NOMES_TIPOS[t]}
                    </option>
                  ))}
                </Selecao>
              </label>
              <label className="flex flex-col gap-1">
                {t('importarZip.versaoDoJogo')}
                <Selecao
                  value={versao}
                  disabled={!versoes}
                  onChange={(e) => setVersao(e.target.value)}
                >
                  {!versoes && <option>{t('importarZip.carregando')}</option>}
                  {versoes?.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Selecao>
              </label>
            </div>
            {analise.versaoDoMundo && versao && versao !== analise.versaoDoMundo && (
              <p className="text-xs text-muted">
                {t('importarZip.usarUmaVersaoMaisAntiga', { versaoDoMundo: analise.versaoDoMundo })}
              </p>
            )}
            <CaixaSelecao marcada={eula} aoMudar={setEula} disabled={criando}>
              {t('importarZip.liEAceitoO')}{' '}
              <a
                href="https://aka.ms/MinecraftEULA"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t('importarZip.eulaDoMinecraft')}
              </a>
            </CaixaSelecao>
            {criando && progresso && (
              <div className="flex flex-col gap-1">
                <span>{progresso.etapa}</span>
                <BarraProgresso
                  rotulo={progresso.etapa}
                  valor={progresso.recebido}
                  maximo={progresso.total}
                />
              </div>
            )}
            {erroDialogo && <MensagemErro erro={erroDialogo} />}
          </div>
        )}
      </Dialogo>
    </>
  )
}
