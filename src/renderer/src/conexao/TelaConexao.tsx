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

// Cada aba mostra um jeito de os amigos entrarem; só um fica "em uso" (o que liga com o servidor).
const POR_ABA: Record<string, { modo: ModoConexao; descricao: string }> = {
  'playit.gg': {
    modo: 'playit',
    descricao:
      'Recomendado. Funciona pela internet sem mexer no roteador; seus amigos não instalam nada.'
  },
  'Radmin VPN': {
    modo: 'radmin',
    descricao: 'Você e seus amigos entram na mesma rede do Radmin VPN.'
  },
  'Rede local': { modo: 'lan', descricao: 'Para quem está no mesmo Wi-Fi ou rede da casa.' },
  Avançado: {
    modo: 'porta',
    descricao: 'Abrir a porta no roteador: seus amigos entram pelo seu IP público.'
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
          <span className="text-[13px] font-bold">✓ Em uso: seus amigos entram por aqui</span>
        ) : (
          <Botao variante="primario" onClick={() => usar(modo)}>
            Usar este método
          </Botao>
        )}
        <BotaoDiagnostico
          rotulo="Testar tudo"
          titulo="Testar a conexão do servidor"
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
      <Secao titulo="1. Vincular sua conta (só uma vez)">
        {playit.vinculado ? (
          <Aviso tipo="sucesso">Conta do playit.gg vinculada.</Aviso>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              O app baixa o programa oficial do playit.gg e abre o site no navegador. Lá, crie uma
              conta grátis (ou entre) e aprove o ServSquare.
            </p>
            <Botao
              variante="primario"
              onClick={vincular}
              disabled={esperando}
              className="self-start"
            >
              {esperando ? 'Esperando você aprovar no navegador...' : 'Vincular playit.gg'}
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

      <Secao titulo="2. Criar o túnel no site (só uma vez)">
        <p className="text-[13px] text-muted">
          No{' '}
          <a
            href="https://playit.gg/account"
            target="_blank"
            rel="noreferrer"
            className="text-texto underline"
          >
            site do playit.gg
          </a>
          , crie um túnel do tipo <b className="text-texto">Minecraft Java</b> para o endereço local{' '}
          <b className="text-texto">127.0.0.1</b> e a porta{' '}
          <b className="text-texto">{estado.porta}</b>. Depois copie o endereço que o site mostrar e
          cole aqui.
        </p>
        <form onSubmit={salvar} className="flex gap-2">
          <Campo
            value={endereco}
            placeholder="ex.: nome.joinmc.link"
            aria-label="Endereço do túnel do playit.gg"
            onChange={(e) => setEndereco(e.target.value)}
          />
          <Botao type="submit" variante="primario" disabled={!endereco.trim()}>
            Salvar
          </Botao>
        </form>
      </Secao>

      <Secao titulo="3. Passar o endereço para seus amigos">
        <p className="text-[13px] text-muted">
          O playit.gg liga junto com o servidor.{' '}
          {playit.agenteLigado ? 'Agora ele está ligado.' : 'Agora ele está desligado.'}
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
      <Secao titulo="Endereço">
        {estado.radminIp ? (
          <Endereco endereco={`${estado.radminIp}:${estado.porta}`} />
        ) : (
          <Aviso tipo="atencao">
            <span>
              <b>Radmin VPN fechado ou desconectado.</b> Abra o Radmin VPN, ligue o botão de energia
              e entre na mesma rede que seus amigos. O endereço aparece aqui sozinho.
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
      <Secao titulo="Endereço">
        {estado.lanIp ? (
          <Endereco endereco={`${estado.lanIp}:${estado.porta}`} />
        ) : (
          <Aviso tipo="atencao">
            Não achei a rede local deste PC. Confira se o Wi-Fi ou o cabo está conectado.
          </Aviso>
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
      <Secao titulo="Endereço">
        {ipPublico ? (
          <Endereco endereco={`${ipPublico}:${estado.porta}`} />
        ) : (
          <p className="text-[13px] text-muted">Descobrindo o seu IP público...</p>
        )}
      </Secao>

      <Secao titulo="Abrir a porta automaticamente">
        <Botao onClick={tentar} disabled={tentando} className="self-start">
          {tentando ? 'Tentando...' : 'Tentar pelo UPnP'}
        </Botao>
        {upnp && <Aviso tipo={upnp.ok ? 'sucesso' : 'atencao'}>{upnp.mensagem}</Aviso>}
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Secao titulo="Abrir a porta à mão">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px]">
          <li>
            Abra a página do roteador no navegador (geralmente 192.168.0.1 ou 192.168.1.1) e entre
            com o usuário e a senha que ficam na etiqueta do roteador.
          </li>
          <li>
            Procure &quot;Redirecionamento de porta&quot;, &quot;Port forwarding&quot;,
            &quot;NAT&quot; ou &quot;Servidor virtual&quot;.
          </li>
          <li>
            Crie uma regra: porta externa <b>{estado.porta}</b>, porta interna <b>{estado.porta}</b>
            , protocolo <b>TCP</b>, IP deste PC <b>{estado.lanIp ?? '(não encontrado)'}</b>.
          </li>
          <li>Salve, libere o Java no Firewall (abaixo) e clique em &quot;Testar conexão&quot;.</li>
        </ol>
        <p className="text-[13px] text-muted">
          Se mesmo assim não funcionar, sua operadora pode usar CGNAT: ela divide um IP público
          entre várias casas, e aí abrir a porta não adianta. Nesse caso, use o playit.gg.
        </p>
      </Secao>

      <Firewall liberado={estado.firewallLiberado} aoLiberar={recarregar} />
      <Testar modo="porta" />
    </>
  )
}
