import { useState } from 'react'
import { NOMES_TIPOS, type EstadoServidor, type InfoServidor } from '../../../shared/tipos'
import { IconeCopiar, IconeSeta } from '../componentes/icones'
import { classesBotao, type Variante } from '../componentes/estilos'
import { Botao, Menu } from '../componentes/ui'

const BOTAO: Record<EstadoServidor, { texto: string; variante: Variante; clicavel: boolean }> = {
  desligado: { texto: 'Ligar', variante: 'primario', clicavel: true },
  ligando: { texto: 'Ligando', variante: 'atencao', clicavel: false },
  ligado: { texto: 'Desligar', variante: 'perigo', clicavel: true },
  desligando: { texto: 'Desligando', variante: 'atencao', clicavel: false }
}

// Barra de ação (seção 6.4): seletor do servidor, botão LIGAR/DESLIGAR com o menu ⋮
// e o endereço ativo com o botão de copiar.
export function BarraDeAcao({
  info,
  estado,
  endereco,
  aoLigarDesligar,
  aoReiniciar,
  aoAbrirPasta
}: {
  info: InfoServidor
  estado: EstadoServidor
  endereco: string | null
  aoLigarDesligar: () => void
  aoReiniciar: () => void
  aoAbrirPasta: () => void
}): React.JSX.Element {
  const botao = BOTAO[estado]
  const [copiado, setCopiado] = useState(false)

  async function copiar(): Promise<void> {
    if (!endereco) return
    await window.api.copiar(endereco)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-y-2 border-linha bg-panel px-6">
      <Menu
        rotulo="Detalhes do servidor"
        className="justify-self-start"
        paraCima
        abrirParaDireita
        desabilitado={estado !== 'desligado'}
        classeBotao="flex h-12 w-[280px] items-center gap-3 border border-accent px-2 text-left transition-colors duration-(--dur-fast) hover:bg-tile-active disabled:cursor-not-allowed disabled:opacity-50"
        painel={
          <dl className="grid w-72 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Tipo</dt>
            <dd>{NOMES_TIPOS[info.tipo]}</dd>
            <dt className="text-muted">Versão</dt>
            <dd>{info.versao}</dd>
            <dt className="text-muted">Java</dt>
            <dd>{info.java}</dd>
            <dt className="text-muted">Pasta</dt>
            <dd className="break-all">{info.pasta}</dd>
            <dd className="col-span-2 mt-2">
              <Botao tamanho="pequeno" onClick={aoAbrirPasta}>
                Abrir pasta do servidor
              </Botao>
            </dd>
          </dl>
        }
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center bg-accent font-pixel text-lg text-accent-text"
        >
          {NOMES_TIPOS[info.tipo].charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[13px] font-bold">{NOMES_TIPOS[info.tipo]}</span>
          <span className="text-xs text-muted">{info.versao}</span>
        </span>
        <IconeSeta className="h-4 w-4 shrink-0" />
      </Menu>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={botao.clicavel ? aoLigarDesligar : undefined}
          aria-disabled={!botao.clicavel}
          // A cor faz transição (classesBotao); em LIGANDO passa um brilho diagonal (seção 8).
          className={`${classesBotao(botao.variante, 'grande')} ${
            botao.clicavel ? '' : 'cursor-default'
          } ${estado === 'ligando' ? 'anim-brilho' : ''}`}
        >
          {/* A chave faz o texto novo entrar com fade a cada troca de estado. */}
          <span key={estado} className={`anim-linha ${botao.clicavel ? '' : 'pontos'}`}>
            {botao.texto}
          </span>
        </button>
        <Menu
          rotulo="Mais ações"
          paraCima
          classeBotao={`${classesBotao('secundario')} h-[52px] w-11 px-0 text-lg`}
          itens={[
            { rotulo: 'Reiniciar', aoClicar: aoReiniciar, desabilitado: estado !== 'ligado' },
            { rotulo: 'Abrir pasta do servidor', aoClicar: aoAbrirPasta }
          ]}
        >
          ⋮
        </Menu>
      </div>

      <div className="flex min-w-0 items-center justify-self-end gap-2 text-[13px]">
        {endereco ? (
          <>
            <span className="truncate font-mono" title={endereco}>
              {endereco}
            </span>
            <button
              type="button"
              onClick={copiar}
              aria-label="Copiar endereço"
              title={copiado ? 'Copiado!' : 'Copiar endereço'}
              className="flex h-8 w-8 shrink-0 items-center justify-center hover:bg-tile-active"
            >
              <IconeCopiar className="h-4 w-4" />
            </button>
          </>
        ) : (
          <span className="text-muted">{estado === 'ligado' ? 'Sem endereço' : 'Desligado'}</span>
        )}
      </div>
    </div>
  )
}
