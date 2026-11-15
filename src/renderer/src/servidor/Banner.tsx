import { useEffect, useRef, useState } from 'react'
import { MotdFormatado } from '../componentes/MotdFormatado'
import type { EstadoServidor, ErroTela, FundoDoServidor, InfoServidor } from '../../../shared/tipos'
import { fundoDoServidor, type FundoServidor } from '../../../shared/fundoRegras'
import { escolhaDeImagem, PainelFundo, useImagensFundo } from '../fundo/EscolherFundo'
import { classesBotao } from '../componentes/estilos'
import { MensagemErro } from '../componentes/MensagemErro'
import { EVENTO_FUNDO_SERVIDOR } from '../estrutura/navegar'
import { useAparencia } from '../aparencia/useAparencia'
import { Avisos } from '../componentes/Avisos'
import { IconeCopiar } from '../componentes/icones'
import { Botao, Menu } from '../componentes/ui'
import { BotaoDiagnostico, consertoDoDono } from '../componentes/Diagnostico'
import { BlocoVitrine, BotaoVitrine } from '../componentes/Vitrine'
import { IconeDoServidor } from '../componentes/IconeDoServidor'
import { useIconeAtivo } from '../componentes/useIconeAtivo'
import { BotaoLigar } from './BarraDeAcao'
import { t } from '../../../shared/i18n'

// Banner da aba Painel (seção 6.3): imagem do usuário (ou o padrão geométrico), nome do servidor
// em pixel, MOTD, o card "Chame seus amigos" e os avisos de entrada e saída.
export function Banner({
  info,
  endereco,
  aviso,
  vitrine,
  estado,
  erroDoServidor,
  aoLigarDesligar
}: {
  info: InfoServidor
  endereco: string | null
  aviso: string
  // Fase V11: modo vitrine (o banner ocupa a tela e fica só o bloco com o LIGAR).
  vitrine: boolean
  estado: EstadoServidor
  erroDoServidor: ErroTela | null
  aoLigarDesligar: () => void
}): React.JSX.Element {
  const { definirVitrine } = useAparencia()
  const icone = useIconeAtivo(info.id)
  const { fundoUrl, definirFundoTela } = useAparencia()
  const [motd, setMotd] = useState('')
  // Fase V10: fundo próprio do servidor, no mesmo painel "Fundo" da tela Jogar.
  const [fundo, setFundo] = useState<FundoDoServidor | null>(null)
  const [soltando, setSoltando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const imgs = useImagensFundo()
  const salvar = useRef<NodeJS.Timeout | undefined>(undefined)
  const [maximo, setMaximo] = useState<number | null>(null)

  useEffect(() => {
    window.api.lerConfiguracoes().then((r) => {
      if (!r.ok) return
      setMotd(r.valor.configuracoes.motd)
      setMaximo(r.valor.configuracoes.maxJogadores)
    })
    window.api.fundoDoServidor().then((r) => r.ok && setFundo(r.valor))
    return () => clearTimeout(salvar.current)
  }, [])

  // Mostra na hora (o fundo da janela acompanha) e guarda: botão na hora, ajustes ao parar de mexer.
  function definir(escolha: FundoServidor | null, imediato = true): void {
    if (!fundo) return
    const instalacao = fundo.temInstalacao ? fundo.instalacao : undefined
    setFundo({ ...fundo, escolha, efetivo: fundoDoServidor(escolha, instalacao) })
    definirFundoTela(fundoDoServidor(escolha, instalacao))
    clearTimeout(salvar.current)
    salvar.current = setTimeout(
      async () => {
        const r = await window.api.definirFundoServidor(escolha)
        setErro(r.ok ? null : r.erro)
        window.dispatchEvent(new Event(EVENTO_FUNDO_SERVIDOR))
      },
      imediato ? 0 : 300
    )
  }

  // Soltar uma imagem em cima do topo do Painel escolhe a imagem.
  async function soltar(e: React.DragEvent): Promise<void> {
    e.preventDefault()
    setSoltando(false)
    const arquivo = e.dataTransfer.files[0]
    if (!arquivo) return
    const nome = await imgs.arrastada(arquivo)
    const atual = fundo?.escolha?.tipo === 'instalacao' ? null : (fundo?.escolha ?? null)
    if (nome) definir(escolhaDeImagem(nome, atual))
  }

  // O mesmo botão "Fundo" no canto do banner e no bloco da vitrine.
  const menuFundo = fundo && (
    <Menu
      rotulo={t('banner.trocarOFundo')}
      classeBotao={classesBotao('secundario', 'pequeno')}
      painel={
        <PainelFundo
          titulo={t('banner.fundoDe', { nome: info.nome })}
          rotulo={t('banner.fundoDoServidor')}
          atual={fundo.escolha}
          instalacao={fundo.temInstalacao ? fundo.instalacao : undefined}
          definir={definir}
          imgs={imgs}
        />
      }
    >
      {t('banner.fundo')}
    </Menu>
  )

  return (
    <section
      aria-label={t('banner.servidor')}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setSoltando(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setSoltando(false)
      }}
      onDrop={(e) => void soltar(e)}
      className={`vitrine-altura relative flex min-h-[300px] shrink-0 items-center overflow-hidden text-on-dark ${
        vitrine ? 'h-full' : 'h-[50vh]'
      }`}
    >
      {fundoUrl ? (
        <img src={fundoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-hidden="true" className="banner-padrao absolute inset-0" />
      )}
      <div aria-hidden="true" className="banner-gradiente absolute inset-0" />

      {/* Na vitrine, o nome, o card dos amigos e os botões do canto saem (fora do Tab e do leitor). */}
      <div
        className="vitrine-sai relative flex min-w-0 flex-1 flex-col items-center px-6 text-center"
        data-escondido={vitrine || undefined}
        inert={vitrine}
      >
        {/* Placa de vidro: o nome fica legível sobre o bioma ou qualquer imagem (Fase V1). */}
        <div className="placa-vidro flex max-w-full flex-col items-center px-8 py-4 text-texto">
          <h2 className="texto-pixel max-w-full text-5xl break-words [text-shadow:3px_3px_0_var(--sombra-texto)]">
            {info.nome}
          </h2>
          {motd && <MotdFormatado motd={motd} className="mt-2 max-w-full text-base" />}
        </div>
      </div>

      <div className="vitrine-sai" data-escondido={vitrine || undefined} inert={vitrine}>
        <CardAmigos endereco={endereco} aviso={aviso} />
      </div>

      <Avisos className="absolute right-[380px] bottom-4" />

      {soltando && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 grid place-items-center rounded-(--raio-item) border-2 border-dashed border-accent bg-(--text-on-light)/60 text-[15px] font-bold text-on-dark"
        >
          {t('banner.solteAImagemParaUsar')}
        </div>
      )}
      {fundo && !vitrine && (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <BotaoVitrine ligada={false} aoAlternar={() => definirVitrine(true)} />
          {menuFundo}
        </div>
      )}
      {vitrine && (
        <BlocoVitrine
          icone={<IconeDoServidor icone={icone} nome={info.nome} tam={56} />}
          nome={info.nome}
          principal={<BotaoLigar estado={estado} aoLigarDesligar={aoLigarDesligar} />}
          estado={
            <div className="flex min-w-0 flex-col gap-2">
              <EstadoNaVitrine estado={estado} maximo={maximo} />
              {erroDoServidor && <MensagemErro erro={erroDoServidor} />}
            </div>
          }
          fundo={menuFundo}
          aoMostrar={() => definirVitrine(false)}
        />
      )}
      {erro && (
        <div className="absolute top-14 right-3 max-w-sm">
          <MensagemErro erro={erro} />
        </div>
      )}
    </section>
  )
}

