import { voltouDoIdioma } from '../idioma'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ajustarContraste, amostrarImagem, aplicarAccent, aplicarBioma } from './tema'
import { ARTE, LOGO } from '../fundo/biomas'
import { definirModo } from '../fundo/pausa'
import { modoInicial } from '../../../shared/animacaoRegras'
import { hex, luminancia, rgbDeTexto, superficies, type Rgb } from '../../../shared/contrasteRegras'
import {
  OFICIAIS,
  VARIAVEIS,
  nomeDaLogo,
  paletaDaLogo,
  type PaletaLogo
} from '../../../shared/logoCoresRegras'
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
  // Fase V10: o fundo atrás das telas agora: o do servidor (nas telas dele) ou o do app.
  fundoVigente: EscolhaFundo | null
  // O fundo próprio da tela aberta (o do servidor ativo no ServSquare); null: vale o do app.
  definirFundoTela: (escolha: EscolhaFundo | null) => void
  // Fase V11: modo vitrine (Jogar e Painel sem o painel por cima do fundo), lembrado por área.
  vitrine: boolean
  definirVitrine: (ligada: boolean) => void
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
  // A paleta da logo que acompanha o fundo de agora (a prévia mostra mesmo com "Oficiais").
  paletaFundo: PaletaLogo
}

const Contexto = createContext<ContextoAparencia | null>(null)

const chaveVitrine = (a: Area): string => `hubsquare:vitrine:${a}`
function lerVitrine(a: Area): boolean {
  try {
    return localStorage.getItem(chaveVitrine(a)) === '1'
  } catch {
    return false // sem armazenamento: começa com o painel
  }
}

// Carrega as preferências ao abrir o app e aplica a cor de destaque (com hover e sombra calculados).
// O tema claro/escuro o processo principal já aplicou antes de a janela abrir.
const CHAVE_AREA = 'hubsquare:area'
function lerAreaDaSessao(): Area {
  try {
    return sessionStorage.getItem(CHAVE_AREA) === 'play' ? 'play' : 'serv'
  } catch {
    return 'serv'
  }
}

