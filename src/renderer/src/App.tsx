import { lazy, Suspense, useEffect, useState } from 'react'
import type { AtualizacoesDisponiveis, EstadoModo, InfoServidor } from '../../shared/tipos'
import { AparenciaProvider, useAparencia, type Area } from './aparencia/useAparencia'
import { TelaAparencia } from './aparencia/TelaAparencia'
import { Assistente } from './assistente/Assistente'
import { Avisos } from './componentes/Avisos'
import {
  IconeCaptura,
  IconeConfiguracoes,
  IconeConteudo,
  IconeExplorar,
  IconeInstalacoes,
  IconeLigar,
  IconeServidor
} from './componentes/icones'
import { animacoesReduzidas } from './componentes/movimento'
import { EstadoVazio, PaginaAjustes } from './componentes/ui'
import { TelaArquivos } from './arquivos/TelaArquivos'
import { TelaConexao } from './conexao/TelaConexao'
import { TelaConvites } from './conexao/TelaConvites'
import { TelaConfiguracoes } from './configuracoes/TelaConfiguracoes'
import { BarraLateral, type Pagina, type PaginaPlay } from './estrutura/BarraLateral'
import { FundoDoApp } from './fundo/Fundo'
import { BoasVindas } from './estrutura/BoasVindas'
import { Cabecalho } from './estrutura/Cabecalho'
import {
  EVENTO_ABRIR,
  EVENTO_AREA,
  EVENTO_CRIAR_MODPACK,
  irPara,
  EVENTO_MODO,
  guardarConviteParaColar,
  type PedidoDeArea
} from './estrutura/navegar'
import type { Fonte } from '../../shared/fontes'
import { ListaDoServidor } from './configuracoes/Whitelist'
import { TelaJogadores } from './jogadores/TelaJogadores'
import { TelaAutomacao } from './automacao/TelaAutomacao'
import { TelaDesempenho } from './desempenho/TelaDesempenho'
import { TelaCelular } from './integracoes/TelaCelular'
import { TelaMods } from './mods/TelaMods'
import { DownloadsNecessarios } from './mods/DownloadsNecessarios'
import { TelaMundos } from './mundos/TelaMundos'
import { TelaRegistro } from './registro/TelaRegistro'
import { useEstadoServidor } from './servidor/comandos'
import { TelaServidor } from './servidor/TelaServidor'
import { CriarModpack } from './servidores/CriarModpack'
import { IntegracaoCurseForge } from './configuracoes/IntegracaoCurseForge'
import { TelaComandos } from './comandos/TelaComandos'
import { TelaServidores } from './servidores/TelaServidores'
import { TelaSoftware } from './software/TelaSoftware'
import { TelaInstalacoes } from './playsquare/TelaInstalacoes'
import { TelaJogar } from './playsquare/TelaJogar'
import { TelaServidoresJogo } from './playsquare/TelaServidoresJogo'
import { TelaCapturas } from './playsquare/TelaCapturas'
import { TelaAjustesJogo, TelaDoJogo } from './playsquare/ConteudoDoJogo'

