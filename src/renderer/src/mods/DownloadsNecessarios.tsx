import { useEffect, useRef, useState } from 'react'
import type { DownloadManual, ErroTela, Resultado } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso } from '../componentes/movimento'
import { Aviso, Botao } from '../componentes/ui'
import { IconeProjeto } from './TelaMods'

// Fase D: janela "Downloads necessários" (o fluxo do ATLauncher). Fica montada uma vez no App.
// Abre sozinha quando uma instalação deixa algo faltando, ou pelo botão "Downloads pendentes".
// O app só abre a página oficial; quem baixa é o usuário, e o app reconhece o arquivo pelo hash.

const EVENTO = 'hubsquare:downloads'
const LOTE = 5 // "Abrir todas" abre no máximo 5 abas por vez

// eslint-disable-next-line react-refresh/only-export-components
export function abrirDownloads(alvo: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: alvo }))
}

// Lista viva das pendências (o processo principal avisa a cada mudança).
// eslint-disable-next-line react-refresh/only-export-components
export function useDownloads(): DownloadManual[] {
  const [itens, setItens] = useState<DownloadManual[]>([])
  useEffect(() => {
    window.api.listarDownloads().then((r) => r.ok && setItens(r.valor))
    return window.api.aoMudarDownloads(setItens)
  }, [])
  return itens
}

