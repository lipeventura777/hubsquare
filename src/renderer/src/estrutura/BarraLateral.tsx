import { Logo, Wordmark } from '../componentes/Logo'
import { useState } from 'react'
import {
  NOMES_TIPOS,
  type ErroTela,
  type EstadoServidor,
  type InfoServidor
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import {
  IconeArquivos,
  IconeAtencao,
  IconeAutomacao,
  IconeBackups,
  IconeCaptura,
  IconeComandos,
  IconeConexao,
  IconeConfiguracoes,
  IconeConsole,
  IconeConteudo,
  IconeDesempenho,
  IconeEngrenagem,
  IconeExplorar,
  IconeInstalacoes,
  IconeIntegracoes,
  IconeJogadores,
  IconeLigar,
  IconeMods,
  IconeMundos,
  IconeParar,
  IconeRecolher,
  IconeRegistro,
  IconeServidor,
  IconeSoftware,
  IconeSubmenu
} from '../icones'
import { COR_STATUS, useIndicador } from '../componentes/movimento'
import { Dialogo } from '../componentes/ui'
import { IconeDoServidor } from '../componentes/IconeDoServidor'
import { useIconeAtivo } from '../componentes/useIconeAtivo'
import { useAparencia, type Area } from '../aparencia/useAparencia'
import { TrocaDeArea } from './TrocaDeArea'
import { t, tNome } from '../../../shared/i18n'

export type Pagina =
  | 'Servidores'
  | 'Painel'
  | 'Opções'
  | 'Console'
  | 'Comandos'
  | 'Registro de eventos'
  | 'Jogadores'
  | 'Software'
  | 'Mods'
  | 'Arquivos'
  | 'Mundos'
  | 'Cópias de segurança'
  | 'Desempenho'
  | 'Automação'
  | 'Integrações'
  | 'Conexão'
  | 'Aparência'

// Telas da área PlaySquare (seção 6.1.2).
export type PaginaPlay =
  | 'Jogar'
  | 'Instalações'
  | 'Explorar'
  | 'Conteúdo'
  | 'Servidores'
  | 'Capturas de tela'
  | 'Ajustes do jogo'
  | 'Aparência'

type Icone = (p: { className?: string }) => React.JSX.Element

const ITENS_PLAY: { pagina: PaginaPlay; Icone: Icone; submenu?: string[] }[] = [
  { pagina: 'Jogar', Icone: IconeLigar },
  { pagina: 'Instalações', Icone: IconeInstalacoes },
  { pagina: 'Explorar', Icone: IconeExplorar },
  { pagina: 'Conteúdo', Icone: IconeConteudo },
  { pagina: 'Servidores', Icone: IconeServidor },
  { pagina: 'Capturas de tela', Icone: IconeCaptura },
  { pagina: 'Ajustes do jogo', Icone: IconeConfiguracoes }
]

// Itens da barra lateral, nesta ordem (DESIGN.md, seção 6.1).
const ITENS: { pagina: Pagina; Icone: Icone; submenu?: string[] }[] = [
  { pagina: 'Painel', Icone: IconeServidor },
  { pagina: 'Opções', Icone: IconeConfiguracoes },
  { pagina: 'Console', Icone: IconeConsole },
  { pagina: 'Comandos', Icone: IconeComandos },
  {
    pagina: 'Registro de eventos',
    Icone: IconeRegistro,
    submenu: ['Logs', 'Relatórios de travamento', 'Ações do app']
  },
  { pagina: 'Jogadores', Icone: IconeJogadores },
  { pagina: 'Software', Icone: IconeSoftware },
  { pagina: 'Mods', Icone: IconeMods },
  { pagina: 'Arquivos', Icone: IconeArquivos },
  { pagina: 'Mundos', Icone: IconeMundos },
  { pagina: 'Cópias de segurança', Icone: IconeBackups },
  { pagina: 'Desempenho', Icone: IconeDesempenho },
  { pagina: 'Automação', Icone: IconeAutomacao },
  { pagina: 'Integrações', Icone: IconeIntegracoes },
  { pagina: 'Conexão', Icone: IconeConexao }
]

const TEXTO_STATUS: Record<EstadoServidor | 'erro', string> = {
  desligado: t('barraLateral.desligado'),
  ligando: t('barraLateral.ligando'),
  ligado: t('barraLateral.online'),
  desligando: t('barraLateral.desligando'),
  erro: t('barraLateral.erro')
}

// Rótulos somem antes de recolher e aparecem depois de expandir (seção 8).
function classeRotulo(recolhida: boolean): string {
  return `transition-opacity duration-(--dur-fast) ${
    recolhida ? 'opacity-0' : 'opacity-100 delay-(--dur-fast)'
  }`
}

export function BarraLateral({
  area,
  areaEscolhida,
  aoTrocarArea,
  animarArea,
  info,
  estado,
  comErro,
  pagina,
  aba,
  aoEscolher,
  novidades,
  alertas,
  versao,
  recolhida,
  aoRecolher,
  semTrocaDeArea = false
}: {
  area: Area // a que está na tela
  areaEscolhida: Area // a da aba (muda na hora do clique)
  aoTrocarArea: (area: Area) => void
  animarArea: boolean // false na primeira abertura: a barra não desliza ao abrir o app
  info: InfoServidor | null
  estado: EstadoServidor
  comErro: boolean
  pagina: Pagina | PaginaPlay
  aba: string
  // Recebe uma página da área aberta (Pagina no ServSquare, PaginaPlay no PlaySquare).
  aoEscolher: (p: Pagina & PaginaPlay, aba?: string) => void
  novidades: Partial<Record<Pagina, boolean>> // quadradinho --accent
  alertas: Partial<Record<Pagina, string>> // ⚠ --warning, com o motivo na dica
  versao: string
  recolhida: boolean
  semTrocaDeArea?: boolean // modo amigo (Fase M6): só o PlaySquare
  aoRecolher: () => void
}): React.JSX.Element {
  const logoNaBarra = useAparencia().aparencia?.logoNaBarra !== false
  const [submenuAberto, setSubmenuAberto] = useState(pagina === 'Registro de eventos')
  // A barra de 3px desliza até o item ativo (seção 8).
  const { conteiner, indicador } = useIndicador(pagina, 'y')

  return (
    <nav
      aria-label={t('barraLateral.secoes')}
      className={`m-2.5 mr-0 flex shrink-0 flex-col overflow-hidden bg-sidebar ${
        recolhida ? 'w-14' : 'w-[180px]'
      }`}
    >
      {/* Marca (DESIGN.md, Marca): logo pequena de 32 px e o nome; recolhida, só a logo. Escondida
          (Aparência › Tema › Logo), a linha sai inteira e as abas Serv/Play sobem para o topo. */}
      {logoNaBarra && (
        <div
          data-marca-barra
          className={`flex h-11 shrink-0 items-center gap-2 ${recolhida ? 'justify-center' : 'px-3'}`}
        >
          <Logo tamanho={32} />
          {!recolhida && <Wordmark className="text-[18px]" />}
        </div>
      )}
      {!semTrocaDeArea && (
        <TrocaDeArea area={areaEscolhida} aoTrocar={aoTrocarArea} recolhida={recolhida} />
      )}

      <div key={area} className={`flex min-h-0 flex-col ${animarArea ? `anim-area-${area}` : ''}`}>
        {area === 'serv' && (
          <CartaoServidor
            info={info}
            estado={estado}
            comErro={comErro}
            recolhida={recolhida}
            aoAbrirServidores={() => aoEscolher('Servidores')}
          />
        )}

        <ul
          ref={conteiner as React.RefObject<HTMLUListElement>}
          className="relative flex min-h-0 flex-col overflow-x-hidden overflow-y-auto"
        >
          {(
            (area === 'serv' ? ITENS : ITENS_PLAY) as {
              pagina: Pagina | PaginaPlay
              Icone: Icone
              submenu?: string[]
            }[]
          ).map(({ pagina: p, Icone, submenu }) => {
            const ativa = p === pagina
            return (
              <li key={p} className="list-none">
                <button
                  type="button"
                  data-indicador={p}
                  aria-current={ativa ? 'page' : undefined}
                  title={recolhida ? tNome(p) : undefined}
                  aria-expanded={submenu ? submenuAberto : undefined}
                  onClick={() => {
                    aoEscolher(p as Pagina & PaginaPlay)
                    if (submenu) setSubmenuAberto((a) => (ativa ? !a : true))
                  }}
                  className={`flex h-11 w-full items-center gap-3 px-[18px] text-left text-sm font-bold transition-colors duration-(--dur-fast) ${
                    ativa ? 'bg-tile-active' : 'hover:bg-tile-active'
                  }`}
                >
                  <Icone className="h-5 w-5 shrink-0 text-accent" />
                  <span
                    className={`min-w-0 flex-1 line-clamp-2 leading-[1.15] ${classeRotulo(recolhida)}`}
                  >
                    {tNome(p)}
                  </span>
                  <Selos
                    alerta={alertas[p as Pagina]}
                    novidade={!!novidades[p as Pagina]}
                    recolhida={recolhida}
                  />
                  {submenu && !recolhida && (
                    <IconeSubmenu
                      className={`h-3 w-3 shrink-0 transition-transform duration-(--dur-base) ${
                        submenuAberto ? 'rotate-90' : ''
                      }`}
                    />
                  )}
                </button>
                {submenu && submenuAberto && !recolhida && (
                  <ul>
                    {submenu.map((sub) => {
                      const subAtiva = ativa && aba === sub
                      return (
                        <li key={sub} className="anim-item list-none">
                          <button
                            type="button"
                            onClick={() => aoEscolher(p as Pagina & PaginaPlay, sub)}
                            aria-current={subAtiva ? 'page' : undefined}
                            className={`flex h-9 w-full items-center pl-[50px] text-left text-[13px] transition-colors duration-(--dur-fast) hover:bg-tile-active ${
                              subAtiva ? 'font-bold' : 'text-muted'
                            }`}
                          >
                            {tNome(sub)}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
          <span
            ref={indicador as React.RefObject<HTMLSpanElement>}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 w-[3px] bg-accent transition-transform duration-(--dur-base) ease-(--ease-entrada)"
          />
        </ul>
      </div>

      <div className="mt-auto border-t-2 border-linha">
        <div className={`flex items-center ${recolhida ? 'flex-col' : 'justify-between'}`}>
          <button
            type="button"
            onClick={() => aoEscolher('Aparência')}
            aria-label={t('barraLateral.aparencia')}
            aria-current={pagina === 'Aparência' ? 'page' : undefined}
            title={t('barraLateral.aparencia')}
            className={`flex h-11 w-14 items-center justify-center transition-colors duration-(--dur-fast) hover:bg-tile-active ${
              pagina === 'Aparência' ? 'bg-tile-active text-accent' : ''
            }`}
          >
            <IconeEngrenagem className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={aoRecolher}
            aria-label={
              recolhida
                ? t('barraLateral.expandirABarraLateral')
                : t('barraLateral.recolherABarraLateral')
            }
            title={recolhida ? t('barraLateral.expandir') : t('barraLateral.recolher')}
            className="flex h-11 w-14 items-center justify-center transition-colors duration-(--dur-fast) hover:bg-tile-active"
          >
            <IconeRecolher
              className={`h-4 w-4 transition-transform duration-(--dur-base) ${recolhida ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        <div className={`px-3 pb-2 text-[11px] text-muted ${classeRotulo(recolhida)}`}>
          {recolhida ? '' : t('barraLateral.versao', { versao })}
        </div>
      </div>
    </nav>
  )
}

// Selos à direita do rótulo: ⚠ em --warning e quadradinho de novidade em --accent.
function Selos({
  alerta,
  novidade,
  recolhida
}: {
  alerta?: string
  novidade: boolean
  recolhida: boolean
}): React.JSX.Element | null {
  if (!alerta && !novidade) return null
  return (
    <span className={recolhida ? 'absolute left-9 mt-[-18px]' : 'flex items-center gap-1'}>
      {alerta && (
        <span title={alerta} className="anim-estalo text-xs text-warning">
          <IconeAtencao className="h-3 w-3" />
          <span className="sr-only">{alerta}</span>
        </span>
      )}
      {novidade && (
        <span className="anim-estalo inline-block h-1.5 w-1.5 bg-accent">
          <span className="sr-only">{t('barraLateral.novidade')}</span>
        </span>
      )}
    </span>
  )
}

// Cartão do servidor ativo (seção 6.1): barra de status de 4px, nome, tipo e versão,
// e o botão redondo que liga (▶) ou desliga (■). Clicar no nome abre a tela Servidores.
function CartaoServidor({
  info,
  estado,
  comErro,
  recolhida,
  aoAbrirServidores
}: {
  info: InfoServidor | null
  estado: EstadoServidor
  comErro: boolean
  recolhida: boolean
  aoAbrirServidores: () => void
}): React.JSX.Element {
  const [erro, setErro] = useState<ErroTela | null>(null)
  const icone = useIconeAtivo(info?.id)
  const status = comErro && estado === 'desligado' ? 'erro' : estado
  const ligado = estado === 'ligado'
  const ocupado = estado === 'ligando' || estado === 'desligando'

  async function ligarOuDesligar(): Promise<void> {
    const r = await (ligado ? window.api.desligar() : window.api.ligar())
    if (!r.ok) setErro(r.erro)
  }

  return (
    <div className="relative flex h-[72px] shrink-0 items-center gap-2 border-b-2 border-linha pr-3 pl-4">
      <span
        aria-hidden="true"
        className={`absolute top-0 bottom-0 left-0 w-1 transition-colors duration-(--dur-base) ${COR_STATUS[status]}`}
      />
      <button
        type="button"
        onClick={aoAbrirServidores}
        title={
          info
            ? t('barraLateral.verTodosOsServidores', { nome: info.nome })
            : t('barraLateral.verTodosOsServidores2')
        }
        className={`flex min-w-0 flex-1 items-center gap-2 text-left ${classeRotulo(recolhida)}`}
        tabIndex={recolhida ? -1 : 0}
      >
        {info && <IconeDoServidor icone={icone} nome={info.nome} tam={32} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base">
            {info?.nome ?? t('barraLateral.servidor')}
          </span>
          <span className="block truncate text-xs text-muted">
            {info ? `${NOMES_TIPOS[info.tipo]} ${info.versao}` : ''} · {TEXTO_STATUS[status]}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={ligarOuDesligar}
        disabled={!info || ocupado}
        aria-label={ligado ? t('barraLateral.desligarServidor') : t('barraLateral.ligarServidor')}
        title={
          ocupado
            ? TEXTO_STATUS[status]
            : ligado
              ? t('barraLateral.desligarServidor')
              : t('barraLateral.ligarServidor')
        }
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-b-2 shadow-[inset_0_1px_0_var(--relevo-brilho)] transition-colors duration-(--dur-base) enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${
          ligado || estado === 'desligando'
            ? 'border-danger-shadow bg-danger text-on-dark'
            : 'border-accent-shadow bg-accent text-accent-text'
        } ${recolhida ? '-ml-1' : ''}`}
      >
        {ligado || estado === 'desligando' ? (
          <IconeParar className="h-3 w-3" />
        ) : (
          <IconeLigar className="h-3.5 w-3.5" />
        )}
      </button>

      <Dialogo
        aberto={!!erro}
        titulo={t('barraLateral.naoDeuCerto')}
        aoCancelar={() => setErro(null)}
        acao={{ rotulo: t('barraLateral.ok'), aoClicar: () => setErro(null) }}
      >
        {erro && <MensagemErro erro={erro} />}
      </Dialogo>
    </div>
  )
}