function CardAmigos({
  endereco,
  aviso
}: {
  endereco: string | null
  aviso: string
}): React.JSX.Element {
  const [copiado, setCopiado] = useState(false)

  async function copiar(): Promise<void> {
    if (!endereco) return
    await window.api.copiar(endereco)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="relative mr-6 flex w-[340px] shrink-0 flex-col gap-2 rounded-(--raio-item) border border-linha bg-panel/92 p-5 text-texto">
      <h3 className="texto-pixel text-[22px]">{t('banner.chameSeusAmigos')}</h3>
      <p className="text-[13px] text-muted">
        {endereco ? t('banner.passeEsteEnderecoParaEles') : aviso}
      </p>
      {endereco && <code className="font-mono text-[15px] font-bold break-all">{endereco}</code>}
      <Botao variante="destaque" className="mt-1 self-start" onClick={copiar} disabled={!endereco}>
        <IconeCopiar className="h-4 w-4" />
        {copiado ? t('banner.copiado') : t('banner.copiarEndereco')}
      </Botao>
      <BotaoDiagnostico
        rotulo={t('banner.testarTudo')}
        titulo={t('banner.testarAConexaoDoServidor')}
        tamanho="pequeno"
        rodar={window.api.diagnosticarDono}
        aoConsertar={consertoDoDono}
      />
    </div>
  )
}

// Ao lado do LIGAR na vitrine: Desligado, "Ligando… 0:12" (o tempo desde que começou), "Online ·
// 3/10 jogadores" ou Desligando.
function EstadoNaVitrine({
  estado,
  maximo
}: {
  estado: EstadoServidor
  maximo: number | null
}): React.JSX.Element {
  const [jogadores, setJogadores] = useState<string[]>([])
  const [desde, setDesde] = useState<number | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    window.api.lerJogadores().then(setJogadores)
    return window.api.aoMudarJogadores(setJogadores)
  }, [])
  // O relógio do "Ligando…" começa quando o servidor começa a ligar.
  useEffect(() => {
    if (estado !== 'ligando') return
    const inicio = Date.now()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o relógio começa ao ligar
    setDesde(inicio)
    setAgora(inicio)
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => {
      clearInterval(t)
      setDesde(null)
    }
  }, [estado])
  const segundos = desde === null ? 0 : Math.max(0, Math.floor((agora - desde) / 1000))
  const texto =
    estado === 'ligando'
      ? `Ligando… ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
      : estado === 'ligado'
        ? t('banner.online', {
            length: jogadores.length,
            v: maximo ? `/${maximo}` : '',
            v2: jogadores.length === 1 ? t('banner.jogador') : t('banner.jogadores')
          })
        : estado === 'desligando'
          ? t('banner.desligando')
          : t('banner.desligado')
  return (
    <p aria-live="polite" className="flex items-center gap-2 text-[15px] font-bold tabular-nums">
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 ${
          estado === 'ligado' ? 'bg-online' : estado === 'desligado' ? 'bg-offline' : 'bg-warning'
        }`}
      />
      {texto}
    </p>
  )
}
