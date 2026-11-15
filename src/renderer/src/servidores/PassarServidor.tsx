import { useEffect, useState } from 'react'
import {
  NOMES_TIPOS,
  type AnaliseHubserver,
  type ErroTela,
  type ItemServidor,
  type PreviaPassar,
  type Progresso
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { Aviso, Botao, CaixaSelecao, Campo, Dialogo, OpcaoRadio } from '../componentes/ui'
import { t } from '../../../shared/i18n'

// Passar o servidor (Fase M7): gerar o .hubserver para um amigo hospedar, e receber um de volta.

const tamanho = (bytes: number): string =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
    : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`

// "Passar para outro amigo…" (menu do servidor, servidor desligado).
export function DialogoPassar({
  servidor,
  aoFechar
}: {
  servidor: ItemServidor
  aoFechar: (gerou: boolean) => void
}): React.JSX.Element {
  const [previa, setPrevia] = useState<PreviaPassar | null>(null)
  const [para, setPara] = useState('')
  const [gerando, setGerando] = useState(false)
  const [pronto, setPronto] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    let ativo = true
    window.api.previaPassar(servidor.id).then((r) => {
      if (!ativo) return
      if (r.ok) setPrevia(r.valor)
      else setErro(r.erro)
    })
    return () => {
      ativo = false
    }
  }, [servidor.id])

  async function gerar(): Promise<void> {
    if (pronto) return aoFechar(true)
    setErro(null)
    setGerando(true)
    const r = await window.api.passarServidor(servidor.id, para)
    setGerando(false)
    if (!r.ok) return setErro(r.erro)
    if (r.valor) setPronto(`${r.valor.arquivo} (${tamanho(r.valor.tamanho)})`)
  }

  return (
    <Dialogo
      aberto
      titulo={t('passarServidor.passarParaOutroAmigo', { nome: servidor.nome })}
      aoCancelar={() => aoFechar(!!pronto)}
      acao={{
        rotulo: pronto
          ? t('passarServidor.fechar')
          : gerando
            ? t('passarServidor.gerando')
            : t('passarServidor.gerarArquivoHubserver'),
        ocupado: gerando,
        desabilitado: !pronto && (!previa || !para.trim()),
        aoClicar: gerar
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        {pronto ? (
          <Aviso tipo="sucesso">
            <span>
              {t('passarServidor.pronto')} <b>{pronto}</b>
              {t('passarServidor.mandeOArquivoParaO')}
            </span>
          </Aviso>
        ) : (
          <>
            <Aviso tipo="atencao">
              <span>{t('passarServidor.enquantoSeuAmigoHospedaNao')}</span>
            </Aviso>
            <label className="flex flex-col gap-1">
              {t('passarServidor.quemVaiHospedar')}
              <Campo
                value={para}
                maxLength={32}
                placeholder={t('passarServidor.nomeDoAmigo')}
                onChange={(e) => setPara(e.target.value)}
                autoFocus
              />
            </label>
            {!previa && !erro && <Esqueleto linhas={3} />}
            {previa && (
              <>
                <p>
                  {t('passarServidor.tamanhoCercaDe')} <b>{tamanho(previa.tamanho)}</b>{' '}
                  {t('passarServidor.antesDeCompactar')}
                </p>
                <div>
                  <p className="font-bold">{t('passarServidor.vaiNoArquivo')}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {previa.vai.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                    {previa.mods > 0 && (
                      <li>
                        {t('passarServidor.modsPluginsComoLinkOficial', { mods: previa.mods })}
                      </li>
                    )}
                    {previa.manuais > 0 && (
                      <li>{t('passarServidor.modsBaixadosAMaoSo', { manuais: previa.manuais })}</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-bold">{t('passarServidor.ficaNestePc')}</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {previa.fica.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
                {previa.semLink.length > 0 && (
                  <p className="text-muted">
                    {t('passarServidor.semLinkOficialOAmigo')} {previa.semLink.join(', ')}
                  </p>
                )}
              </>
            )}
          </>
        )}
        {erro && <MensagemErro erro={erro} />}
      </div>
    </Dialogo>
  )
}

// "Receber servidor (.hubserver)": novo servidor, ou o meu atualizado (mesmo id) ou uma cópia.
export function ReceberServidor({ bloqueado }: { bloqueado: boolean }): React.JSX.Element {
  const [analise, setAnalise] = useState<AnaliseHubserver | null>(null)
  const [modo, setModo] = useState<'novo' | 'copia' | 'atualizar'>('novo')
  const [nome, setNome] = useState('')
  const [eula, setEula] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [recebendo, setRecebendo] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [erroDialogo, setErroDialogo] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  async function escolher(): Promise<void> {
    setErro(null)
    setAbrindo(true)
    const r = await window.api.analisarHubserver()
    setAbrindo(false)
    if (!r.ok) return setErro(r.erro)
    if (!r.valor) return
    const a = r.valor
    setAnalise(a)
    setModo(a.mesmo ? (a.mesmo.motivoSemAtualizar ? 'copia' : 'atualizar') : 'novo')
    setNome(a.mesmo ? t('passarServidor.copia', { nome: a.nome }).slice(0, 32) : a.nome)
    setEula(false)
    setErroDialogo(null)
  }

  async function receber(): Promise<void> {
    if (!analise) return
    setErroDialogo(null)
    setRecebendo(true)
    const r = await window.api.receberHubserver({
      token: analise.token,
      modo,
      nome,
      aceitouEula: eula
    })
    setRecebendo(false)
    setProgresso(null)
    if (!r.ok) return setErroDialogo(r.erro)
    location.reload() // todas as telas leem o servidor de novo
  }

  const criaNovo = modo !== 'atualizar'
  return (
    <>
      <Botao onClick={escolher} disabled={bloqueado || abrindo} className="w-full">
        {abrindo ? t('passarServidor.abrindo') : t('passarServidor.receberServidorHubserver')}
      </Botao>
      {erro && (
        <div className="mt-3">
          <MensagemErro erro={erro} />
        </div>
      )}
      <Dialogo
        aberto={analise !== null}
        titulo={t('passarServidor.receberServidor')}
        aoCancelar={() => !recebendo && setAnalise(null)}
        acao={{
          rotulo: recebendo
            ? t('passarServidor.recebendo')
            : modo === 'atualizar'
              ? t('passarServidor.fazerBackupEAtualizar')
              : t('passarServidor.criarServidor'),
          variante: modo === 'atualizar' ? 'perigo' : undefined,
          ocupado: recebendo,
          desabilitado: criaNovo && (!eula || !nome.trim()),
          aoClicar: receber
        }}
      >
        {analise && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>
              {t('passarServidor.em')} <b>{analise.arquivo}</b>
              {t('passarServidor.oServidor')} <b>{analise.nome}</b>{' '}
              {t('passarServidor.comModsPluginsParaBaixar', {
                v: NOMES_TIPOS[analise.tipo],
                versao: analise.versao,
                mods: analise.mods
              })}
              {analise.manuais > 0 &&
                t('passarServidor.arquivosPrecisamSerBaixadosA', { manuais: analise.manuais })}
            </p>
            {analise.semLink.length > 0 && (
              <p className="text-muted">
                {t('passarServidor.semLinkOficialPonhaA')} {analise.semLink.join(', ')}
              </p>
            )}
            {analise.mesmo && (
              <div className="flex flex-col gap-1">
                <p>
                  {t('passarServidor.esseEOSeuServidor')} <b>{analise.mesmo.nome}</b>
                  {t('passarServidor.queVoltou')}
                </p>
                <OpcaoRadio
                  nome="modo-receber"
                  marcada={modo === 'atualizar'}
                  aoEscolher={() => !analise.mesmo?.motivoSemAtualizar && setModo('atualizar')}
                >
                  {t('passarServidor.atualizarOMeuServidorCom')}
                </OpcaoRadio>
                {analise.mesmo.motivoSemAtualizar && (
                  <p className="pl-6 text-xs text-muted">{analise.mesmo.motivoSemAtualizar}</p>
                )}
                <OpcaoRadio
                  nome="modo-receber"
                  marcada={modo === 'copia'}
                  aoEscolher={() => setModo('copia')}
                >
                  {t('passarServidor.criarUmaCopiaOutroServidor')}
                </OpcaoRadio>
              </div>
            )}
            {modo === 'atualizar' && (
              <p>
                {t('passarServidor.oMundoAsConfiguracoesE')} <b>{analise.mesmo?.nome}</b>{' '}
                {t('passarServidor.vaoSerTrocadosPelosDo')}
              </p>
            )}
            {criaNovo && (
              <>
                <label className="flex flex-col gap-1">
                  {t('passarServidor.nomeDoServidor')}
                  <Campo value={nome} maxLength={32} onChange={(e) => setNome(e.target.value)} />
                </label>
                <p className="text-xs text-muted">{t('passarServidor.voceViraODonoOs')}</p>
                <CaixaSelecao marcada={eula} aoMudar={setEula} disabled={recebendo}>
                  {t('passarServidor.liEAceitoO')}{' '}
                  <a
                    href="https://aka.ms/MinecraftEULA"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t('passarServidor.eulaDoMinecraft')}
                  </a>
                </CaixaSelecao>
              </>
            )}
            {recebendo && progresso && (
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
