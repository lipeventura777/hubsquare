import { IconeOk } from '../icones'
import { useCallback, useEffect, useState } from 'react'
import type {
  ErroTela,
  EstadoConexao,
  ModoConexao,
  Progresso,
  ResultadoUpnp
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { Aviso, Botao, Campo, PaginaAjustes, Secao } from '../componentes/ui'
import { Endereco, Firewall, Testar } from './partes'
import { BotaoDiagnostico, consertoDoDono } from '../componentes/Diagnostico'
import { t } from '../../../shared/i18n'

// Cada aba mostra um jeito de os amigos entrarem; só um fica "em uso" (o que liga com o servidor).
const POR_ABA: Record<string, { modo: ModoConexao; descricao: string }> = {
  'playit.gg': {
    modo: 'playit',
    descricao: t('telaConexao.recomendadoFuncionaPelaInternetSem')
  },
  'Radmin VPN': {
    modo: 'radmin',
    descricao: t('telaConexao.voceESeusAmigosEntram')
  },
  'Rede local': { modo: 'lan', descricao: t('telaConexao.paraQuemEstaNoMesmo') },
  Avançado: {
    modo: 'porta',
    descricao: t('telaConexao.abrirAPortaNoRoteador')
  }
}

export function TelaConexao({ aba }: { aba: string }): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoConexao | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  const recarregar = useCallback((): void => {
    window.api.lerConexao().then((r) => (r.ok ? setEstado(r.valor) : setErro(r.erro)))
  }, [])

  // Recarrega a cada 5 s: o Radmin pode ser aberto ou fechado com a tela aberta.
  useEffect(() => {
    recarregar()
    const timer = setInterval(recarregar, 5000)
    const parar = window.api.aoMudarEstado(() => recarregar())
    return () => {
      clearInterval(timer)
      parar()
    }
  }, [recarregar])

  async function usar(modo: ModoConexao): Promise<void> {
    setEstado((e) => e && { ...e, modo })
    const r = await window.api.escolherModoConexao(modo)
    if (!r.ok) setErro(r.erro)
    recarregar()
  }

  if (!estado) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }
  const { modo, descricao } = POR_ABA[aba] ?? POR_ABA['playit.gg']
  const emUso = estado.modo === modo

  return (
    <PaginaAjustes>
      <div className="flex items-center gap-4 border border-linha bg-panel p-4">
        <p className="flex-1 text-[13px]">{descricao}</p>
        {emUso ? (
          <span className="text-[13px] font-bold">
            <IconeOk className="mr-1 inline h-[1em] w-[1em] align-[-0.125em]" />
            {t('telaConexao.emUsoSeusAmigosEntram')}
          </span>
        ) : (
          <Botao variante="primario" onClick={() => usar(modo)}>
            {t('telaConexao.usarEsteMetodo')}
          </Botao>
        )}
        <BotaoDiagnostico
          rotulo={t('telaConexao.testarTudo')}
          titulo={t('telaConexao.testarAConexaoDoServidor')}
          rodar={window.api.diagnosticarDono}
          aoConsertar={consertoDoDono}
        />
      </div>

      {erro && <MensagemErro erro={erro} />}

      <div className="flex flex-col gap-10">
        {modo === 'playit' && <PainelPlayit estado={estado} recarregar={recarregar} />}
        {modo === 'radmin' && <PainelRadmin estado={estado} recarregar={recarregar} />}
        {modo === 'lan' && <PainelLan estado={estado} recarregar={recarregar} />}
        {modo === 'porta' && <PainelPorta estado={estado} recarregar={recarregar} />}
      </div>
    </PaginaAjustes>
  )
}

interface PropsPainel {
  estado: EstadoConexao
  recarregar: () => void
}

function PainelPlayit({ estado, recarregar }: PropsPainel): React.JSX.Element {
  const { playit } = estado
  const [endereco, setEndereco] = useState(playit.endereco ?? '')
  const [vinculando, setVinculando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  async function vincular(): Promise<void> {
    setErro(null)
    setVinculando(true)
    const r = await window.api.vincularPlayit()
    setVinculando(false)
    setProgresso(null)
    if (!r.ok) setErro(r.erro)
    recarregar()
  }

  async function salvar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault()
    setErro(null)
    const r = await window.api.salvarEnderecoPlayit(endereco)
    if (!r.ok) setErro(r.erro)
    recarregar()
  }

  const esperando = vinculando || playit.vinculando

  return (
    <>
      <Secao titulo={t('telaConexao.n1VincularSuaContaSo')}>
        {playit.vinculado ? (
          <Aviso tipo="sucesso">{t('telaConexao.contaDoPlayitGgVinculada')}</Aviso>
        ) : (
          <>
            <p className="text-[13px] text-muted">{t('telaConexao.oAppBaixaOPrograma')}</p>
            <Botao
              variante="primario"
              onClick={vincular}
              disabled={esperando}
              className="self-start"
            >
              {esperando
                ? t('telaConexao.esperandoVoceAprovarNoNavegador')
                : t('telaConexao.vincularPlayitGg')}
            </Botao>
            {progresso && esperando && progresso.total > 0 && (
              <BarraProgresso
                rotulo={progresso.etapa}
                valor={progresso.recebido}
                maximo={progresso.total}
              />
            )}
          </>
        )}
      </Secao>

      <Secao titulo={t('telaConexao.n2CriarOTunelNo')}>
        <p className="text-[13px] text-muted">
          {t('telaConexao.no')}{' '}
          <a
            href="https://playit.gg/account"
            target="_blank"
            rel="noreferrer"
            className="text-texto underline"
          >
            {t('telaConexao.siteDoPlayitGg')}
          </a>
          {t('telaConexao.crieUmTunelDoTipo')}{' '}
          <b className="text-texto">{t('telaConexao.minecraftJava')}</b>{' '}
          {t('telaConexao.paraOEnderecoLocal')} <b className="text-texto">127.0.0.1</b>{' '}
          {t('telaConexao.eAPorta')} <b className="text-texto">{estado.porta}</b>
          {t('telaConexao.depoisCopieOEnderecoQue')}
        </p>
        <form onSubmit={salvar} className="flex gap-2">
          <Campo
            value={endereco}
            placeholder={t('telaConexao.exNomeJoinmcLink')}
            aria-label={t('telaConexao.enderecoDoTunelDoPlayit')}
            onChange={(e) => setEndereco(e.target.value)}
          />
          <Botao type="submit" variante="primario" disabled={!endereco.trim()}>
            {t('telaConexao.salvar')}
          </Botao>
        </form>
      </Secao>

      <Secao titulo={t('telaConexao.n3PassarOEnderecoPara')}>
        <p className="text-[13px] text-muted">
          {t('telaConexao.oPlayitGgLigaJunto')}{' '}
          {playit.agenteLigado
            ? t('telaConexao.agoraEleEstaLigado')
            : t('telaConexao.agoraEleEstaDesligado')}
        </p>
        {playit.endereco && <Endereco endereco={playit.endereco} />}
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Testar modo="playit" />
    </>
  )
}

