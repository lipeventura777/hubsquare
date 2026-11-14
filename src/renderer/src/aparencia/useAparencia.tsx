import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ajustarContraste, amostrarImagem, aplicarAccent, aplicarBioma } from './tema'
import { ARTE } from '../fundo/biomas'
import { definirModo } from '../fundo/pausa'
import { modoInicial } from '../../../shared/animacaoRegras'
import { hex, luminancia, type Rgb } from '../../../shared/contrasteRegras'
import { camadaDeLuz, tomDoVidro, urlDoFundo, type EscolhaFundo } from '../../../shared/fundoRegras'
import type { Aparencia, ErroTela, Screenshot } from '../../../shared/tipos'

// Área do app aberta agora: cada uma tem a própria cor de destaque.
export type Area = 'serv' | 'play'

interface ContextoAparencia {
  aparencia: Aparencia | null
  area: Area
  setArea: (area: Area) => void
  // Banner do Painel: a imagem do fundo do app (ou a antiga, só do banner, de antes da V4).
  fundoUrl: string | null
  // Fase V4: o fundo do app que vale agora (a imagem que não abriu volta para o bioma).
  fundoApp: EscolhaFundo | null
  imagemFalhou: () => void
  falhou: boolean
  // Avisos da migração dos fundos antigos (mostrados uma vez).
  avisosFundo: string[]
  fecharAvisosFundo: () => void
  // Prints do Minecraft (mais recentes primeiro): galeria do fundo e imagens dos cards.
  screenshots: Screenshot[]
  // O Windows pediu menos movimento: as animações ficam reduzidas mesmo com o interruptor desligado.
  windowsReduzAnimacoes: boolean
  erro: ErroTela | null
  mudar: (mudancas: Partial<Omit<Aparencia, 'fundo'>>) => void
  usarScreenshot: (nome: string) => Promise<string | null>
}

const Contexto = createContext<ContextoAparencia | null>(null)

// Carrega as preferências ao abrir o app e aplica a cor de destaque (com hover e sombra calculados).
// O tema claro/escuro o processo principal já aplicou antes de a janela abrir.
export function AparenciaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [aparencia, setAparencia] = useState<Aparencia | null>(null)
  const [fundoAntigo, setFundoAntigo] = useState<string | null>(null)
  const [falhou, setFalhou] = useState<string | null>(null) // nome da imagem que não abriu
  const [avisosFundo, setAvisosFundo] = useState<string[]>([])
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [area, setArea] = useState<Area>('serv')
  const salvarDepois = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    window.api.lerAparencia().then((r) => (r.ok ? setAparencia(r.valor) : setErro(r.erro)))
    window.api.lerFundo().then((r) => r.ok && setFundoAntigo(r.valor))
    window.api.avisosDeFundo().then(setAvisosFundo)
    window.api.listarScreenshots().then((r) => r.ok && setScreenshots(r.valor))
  }, [])

  // O fundo do app que vale agora: a imagem que não abriu fica de fora (vale o bioma).
  const escolhido = aparencia?.fundoApp ?? null
  const fundoApp = escolhido?.tipo === 'imagem' && escolhido.imagem === falhou ? null : escolhido
  const imagemApp = fundoApp?.tipo === 'imagem' ? fundoApp : null
  const fundoUrl = imagemApp ? urlDoFundo(imagemApp.imagem) : fundoAntigo

  // Bioma, cor de destaque da área e contraste (o vidro fica mais opaco se o fundo pedir).
  // Fase V4: sobre uma imagem, o tom do vidro (claro ou escuro) sai da luz da imagem.
  useEffect(() => {
    if (!aparencia) return
    let ativo = true
    const e = aparencia.fundoApp
    const imagemApp = e?.tipo === 'imagem' && e.imagem !== falhou ? e : null
    const luz = imagemApp ? camadaDeLuz(imagemApp.ajuste.luz) : null
    const camada = luz
      ? {
          cor: (luz.cor === 'preto' ? [0, 0, 0] : [255, 255, 255]) as Rgb,
          opacidade: luz.opacidade
        }
      : null
    ;(imagemApp
      ? amostrarImagem(urlDoFundo(imagemApp.imagem), camada)
      : Promise.resolve([] as Rgb[])
    ).then((amostra) => {
      if (!ativo) return
      const bioma = amostra.length
        ? tomDoVidro(amostra.reduce((t, c) => t + luminancia(c), 0) / amostra.length)
        : aparencia.bioma
      aplicarBioma(bioma, aparencia.vidroLeve)
      const accent = aplicarAccent(area === 'play' ? aparencia.destaquePlay : aparencia.destaque)
      ajustarContraste(amostra.length ? amostra : ARTE[bioma].paleta.map(hex), accent)
    })
    return () => {
      ativo = false
    }
  }, [aparencia, area, falhou])

  const windowsReduzAnimacoes = useWindowsReduzAnimacoes()
  const reduzir = windowsReduzAnimacoes || !!aparencia?.reduzirAnimacoes
  useEffect(() => {
    document.documentElement.toggleAttribute('data-reduzir-animacoes', reduzir)
  }, [reduzir])

  // Animação do fundo (Fase V2): a escolhida, ou leve quando o Windows (ou o app) pede menos movimento.
  useEffect(() => {
    if (aparencia) definirModo(modoInicial(aparencia.animacaoFundo, reduzir))
  }, [aparencia, reduzir])

  function mudar(mudancas: Partial<Omit<Aparencia, 'fundo'>>): void {
    if (!aparencia) return
    const nova = { ...aparencia, ...mudancas }
    setAparencia(nova) // aparece na hora
    // Salva só quando o usuário para de mexer (a barra e o seletor de cor mudam muito rápido).
    clearTimeout(salvarDepois.current)
    salvarDepois.current = setTimeout(async () => {
      const r = await window.api.salvarAparencia(nova)
      setErro(r.ok ? null : r.erro)
    }, 300)
  }

  // Print do jogo: guardado na pasta de fundos; devolve o nome para a tela usar.
  async function usarScreenshot(nome: string): Promise<string | null> {
    const r = await window.api.usarScreenshotComoFundo(nome)
    if (!r.ok) {
      setErro(r.erro)
      return null
    }
    setErro(null)
    return r.valor
  }

  return (
    <Contexto.Provider
      value={{
        aparencia,
        area,
        setArea,
        fundoUrl,
        fundoApp,
        imagemFalhou: () => imagemApp && setFalhou(imagemApp.imagem),
        falhou: !!falhou && escolhido?.tipo === 'imagem' && escolhido.imagem === falhou,
        avisosFundo,
        fecharAvisosFundo: () => setAvisosFundo([]),
        screenshots,
        windowsReduzAnimacoes,
        erro,
        mudar,
        usarScreenshot
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

// Acompanha o pedido do Windows de menos movimento (prefers-reduced-motion).
function useWindowsReduzAnimacoes(): boolean {
  const [pede, setPede] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const consulta = matchMedia('(prefers-reduced-motion: reduce)')
    const mudou = (): void => setPede(consulta.matches)
    consulta.addEventListener('change', mudou)
    return () => consulta.removeEventListener('change', mudou)
  }, [])
  return pede
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAparencia(): ContextoAparencia {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useAparencia precisa estar dentro do AparenciaProvider')
  return contexto
}