// Título e abas de cada tela (DESIGN.md, seção 6.2). "inicial" é a aba que abre primeiro.
const ABAS: Record<Pagina, { titulo: string; abas: readonly string[]; inicial?: string }> = {
  Servidores: { titulo: 'Servidores', abas: [] },
  Painel: { titulo: 'Servidor', abas: [] },
  Opções: { titulo: 'Opções', abas: ['Gerais', 'Integrações', 'Avançado'] },
  Console: { titulo: 'Console', abas: [] },
  Comandos: {
    titulo: 'Comandos',
    abas: ['Mundo', 'Regras do jogo', 'Jogadores', 'Itens', 'Efeitos', 'Mensagens', 'Atalhos']
  },
  'Registro de eventos': {
    titulo: 'Registro de eventos',
    abas: ['Logs', 'Relatórios de travamento', 'Ações do app']
  },
  Jogadores: {
    titulo: 'Jogadores',
    abas: ['Todos', 'Online', 'Whitelist', 'Operadores', 'Banidos', 'IPs banidos'],
    inicial: 'Online'
  },
  Software: { titulo: 'Software', abas: [] },
  Mods: {
    titulo: 'Mods',
    abas: ['Instalados', 'Explorar', 'Atualizações', 'Proibidos para jogadores']
  },
  Arquivos: { titulo: 'Arquivos', abas: [] },
  Mundos: { titulo: 'Mundos', abas: [] },
  'Cópias de segurança': { titulo: 'Cópias de segurança', abas: [] },
  Desempenho: {
    titulo: 'Desempenho',
    abas: ['Visão geral', 'Pré-gerar mundo', 'Diagnóstico', 'Mapa']
  },
  Automação: {
    titulo: 'Automação',
    abas: ['Desligar quando vazio', 'Reinício', 'Backup agendado']
  },
  Integrações: { titulo: 'Integrações', abas: ['Celular'] },
  Conexão: {
    titulo: 'Conexão',
    abas: ['playit.gg', 'Radmin VPN', 'Rede local', 'Avançado', 'Convites']
  },
  Aparência: { titulo: 'Aparência', abas: ['Tema', 'Fundo', 'Animações'] }
}

// Telas do PlaySquare (seção 6.1.2): por enquanto vazias, com o ícone da barra lateral.
const TELAS_PLAY: Record<
  Exclude<PaginaPlay, 'Aparência'>,
  (p: { className?: string }) => React.JSX.Element
> = {
  Jogar: IconeLigar,
  Instalações: IconeInstalacoes,
  Explorar: IconeExplorar,
  Conteúdo: IconeConteudo,
  Servidores: IconeServidor,
  'Capturas de tela': IconeCaptura,
  'Ajustes do jogo': IconeConfiguracoes
}

const CHAVE_RECOLHIDA = 'servsquare:barraRecolhida'

// Página /dev/componentes (vitrine do DESIGN.md), só em desenvolvimento: fora dele o import some do build.
const Galeria = import.meta.env.DEV ? lazy(() => import('./componentes/Galeria')) : null

function App(): React.JSX.Element {
  return (
    <AparenciaProvider>
      <FundoDoApp />
      {Galeria && (location.pathname === '/dev/componentes' || location.hash === '#galeria') ? (
        <Suspense>
          <Galeria />
        </Suspense>
      ) : (
        <Janela />
      )}
    </AparenciaProvider>
  )
}

function lerRecolhida(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDA) === '1'
  } catch {
    return false
  }
}

