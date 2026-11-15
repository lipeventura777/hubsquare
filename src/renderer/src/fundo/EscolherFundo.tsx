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
  urlDoFundo,
  type AjusteImagem,
  type EscolhaFundo,
  type FundoServidor
} from '../../../shared/fundoRegras'
import { Botao, OpcaoRadio, Selecao, Slider } from '../componentes/ui'
import { MensagemErro } from '../componentes/MensagemErro'
import { useAparencia } from '../aparencia/useAparencia'
import { ArteDoBioma } from './Fundo'
import { CamadaFundo } from './CamadaFundo'
import { t } from '../../../shared/i18n'

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
          [t('escolherFundo.claros'), BIOMAS_CLAROS],
          [t('escolherFundo.escuros'), BIOMAS_ESCUROS]
        ] as const
      ).map(([titulo, lista]) =>
        pequeno ? null : (
          <div key={titulo} className="flex flex-col gap-2">
            <p className="text-xs font-bold tracking-[.02em] text-muted uppercase">{titulo}</p>
            <div
              role="radiogroup"
              aria-label={t('escolherFundo.biomas', { toLowerCase: titulo.toLowerCase() })}
              className={grade}
            >
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
        <div role="radiogroup" aria-label={t('escolherFundo.bioma')} className={grade}>
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
          aria-label={t('escolherFundo.minhasImagens')}
          className={
            pequeno
              ? 'grid grid-cols-4 gap-2'
              : 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3'
          }
        >
          {imagens.map((img, n) => (
            <CartaoFundo
              key={img.nome}
              rotulo={t('escolherFundo.imagem', {
                v: n + 1,
                v2: img.usadaEm.length
                  ? t('escolherFundo.emUso', { join: img.usadaEm.join(', ') })
                  : ''
              })}
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
          {imagens?.length
            ? t('escolherFundo.escolherOutraImagem')
            : t('escolherFundo.escolherUmaImagem')}
        </Botao>
      </div>
      <p className="text-xs text-muted">{t('escolherFundo.pngJpgOuWebpAte')}</p>
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
    v === 0
      ? t('escolherFundo.normal')
      : v < 0
        ? t('escolherFundo.escurecer', { v: -v })
        : t('escolherFundo.clarear', { v })
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div
        role="radiogroup"
        aria-label={t('escolherFundo.enquadramento')}
        className="flex flex-wrap gap-x-4"
      >
        <OpcaoRadio
          nome="enquadrar"
          marcada={ajuste.enquadrar === 'preencher'}
          aoEscolher={() => aoMudar({ ...ajuste, enquadrar: 'preencher' })}
        >
          {t('escolherFundo.preencherATela')}
        </OpcaoRadio>
        <OpcaoRadio
          nome="enquadrar"
          marcada={ajuste.enquadrar === 'inteira'}
          aoEscolher={() => aoMudar({ ...ajuste, enquadrar: 'inteira' })}
        >
          {t('escolherFundo.mostrarAImagemInteira')}
        </OpcaoRadio>
      </div>
      <div className="flex flex-col gap-1">
        <span id="rotulo-foco">{t('escolherFundo.pontoDeFocoArrasteNa')}</span>
        <div
          ref={area}
          role="slider"
          tabIndex={0}
          aria-labelledby="rotulo-foco"
          aria-valuetext={t('escolherFundo.daEsquerdaDoTopo', {
            round: Math.round(ajuste.focoX * 100),
            round2: Math.round(ajuste.focoY * 100)
          })}
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
        rotulo={t('escolherFundo.desfoque')}
        valor={ajuste.desfoque}
        min={0}
        max={20}
        aoMudar={(v) => aoMudar({ ...ajuste, desfoque: v })}
        formatar={(v) => `${v}px`}
      />
      <Slider
        rotulo={t('escolherFundo.escurecerOuClarear')}
        valor={ajuste.luz}
        min={-60}
        max={60}
        passo={5}
        aoMudar={(v) => aoMudar({ ...ajuste, luz: v })}
        formatar={luzTexto}
      />
      <label className="flex flex-col gap-1">
        {t('escolherFundo.particulasPorCima')}
        <Selecao
          value={ajuste.particulas ?? ''}
          onChange={(e) =>
            aoMudar({ ...ajuste, particulas: (e.target.value || null) as Bioma | null })
          }
        >
          <option value="">{t('escolherFundo.desligadas')}</option>
          {BIOMAS.map((b) => (
            <option key={b} value={b}>
              {t('escolherFundo.particulasDoBioma', { v: NOMES_BIOMAS[b] })}
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

// Painel "Fundo" (Fase V4, seção 7.2), o MESMO nas duas áreas: na tela Jogar (instalação) e no
// Painel do servidor (Fase V10). Igual ao app, Igual à instalação (só no servidor, quando ela
// existe), Bioma ou Imagem, com a prévia de cada um; embaixo, usar em todas as instalações (só no
// PlaySquare, com confirmação) e voltar ao fundo do app.
export function PainelFundo({
  titulo,
  rotulo,
  atual,
  instalacao,
  definir,
  imgs,
  emTodas
}: {
  titulo: string
  rotulo: string // nome do grupo de escolhas (leitores de tela)
  atual: FundoServidor | null
  // "Igual à instalação deste servidor": o fundo dela (null = igual ao app). Sem valor: não aparece.
  instalacao?: EscolhaFundo | null
  definir: (escolha: FundoServidor | null, imediato?: boolean) => void
  imgs: ReturnType<typeof useImagensFundo>
  emTodas?: (escolha: EscolhaFundo | null) => Promise<void>
}): React.JSX.Element {
  const { aparencia, fundoApp } = useAparencia()
  const daInstalacao = atual?.tipo === 'instalacao' ? null : atual // a escolha própria
  const [modo, setModo] = useState<'app' | 'instalacao' | 'bioma' | 'imagem'>(atual?.tipo ?? 'app')
  const [confirmar, setConfirmar] = useState(false)
  const biomaApp = aparencia?.bioma ?? 'dia'
  const doApp = fundoApp ?? { tipo: 'bioma' as const, bioma: biomaApp }
  const imagem = daInstalacao?.tipo === 'imagem' ? daInstalacao : null

  const opcoes = [
    {
      modo: 'app' as const,
      rotulo: t('escolherFundo.igualAoApp'),
      previa: <CamadaFundo escolha={doApp} parado />,
      escolher: () => definir(null)
    },
    ...(instalacao !== undefined
      ? [
          {
            modo: 'instalacao' as const,
            rotulo: t('escolherFundo.igualAInstalacaoDesteServidor'),
            previa: <CamadaFundo escolha={instalacao ?? doApp} parado />,
            escolher: () => definir({ tipo: 'instalacao' })
          }
        ]
      : []),
    {
      modo: 'bioma' as const,
      rotulo: t('escolherFundo.bioma'),
      previa: (
        <ArteDoBioma
          bioma={daInstalacao?.tipo === 'bioma' ? daInstalacao.bioma : biomaApp}
          className="absolute inset-0 h-full w-full"
        />
      ),
      escolher: () => daInstalacao?.tipo !== 'bioma' && definir({ tipo: 'bioma', bioma: biomaApp })
    },
    {
      modo: 'imagem' as const,
      rotulo: t('escolherFundo.imagem2'),
      previa: imagem ? (
        <CamadaFundo escolha={imagem} parado />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-panel-2 px-2 text-center text-xs text-muted">
          {t('escolherFundo.umaImagemSua')}
        </span>
      ),
      // Escolher "Imagem" sem imagem ainda só abre a lista (nada muda até escolher uma).
      escolher: () => {
        const primeira = imgs.imagens?.[0]
        if (!imagem && primeira) definir(escolhaDeImagem(primeira.nome, daInstalacao))
      }
    }
  ]

  return (
    <div className="flex w-[380px] max-w-[calc(100vw-48px)] flex-col gap-3">
      <p className="font-bold">{titulo}</p>
      <div
        role="radiogroup"
        aria-label={rotulo}
        className={`grid gap-2 ${opcoes.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}
      >
        {opcoes.map((o) => (
          <CartaoFundo
            key={o.modo}
            rotulo={o.rotulo}
            marcado={modo === o.modo}
            aoEscolher={() => {
              setModo(o.modo)
              o.escolher()
            }}
          >
            {o.previa}
          </CartaoFundo>
        ))}
      </div>
      {modo === 'app' && <p className="text-xs text-muted">{t('escolherFundo.usaOFundoDoApp')}</p>}
      {modo === 'instalacao' && (
        <p className="text-xs text-muted">{t('escolherFundo.usaOFundoDaInstalacao')}</p>
      )}
      {modo === 'bioma' && (
        <GradeBiomas
          atual={daInstalacao?.tipo === 'bioma' ? daInstalacao.bioma : null}
          aoEscolher={(b) => definir({ tipo: 'bioma', bioma: b })}
          pequeno
        />
      )}
      {modo === 'imagem' && (
        <>
          <GradeImagens
            imagens={imgs.imagens}
            atual={imagem?.imagem ?? null}
            aoEscolher={(nome) => definir(escolhaDeImagem(nome, daInstalacao))}
            aoEscolherOutra={async () => {
              const nome = await imgs.escolher()
              if (nome) definir(escolhaDeImagem(nome, daInstalacao))
            }}
            pequeno
          />
          {imgs.erro && <MensagemErro erro={imgs.erro} />}
          {imagem && (
            <AjustesImagem
              url={urlDoFundo(imagem.imagem)}
              ajuste={imagem.ajuste}
              aoMudar={(ajuste) => definir({ ...imagem, ajuste }, false)}
            />
          )}
        </>
      )}
      <div className="flex flex-col items-start gap-1 border-t border-linha pt-3">
        {!emTodas ? null : confirmar ? (
          <div className="flex flex-col gap-2">
            <p>
              {t('escolherFundo.trocarOFundoDeTodas')}{' '}
              {daInstalacao ? t('escolherFundo.este') : t('escolherFundo.igualAoApp2')}
              {t('escolherFundo.cadaUmaPodeSerMudada')}
            </p>
            <div className="flex gap-2">
              <Botao
                tamanho="pequeno"
                variante="primario"
                onClick={() => void emTodas(daInstalacao).then(() => setConfirmar(false))}
              >
                {t('escolherFundo.usarEmTodas')}
              </Botao>
              <Botao tamanho="pequeno" onClick={() => setConfirmar(false)}>
                {t('escolherFundo.cancelar')}
              </Botao>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="text-[13px] underline hover:text-accent"
          >
            {t('escolherFundo.usarEsteFundoEmTodas')}
          </button>
        )}
        {atual && (
          <button
            type="button"
            onClick={() => {
              setModo('app')
              definir(null)
            }}
            className="text-[13px] underline hover:text-accent"
          >
            {t('escolherFundo.voltarAoFundoDoApp')}
          </button>
        )}
      </div>
    </div>
  )
}
