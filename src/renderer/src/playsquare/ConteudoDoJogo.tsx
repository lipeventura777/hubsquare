import { useCallback, useEffect, useState } from 'react'
import {
  AVISOS,
  NOMES_AVISOS,
  type AjustesJogo,
  type ErroTela,
  type InfoServidor,
  type LimitesRam,
  type Instalacao
} from '../../../shared/tipos'
import { ApiDaInstalacao } from '../componentes/api'
import { MensagemErro } from '../componentes/MensagemErro'
import { IconeInstalacoes } from '../componentes/icones'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import {
  Aviso,
  Botao,
  CaixaSelecao,
  Campo,
  EstadoVazio,
  PaginaAjustes,
  Secao,
  Selecao,
  Slider
} from '../componentes/ui'
import { Explorar } from '../mods/Explorar'
import { useAvisosOcultos } from '../mods/FraseCompat'
import { Instalados } from '../mods/Instalados'
import { BotaoDownloadsPendentes } from '../mods/DownloadsNecessarios'
import { AjusteVersaoApp } from '../configuracoes/AjusteAtualizacoes'
import { ModoDoApp } from './ModoDoApp'
import { BotaoRelatorio } from '../componentes/RelatorioErro'

// PlaySquare (Fase P3, DESIGN.md seção 6.1.5): Explorar e Conteúdo são os MESMOS componentes da
// tela Mods do ServSquare, só que apontados para a instalação escolhida (ApiDaInstalacao).

const CHAVE = 'hubsquare:instalacaoEscolhida'

function lerEscolhida(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

// Instalação escolhida (lembrada entre as telas) e o "info" dela no formato das telas de mods.
function useInstalacao(): {
  lista: Instalacao[] | null
  escolhida: Instalacao | null
  info: InfoServidor | null
  erro: ErroTela | null
  escolher: (id: string) => void
  recarregar: () => Promise<void>
} {
  const [lista, setLista] = useState<Instalacao[] | null>(null)
  const [id, setId] = useState<string | null>(lerEscolhida)
  const [info, setInfo] = useState<InfoServidor | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.listarInstalacoes().then((r) => (r.ok ? setLista(r.valor) : setErro(r.erro)))
  }, [])

  const escolhida = lista?.find((i) => i.id === id) ?? lista?.[0] ?? null

  const recarregar = useCallback(async (): Promise<void> => {
    if (!escolhida) return
    const [r, l] = await Promise.all([
      window.api.instalacaoInfo(escolhida.id),
      window.api.listarInstalacoes()
    ])
    if (r.ok) setInfo(r.valor)
    else setErro(r.erro)
    if (l.ok) setLista(l.valor)
  }, [escolhida])

  useEffect(() => {
    if (!escolhida) return
    let vivo = true
    window.api.instalacaoInfo(escolhida.id).then((r) => {
      if (!vivo) return
      if (r.ok) setInfo(r.valor)
      else setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [escolhida])

  return {
    lista,
    escolhida,
    info: info && escolhida && info.jogador?.instalacaoId === escolhida.id ? info : null,
    erro,
    escolher: (novo) => {
      setId(novo)
      try {
        localStorage.setItem(CHAVE, novo)
      } catch {
        // sem armazenamento: só não lembra
      }
    },
    recarregar
  }
}

function Seletor({
  lista,
  escolhida,
  aoEscolher
}: {
  lista: Instalacao[]
  escolhida: Instalacao
  aoEscolher: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 border border-linha bg-panel p-4">
      <span className="text-[13px] font-bold">Instalação</span>
      <Selecao
        aria-label="Instalação"
        value={escolhida.id}
        onChange={(e) => aoEscolher(e.target.value)}
        className="min-w-[240px]"
      >
        {lista.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nome} · {i.versao}
          </option>
        ))}
      </Selecao>
      <span className="text-xs text-muted">
        Tudo o que você instalar aqui é seu: a sincronização com o servidor nunca tira.
      </span>
    </div>
  )
}