function Janela(): React.JSX.Element {
  const [pagina, setPagina] = useState<Pagina>('Painel')
  const { area, setArea } = useAparencia()
  // O PlaySquare abre na tela Jogar e lembra a última tela enquanto o app está aberto.
  const [paginaPlay, setPaginaPlay] = useState<PaginaPlay>('Jogar')
  const [abaAparenciaPlay, setAbaAparenciaPlay] = useState(ABAS.Aparência.abas[0])
  // A transição de área só roda depois da primeira troca, não ao abrir o app.
  const [animarArea, setAnimarArea] = useState(false)
  const [areaVista, setAreaVista] = useState<Area>(area)
  const saindoArea = areaVista !== area
  useEffect(() => {
    if (!saindoArea) return
    const timer = setTimeout(() => setAreaVista(area), animacoesReduzidas() ? 0 : 100)
    return () => clearTimeout(timer)
  }, [saindoArea, area])
  // Lembra a aba escolhida em cada tela enquanto o app está aberto.
  const [abas, setAbas] = useState<Record<Pagina, string>>(
    () =>
      Object.fromEntries(
        Object.entries(ABAS).map(([p, a]) => [p, a.inicial ?? a.abas[0] ?? ''])
      ) as Record<Pagina, string>
  )
  const [versao, setVersao] = useState('')
  // undefined: ainda verificando; null: primeira vez, mostra o assistente.
  const [info, setInfo] = useState<InfoServidor | null | undefined>(undefined)
  const [novidades, setNovidades] = useState<Partial<Record<Pagina, boolean>>>({})
  const [alertaBackups, setAlertaBackups] = useState<string | null>(null)
  const [recolhida, setRecolhida] = useState(lerRecolhida)
  // "+ Criar" da tela Servidores abre o assistente por cima de tudo.
  const [criando, setCriando] = useState<false | 'zero' | 'modpack'>(false)
  // Explorar › Modpacks › "Criar servidor com este modpack" já chega com o pack escolhido.
  const [packInicial, setPackInicial] = useState<{ id: string; fonte: Fonte } | undefined>(
    undefined
  )
  const { estado, comErro } = useEstadoServidor()
  const [atualizacoes, setAtualizacoes] = useState<AtualizacoesDisponiveis | null>(null)

  // Selos de atualização em Software e Mods (Fase 21); somem quando a atualização acontece.
  useEffect(() => {
    window.api.lerAtualizacoes().then((r) => r.ok && setAtualizacoes(r.valor))
    return window.api.aoMudarAtualizacoes(setAtualizacoes)
  }, [])

  // Fase P5: atalhos entre as áreas e o atalho da área de trabalho (abre o Jogar da instalação).
  // "navegacao" remonta a tela, para ela ler a instalação escolhida de novo.
  const [navegacao, setNavegacao] = useState(0)
  useEffect(() => {
    const ir = (e: Event): void => {
      const { area: nova, pagina: p } = (e as CustomEvent<PedidoDeArea>).detail
      setAnimarArea(true)
      setArea(nova)
      if (nova === 'play') setPaginaPlay(p as PaginaPlay)
      else {
        escolherPagina(p as Pagina)
        // O atalho pode ter trocado o servidor ativo: a barra lateral relê.
        window.api.servidorAtual().then((r) => r.ok && r.valor && setInfo(r.valor))
      }
      setNavegacao((n) => n + 1)
    }
    const jogar = (id: string): void => irPara({ area: 'play', pagina: 'Jogar', instalacaoId: id })
    window.addEventListener(EVENTO_AREA, ir)
    window.api.pedidoInicial().then((id) => id && jogar(id))
    const parar = window.api.aoAbrirJogar(jogar)
    // Convite aberto com o app já aberto (Fase M6): Instalações com ele colado.
    const pararConvite = window.api.aoConvite((texto) => {
      guardarConviteParaColar(texto)
      irPara({ area: 'play', pagina: 'Instalações' })
    })
    return () => {
      window.removeEventListener(EVENTO_AREA, ir)
      parar()
      pararConvite()
    }
  }, [setArea])

  // Modo do app (Fase M6): boas-vindas na primeira vez; no amigo, só o PlaySquare.
  const [modoApp, setModoApp] = useState<EstadoModo | undefined>(undefined)
  useEffect(() => {
    window.api.estadoModo().then((r) => {
      if (!r.ok) return setModoApp({ modo: 'completo', sugerirAmigo: false, convite: null })
      setModoApp(r.valor)
      // Já escolhido e aberto por um convite: Instalações com ele colado.
      if (r.valor.modo && r.valor.convite) {
        guardarConviteParaColar(r.valor.convite)
        irPara({ area: 'play', pagina: 'Instalações' })
      }
    })
    const mudou = (e: Event): void => {
      const novo = (e as CustomEvent<EstadoModo>).detail
      setModoApp(novo)
      // Trocar de modo usa a mesma transição da troca de área.
      irPara({
        area: novo.modo === 'amigo' ? 'play' : 'serv',
        pagina: novo.modo === 'amigo' ? 'Ajustes do jogo' : 'Painel'
      })
    }
    window.addEventListener(EVENTO_MODO, mudou)
    return () => window.removeEventListener(EVENTO_MODO, mudou)
  }, [])
  const amigo = modoApp?.modo === 'amigo'
  useEffect(() => {
    if (amigo) setArea('play')
  }, [amigo, setArea])

  // Outras telas pedem para abrir uma página (ex.: o card de atualizações do Painel).
  useEffect(() => {
    const abrir = (e: Event): void => {
      const { pagina: p, aba } = (e as CustomEvent<{ pagina: Pagina; aba?: string }>).detail
      escolherPagina(p, aba)
    }
    window.addEventListener(EVENTO_ABRIR, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR, abrir)
  }, [])

  useEffect(() => {
    const criar = (e: Event): void => {
      setPackInicial((e as CustomEvent<{ id: string; fonte: Fonte }>).detail)
      setCriando('modpack')
    }
    window.addEventListener(EVENTO_CRIAR_MODPACK, criar)
    return () => window.removeEventListener(EVENTO_CRIAR_MODPACK, criar)
  }, [])

  useEffect(() => {
    window.api.versaoDoApp().then(setVersao)
    // Se der erro ao ler, segue para o app: a tela do Painel mostra o erro com "Ver detalhes".
    window.api.servidorAtual().then((r) => setInfo(r.ok ? r.valor : undefined))
  }, [])

  // Selo ⚠ em Cópias de segurança: o último backup falhou ou ainda não há nenhum (seção 6.1).
  useEffect(() => {
    const ver = (): void => {
      window.api.alertaBackups().then((r) => setAlertaBackups(r.ok ? r.valor : null))
    }
    ver()
    return window.api.aoMudarBackups(ver)
  }, [])

  // Quadradinho de novidade em Jogadores quando alguém entra e o usuário está em outra tela.
  useEffect(
    () =>
      window.api.aoAvisoJogador((aviso) => {
        if (aviso.tipo === 'entrou') setNovidades((n) => ({ ...n, Jogadores: true }))
      }),
    []
  )

  function escolherPagina(p: Pagina, aba?: string): void {
    setPagina(p)
    if (aba) setAbas((a) => ({ ...a, [p]: aba }))
    setNovidades((n) => ({ ...n, [p]: false }))
  }

  function alternarRecolhida(): void {
    setRecolhida((r) => {
      try {
        localStorage.setItem(CHAVE_RECOLHIDA, r ? '0' : '1')
      } catch {
        // sem armazenamento: só não lembra na próxima vez
      }
      return !r
    })
  }

  if (modoApp === undefined) return <div className="h-screen" />
  if (modoApp.modo === null) {
    return (
      <BoasVindas
        sugerirAmigo={modoApp.sugerirAmigo}
        temConvite={!!modoApp.convite}
        aoEscolher={async (modo) => {
          const r = await window.api.escolherModoApp(modo)
          if (!r.ok) return r.erro
          setModoApp(r.valor)
          if (modo === 'amigo' && modoApp.convite) {
            guardarConviteParaColar(modoApp.convite)
            setPaginaPlay('Instalações')
          }
          return null
        }}
      />
    )
  }

  // Modo amigo (Fase M6): sem servidor não abre o assistente; fica no PlaySquare.
  if ((info === null && !amigo) || criando) {
    return (
      // O assistente não tem barra lateral e usa só o fundo --bg-app (seção 6.10).
      <div className="flex h-screen overflow-clip bg-app text-texto">
        {criando === 'modpack' ? (
          <CriarModpack
            projetoInicial={packInicial}
            aoConcluir={() => location.reload()}
            aoCancelar={() => {
              setPackInicial(undefined)
              setCriando(false)
            }}
          />
        ) : (
          <Assistente
            // O servidor novo vira o ativo; recarregar faz todas as telas lerem ele.
            aoConcluir={() => location.reload()}
            aoCancelar={info ? () => setCriando(false) : undefined}
          />
        )}
      </div>
    )
  }

  function trocarArea(nova: Area): void {
    setAnimarArea(true)
    setArea(nova)
  }

  // A aba e a cor da área trocam na hora; a barra lateral e o conteúdo saem com fade de 100ms e
  // só então a área nova entra deslizando (a mesma ideia da troca de página, seção 8).
  const play = areaVista === 'play'
  const aba = play ? (paginaPlay === 'Aparência' ? abaAparenciaPlay : '') : abas[pagina]
  const cabecalho = play
    ? paginaPlay === 'Aparência'
      ? ABAS.Aparência
      : { titulo: paginaPlay, abas: [] }
    : ABAS[pagina]
  const animacaoArea = saindoArea ? 'anim-area-saindo' : animarArea ? `anim-area-${areaVista}` : ''
  return (
    <div className="flex h-screen bg-app text-texto">
      <BarraLateral
        area={areaVista}
        areaEscolhida={area}
        saindo={saindoArea}
        aoTrocarArea={trocarArea}
        animarArea={animarArea}
        info={info ?? null}
        estado={estado}
        comErro={comErro}
        pagina={play ? paginaPlay : pagina}
        aba={aba}
        aoEscolher={play ? setPaginaPlay : escolherPagina}
        novidades={
          play
            ? {}
            : {
                ...(pagina === 'Jogadores' ? {} : novidades),
                Software: !!(atualizacoes?.build || atualizacoes?.minecraft),
                Mods: !!(atualizacoes?.mods || atualizacoes?.modpack)
              }
        }
        alertas={!play && alertaBackups ? { 'Cópias de segurança': alertaBackups } : {}}
        versao={versao}
        recolhida={recolhida}
        aoRecolher={alternarRecolhida}
        semTrocaDeArea={amigo}
      />
      {/* key={area}: trocar de área remonta o conteúdo com a transição de área, não a de página. */}
      <div
        key={`${areaVista}-${navegacao}`}
        className={`flex min-w-0 flex-1 flex-col ${animacaoArea}`}
      >
        <Cabecalho
          titulo={cabecalho.titulo}
          abas={cabecalho.abas}
          aba={aba}
          aoEscolher={(nova) => (play ? setAbaAparenciaPlay(nova) : escolherPagina(pagina, nova))}
          // A faixa de CPU e RAM do servidor é do ServSquare.
          estado={play ? 'desligado' : estado}
        />
        {play ? (
          <Conteudo
            pagina={paginaPlay}
            aba={aba}
            tela={(p, a) =>
              p === 'Aparência' ? (
                <TelaAparencia aba={a} />
              ) : p === 'Jogar' ? (
                <TelaJogar />
              ) : p === 'Instalações' ? (
                <TelaInstalacoes />
              ) : p === 'Explorar' || p === 'Conteúdo' ? (
                <TelaDoJogo key={p} tela={p} />
              ) : p === 'Servidores' ? (
                <TelaServidoresJogo />
              ) : p === 'Capturas de tela' ? (
                <TelaCapturas />
              ) : p === 'Ajustes do jogo' ? (
                <TelaAjustesJogo />
              ) : (
                <EmBreve icone={iconeDaTelaPlay(p as PaginaPlay)} titulo={p} />
              )
            }
          />
        ) : (
          <Conteudo
            pagina={pagina}
            aba={aba}
            tela={(p, a) => (
              <Tela
                pagina={p as Pagina}
                aba={a}
                aoCriar={setCriando}
                aoAbrirPainel={() => escolherPagina('Painel')}
                aoAbrirAba={(nova) => escolherPagina(pagina, nova)}
              />
            )}
          />
        )}
      </div>
      {/* No Painel os avisos ficam dentro do banner. */}
      {(play || pagina !== 'Painel') && <Avisos />}
      <DownloadsNecessarios />
    </div>
  )
}