function PainelRadmin({ estado, recarregar }: PropsPainel): React.JSX.Element {
  return (
    <>
      <Secao titulo={t('telaConexao.endereco')}>
        {estado.radminIp ? (
          <Endereco endereco={`${estado.radminIp}:${estado.porta}`} />
        ) : (
          <Aviso tipo="atencao">
            <span>
              <b>{t('telaConexao.radminVpnFechadoOuDesconectado')}</b>{' '}
              {t('telaConexao.abraORadminVpnLigue')}
            </span>
          </Aviso>
        )}
      </Secao>
      <Firewall liberado={estado.firewallLiberado} aoLiberar={recarregar} />
      <Testar modo="radmin" />
    </>
  )
}

function PainelLan({ estado, recarregar }: PropsPainel): React.JSX.Element {
  return (
    <>
      <Secao titulo={t('telaConexao.endereco')}>
        {estado.lanIp ? (
          <Endereco endereco={`${estado.lanIp}:${estado.porta}`} />
        ) : (
          <Aviso tipo="atencao">{t('telaConexao.naoAcheiARedeLocal')}</Aviso>
        )}
      </Secao>
      <Firewall liberado={estado.firewallLiberado} aoLiberar={recarregar} />
      <Testar modo="lan" />
    </>
  )
}

function PainelPorta({ estado, recarregar }: PropsPainel): React.JSX.Element {
  const [ipPublico, setIpPublico] = useState<string | null>(null)
  const [tentando, setTentando] = useState(false)
  const [upnp, setUpnp] = useState<ResultadoUpnp | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.lerIpPublico().then((r) => r.ok && setIpPublico(r.valor))
  }, [])

  async function tentar(): Promise<void> {
    setErro(null)
    setUpnp(null)
    setTentando(true)
    const r = await window.api.tentarUpnp()
    setTentando(false)
    if (!r.ok) return setErro(r.erro)
    setUpnp(r.valor)
    if (r.valor.ipPublico) setIpPublico(r.valor.ipPublico)
  }

  return (
    <>
      <Secao titulo={t('telaConexao.endereco')}>
        {ipPublico ? (
          <Endereco endereco={`${ipPublico}:${estado.porta}`} />
        ) : (
          <p className="text-[13px] text-muted">{t('telaConexao.descobrindoOSeuIpPublico')}</p>
        )}
      </Secao>

      <Secao titulo={t('telaConexao.abrirAPortaAutomaticamente')}>
        <Botao onClick={tentar} disabled={tentando} className="self-start">
          {tentando ? t('telaConexao.tentando') : t('telaConexao.tentarPeloUpnp')}
        </Botao>
        {upnp && <Aviso tipo={upnp.ok ? 'sucesso' : 'atencao'}>{upnp.mensagem}</Aviso>}
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Secao titulo={t('telaConexao.abrirAPortaAMao')}>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px]">
          <li>{t('telaConexao.abraAPaginaDoRoteador')}</li>
          <li>{t('telaConexao.procureRedirecionamentoDePortaPort')}</li>
          <li>
            {t('telaConexao.crieUmaRegraPortaExterna')} <b>{estado.porta}</b>
            {t('telaConexao.portaInterna')} <b>{estado.porta}</b>
            {t('telaConexao.protocolo')} <b>{t('telaConexao.tcp')}</b>
            {t('telaConexao.ipDestePc')} <b>{estado.lanIp ?? t('telaConexao.naoEncontrado')}</b>.
          </li>
          <li>{t('telaConexao.salveLibereOJavaNo')}</li>
        </ol>
        <p className="text-[13px] text-muted">{t('telaConexao.seMesmoAssimNaoFuncionar')}</p>
      </Secao>

      <Firewall liberado={estado.firewallLiberado} aoLiberar={recarregar} />
      <Testar modo="porta" />
    </>
  )
}
