import { useState } from 'react'
import {
  numerosPaginas,
  TAMANHOS_PAGINA,
  textoIntervalo,
  totalPaginas
} from '../../../shared/paginaRegras'
import { classesBotao, campo } from './estilos'
import { t } from '../../../shared/i18n'

// Páginas nas listas de mods (Fase V9): o topo da lista ("Mostrando 25–48 de 1.234" e o
// tamanho da página) e a barra embaixo (Anterior, números com reticências, Próxima e "Ir para").

export function TopoDaLista({
  pagina,
  tamanho,
  total,
  aoMudarTamanho
}: {
  pagina: number
  tamanho: number
  total: number
  aoMudarTamanho: (t: number) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className="text-xs text-muted">
        {textoIntervalo(pagina, tamanho, total)}
      </p>
      <label className="flex items-center gap-2 text-xs whitespace-nowrap text-muted">
        {t('paginas.porPagina')}
        <select
          aria-label={t('paginas.itensPorPagina')}
          value={tamanho}
          onChange={(e) => aoMudarTamanho(Number(e.target.value))}
          className={`${campo.replace('w-full', '')} w-20 rounded-(--raio-pequeno)`}
        >
          {TAMANHOS_PAGINA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

const BOTAO_PAGINA = 'h-11 min-w-11 px-2.5 rounded-(--raio-pequeno) text-[13px] font-bold'

export function BarraDePaginas({
  pagina,
  tamanho,
  total,
  aoIr
}: {
  pagina: number
  tamanho: number
  total: number
  aoIr: (p: number) => void
}): React.JSX.Element | null {
  const paginas = totalPaginas(total, tamanho)
  const [destino, setDestino] = useState('')
  if (paginas <= 1) return null
  const ir = (p: number): void => aoIr(Math.min(Math.max(1, p), paginas))
  return (
    <nav
      aria-label={t('paginas.paginas')}
      className="placa-vidro flex flex-wrap items-center justify-center gap-2 p-2"
      // Setas do teclado: página anterior e próxima, com o foco em qualquer botão da barra.
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        if (e.key === 'ArrowLeft' && pagina > 1) ir(pagina - 1)
        else if (e.key === 'ArrowRight' && pagina < paginas) ir(pagina + 1)
        else return
        e.preventDefault()
      }}
    >
      {/* Dois blocos que quebram juntos: a navegação e o "Ir para a página". */}
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => ir(pagina - 1)}
          className={`${classesBotao('secundario')} ${BOTAO_PAGINA}`}
        >
          {t('paginas.anterior')}
        </button>
        {numerosPaginas(pagina, paginas).map((n, i) =>
          n === '…' ? (
            <span key={`r${i}`} aria-hidden="true" className="min-w-4 text-center text-muted">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={t('paginas.pagina', { n })}
              aria-current={n === pagina ? 'page' : undefined}
              onClick={() => n !== pagina && ir(n)}
              className={`${classesBotao(n === pagina ? 'primario' : 'secundario')} ${BOTAO_PAGINA}`}
            >
              {n}
            </button>
          )
        )}
        <button
          type="button"
          disabled={pagina >= paginas}
          onClick={() => ir(pagina + 1)}
          className={`${classesBotao('secundario')} ${BOTAO_PAGINA}`}
        >
          {t('paginas.proxima')}
        </button>
      </div>
      <form
        className="flex items-center gap-2 pl-2 text-xs text-muted"
        onSubmit={(e) => {
          e.preventDefault()
          const p = Number(destino)
          // Campo vazio não é a página 0: não faz nada.
          if (destino.trim() && Number.isInteger(p)) ir(p)
          setDestino('')
        }}
      >
        <label className="flex items-center gap-2 whitespace-nowrap">
          {t('paginas.irParaAPagina')}
          <input
            type="number"
            min={1}
            max={paginas}
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className={`${campo.replace('w-full', '')} h-11 w-20 rounded-(--raio-pequeno)`}
          />
        </label>
        <button type="submit" className={`${classesBotao('secundario')} ${BOTAO_PAGINA}`}>
          {t('paginas.ir')}
        </button>
      </form>
    </nav>
  )
}