// Troca de página (seção 8): o conteúdo antigo sai com fade de 100 ms e o novo entra com
// fade + 8px. A barra lateral e o cabeçalho não se mexem.
// A primeira tela de cada área não anima (a troca de área já anima): só as trocas seguintes.
function useTrocaDePagina(chave: string): { exibida: string; saindo: boolean; trocou: boolean } {
  const [exibida, setExibida] = useState(chave)
  const [trocou, setTrocou] = useState(false)
  const saindo = exibida !== chave
  useEffect(() => {
    if (!saindo) return
    const timer = setTimeout(
      () => {
        setExibida(chave)
        setTrocou(true)
      },
      animacoesReduzidas() ? 0 : 100
    )
    return () => clearTimeout(timer)
  }, [saindo, chave])
  return { exibida, saindo, trocou }
}

interface AcoesTela {
  aoCriar: (modo: 'zero' | 'modpack') => void
  aoAbrirPainel: () => void
  aoAbrirAba: (aba: string) => void
}

function iconeDaTelaPlay(p: PaginaPlay): React.ReactNode {
  const Icone = TELAS_PLAY[p as Exclude<PaginaPlay, 'Aparência'>]
  return <Icone />
}

function Conteudo({
  pagina,
  aba,
  tela
}: {
  pagina: string
  aba: string
  tela: (pagina: string, aba: string) => React.ReactNode
}): React.JSX.Element {
  const { exibida, saindo, trocou } = useTrocaDePagina(`${pagina}|${aba}`)
  const [paginaVista, abaVista] = exibida.split('|') as [string, string]
  return (
    // overflow-clip (e não hidden): o navegador não consegue rolar este contêiner sozinho ao focar algo.
    <main className="vidro-painel relative m-2.5 flex min-h-0 flex-1 flex-col overflow-clip">
      <div
        key={exibida}
        className={`relative flex min-h-0 flex-1 flex-col ${saindo ? 'anim-pagina-saindo' : trocou ? 'anim-pagina' : ''}`}
      >
        {tela(paginaVista, abaVista)}
      </div>
    </main>
  )
}

