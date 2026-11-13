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

// QR em preto no branco: os leitores precisam desse contraste, nos dois temas.
function Qr({ texto }: { texto: string }): React.JSX.Element {
  const svg = renderSVG(texto, { border: 2, whiteColor: '#ffffff', blackColor: '#000000' })
  return (
    <div
      role="img"
      aria-label={`QR code para abrir ${texto}`}
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
      <Secao titulo="Painel pelo celular">
        <LinhaControle
          rotulo="Abrir o painel no celular"
          ligado={e.ativo}
          disabled={ocupado || (!e.ativo && !e.temPin)}
          aoMudar={(v) => rodar(() => window.api.ativarCelular(v))}
        />
        <p className="text-[13px] text-muted">
          Pelo navegador do celular você vê o status, os jogadores, CPU e RAM, e liga, desliga ou
          reinicia o servidor. O painel só abre na rede local, no Radmin e no Tailscale, nunca na
          internet.
          {!e.temPin && ' Crie um PIN abaixo para ligar.'}
        </p>
        {e.erro && <Aviso tipo="atencao">{e.erro}</Aviso>}
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Secao titulo="PIN">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px]">
            {e.temPin ? 'Novo PIN' : 'PIN (6 a 8 números)'}
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
            Repita o PIN
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
          <p className="text-xs text-warning">Os dois PINs estão diferentes.</p>
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
                  ? 'PIN trocado. Os aparelhos precisam entrar de novo.'
                  : 'PIN criado. Agora ligue o painel.'
              )
            ) {
              setPin('')
              setPin2('')
            }
          }}
        >
          {e.temPin ? 'Trocar PIN' : 'Criar PIN'}
        </Botao>
        <p className="text-xs text-muted">
          O app guarda só uma versão embaralhada do PIN. Depois de 5 PINs errados, o painel bloqueia
          por 15 minutos.{e.temPin && ' Trocar o PIN desconecta todos os aparelhos.'}
        </p>
      </Secao>

      <Secao titulo="Porta">
        <div className="flex items-center gap-2">
          <Campo
            type="number"
            min={1024}
            max={65535}
            value={porta}
            onChange={(ev) => setPorta(ev.target.value)}
            className="w-32"
            aria-label="Porta do painel"
          />
          <Botao
            disabled={ocupado || Number(porta) === e.porta}
            onClick={() =>
              rodar(() => window.api.definirPortaCelular(Math.round(Number(porta))), 'Porta salva.')
            }
          >
            Salvar porta
          </Botao>
        </div>
        <p className="text-xs text-muted">
          Padrão: 8787. Só mude se outro programa já usar essa porta.
        </p>
      </Secao>

      <Secao titulo="Endereços">
        {!e.ativo && (
          <p className="text-[13px] text-muted">Ligue o painel para abrir os endereços.</p>
        )}
        <div className="flex flex-col gap-3">
          {e.enderecos.map((a) => (
            <CardPainel key={a.rotulo} titulo={a.rotulo}>
              {!a.url ? (
                <p className="text-[13px] text-muted">
                  {a.rotulo.startsWith('Tailscale')
                    ? 'Tailscale não encontrado. Veja o passo a passo abaixo.'
                    : a.rotulo.startsWith('Radmin')
                      ? 'Radmin VPN fechado ou desconectado.'
                      : 'Rede local não encontrada.'}
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  {e.ativo && a.escutando && <Qr texto={a.url} />}
                  <div className="flex min-w-0 flex-col gap-2">
                    <span className="font-mono text-[13px] break-all">{a.url}</span>
                    <span className="text-xs text-muted">
                      {!e.ativo
                        ? 'O painel está desligado.'
                        : a.escutando
                          ? 'Aponte a câmera do celular para o QR code.'
                          : 'Não consegui abrir o painel neste endereço.'}
                    </span>
                  </div>
                </div>
              )}
            </CardPainel>
          ))}
        </div>
        <p className="text-xs text-muted">
          Na primeira vez, o Windows pode perguntar se o HubSquare pode usar a rede: permita em
          redes privadas.
        </p>
      </Secao>

      <Secao titulo="Aparelhos conectados">
        {e.aparelhos.length ? (
          <ul className="flex flex-col divide-y divide-linha border border-linha bg-panel">
            {e.aparelhos.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]"
              >
                <b>{a.aparelho}</b>
                <span className="text-xs text-muted">
                  entrou {dataHora(new Date(a.criada).toISOString())} · último uso{' '}
                  {dataHora(new Date(a.usada).toISOString())}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">Nenhum aparelho conectado.</p>
        )}
        <Botao
          variante="perigo"
          className="self-start"
          disabled={!e.aparelhos.length || ocupado}
          onClick={() => setDesconectando(true)}
        >
          Desconectar todos os aparelhos
        </Botao>
        <p className="text-xs text-muted">Cada login vale por 7 dias.</p>
      </Secao>

      <Secao titulo="Fora de casa (Tailscale)">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px]">
          <li>
            No PC, baixe o Tailscale em{' '}
            <a
              href="https://tailscale.com/download"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              tailscale.com/download
            </a>
            , instale e entre com uma conta (Google, Microsoft ou outra).
          </li>
          <li>
            No celular, instale o app Tailscale (Play Store ou App Store) e entre com a mesma conta.
          </li>
          <li>
            Deixe o Tailscale ligado nos dois. O endereço &quot;Tailscale&quot; aparece aqui em
            alguns segundos.
          </li>
          <li>
            No celular, abra esse endereço. Funciona até pelos dados móveis, sem abrir nada na
            internet.
          </li>
        </ol>
      </Secao>

      <Dialogo
        aberto={desconectando}
        titulo="Desconectar todos os aparelhos?"
        aoCancelar={() => setDesconectando(false)}
        acao={{
          rotulo: 'Desconectar',
          variante: 'perigo',
          aoClicar: async () => {
            setDesconectando(false)
            await rodar(window.api.desconectarCelulares, 'Todos os aparelhos foram desconectados.')
          }
        }}
      >
        <p>Cada aparelho vai precisar digitar o PIN de novo.</p>
      </Dialogo>
    </PaginaAjustes>
  )
}
