import { useEffect, useRef, useState } from 'react'
import type { Bioma, ErroTela, ImagemFundo } from '../../../shared/tipos'
import { mesmaEscolha, urlDoFundo, type EscolhaFundo } from '../../../shared/fundoRegras'
import { CamadaFundo } from '../fundo/CamadaFundo'
import {
  AjustesImagem,
  escolhaDeImagem,
  GradeBiomas,
  GradeImagens,
  useImagensFundo
} from '../fundo/EscolherFundo'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import {
  Aviso,
  Botao,
  Dialogo,
  LinhaControle,
  OpcaoRadio,
  PaginaAjustes,
  Secao
} from '../componentes/ui'
import { MODOS_ANIMACAO, modoInicial, type ModoAnimacao } from '../../../shared/animacaoRegras'
import { corDaSugestao, NOMES_SUGESTOES } from './tema'
import { useAparencia } from './useAparencia'

const NOMES_CORES: Record<(typeof NOMES_SUGESTOES)[number], string> = {
  verde: 'Verde',
  azul: 'Azul',
  roxo: 'Roxo',
  laranja: 'Laranja',
  vermelho: 'Vermelho',
  ciano: 'Ciano'
}

// Tela Aparência (DESIGN.md, seções 6.7 e 7). Abas: Tema e Fundo.
export function TelaAparencia({ aba }: { aba: string }): React.JSX.Element {
  const { aparencia, erro } = useAparencia()
  if (!aparencia) {
    return <PaginaAjustes>{erro ? <MensagemErro erro={erro} /> : <Esqueleto />}</PaginaAjustes>
  }
  return (
    <PaginaAjustes largo={aba === 'Fundo'}>
      {erro && <MensagemErro erro={erro} />}
      {aba === 'Tema' && <AbaTema />}
      {aba === 'Fundo' && <AbaFundo />}
      {aba === 'Animações' && <AbaAnimacoes />}
    </PaginaAjustes>
  )
}

function AbaTema(): React.JSX.Element {
  const { aparencia, mudar } = useAparencia()
  if (!aparencia) return <></>

  return (
    <>
      <Secao titulo="Vidro">
        <LinhaControle
          rotulo="Vidro leve"
          ligado={aparencia.vidroLeve}
          aoMudar={(v) => mudar({ vidroLeve: v })}
        >
          Sem o desfoque atrás dos painéis, só o fundo translúcido. Use se o PC ficar lento.
        </LinhaControle>
      </Secao>

      <AnimacaoDoFundo />

      <CorDaArea campo="destaque" titulo="Cor do ServSquare" />
      <CorDaArea campo="destaquePlay" titulo="Cor do PlaySquare" />
    </>
  )
}

const NOMES_ANIMACAO: Record<ModoAnimacao, string> = {
  completa: 'Completa',
  leve: 'Leve (metade das partículas, mais devagar)',
  desligada: 'Desligada (fundo parado)'
}

// Animação do fundo (Fase V2). Sem escolha salva: completa, ou desligada (arte parada) com menos movimento pedido.
function AnimacaoDoFundo(): React.JSX.Element {
  const { aparencia, mudar, windowsReduzAnimacoes } = useAparencia()
  if (!aparencia) return <></>
  const atual = modoInicial(
    aparencia.animacaoFundo,
    windowsReduzAnimacoes || aparencia.reduzirAnimacoes
  )
  return (
    <Secao titulo="Animação do fundo">
      <div role="radiogroup" aria-label="Animação do fundo">
        {MODOS_ANIMACAO.map((m) => (
          <OpcaoRadio
            key={m}
            nome="animacao-fundo"
            marcada={atual === m}
            aoEscolher={() => mudar({ animacaoFundo: m })}
          >
            {NOMES_ANIMACAO[m]}
          </OpcaoRadio>
        ))}
      </div>
      <p className="text-xs text-muted">
        O fundo para sozinho com o jogo aberto, com o app minimizado ou na bandeja, sem uso por 30
        segundos e enquanto um modpack instala.
      </p>
    </Secao>
  )
}

