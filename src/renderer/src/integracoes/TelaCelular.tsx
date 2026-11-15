import { useCallback, useEffect, useState } from 'react'
import { renderSVG } from 'uqr'
import type { ErroTela, EstadoCelular, Resultado } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { dataHora } from '../componentes/formato'
import { Esqueleto } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import {
  Aviso,
  Botao,
  Campo,
  Dialogo,
  LinhaControle,
  PaginaAjustes,
  Secao
} from '../componentes/ui'
import { t } from '../../../shared/i18n'

// QR em preto no branco: os leitores precisam desse contraste, nos dois temas.
function Qr({ texto }: { texto: string }): React.JSX.Element {
  const svg = renderSVG(texto, { border: 2, whiteColor: '#ffffff', blackColor: '#000000' })
  return (
    <div
      role="img"
      aria-label={t('telaCelular.qrCodeParaAbrir', { texto })}
      className="h-40 w-40 shrink-0 [&>svg]:h-full [&>svg]:w-full"
      // O SVG é gerado aqui mesmo, a partir do nosso endereço.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// Integrações › Celular (Fase 20): liga o painel no navegador do celular.
export function TelaCelular(): React.JSX.Element {
  const [e, setE] = useState<EstadoCelular | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [porta, setPorta] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const ler = useCallback(async (): Promise<void> => {
    const r = await window.api.estadoCelular()
    if (!r.ok) return setErro(r.erro)
    setE(r.valor)
    setPorta((p) => p || String(r.valor.porta))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura
    void ler()
    const id = setInterval(() => void ler(), 5000) // Wi-Fi, Radmin e Tailscale podem conectar depois
    return () => clearInterval(id)
  }, [ler])

  async function rodar(
    acao: () => Promise<Resultado<EstadoCelular>>,
    sucesso?: string
  ): Promise<boolean> {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(false)
    if (!r.ok) {
      setErro(r.erro)
      return false
    }
    setE(r.valor)
    if (sucesso) setAviso(sucesso)
    return true
  }

  if (!e)
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={5} />}
      </PaginaAjustes>
    )

  const pinOk = /^\d{6,8}$/.test(pin) && pin === pin2
  return (
    <PaginaAjustes>
      <Secao titulo={t('telaCelular.painelPeloCelular')}>
        <LinhaControle
          rotulo={t('telaCelular.abrirOPainelNoCelular')}
          ligado={e.ativo}
          disabled={ocupado || (!e.ativo && !e.temPin)}
          aoMudar={(v) => rodar(() => window.api.ativarCelular(v))}
        />
        <p className="text-[13px] text-muted">
          {t('telaCelular.peloNavegadorDoCelularVoce')}
          {!e.temPin && t('telaCelular.crieUmPinAbaixoPara')}
        </p>
        {e.erro && <Aviso tipo="atencao">{e.erro}</Aviso>}
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Secao titulo={t('telaCelular.pin')}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px]">
            {e.temPin ? t('telaCelular.novoPin') : t('telaCelular.pin6A8Numeros')}
            <Campo
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={pin}
              onChange={(ev) => setPin(ev.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            {t('telaCelular.repitaOPin')}
            <Campo
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={pin2}
              onChange={(ev) => setPin2(ev.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        {pin2.length >= 6 && pin !== pin2 && (
          <p className="text-xs text-warning">{t('telaCelular.osDoisPinsEstaoDiferentes')}</p>
        )}
        <Botao
          variante="primario"
          className="self-start"
          disabled={!pinOk || ocupado}
          onClick={async () => {
            if (
              await rodar(
                () => window.api.definirPinCelular(pin),
                e.temPin
                  ? t('telaCelular.pinTrocadoOsAparelhosPrecisam')
                  : t('telaCelular.pinCriadoAgoraLigueO')
              )
            ) {
              setPin('')
              setPin2('')
            }
          }}
        >
          {e.temPin ? t('telaCelular.trocarPin') : t('telaCelular.criarPin')}
        </Botao>
        <p className="text-xs text-muted">
          {t('telaCelular.oAppGuardaSoUma')}
          {e.temPin && t('telaCelular.trocarOPinDesconectaTodos')}
        </p>
      </Secao>

      <Secao titulo={t('telaCelular.porta')}>
        <div className="flex items-center gap-2">
          <Campo
            type="number"
            min={1024}
            max={65535}
            value={porta}
            onChange={(ev) => setPorta(ev.target.value)}
            className="w-32"
            aria-label={t('telaCelular.portaDoPainel')}
          />
          <Botao
            disabled={ocupado || Number(porta) === e.porta}
            onClick={() =>
              rodar(
                () => window.api.definirPortaCelular(Math.round(Number(porta))),
                t('telaCelular.portaSalva')
              )
            }
          >
            {t('telaCelular.salvarPorta')}
          </Botao>
        </div>
        <p className="text-xs text-muted">{t('telaCelular.padrao8787SoMudeSe')}</p>
      </Secao>

      <Secao titulo={t('telaCelular.enderecos')}>
        {!e.ativo && (
          <p className="text-[13px] text-muted">{t('telaCelular.ligueOPainelParaAbrir')}</p>
        )}
        <div className="flex flex-col gap-3">
          {e.enderecos.map((a) => (
            <CardPainel key={a.rotulo} titulo={a.rotulo}>
              {!a.url ? (
                <p className="text-[13px] text-muted">
                  {a.rotulo.startsWith('Tailscale')
                    ? t('telaCelular.tailscaleNaoEncontradoVejaO')
                    : a.rotulo.startsWith('Radmin')
                      ? t('telaCelular.radminVpnFechadoOuDesconectado')
                      : t('telaCelular.redeLocalNaoEncontrada')}
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  {e.ativo && a.escutando && <Qr texto={a.url} />}
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="font-mono text-[13px] break-all">{a.url}</span>
                    <span className="text-xs text-muted">
                      {!e.ativo
                        ? t('telaCelular.oPainelEstaDesligado')
                        : a.escutando
                          ? t('telaCelular.aponteACameraDoCelular')
                          : t('telaCelular.naoConseguiAbrirOPainel')}
                    </span>
                  </div>
                </div>
              )}
            </CardPainel>
          ))}
        </div>
        <p className="text-xs text-muted">{t('telaCelular.naPrimeiraVezOWindows')}</p>
      </Secao>

      <Secao titulo={t('telaCelular.aparelhosConectados')}>
        {e.aparelhos.length ? (
          <ul className="flex flex-col divide-y divide-linha border border-linha bg-panel">
            {e.aparelhos.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]"
              >
                <b>{a.aparelho}</b>
                <span className="text-xs text-muted">
                  {t('telaCelular.entrouUltimoUso', {
                    dataHora: dataHora(new Date(a.criada).toISOString()),
                    dataHora2: dataHora(new Date(a.usada).toISOString())
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">{t('telaCelular.nenhumAparelhoConectado')}</p>
        )}
        <Botao
          variante="perigo"
          className="self-start"
          disabled={!e.aparelhos.length || ocupado}
          onClick={() => setDesconectando(true)}
        >
          {t('telaCelular.desconectarTodosOsAparelhos')}
        </Botao>
        <p className="text-xs text-muted">{t('telaCelular.cadaLoginValePor7')}</p>
      </Secao>

      <Secao titulo={t('telaCelular.foraDeCasaTailscale')}>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px]">
          <li>
            {t('telaCelular.noPcBaixeOTailscale')}{' '}
            <a
              href="https://tailscale.com/download"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {t('telaCelular.tailscaleComDownload')}
            </a>
            {t('telaCelular.instaleEEntreComUma')}
          </li>
          <li>{t('telaCelular.noCelularInstaleOApp')}</li>
          <li>{t('telaCelular.deixeOTailscaleLigadoNos')}</li>
          <li>{t('telaCelular.noCelularAbraEsseEndereco')}</li>
        </ol>
      </Secao>

      <Dialogo
        aberto={desconectando}
        titulo={t('telaCelular.desconectarTodosOsAparelhos2')}
        aoCancelar={() => setDesconectando(false)}
        acao={{
          rotulo: t('telaCelular.desconectar'),
          variante: 'perigo',
          aoClicar: async () => {
            setDesconectando(false)
            await rodar(
              window.api.desconectarCelulares,
              t('telaCelular.todosOsAparelhosForamDesconectados')
            )
          }
        }}
      >
        <p>{t('telaCelular.cadaAparelhoVaiPrecisarDigitar')}</p>
      </Dialogo>
    </PaginaAjustes>
  )
}
