import { useCallback, useEffect, useState } from 'react'
import type { ErroTela, Instalacao, StatusServidorJogo } from '../../../shared/tipos'
import { IconeServidor } from '../componentes/icones'
import { MensagemErro } from '../componentes/MensagemErro'
import { BotaoDiagnostico } from '../componentes/Diagnostico'
import { BarraProgresso, BolinhaStatus, Esqueleto } from '../componentes/movimento'
import { CabecaJogador, TituloPagina } from '../componentes/paineis'
import { Botao, EstadoVazio } from '../componentes/ui'
import { irPara } from '../estrutura/navegar'
import { desatualizada, useJogar } from './useJogar'
import { JogarEmBreve, precisaInstalar, rotuloInstalar, useAbrirLauncherLigado } from './Instalar'
import { t } from '../../../shared/i18n'

// PlaySquare › Servidores (Fase P5, DESIGN.md seção 6.1.6): os servidores das minhas instalações
// (os meus, do ServSquare, e os de convites), com status, jogadores, recado do dono, versão do
// pacote e Jogar. Atualiza a cada 30 s, só com a tela aberta.

const INTERVALO = 30_000

export function TelaServidoresJogo(): React.JSX.Element {
  const [lista, setLista] = useState<Instalacao[] | null>(null)
  const [status, setStatus] = useState<Record<string, StatusServidorJogo | null>>({})
  const [erro, setErro] = useState<ErroTela | null>(null)

  const ler = useCallback(async (): Promise<void> => {
    const r = await window.api.listarInstalacoes()
    if (!r.ok) return setErro(r.erro)
    const deServidor = r.valor.filter(
      (i) => i.origem.tipo === 'servidor' || i.origem.tipo === 'convite'
    )
    setLista(deServidor)
    const pares = await Promise.all(
      deServidor.map(async (i) => {
        const s = await window.api.statusDoServidorDoJogo(i.id)
        return [i.id, s.ok ? s.valor : null] as const
      })
    )
    setStatus(Object.fromEntries(pares))
  }, [])

  useEffect(() => {
    let vivo = true
    const passo = (): void => {
      if (vivo) void ler()
    }
    // Primeiro confere os convites (versão do pacote), depois o status de cada servidor.
    void window.api.verificarConvites().then(passo)
    const t = setInterval(passo, INTERVALO)
    const parar = window.api.aoMudarEstado(passo)
    return () => {
      vivo = false
      clearInterval(t)
      parar()
    }
  }, [ler])

  const fluxo = useJogar(ler)

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 p-10">
        <TituloPagina>{t('telaServidoresJogo.servidores')}</TituloPagina>
        <p className="-mt-6 text-[13px] text-muted">
          {t('telaServidoresJogo.osServidoresDasSuasInstalacoes')}
        </p>
        {erro && <MensagemErro erro={erro} />}
        {fluxo.erro && <MensagemErro erro={fluxo.erro} />}
        {fluxo.ocupado && (
          <BarraProgresso
            rotulo={fluxo.progresso?.etapa ?? t('telaServidoresJogo.preparando')}
            valor={fluxo.progresso?.recebido ?? 0}
            maximo={fluxo.progresso?.total ?? 0}
          />
        )}
        {lista === null ? (
          <Esqueleto linhas={3} />
        ) : !lista.length ? (
          <EstadoVazio
            icone={<IconeServidor />}
            titulo={t('telaServidoresJogo.nenhumServidorAinda')}
            texto={t('telaServidoresJogo.entreComUmConviteEm')}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {lista.map((i, n) => (
              <LinhaServidor
                key={i.id}
                i={i}
                ordem={n}
                status={status[i.id]}
                ocupado={!!fluxo.ocupado}
                aoJogar={() => void fluxo.jogar(i)}
                aoInstalar={() => void fluxo.jogar(i, undefined, 'instalar')}
              />
            ))}
          </ul>
        )}
      </div>
      {fluxo.dialogo}
    </div>
  )
}