// Cada área (ServSquare e PlaySquare) tem a própria cor de destaque.
function CorDaArea({
  campo,
  titulo
}: {
  campo: 'destaque' | 'destaquePlay'
  titulo: string
}): React.JSX.Element {
  const { aparencia, mudar } = useAparencia()
  if (!aparencia) return <></>
  // null: a cor do bioma (muda junto com ele). Uma cor escolhida vale em todos os biomas.
  const atual = aparencia[campo]
  const sugestoes = NOMES_SUGESTOES.map((nome) => ({ nome, cor: corDaSugestao(nome) }))
  const personalizada =
    atual !== null && !sugestoes.some((s) => s.cor.toLowerCase() === atual.toLowerCase())

  return (
    <>
      <Secao titulo={titulo}>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={titulo}>
          <button
            type="button"
            role="radio"
            aria-checked={atual === null}
            onClick={() => mudar({ [campo]: null })}
            className={`flex h-10 items-center gap-2 rounded-[var(--raio-pequeno)] border-2 px-3 text-[13px] ${
              atual === null ? 'border-texto' : 'border-linha'
            }`}
          >
            <span aria-hidden="true" className="h-5 w-5 rounded-[6px] bg-[var(--accent-padrao)]" />
            Cor do bioma
          </button>
          {sugestoes.map(({ nome, cor }) => {
            const ativa = atual?.toLowerCase() === cor.toLowerCase()
            return (
              <button
                key={nome}
                type="button"
                role="radio"
                aria-checked={ativa}
                aria-label={NOMES_CORES[nome]}
                title={NOMES_CORES[nome]}
                onClick={() => mudar({ [campo]: cor })}
                className={`h-10 w-10 rounded-[var(--raio-pequeno)] border-2 ${ativa ? 'border-texto' : 'border-linha'}`}
                style={{ backgroundColor: cor }}
              />
            )
          })}
          <label
            className={`flex h-10 cursor-pointer items-center gap-2 rounded-[var(--raio-pequeno)] border-2 px-2 text-[13px] ${
              personalizada ? 'border-texto' : 'border-linha'
            }`}
          >
            <input
              type="color"
              value={atual ?? '#22c55e'}
              onChange={(e) => mudar({ [campo]: e.target.value })}
              className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
            />
            Personalizada
          </label>
        </div>
        <p className="text-xs text-muted">
          {campo === 'destaque'
            ? 'Muda o botão LIGAR, a aba ativa, as caixas marcadas e os avisos.'
            : 'Vale enquanto o PlaySquare está aberto: botão JOGAR, aba ativa e caixas marcadas.'}
        </p>
      </Secao>
    </>
  )
}

