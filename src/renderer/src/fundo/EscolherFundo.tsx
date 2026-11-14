import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BIOMAS,
  NOMES_BIOMAS,
  type Bioma,
  type ErroTela,
  type ImagemFundo
} from '../../../shared/tipos'
import {
  AJUSTE_PADRAO,
  BIOMAS_CLAROS,
  BIOMAS_ESCUROS,
  type AjusteImagem,
  type EscolhaFundo
} from '../../../shared/fundoRegras'
import { Botao, OpcaoRadio, Selecao, Slider } from '../componentes/ui'
import { ArteDoBioma } from './Fundo'

// Peças da escolha de fundo (Fase V4), usadas na Aparência (fundo do app) e no painel Fundo da
// tela Jogar (fundo da instalação): biomas claros e escuros, minhas imagens e os ajustes.

// Imagens guardadas pelo app: lista, escolher do PC e arrastar.
// eslint-disable-next-line react-refresh/only-export-components
export function useImagensFundo(): {
  imagens: ImagemFundo[] | null
  erro: ErroTela | null
  recarregar: () => Promise<void>
  escolher: () => Promise<string | null>
  arrastada: (arquivo: File) => Promise<string | null>
} {
  const [imagens, setImagens] = useState<ImagemFundo[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const recarregar = useCallback(async (): Promise<void> => {
    const r = await window.api.listarImagensFundo()
    if (r.ok) setImagens(r.valor)
    else setErro(r.erro)
  }, [])
  useEffect(() => {
    window.api.listarImagensFundo().then((r) => (r.ok ? setImagens(r.valor) : setErro(r.erro)))
  }, [])
  async function guardar(
    pedido: Promise<{ ok: true; valor: string | null } | { ok: false; erro: ErroTela }>
  ): Promise<string | null> {
    const r = await pedido
    if (!r.ok) {
      setErro(r.erro)
      return null
    }
    setErro(null)
    if (r.valor) await recarregar()
    return r.valor
  }
  return {
    imagens,
    erro,
    recarregar,
    escolher: () => guardar(window.api.escolherImagemFundo()),
    arrastada: (arquivo) => guardar(window.api.guardarImagemArrastada(arquivo))
  }
}

// Miniatura de um bioma ou imagem num botão de escolha (radio).
export function CartaoFundo({
  rotulo,
  marcado,
  aoEscolher,
  children,
  pequeno = false
}: {
  rotulo: string
  marcado: boolean
  aoEscolher: () => void
  children: React.ReactNode
  pequeno?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      aria-label={rotulo}
      title={rotulo}
      onClick={aoEscolher}
      className={`isolate flex flex-col overflow-hidden rounded-(--raio-pequeno) border-2 bg-panel text-left transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        marcado ? 'border-accent' : 'border-linha hover:border-muted'
      }`}
    >
      <span className="relative block aspect-video w-full overflow-hidden">{children}</span>
      {!pequeno && <span className="truncate px-3 py-2 text-[13px] font-bold">{rotulo}</span>}
    </button>
  )
}

export function GradeBiomas({
  atual,
  aoEscolher,
  pequeno = false
}: {
  atual: Bioma | null
  aoEscolher: (b: Bioma) => void
  pequeno?: boolean
}): React.JSX.Element {
  const grade = pequeno
    ? 'grid grid-cols-4 gap-2'
    : 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3'
  return (
    <div className="flex flex-col gap-3">
      {(
        [
          ['Claros', BIOMAS_CLAROS],
          ['Escuros', BIOMAS_ESCUROS]
        ] as const
      ).map(([titulo, lista]) =>
        pequeno ? null : (
          <div key={titulo} className="flex flex-col gap-2">
            <p className="text-xs font-bold tracking-[.02em] text-muted uppercase">{titulo}</p>
            <div role="radiogroup" aria-label={`Biomas ${titulo.toLowerCase()}`} className={grade}>
              {lista.map((b) => (
                <CartaoFundo
                  key={b}
                  rotulo={NOMES_BIOMAS[b]}
                  marcado={atual === b}
                  aoEscolher={() => aoEscolher(b)}
                >
                  <ArteDoBioma bioma={b} className="absolute inset-0 h-full w-full" />
                </CartaoFundo>
              ))}
            </div>
          </div>
        )
      )}
      {pequeno && (
        <div role="radiogroup" aria-label="Bioma" className={grade}>
          {BIOMAS.map((b) => (
            <CartaoFundo
              key={b}
              rotulo={NOMES_BIOMAS[b]}
              marcado={atual === b}
              aoEscolher={() => aoEscolher(b)}
              pequeno
            >
              <ArteDoBioma bioma={b} className="absolute inset-0 h-full w-full" />
            </CartaoFundo>
          ))}
        </div>
      )}
    </div>
  )
}

// Minhas imagens como opções + "Escolher outra imagem…".
export function GradeImagens({
  imagens,
  atual,
  aoEscolher,
  aoEscolherOutra,
  pequeno = false
}: {
  imagens: ImagemFundo[] | null
  atual: string | null
  aoEscolher: (nome: string) => void
  aoEscolherOutra: () => void
  pequeno?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {imagens && imagens.length > 0 && (
        <div
          role="radiogroup"
          aria-label="Minhas imagens"
          className={
            pequeno
              ? 'grid grid-cols-4 gap-2'
              : 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3'
          }
        >
          {imagens.map((img, n) => (
            <CartaoFundo
              key={img.nome}
              rotulo={`Imagem ${n + 1}${img.usadaEm.length ? ` (em uso: ${img.usadaEm.join(', ')})` : ''}`}
              marcado={atual === img.nome}
              aoEscolher={() => aoEscolher(img.nome)}
              pequeno
            >
              <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </CartaoFundo>
          ))}
        </div>
      )}
      <div>
        <Botao tamanho="pequeno" onClick={aoEscolherOutra}>
          {imagens?.length ? 'Escolher outra imagem…' : 'Escolher uma imagem…'}
        </Botao>
      </div>
      <p className="text-xs text-muted">
        PNG, JPG ou WEBP até 25 MB. O app guarda uma cópia: pode apagar ou mover o arquivo original.
      </p>
    </div>
  )
}

// Ajustes da imagem: enquadramento, ponto de foco (arrastar na miniatura), desfoque, luz e
// partículas por cima.
export function AjustesImagem({
  url,
  ajuste,
  aoMudar
}: {
  url: string
  ajuste: AjusteImagem
  aoMudar: (a: AjusteImagem) => void
}): React.JSX.Element {
  const area = useRef<HTMLDivElement>(null)
  const arrastando = useRef(false)
  function foco(e: React.PointerEvent): void {
    const r = area.current?.getBoundingClientRect()
    if (!r) return
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    aoMudar({ ...ajuste, focoX: Math.round(x * 100) / 100, focoY: Math.round(y * 100) / 100 })
  }
  function teclasFoco(e: React.KeyboardEvent): void {
    const passo = 0.05
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo]
    }
    const m = d[e.key]
    if (!m) return
    e.preventDefault()
    const lim = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100
    aoMudar({ ...ajuste, focoX: lim(ajuste.focoX + m[0]), focoY: lim(ajuste.focoY + m[1]) })
  }
  const luzTexto = (v: number): string =>
    v === 0 ? 'Normal' : v < 0 ? `Escurecer ${-v}%` : `Clarear ${v}%`
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div role="radiogroup" aria-label="Enquadramento" className="flex flex-wrap gap-x-4">
        <OpcaoRadio
          nome="enquadrar"
          marcada={ajuste.enquadrar === 'preencher'}
          aoEscolher={() => aoMudar({ ...ajuste, enquadrar: 'preencher' })}
        >
          Preencher a tela
        </OpcaoRadio>
        <OpcaoRadio
          nome="enquadrar"
          marcada={ajuste.enquadrar === 'inteira'}
          aoEscolher={() => aoMudar({ ...ajuste, enquadrar: 'inteira' })}
        >
          Mostrar a imagem inteira
        </OpcaoRadio>
      </div>
      <div className="flex flex-col gap-1">
        <span id="rotulo-foco">Ponto de foco: arraste na imagem para escolher o centro</span>
        <div
          ref={area}
          role="slider"
          tabIndex={0}
          aria-labelledby="rotulo-foco"
          aria-valuetext={`${Math.round(ajuste.focoX * 100)}% da esquerda, ${Math.round(ajuste.focoY * 100)}% do topo`}
          onKeyDown={teclasFoco}
          onPointerDown={(e) => {
            arrastando.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            foco(e)
          }}
          onPointerMove={(e) => arrastando.current && foco(e)}
          onPointerUp={() => (arrastando.current = false)}
          className="relative aspect-video w-full max-w-[320px] cursor-crosshair touch-none overflow-hidden rounded-(--raio-pequeno) border border-linha bg-panel-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <img
            src={url}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--text-on-dark) shadow-[0_0_0_2px_var(--text-on-light)]"
            style={{ left: `${ajuste.focoX * 100}%`, top: `${ajuste.focoY * 100}%` }}
          />
        </div>
      </div>
      <Slider
        rotulo="Desfoque"
        valor={ajuste.desfoque}
        min={0}
        max={20}
        aoMudar={(v) => aoMudar({ ...ajuste, desfoque: v })}
        formatar={(v) => `${v}px`}
      />
      <Slider
        rotulo="Escurecer ou clarear"
        valor={ajuste.luz}
        min={-60}
        max={60}
        passo={5}
        aoMudar={(v) => aoMudar({ ...ajuste, luz: v })}
        formatar={luzTexto}
      />
      <label className="flex flex-col gap-1">
        Partículas por cima
        <Selecao
          value={ajuste.particulas ?? ''}
          onChange={(e) =>
            aoMudar({ ...ajuste, particulas: (e.target.value || null) as Bioma | null })
          }
        >
          <option value="">Desligadas</option>
          {BIOMAS.map((b) => (
            <option key={b} value={b}>
              Partículas do bioma {NOMES_BIOMAS[b]}
            </option>
          ))}
        </Selecao>
      </label>
    </div>
  )
}

// Escolha de imagem com o ajuste guardado (ou o padrão, na primeira vez).
// eslint-disable-next-line react-refresh/only-export-components
export const escolhaDeImagem = (nome: string, anterior: EscolhaFundo | null): EscolhaFundo => ({
  tipo: 'imagem',
  imagem: nome,
  ajuste: anterior?.tipo === 'imagem' ? anterior.ajuste : AJUSTE_PADRAO
})