function LinhaServidor({
  i,
  ordem,
  status,
  ocupado,
  aoJogar,
  aoInstalar
}: {
  i: Instalacao
  ordem: number
  status: StatusServidorJogo | null | undefined
  ocupado: boolean
  aoJogar: () => void
  aoInstalar: () => void
}): React.JSX.Element {
  const abrirLigado = useAbrirLauncherLigado()
  const [erro, setErro] = useState<ErroTela | null>(null)
  const meu = i.origem.tipo === 'servidor'
  const situacao = status?.ligando ? 'ligando' : status?.online ? 'ligado' : 'desligado'
  const pacote =
    i.convite && i.convite.versaoAplicada
      ? t('telaServidoresJogo.pacoteVersao', {
          versaoAplicada: i.convite.versaoAplicada,
          v: desatualizada(i) ? ` (nova: ${i.convite.versaoDisponivel})` : ''
        })
      : i.convite
        ? t('telaServidoresJogo.pacoteAindaNaoInstalado')
        : t('telaServidoresJogo.pacoteIgualAoDoSeu')

  async function gerenciar(): Promise<void> {
    if (i.origem.tipo !== 'servidor') return
    // Torna ativo (se der) e abre o Painel; com outro servidor ligado, abre a lista de servidores.
    const r = await window.api.ativarServidor(i.origem.servidorId)
    if (!r.ok) {
      setErro(r.erro)
      irPara({ area: 'serv', pagina: t('telaServidoresJogo.servidores') })
      return
    }
    irPara({ area: 'serv', pagina: 'Painel' })
  }

  return (
    <li
      className="anim-item flex list-none flex-wrap items-center gap-4 border border-linha bg-panel p-4"
      style={{ '--ordem': ordem } as React.CSSProperties}
    >
      {i.imagem ? (
        <img src={i.imagem} alt="" className="h-12 w-12 shrink-0 [image-rendering:pixelated]" />
      ) : (
        <span aria-hidden="true" className="banner-padrao h-12 w-12 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <BolinhaStatus estado={situacao} />
          <b className="truncate">{status?.nome ?? i.nome}</b>
          <span className="text-xs text-muted">
            {meu ? t('telaServidoresJogo.seuServidor') : t('telaServidoresJogo.convite')}
          </span>
        </span>
        <span className="text-xs text-muted">
          {status === undefined
            ? t('telaServidoresJogo.conferindo')
            : !status
              ? t('telaServidoresJogo.semEndereco')
              : status.ligando
                ? t('telaServidoresJogo.ligando')
                : status.online
                  ? status.contagem
                    ? `${status.contagem.online}/${status.contagem.max} online`
                    : t('telaServidoresJogo.online', { length: status.jogadores.length })
                  : t('telaServidoresJogo.servidorDesligado')}
          {' · '}
          {i.versao} · {pacote}
          {status?.endereco && <span className="font-mono"> · {status.endereco}</span>}
        </span>
        {status?.online && status.jogadores.length > 0 && (
          <span className="flex gap-1" aria-label={t('telaServidoresJogo.jogadoresOnline')}>
            {status.jogadores.slice(0, 10).map((j) => (
              <span key={j.nome} title={j.nome}>
                <CabecaJogador nome={j.nome} uuid={j.uuid ?? undefined} />
              </span>
            ))}
          </span>
        )}
        {!status?.online && status?.mensagem && (
          <span className="text-xs">
            {t('telaServidoresJogo.recadoDoDono', { mensagem: status.mensagem })}
          </span>
        )}
        {erro && <MensagemErro erro={erro} />}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meu && (
          <Botao tamanho="pequeno" onClick={() => void gerenciar()}>
            {t('telaServidoresJogo.gerenciarNoServsquare')}
          </Botao>
        )}
        {!meu && (
          <BotaoDiagnostico
            rotulo={t('telaServidoresJogo.naoConsigoEntrar')}
            titulo={t('telaServidoresJogo.naoConsigoEntrarEm', { nome: i.nome })}
            tamanho="pequeno"
            rodar={() => window.api.diagnosticarInstalacao(i.id)}
            aoConsertar={async () => {
              // Único conserto do amigo: atualizar a instalação (mesmo fluxo do ATUALIZAR).
              aoInstalar()
              return 'fechar'
            }}
          />
        )}
        {abrirLigado ? (
          <Botao variante="primario" disabled={ocupado} onClick={aoJogar}>
            {desatualizada(i)
              ? t('telaServidoresJogo.atualizarEJogar')
              : t('telaServidoresJogo.jogar')}
          </Botao>
        ) : (
          <>
            {precisaInstalar(i) ? (
              <Botao variante="primario" disabled={ocupado} onClick={aoInstalar}>
                {rotuloInstalar(i, false)}
              </Botao>
            ) : (
              <Botao
                onClick={() =>
                  void window.api
                    .abrirPastaInstalacao(i.id)
                    .then((r) => setErro(r.ok ? null : r.erro))
                }
              >
                {t('telaServidoresJogo.abrirPasta')}
              </Botao>
            )}
            <JogarEmBreve />
          </>
        )}
      </div>
    </li>
  )
}