export function AparenciaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [aparencia, setAparencia] = useState<Aparencia | null>(null)
  const [fundoAntigo, setFundoAntigo] = useState<string | null>(null)
  const [falhou, setFalhou] = useState<string | null>(null) // nome da imagem que não abriu
  const [avisosFundo, setAvisosFundo] = useState<string[]>([])
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [erro, setErro] = useState<ErroTela | null>(null)
  // Fase I1: depois de trocar o idioma a tela recarrega e volta para a mesma área.
  const [area, setArea] = useState<Area>(() => (voltouDoIdioma ? lerAreaDaSessao() : 'serv'))
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_AREA, area)
    } catch {
      // sem armazenamento: volta para o ServSquare
    }
  }, [area])
  const [fundoTela, setFundoTela] = useState<EscolhaFundo | null>(null)
  const [vitrines, setVitrines] = useState(() => ({
    serv: lerVitrine('serv'),
    play: lerVitrine('play')
  }))
  function definirVitrine(ligada: boolean): void {
    setVitrines((v) => ({ ...v, [area]: ligada }))
    try {
      localStorage.setItem(chaveVitrine(area), ligada ? '1' : '0')
    } catch {
      // sem armazenamento: só não lembra na próxima abertura
    }
  }
  const salvarDepois = useRef<NodeJS.Timeout | undefined>(undefined)
  const [paletaFundo, setPaletaFundo] = useState<PaletaLogo>(OFICIAIS)
  // As cores do nome na barra lateral (mesmo tom das faces, 4,5:1); null: as oficiais do nome.
  const [nomeFundo, setNomeFundo] = useState<{ hub: string; square: string } | null>(null)

  useEffect(() => {
    window.api.lerAparencia().then((r) => (r.ok ? setAparencia(r.valor) : setErro(r.erro)))
    window.api.lerFundo().then((r) => r.ok && setFundoAntigo(r.valor))
    window.api.avisosDeFundo().then(setAvisosFundo)
    window.api.listarScreenshots().then((r) => r.ok && setScreenshots(r.valor))
  }, [])

  // O fundo do app que vale agora: a imagem que não abriu fica de fora (vale o bioma).
  const semFalha = (e: EscolhaFundo | null): EscolhaFundo | null =>
    e?.tipo === 'imagem' && e.imagem === falhou ? null : e
  const fundoApp = semFalha(aparencia?.fundoApp ?? null)
  // Fase V10: nas telas de um servidor com fundo próprio, ele vem antes do fundo do app.
  const escolhido = fundoTela ?? aparencia?.fundoApp ?? null
  const fundoVigente = semFalha(escolhido)
  const imagemVigente = fundoVigente?.tipo === 'imagem' ? fundoVigente : null
  const fundoUrl = imagemVigente ? urlDoFundo(imagemVigente.imagem) : fundoTela ? null : fundoAntigo

  // Bioma, cor de destaque da área e contraste (o vidro fica mais opaco se o fundo pedir).
  // Fase V4: sobre uma imagem, o tom do vidro (claro ou escuro) sai da luz da imagem.
  useEffect(() => {
    if (!aparencia) return
    let ativo = true
    const e = fundoTela ?? aparencia.fundoApp
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
        : fundoTela?.tipo === 'bioma'
          ? fundoTela.bioma // Fase V10: o bioma do servidor também dá o tom do vidro
          : aparencia.bioma
      aplicarBioma(bioma, aparencia.vidroLeve)
      const accent = aplicarAccent(area === 'play' ? aparencia.destaquePlay : aparencia.destaque)
      const fundos = amostra.length ? amostra : ARTE[bioma].paleta.map(hex)
      ajustarContraste(fundos, accent)
      // Logo e nome: o vidro da barra lateral sobre este fundo (para o contraste do nome).
      const estilo = getComputedStyle(document.documentElement)
      const sobre = superficies(
        { cores: [rgbDeTexto(estilo.getPropertyValue('--vidro-rgb'))], textos: [] },
        Number(estilo.getPropertyValue('--vidro-alfa')),
        fundos
      )
      // As cores da cena do bioma; imagem do usuário não tem paleta própria (cores oficiais).
      const cena = imagemApp ? null : LOGO[bioma]
      const paleta = paletaDaLogo({ modo: 'fundo', cena })
      setPaletaFundo(paleta)
      setNomeFundo(cena ? nomeDaLogo(paleta, sobre) : null)
    })
    return () => {
      ativo = false
    }
  }, [aparencia, area, falhou, fundoTela])

  // Cores da logo dentro do app: com "Oficiais", as variáveis saem e vale o padrão do SVG.
  const coresLogo = aparencia?.coresLogo
  useEffect(() => {
    const raiz = document.documentElement
    for (const [k, v] of Object.entries(VARIAVEIS)) {
      if (coresLogo === 'fundo') raiz.style.setProperty(v, paletaFundo[k as keyof PaletaLogo])
      else raiz.style.removeProperty(v)
    }
    const nome = coresLogo === 'fundo' ? nomeFundo : null
    for (const [v, cor] of [
      ['--logo-nome-hub', nome?.hub],
      ['--logo-nome-square', nome?.square]
    ] as const) {
      if (cor) raiz.style.setProperty(v, cor)
      else raiz.style.removeProperty(v)
    }
  }, [paletaFundo, nomeFundo, coresLogo])

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
        fundoVigente,
        definirFundoTela: setFundoTela,
        vitrine: vitrines[area],
        definirVitrine,
        imagemFalhou: () => imagemVigente && setFalhou(imagemVigente.imagem),
        falhou: !!falhou && escolhido?.tipo === 'imagem' && escolhido.imagem === falhou,
        avisosFundo,
        fecharAvisosFundo: () => setAvisosFundo([]),
        screenshots,
        windowsReduzAnimacoes,
        erro,
        mudar,
        usarScreenshot,
        paletaFundo
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