// Telas que ainda não existem mostram "Em breve" (seção 6.23).
function EmBreve({
  icone,
  titulo,
  children
}: {
  icone: React.ReactNode
  titulo: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <PaginaAjustes>
      <EstadoVazio
        icone={icone}
        titulo={titulo}
        texto="Em breve. Esta parte chega numa próxima versão do HubSquare."
      >
        {children}
      </EstadoVazio>
    </PaginaAjustes>
  )
}

function Tela({
  pagina,
  aba,
  aoCriar,
  aoAbrirPainel,
  aoAbrirAba
}: {
  pagina: Pagina
  aba: string
} & AcoesTela): React.JSX.Element {
  switch (pagina) {
    case 'Servidores':
      return <TelaServidores aoCriar={aoCriar} aoAbrirPainel={aoAbrirPainel} />
    case 'Painel':
      return <TelaServidor aba="Painel" />
    case 'Opções':
      return aba === 'Gerais' ? (
        <TelaConfiguracoes aba="Gerais" />
      ) : aba === 'Integrações' ? (
        <PaginaAjustes>
          <IntegracaoCurseForge />
        </PaginaAjustes>
      ) : (
        <EmBreve icone={<IconeConfiguracoes />} titulo="Opções avançadas" />
      )
    case 'Console':
      return <TelaServidor aba="Console" />
    case 'Comandos':
      return <TelaComandos key={aba} aba={aba} />
    case 'Registro de eventos':
      return <TelaRegistro key={aba} aba={aba} />
    case 'Jogadores':
      if (aba === 'Todos' || aba === 'Online') {
        return <TelaJogadores aba={aba} aoAbrirAba={aoAbrirAba} />
      }
      if (aba === 'Whitelist') return <TelaConfiguracoes aba="Whitelist" />
      return (
        <PaginaAjustes>
          <ListaDoServidor
            key={aba}
            lista={aba === 'Operadores' ? 'ops' : aba === 'Banidos' ? 'banidos' : 'ipsBanidos'}
          />
        </PaginaAjustes>
      )
    case 'Software':
      return <TelaSoftware />
    case 'Mods':
      return <TelaMods aba={aba} />
    case 'Arquivos':
      return <TelaArquivos />
    case 'Mundos':
      return <TelaMundos />
    case 'Cópias de segurança':
      return <TelaServidor aba="Backups" />
    case 'Desempenho':
      return <TelaDesempenho aba={aba} />
    case 'Automação':
      return <TelaAutomacao aba={aba} />
    case 'Integrações':
      return <TelaCelular />
    case 'Conexão':
      return aba === 'Convites' ? <TelaConvites /> : <TelaConexao aba={aba} />
    case 'Aparência':
      return <TelaAparencia aba={aba} />
  }
}

export default App