function SemInstalacao(): React.JSX.Element {
  return (
    <EstadoVazio
      icone={<IconeInstalacoes />}
      titulo="Nenhuma instalação ainda"
      texto="Crie uma instalação (ou entre com um convite) na tela Instalações."
    />
  )
}

export function TelaDoJogo({ tela }: { tela: 'Explorar' | 'Conteúdo' }): React.JSX.Element {
  const { lista, escolhida, info, erro, escolher, recarregar } = useInstalacao()
  if (!lista) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }
  if (!escolhida)
    return (
      <PaginaAjustes>
        <SemInstalacao />
      </PaginaAjustes>
    )
  return (
    <PaginaAjustes largo>
      <Seletor lista={lista} escolhida={escolhida} aoEscolher={escolher} />
      {erro && <MensagemErro erro={erro} />}
      {tela === 'Conteúdo' && <BotaoDownloadsPendentes alvo={`jogo:${escolhida.id}`} />}
      {!info ? (
        <Esqueleto linhas={4} />
      ) : (
        <ApiDaInstalacao id={escolhida.id}>
          {tela === 'Explorar' ? (
            <Explorar key={escolhida.id} info={info} aoInstalar={recarregar} />
          ) : (
            <>
              <Recomendados key={`r-${escolhida.id}`} i={escolhida} aoMudar={recarregar} />
              <Instalados key={escolhida.id} info={info} estado="desligado" aoMudar={recarregar} />
            </>
          )}
        </ApiDaInstalacao>
      )}
    </PaginaAjustes>
  )
}

// Recomendados do servidor (convite): o jogador escolhe quais quer. Vale na hora.
function Recomendados({
  i,
  aoMudar
}: {
  i: Instalacao
  aoMudar: () => Promise<void>
}): React.JSX.Element | null {
  const opcionais = i.convite?.opcionais ?? []
  const [recusados, setRecusados] = useState(
    () => new Set(opcionais.filter((o) => o.recusado).map((o) => o.path))
  )
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [progresso, setProgresso] = useState<{
    etapa: string
    recebido: number
    total: number
  } | null>(null)
  useEffect(() => window.api.aoProgredir(setProgresso), [])
  if (!opcionais.length) return null
  const mudou = opcionais.some((o) => o.recusado !== recusados.has(o.path))
  return (
    <Secao
      titulo={`Recomendados pelo servidor ${i.origem.tipo === 'convite' ? i.origem.servidor : ''}`}
    >
      <p className="text-[13px] text-muted">
        O servidor sugere estes itens, mas você escolhe. Os obrigatórios não aparecem aqui.
      </p>
      {opcionais.map((o) => (
        <CaixaSelecao
          key={o.path}
          marcada={!recusados.has(o.path)}
          disabled={ocupado}
          aoMudar={(marcada) =>
            setRecusados((r) => {
              const n = new Set(r)
              if (marcada) n.delete(o.path)
              else n.add(o.path)
              return n
            })
          }
        >
          {o.path.split('/').pop()}
        </CaixaSelecao>
      ))}
      <Botao
        className="self-start"
        variante="primario"
        disabled={ocupado || !mudou}
        onClick={async () => {
          setOcupado(true)
          setErro(null)
          const r = await window.api.definirRecomendados(i.id, [...recusados])
          setOcupado(false)
          if (!r.ok) return setErro(r.erro)
          await aoMudar()
        }}
      >
        {ocupado ? 'Aplicando...' : 'Salvar escolha'}
      </Botao>
      {ocupado && progresso && (
        <BarraProgresso
          rotulo={progresso.etapa}
          valor={progresso.recebido}
          maximo={progresso.total}
        />
      )}
      {erro && <MensagemErro erro={erro} />}
    </Secao>
  )
}