// Aba Fundo (Fase V4, DESIGN.md seção 7.2): o fundo do app inteiro. Biomas claros e escuros ou
// uma imagem minha, com ajustes, prévia ao vivo e "Desfazer" por 10 segundos depois de trocar.
function AbaFundo(): React.JSX.Element {
  const { aparencia, fundoApp, screenshots, mudar, usarScreenshot } = useAparencia()
  const imgs = useImagensFundo()
  const [desfazer, setDesfazer] = useState<{ escolha: EscolhaFundo; bioma: Bioma } | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [apagar, setApagar] = useState<ImagemFundo | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  useEffect(() => () => clearTimeout(relogio.current), [])
  if (!aparencia) return <></>
  const atual: EscolhaFundo = aparencia.fundoApp ?? { tipo: 'bioma', bioma: aparencia.bioma }

  // Trocar de fundo (não os ajustes) guarda o anterior para o "Desfazer" por 10 segundos.
  function trocar(nova: EscolhaFundo, guardarAnterior = true): void {
    if (!aparencia) return
    if (guardarAnterior && !mesmaEscolha(nova, atual)) {
      setDesfazer({ escolha: atual, bioma: aparencia.bioma })
      clearTimeout(relogio.current)
      relogio.current = setTimeout(() => setDesfazer(null), 10_000)
    }
    mudar({ fundoApp: nova, ...(nova.tipo === 'bioma' ? { bioma: nova.bioma } : {}) })
  }

  async function confirmarApagar(): Promise<void> {
    if (!apagar) return
    const r = await window.api.apagarImagemFundo(apagar.nome)
    if (!r.ok) return setErro(r.erro)
    setErro(null)
    if (atual.tipo === 'imagem' && atual.imagem === apagar.nome) {
      mudar({ fundoApp: { tipo: 'bioma', bioma: aparencia!.bioma } })
    }
    setApagar(null)
    await imgs.recarregar()
  }

  const imagemAtual = atual.tipo === 'imagem' ? atual : null
  return (
    <>
      <Secao titulo="Prévia">
        <div className="relative aspect-video w-full max-w-[480px] overflow-hidden rounded-(--raio-item) border border-linha">
          <CamadaFundo escolha={fundoApp ?? atual} />
          <div className="vidro-painel absolute right-4 bottom-4 left-4 px-4 py-3 text-[13px]">
            <b>Assim fica o vidro</b>
            <p className="text-muted">O texto continua fácil de ler sobre qualquer fundo.</p>
          </div>
        </div>
        {desfazer && (
          <Aviso tipo="sucesso">
            <span className="flex-1">Fundo do app trocado.</span>
            <Botao
              tamanho="pequeno"
              onClick={() => {
                mudar({ fundoApp: desfazer.escolha, bioma: desfazer.bioma })
                setDesfazer(null)
              }}
            >
              Desfazer
            </Botao>
          </Aviso>
        )}
      </Secao>

      <Secao titulo="Bioma">
        <GradeBiomas
          atual={atual.tipo === 'bioma' ? atual.bioma : null}
          aoEscolher={(b) => trocar({ tipo: 'bioma', bioma: b })}
        />
      </Secao>

      <Secao titulo="Minha imagem">
        <GradeImagens
          imagens={imgs.imagens}
          atual={imagemAtual?.imagem ?? null}
          aoEscolher={(nome) => trocar(escolhaDeImagem(nome, atual))}
          aoEscolherOutra={async () => {
            const nome = await imgs.escolher()
            if (nome) trocar(escolhaDeImagem(nome, atual))
          }}
        />
        {imgs.erro && <MensagemErro erro={imgs.erro} />}
        {imagemAtual && (
          <AjustesImagem
            url={urlDoFundo(imagemAtual.imagem)}
            ajuste={imagemAtual.ajuste}
            aoMudar={(ajuste) => trocar({ ...imagemAtual, ajuste }, false)}
          />
        )}
      </Secao>

      <Secao titulo="Seus prints do jogo">
        {screenshots.length === 0 ? (
          <p className="text-[13px] text-muted">
            Nenhum print encontrado. No jogo, aperte F2 para tirar um; eles ficam em
            .minecraft\screenshots e aparecem aqui.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              Clique num print para usar como fundo do app. Os mais recentes também aparecem nos
              cards de backup e de mundo.
            </p>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {screenshots.map((s, i) => (
                <li
                  key={s.nome}
                  className="anim-item"
                  style={{ '--ordem': i } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      const nome = await usarScreenshot(s.nome)
                      if (!nome) return
                      await imgs.recarregar()
                      trocar(escolhaDeImagem(nome, atual))
                    }}
                    title={`Usar ${s.nome} como fundo`}
                    className="block w-full overflow-hidden rounded-(--raio-pequeno) border border-linha transition-colors duration-(--dur-fast) hover:border-muted"
                  >
                    <img
                      src={s.miniatura}
                      alt={`Print ${s.nome}`}
                      className="aspect-video w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>

      <Secao titulo="Minhas imagens">
        {erro && <MensagemErro erro={erro} />}
        {imgs.imagens === null ? (
          <Esqueleto linhas={2} />
        ) : imgs.imagens.length === 0 ? (
          <p className="text-[13px] text-muted">
            Nenhuma imagem guardada ainda. As que você escolher para o app ou para uma instalação
            aparecem aqui.
          </p>
        ) : (
          <ul className="flex max-w-[720px] flex-col gap-2">
            {imgs.imagens.map((img, n) => (
              <li
                key={img.nome}
                className="flex items-center gap-3 rounded-(--raio-pequeno) border border-linha bg-panel-2 p-2"
              >
                <img
                  src={img.url}
                  alt={`Imagem ${n + 1}`}
                  className="aspect-video w-28 shrink-0 rounded-[calc(var(--raio-pequeno)-4px)] object-cover"
                />
                <span className="min-w-0 flex-1 text-[13px]">
                  <b>Imagem {n + 1}</b>
                  <span className="block text-muted">
                    {img.usadaEm.length ? `Em uso: ${img.usadaEm.join(', ')}` : 'Sem uso'}
                  </span>
                </span>
                <Botao variante="perigo" tamanho="pequeno" onClick={() => setApagar(img)}>
                  Apagar…
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Dialogo
        aberto={apagar !== null}
        titulo="Apagar esta imagem?"
        aoCancelar={() => setApagar(null)}
        acao={{ rotulo: 'Apagar', variante: 'perigo', aoClicar: () => void confirmarApagar() }}
      >
        <p className="text-[13px]">
          A cópia guardada pelo app sai da pasta de fundos (o seu arquivo original não muda).
          {apagar?.usadaEm.length
            ? ` Quem usa esta imagem (${apagar.usadaEm.join(', ')}) volta para ${
                apagar.usadaEm.includes('Fundo do app') ? 'o bioma' : '"Igual ao app"'
              }.`
            : ''}
        </p>
      </Dialogo>
    </>
  )
}

// Aba Animações (seção 8): "Reduzir animações". Liga sozinho quando o Windows pede menos movimento.
function AbaAnimacoes(): React.JSX.Element {
  const { aparencia, mudar, windowsReduzAnimacoes } = useAparencia()
  if (!aparencia) return <></>
  return (
    <Secao titulo="Animações">
      <LinhaControle
        rotulo="Reduzir animações"
        ligado={windowsReduzAnimacoes || aparencia.reduzirAnimacoes}
        disabled={windowsReduzAnimacoes}
        aoMudar={(v) => mudar({ reduzirAnimacoes: v })}
      >
        {windowsReduzAnimacoes
          ? 'Ligado pelo Windows (Configurações › Acessibilidade › Efeitos visuais › Efeitos de animação).'
          : 'Tira os movimentos da tela. As cores de status continuam, só param de piscar.'}
      </LinhaControle>
    </Secao>
  )
}
