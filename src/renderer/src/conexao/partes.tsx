import { useState } from 'react'
import type { ErroTela, ModoConexao, ResultadoTeste } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeCopiar } from '../icones'
import { Aviso, Botao, Secao } from '../componentes/ui'
import { t } from '../../../shared/i18n'

// Endereço em monoespaçada com o botão de destaque "Copiar endereço".
export function Endereco({ endereco }: { endereco: string }): React.JSX.Element {
  const [copiado, setCopiado] = useState(false)

  async function copiar(): Promise<void> {
    await window.api.copiar(endereco)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 border border-linha bg-panel-2 p-3">
      <code className="flex-1 font-mono text-base font-bold break-all">{endereco}</code>
      <Botao variante="destaque" onClick={copiar}>
        <IconeCopiar className="h-4 w-4" />
        {copiado ? t('partes.copiado') : t('partes.copiarEndereco')}
      </Botao>
    </div>
  )
}

export function Testar({ modo }: { modo: ModoConexao }): React.JSX.Element {
  const [testando, setTestando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  async function testar(): Promise<void> {
    setTestando(true)
    setResultado(null)
    setErro(null)
    const r = await window.api.testarConexao(modo)
    setTestando(false)
    if (r.ok) setResultado(r.valor)
    else setErro(r.erro)
  }

  return (
    <Secao titulo={t('partes.teste')}>
      <Botao onClick={testar} disabled={testando} className="self-start">
        {testando ? t('partes.testando') : t('partes.testarConexao')}
      </Botao>
      {resultado && <Aviso tipo={resultado.ok ? 'sucesso' : 'atencao'}>{resultado.mensagem}</Aviso>}
      {erro && <MensagemErro erro={erro} />}
    </Secao>
  )
}

export function Firewall({
  liberado,
  aoLiberar
}: {
  liberado: boolean | null
  aoLiberar: () => void
}): React.JSX.Element {
  const [liberando, setLiberando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  async function liberar(): Promise<void> {
    setErro(null)
    setLiberando(true)
    const r = await window.api.liberarFirewall()
    setLiberando(false)
    if (r.ok) aoLiberar()
    else setErro(r.erro)
  }

  return (
    <Secao titulo={t('partes.firewallDoWindows')}>
      {liberado ? (
        <Aviso tipo="sucesso">{t('partes.oJavaJaEstaLiberado')}</Aviso>
      ) : (
        <>
          <p className="text-[13px] text-muted">{t('partes.oFirewallDoWindowsPode')}</p>
          <Botao
            variante="atencao"
            onClick={liberar}
            disabled={liberando || liberado === null}
            className="self-start"
          >
            {liberando ? t('partes.esperandoPermissao') : t('partes.liberarOJavaNoFirewall')}
          </Botao>
          {liberado === null && (
            <p className="text-xs text-muted">{t('partes.crieUmServidorPrimeiro')}</p>
          )}
        </>
      )}
      {erro && <MensagemErro erro={erro} />}
    </Secao>
  )
}