// Ajustes do jogo (Fases P3 e P5, DESIGN.md seção 6.1.6): memória padrão, resolução da janela,
// launcher, avisos escondidos e pasta das instalações.
export function TelaAjustesJogo(): React.JSX.Element {
  const [ocultos, mudar] = useAvisosOcultos()
  const [ajustes, setAjustes] = useState<AjustesJogo | null>(null)
  const [limites, setLimites] = useState<LimitesRam | null>(null)
  const [pasta, setPasta] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [salvo, setSalvo] = useState(false)

  function receber(a: AjustesJogo): void {
    setAjustes(a)
    setLargura(a.resolucao ? String(a.resolucao.largura) : '')
    setAltura(a.resolucao ? String(a.resolucao.altura) : '')
    window.api.pastaDasInstalacoes().then((r) => r.ok && setPasta(r.valor))
  }
  useEffect(() => {
    window.api.lerAjustesJogo().then((r) => (r.ok ? receber(r.valor) : setErro(r.erro)))
    window.api.limitesRam().then(setLimites)
  }, [])

  async function salvar(
    mudancas: Partial<Pick<AjustesJogo, 'memoriaPadrao' | 'resolucao'>>
  ): Promise<void> {
    if (!ajustes) return
    const r = await window.api.salvarAjustesJogo({
      memoriaPadrao: ajustes.memoriaPadrao,
      resolucao: ajustes.resolucao,
      ...mudancas
    })
    if (!r.ok) return setErro(r.erro)
    setErro(null)
    setSalvo(true)
    receber(r.valor)
  }

  if (!ajustes || !limites) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={5} />}
      </PaginaAjustes>
    )
  }
  return (
    <PaginaAjustes>
      {erro && <MensagemErro erro={erro} />}
      <Secao titulo="Memória padrão">
        <CaixaSelecao
          marcada={ajustes.memoriaPadrao === null}
          aoMudar={(v) => void salvar({ memoriaPadrao: v ? null : Math.min(4, limites.max) })}
        >
          Usar a sugestão do app (pelo número de mods e pela memória do PC)
        </CaixaSelecao>
        {ajustes.memoriaPadrao !== null && (
          <Slider
            rotulo="Memória das instalações novas"
            valor={ajustes.memoriaPadrao}
            min={limites.min}
            max={limites.max}
            aoMudar={(v) => setAjustes({ ...ajustes, memoriaPadrao: v })}
            formatar={(v) => `${v} GB`}
          />
        )}
        {ajustes.memoriaPadrao !== null && (
          <Botao className="self-start" onClick={() => void salvar({})}>
            Salvar memória
          </Botao>
        )}
        <p className="text-xs text-muted">
          Vale para instalações novas. Cada instalação tem a própria memória na tela Jogar.
        </p>
      </Secao>

      <Secao titulo="Janela do jogo">
        <CaixaSelecao
          marcada={ajustes.resolucao === null}
          aoMudar={(v) => void salvar({ resolucao: v ? null : { largura: 1280, altura: 720 } })}
        >
          Deixar o Minecraft Launcher decidir o tamanho
        </CaixaSelecao>
        {ajustes.resolucao !== null && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[13px]">
              Largura
              <Campo
                inputMode="numeric"
                className="w-28"
                value={largura}
                onChange={(e) => setLargura(e.target.value.replace(/D/g, '').slice(0, 4))}
              />
            </label>
            <span className="pb-2">×</span>
            <label className="flex flex-col gap-1 text-[13px]">
              Altura
              <Campo
                inputMode="numeric"
                className="w-28"
                value={altura}
                onChange={(e) => setAltura(e.target.value.replace(/D/g, '').slice(0, 4))}
              />
            </label>
            <Botao
              onClick={() =>
                void salvar({ resolucao: { largura: Number(largura), altura: Number(altura) } })
              }
            >
              Salvar tamanho
            </Botao>
          </div>
        )}
        <p className="text-xs text-muted">Vale da próxima vez que você clicar em Jogar.</p>
      </Secao>

      <Secao titulo="Launcher">
        <p className="text-[13px]">
          O PlaySquare abre o jogo pelo <b>Minecraft Launcher oficial</b>, com a sua conta. O app
          nunca faz login nem abre o jogo sem a conta original.
        </p>
        <p className="text-xs text-muted">
          Modrinth App e Prism Launcher não têm um jeito oficial de receber instalações de fora,
          então não estão disponíveis por enquanto.
        </p>
      </Secao>

      <Secao titulo="Avisos de compatibilidade">
        <p className="text-[13px] text-muted">
          Avisos que você pediu para não mostrar de novo no Explorar e em Conteúdo. Os que impedem a
          instalação (loader e versão) aparecem sempre.
        </p>
        {!ocultos.length ? (
          <Aviso tipo="sucesso">Todos os avisos estão aparecendo.</Aviso>
        ) : (
          <ul className="flex flex-col divide-y divide-linha">
            {AVISOS.filter((a) => ocultos.includes(a)).map((a) => (
              <li key={a} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-[13px]">{NOMES_AVISOS[a]}</span>
                <Botao tamanho="pequeno" onClick={() => mudar(a, false)}>
                  Mostrar de novo
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Pasta das instalações">
        <p className="font-mono text-[13px] break-all">{pasta}</p>
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => void window.api.abrirPastaDasInstalacoes()}>Abrir pasta</Botao>
          <Botao
            onClick={async () => {
              const r = await window.api.escolherPastaInstalacoes(false)
              if (r.ok) receber(r.valor)
              else setErro(r.erro)
            }}
          >
            Escolher outra pasta
          </Botao>
          {ajustes.pastaInstalacoes && (
            <Botao
              onClick={async () => {
                const r = await window.api.escolherPastaInstalacoes(true)
                if (r.ok) receber(r.valor)
                else setErro(r.erro)
              }}
            >
              Voltar ao padrão
            </Botao>
          )}
        </div>
        <p className="text-xs text-muted">
          Vale para as instalações novas. As que já existem continuam onde estão (nada é movido).
        </p>
      </Secao>

      <Secao titulo="Downloads manuais">
        <p className="text-[13px] text-muted">
          Quando um mod precisa ser baixado pela página oficial, o app procura o arquivo na pasta
          Downloads do Windows. Se o seu navegador salva em outro lugar, adicione a pasta aqui. Só
          sai de lá o arquivo que bate com o esperado (o hash é conferido).
        </p>
        {ajustes.pastasDownloads.length > 0 && (
          <ul className="flex flex-col gap-1">
            {ajustes.pastasDownloads.map((p) => (
              <li key={p} className="flex items-center gap-2 bg-panel-2 px-3 py-2">
                <span className="flex-1 font-mono text-[13px] break-all">{p}</span>
                <Botao
                  tamanho="pequeno"
                  onClick={async () => {
                    const r = await window.api.mudarPastaDownloads(p)
                    if (r.ok) receber(r.valor)
                    else setErro(r.erro)
                  }}
                >
                  Tirar
                </Botao>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Botao
            onClick={async () => {
              const r = await window.api.mudarPastaDownloads()
              if (r.ok) receber(r.valor)
              else setErro(r.erro)
            }}
          >
            Adicionar pasta
          </Botao>
        </div>
      </Secao>
      <ModoDoApp />
      <Secao titulo="Ajuda">
        <p className="text-[13px] text-muted">
          Algo deu errado? O relatório junta os logs e as configurações, sem segredos, para quem for
          ajudar.
        </p>
        <div>
          <BotaoRelatorio />
        </div>
      </Secao>
      <Secao titulo="Versão do HubSquare">
        <AjusteVersaoApp />
      </Secao>
      {salvo && <Aviso tipo="sucesso">Salvo.</Aviso>}
    </PaginaAjustes>
  )
}
