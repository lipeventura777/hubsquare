import { useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { idiomaAtual, t, TEXTOS, type Idioma } from '../../../shared/i18n'
import { MensagemErro } from '../componentes/MensagemErro'
import { CardPainel } from '../componentes/paineis'
import { Botao } from '../componentes/ui'

// Fase I1: dois cartões grandes, um por idioma. O nome de cada idioma fica sempre na própria
// língua, para quem trocou sem querer achar o caminho de volta.
const OPCOES: { idioma: Idioma; nome: string }[] = [
  { idioma: 'pt-BR', nome: 'Português (Brasil)' },
  { idioma: 'en-US', nome: 'English (US)' }
]

export function CartoesIdioma({
  marcado,
  ocupado,
  aoEscolher
}: {
  marcado: Idioma
  ocupado: boolean
  aoEscolher: (idioma: Idioma) => void
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={t('idioma.titulo')}
      className="grid gap-3 min-[720px]:grid-cols-2"
    >
      {OPCOES.map((o, n) => {
        const ativo = o.idioma === marcado
        return (
          <button
            key={o.idioma}
            type="button"
            role="radio"
            aria-checked={ativo}
            lang={o.idioma}
            disabled={ocupado}
            onClick={() => aoEscolher(o.idioma)}
            className={`anim-item flex min-h-[96px] flex-col justify-center gap-2 rounded-[var(--raio-item)] border-2 bg-panel p-6 text-left transition-colors duration-(--dur-fast) disabled:opacity-60 ${
              ativo ? 'border-accent' : 'border-linha hover:border-muted'
            }`}
            style={{ '--ordem': n } as React.CSSProperties}
          >
            <span className="texto-pixel text-xl">{o.nome}</span>
            {ativo && (
              <span className="self-start bg-accent px-2 py-0.5 text-xs font-bold text-accent-text">
                {t('idioma.selecionado')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Primeira abertura: escolhe o idioma antes das boas-vindas. Já vem marcado o do instalador ou,
// sem ele, o do Windows.
export function EscolherIdioma(): React.JSX.Element {
  const [marcado, setMarcado] = useState<Idioma>(idiomaAtual())
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  async function continuar(): Promise<void> {
    setOcupado(true)
    const r = await window.api.escolherIdioma(marcado)
    // Deu certo: a tela recarrega sozinha no idioma escolhido.
    if (!r.ok) {
      setOcupado(false)
      setErro(r.erro)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center p-6 text-texto">
      <div className="vidro-painel flex w-full max-w-[760px] flex-col gap-6 p-10">
        <div className="flex flex-col gap-2">
          <h1 className="texto-pixel text-[28px]">HubSquare</h1>
          <p className="text-[13px] text-muted">{t('idioma.escolhaInicial')}</p>
        </div>
        <CartoesIdioma marcado={marcado} ocupado={ocupado} aoEscolher={setMarcado} />
        <Botao
          variante="primario"
          className="self-end"
          disabled={ocupado}
          onClick={() => void continuar()}
        >
          {TEXTOS[marcado]['idioma.continuar'] as string}
        </Botao>
        {erro && <MensagemErro erro={erro} />}
      </div>
    </div>
  )
}

// Engrenagem › Idioma / Language: troca na hora, sem reiniciar.
export function AbaIdioma(): React.JSX.Element {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  async function escolher(idioma: Idioma): Promise<void> {
    if (idioma === idiomaAtual()) return
    setOcupado(true)
    const r = await window.api.escolherIdioma(idioma)
    if (!r.ok) {
      setOcupado(false)
      setErro(r.erro)
    }
  }

  return (
    <CardPainel titulo={t('idioma.titulo')}>
      <div className="flex flex-col gap-4">
        <CartoesIdioma
          marcado={idiomaAtual()}
          ocupado={ocupado}
          aoEscolher={(i) => void escolher(i)}
        />
        <p className="text-[13px] text-muted">{t('idioma.trocaNaHora')}</p>
        {erro && <MensagemErro erro={erro} />}
      </div>
    </CardPainel>
  )
}
