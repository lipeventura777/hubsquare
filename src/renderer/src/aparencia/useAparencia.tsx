import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ajustarContraste, amostrarImagem, aplicarAccent, aplicarBioma } from './tema'
import { ARTE } from '../fundo/biomas'
import { definirModo } from '../fundo/pausa'
import { modoInicial } from '../../../shared/animacaoRegras'
import { hex } from '../../../shared/contrasteRegras'
import type { Aparencia, ErroTela, Screenshot } from '../../../shared/tipos'

// Área do app aberta agora: cada uma tem a própria cor de destaque.
export type Area = 'serv' | 'play'

interface ContextoAparencia {
  aparencia: Aparencia | null
  area: Area
  setArea: (area: Area) => void
  fundoUrl: string | null
  // Prints do Minecraft (mais recentes primeiro): galeria do fundo e imagens dos cards.
  screenshots: Screenshot[]
  // O Windows pediu menos movimento: as animações ficam reduzidas mesmo com o interruptor desligado.
  windowsReduzAnimacoes: boolean
  erro: ErroTela | null
  mudar: (mudancas: Partial<Omit<Aparencia, 'fundo'>>) => void
  escolherFundo: () => Promise<void>
  usarScreenshot: (nome: string) => Promise<void>
  removerFundo: () => Promise<void>
}

const Contexto = createContext<ContextoAparencia | null>(null)

// Carrega as preferências ao abrir o app e aplica a cor de destaque (com hover e sombra calculados).
// O tema claro/escuro o processo principal já aplicou antes de a janela abrir.
export function AparenciaProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [aparencia, setAparencia] = useState<Aparencia | null>(null)
  const [fundoUrl, setFundoUrl] = useState<string | null>(null)
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [area, setArea] = useState<Area>('serv')
  const salvarDepois = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    window.api.lerAparencia().then((r) => (r.ok ? setAparencia(r.valor) : setErro(r.erro)))
    window.api.lerFundo().then((r) => r.ok && setFundoUrl(r.valor))
    window.api.listarScreenshots().then((r) => r.ok && setScreenshots(r.valor))
  }, [])

  // Bioma, cor de destaque da área e contraste (o vidro fica mais opaco se o fundo pedir).
  useEffect(() => {
    if (!aparencia) return
    let ativo = true
    aplicarBioma(aparencia.bioma, aparencia.vidroLeve)
    const accent = aplicarAccent(area === 'play' ? aparencia.destaquePlay : aparencia.destaque)
    const imagem = fundoUrl && aparencia.fundoEmTodoApp
    ;(imagem
      ? amostrarImagem(fundoUrl, aparencia.escurecimento)
      : Promise.resolve(ARTE[aparencia.bioma].paleta.map(hex))
    ).then((fundos) => ativo && fundos.length && ajustarContraste(fundos, accent))
    return () => {
      ativo = false
    }
  }, [aparencia, area, fundoUrl])

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

  async function trocarFundo(
    pedido: Promise<{ ok: true; valor: string | null } | { ok: false; erro: ErroTela }>
  ): Promise<void> {
    const r = await pedido
    if (!r.ok) return setErro(r.erro)
    setErro(null)
    if (r.valor) setFundoUrl(r.valor)
  }

  async function removerFundo(): Promise<void> {
    const r = await window.api.removerFundo()
    if (!r.ok) return setErro(r.erro)
    setFundoUrl(null)
  }

  return (
    <Contexto.Provider
      value={{
        aparencia,
        area,
        setArea,
        fundoUrl,
        screenshots,
        windowsReduzAnimacoes,
        erro,
        mudar,
        escolherFundo: () => trocarFundo(window.api.escolherFundo()),
        usarScreenshot: (nome) => trocarFundo(window.api.usarScreenshotComoFundo(nome)),
        removerFundo
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