function tamanho(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Faixa com "Downloads pendentes (N)" nas telas Mods e Conteúdo, só enquanto falta algo.
export function BotaoDownloadsPendentes({ alvo }: { alvo: string }): React.JSX.Element | null {
  const n = useDownloads().filter((d) => d.alvo === alvo && d.estado !== 'pronto').length
  if (!n) return null
  return (
    <Aviso tipo="atencao">
      <span className="flex-1">
        {n === 1
          ? 'Falta 1 arquivo que precisa ser baixado pela página oficial.'
          : `Faltam ${n} arquivos que precisam ser baixados pela página oficial.`}
      </span>
      <Botao variante="atencao" tamanho="pequeno" onClick={() => abrirDownloads(alvo)}>
        Downloads pendentes ({n})
      </Botao>
    </Aviso>
  )
}

const ESTADOS: Record<DownloadManual['estado'], { texto: string; cor: string; borda: string }> = {
  aguardando: { texto: 'Aguardando', cor: 'text-muted', borda: 'border-linha' },
  conferindo: { texto: 'Detectado, conferindo…', cor: 'text-warning', borda: 'border-warning' },
  pronto: { texto: 'Pronto ✓', cor: 'text-online', borda: 'border-online' },
  diferente: { texto: 'Arquivo diferente', cor: 'text-danger', borda: 'border-danger' }
}

function Linha({
  d,
  aoErro
}: {
  d: DownloadManual
  aoErro: (e: ErroTela) => void
}): React.JSX.Element {
  const [soltando, setSoltando] = useState(false)
  const e = ESTADOS[d.estado]
  const pronto = d.estado === 'pronto'
  const pedir = async (p: Promise<Resultado<void>>): Promise<void> => {
    const r = await p
    if (!r.ok) aoErro(r.erro)
  }
  return (
    <li
      className={`anim-item flex flex-col gap-2 border-l-4 bg-panel-2 p-3 ${e.borda} ${soltando ? 'outline-2 outline-accent' : ''}`}
      onDragOver={(ev) => {
        if (pronto) return
        ev.preventDefault()
        setSoltando(true)
      }}
      onDragLeave={() => setSoltando(false)}
      onDrop={(ev) => {
        ev.preventDefault()
        setSoltando(false)
        const f = ev.dataTransfer.files[0]
        if (f && !pronto) void pedir(window.api.soltarDownload(d.id, f))
      }}
    >
      <div className="flex items-start gap-3">
        <IconeProjeto url={d.icone} titulo={d.titulo} tam={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <b className="truncate text-sm" title={d.titulo}>
              {d.titulo}
            </b>
            <span className="ml-auto shrink-0 text-xs text-muted">{tamanho(d.tamanho)}</span>
          </div>
          <div className="truncate font-mono text-xs text-muted" title={d.arquivo}>
            {d.arquivo}
          </div>
          <div className="text-xs text-muted">Para: {d.nomeAlvo}</div>
        </div>
        {/* key: o selo entra de novo (fade + escala) a cada troca de estado. */}
        <span key={d.estado} className={`anim-estalo shrink-0 text-[13px] font-bold ${e.cor}`}>
          {e.texto}
        </span>
      </div>
      {d.estado === 'diferente' && d.motivo && <p className="text-xs text-danger">{d.motivo}</p>}
      {!pronto && (
        <div className="flex flex-wrap items-center gap-2">
          <Botao
            variante="primario"
            tamanho="pequeno"
            onClick={() => void pedir(window.api.abrirPaginaDownload(d.id))}
          >
            Abrir página de download
          </Botao>
          <Botao tamanho="pequeno" onClick={() => void pedir(window.api.escolherDownload(d.id))}>
            Já baixei, escolher arquivo
          </Botao>
          <span className="flex-1 border-2 border-dashed border-linha px-2 py-1 text-center text-xs text-muted">
            ou arraste o arquivo aqui
          </span>
        </div>
      )}
    </li>
  )
}

export function DownloadsNecessarios(): React.JSX.Element {
  const todos = useDownloads()
  const [alvo, setAlvo] = useState<string | null>(null) // null: fechada
  const [lote, setLote] = useState(0) // quantos lotes do "Abrir todas" já abriram
  const [erro, setErro] = useState<ErroTela | null>(null)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const abrir = (a: string): void => {
      setAlvo(a)
      setLote(0)
      setErro(null)
      void window.api.procurarDownloads() // já baixados antes de abrir a janela
    }
    const ouvinte = (e: Event): void => abrir((e as CustomEvent<string>).detail)
    window.addEventListener(EVENTO, ouvinte)
    const parar = window.api.aoPedirDownloads(abrir)
    return () => {
      window.removeEventListener(EVENTO, ouvinte)
      parar()
    }
  }, [])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (alvo !== null && !d.open) d.showModal()
    if (alvo === null && d.open) d.close()
  }, [alvo])

  const itens = todos.filter((d) => d.alvo === alvo)
  const prontos = itens.filter((d) => d.estado === 'pronto').length
  const faltam = itens.filter((d) => d.estado !== 'pronto')
  const tudoPronto = itens.length > 0 && !faltam.length
  const proximo = faltam.slice(lote * LOTE, lote * LOTE + LOTE)

  const fechar = (): void => {
    setAlvo(null)
    void window.api.limparDownloadsProntos()
  }

  const abrirLote = async (): Promise<void> => {
    for (const d of proximo) {
      const r = await window.api.abrirPaginaDownload(d.id)
      if (!r.ok) return setErro(r.erro)
    }
    setLote((l) => l + 1)
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        fechar()
      }}
      aria-labelledby="titulo-downloads"
      className="m-auto w-[680px] max-w-[calc(100vw-32px)] border-2 border-linha bg-panel p-6 text-texto backdrop:bg-[var(--overlay)]"
    >
      <h2 id="titulo-downloads" className="texto-pixel text-xl">
        Downloads necessários
      </h2>
      <p className="mt-2 text-sm text-muted">
        Os autores destes arquivos não deixam outros apps baixarem por você. Baixe cada um pela
        página oficial: o app encontra o arquivo na pasta Downloads, confere e instala sozinho.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-baseline gap-3 text-[13px]">
          <b>
            {prontos} de {itens.length} prontos
          </b>
          {!tudoPronto && faltam.length > 0 && (
            <span className="text-xs text-muted">Procurando na pasta Downloads…</span>
          )}
          {!tudoPronto && faltam.length > 0 && (
            <Botao
              variante="primario"
              tamanho="pequeno"
              className="ml-auto"
              disabled={!proximo.length}
              onClick={() => void abrirLote()}
            >
              {lote === 0
                ? `Abrir todas${faltam.length > LOTE ? ` (${LOTE} por vez)` : ''}`
                : proximo.length
                  ? `Abrir as próximas ${proximo.length}`
                  : 'Todas abertas'}
            </Botao>
          )}
        </div>
        <BarraProgresso
          rotulo={`${prontos} de ${itens.length} prontos`}
          valor={prontos}
          maximo={itens.length}
        />
      </div>

      {tudoPronto && (
        <div className="anim-estalo mt-4">
          <Aviso tipo="sucesso">
            Tudo pronto! Os arquivos foram para a pasta certa e a instalação continuou sozinha.
          </Aviso>
        </div>
      )}
      {erro && (
        <div className="mt-4">
          <MensagemErro erro={erro} />
        </div>
      )}

      <ul className="mt-4 flex max-h-[50vh] flex-col gap-2 overflow-auto">
        {itens.map((d) => (
          <Linha key={d.id} d={d} aoErro={setErro} />
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-end gap-2">
        {!tudoPronto && (
          <span className="mr-auto text-xs text-muted">
            Pode fechar: o que falta fica salvo e continua depois.
          </span>
        )}
        <Botao variante={tudoPronto ? 'primario' : 'secundario'} onClick={fechar}>
          {tudoPronto ? 'Concluir' : 'Fechar'}
        </Botao>
      </div>
    </dialog>
  )
}
