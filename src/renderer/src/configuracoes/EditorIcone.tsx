import { useEffect, useRef, useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { IconeDoServidor } from '../componentes/IconeDoServidor'
import { MensagemErro } from '../componentes/MensagemErro'
import { Botao, Dialogo, Slider } from '../componentes/ui'
import { avisarIconeMudou } from '../estrutura/navegar'

const LADO = 256 // área de recorte na tela
const SAIDA = 64 // server-icon.png

interface Recorte {
  img: HTMLImageElement
  zoom: number // 1 = a imagem cobre o quadrado inteiro
  x: number // deslocamento do centro, em px da área de recorte
  y: number
}

// Mantém a imagem cobrindo o quadrado todo (sem bordas vazias).
function limitar(r: Recorte): Recorte {
  const escala = Math.max(LADO / r.img.width, LADO / r.img.height) * r.zoom
  const folgaX = Math.max(0, (r.img.width * escala - LADO) / 2)
  const folgaY = Math.max(0, (r.img.height * escala - LADO) / 2)
  return {
    ...r,
    x: Math.max(-folgaX, Math.min(folgaX, r.x)),
    y: Math.max(-folgaY, Math.min(folgaY, r.y))
  }
}

function desenhar(ctx: CanvasRenderingContext2D, r: Recorte, lado: number): void {
  const fator = lado / LADO
  const escala = Math.max(LADO / r.img.width, LADO / r.img.height) * r.zoom * fator
  const w = r.img.width * escala
  const h = r.img.height * escala
  ctx.clearRect(0, 0, lado, lado)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(r.img, (lado - w) / 2 + r.x * fator, (lado - h) / 2 + r.y * fator, w, h)
}

// Ícone do servidor (Opções › Gerais). Salva na hora, separado do botão Salvar da tela.
export function EditorIcone({ nome }: { nome: string }): React.JSX.Element {
  const [icone, setIcone] = useState<string | null>(null)
  const [recorte, setRecorte] = useState<Recorte | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const arrasto = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    window.api.lerIcone().then((r) => r.ok && setIcone(r.valor))
  }, [])

  useEffect(() => {
    const ctx = tela.current?.getContext('2d')
    if (ctx && recorte) desenhar(ctx, recorte, LADO)
  }, [recorte])

  function escolher(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      return setErro({
        mensagem: 'Esse arquivo não é uma imagem. Escolha um PNG ou JPG.',
        detalhes: f.name
      })
    }
    const leitor = new FileReader()
    leitor.onload = () => {
      const img = new Image()
      img.onload = () => setRecorte({ img, zoom: 1, x: 0, y: 0 })
      img.onerror = () =>
        setErro({ mensagem: 'Não consegui abrir essa imagem. Tente outra.', detalhes: f.name })
      img.src = String(leitor.result)
    }
    leitor.readAsDataURL(f)
  }

  async function salvar(): Promise<void> {
    if (!recorte) return
    const c = document.createElement('canvas')
    c.width = SAIDA
    c.height = SAIDA
    const ctx = c.getContext('2d')
    if (!ctx) return
    desenhar(ctx, recorte, SAIDA)
    setOcupado(true)
    setErro(null)
    const r = await window.api.salvarIcone(c.toDataURL('image/png'))
    setOcupado(false)
    if (!r.ok) return setErro(r.erro)
    setIcone(r.valor)
    setRecorte(null)
    avisarIconeMudou()
  }

  async function remover(): Promise<void> {
    setRemovendo(false)
    const r = await window.api.removerIcone()
    if (!r.ok) return setErro(r.erro)
    setIcone(null)
    avisarIconeMudou()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <IconeDoServidor icone={icone} nome={nome} tam={64} />
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => arquivo.current?.click()}>Escolher imagem</Botao>
          {icone && (
            <Botao variante="perigo" onClick={() => setRemovendo(true)}>
              Remover ícone
            </Botao>
          )}
        </div>
        <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={escolher} />
      </div>
      <p className="text-xs text-muted">
        Aparece na lista de servidores do jogo (64×64). O app recorta a imagem em quadrado.
      </p>
      {erro && <MensagemErro erro={erro} />}

      <Dialogo
        aberto={!!recorte}
        titulo="Recortar o ícone"
        aoCancelar={() => !ocupado && setRecorte(null)}
        acao={{ rotulo: ocupado ? 'Salvando...' : 'Usar este ícone', ocupado, aoClicar: salvar }}
      >
        <div className="flex flex-col items-center gap-3">
          <canvas
            ref={tela}
            width={LADO}
            height={LADO}
            aria-label="Área de recorte: arraste para mover"
            className="cursor-grab touch-none border border-linha bg-panel-2 active:cursor-grabbing"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              arrasto.current = { x: e.clientX, y: e.clientY }
            }}
            onPointerMove={(e) => {
              const a = arrasto.current
              if (!a || !recorte) return
              arrasto.current = { x: e.clientX, y: e.clientY }
              setRecorte(
                limitar({
                  ...recorte,
                  x: recorte.x + e.clientX - a.x,
                  y: recorte.y + e.clientY - a.y
                })
              )
            }}
            onPointerUp={() => (arrasto.current = null)}
            onWheel={(e) =>
              recorte &&
              setRecorte(
                limitar({
                  ...recorte,
                  zoom: Math.max(1, Math.min(4, recorte.zoom - e.deltaY / 500))
                })
              )
            }
          />
          {recorte && (
            <div className="w-full">
              <Slider
                rotulo="Zoom"
                valor={recorte.zoom}
                min={1}
                max={4}
                passo={0.05}
                aoMudar={(z) => setRecorte(limitar({ ...recorte, zoom: z }))}
                formatar={(z) => `${Math.round(z * 100)}%`}
              />
            </div>
          )}
          <p className="text-xs text-muted">Arraste a imagem para escolher a parte que aparece.</p>
        </div>
      </Dialogo>

      <Dialogo
        aberto={removendo}
        titulo="Remover o ícone?"
        aoCancelar={() => setRemovendo(false)}
        acao={{ rotulo: 'Remover', variante: 'perigo', aoClicar: remover }}
      >
        <p>O servidor volta a aparecer sem ícone na lista do jogo.</p>
      </Dialogo>
    </div>
  )
}
