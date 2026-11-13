import { BIOMAS, NOMES_BIOMAS } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import {
  Botao,
  CaixaSelecao,
  LinhaControle,
  OpcaoRadio,
  PaginaAjustes,
  Secao,
  Slider
} from '../componentes/ui'
import { MODOS_ANIMACAO, modoInicial, type ModoAnimacao } from '../../../shared/animacaoRegras'
import { ArteDoBioma } from '../fundo/Fundo'
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
      <Secao titulo="Bioma">
        <div
          role="radiogroup"
          aria-label="Bioma"
          className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3"
        >
          {BIOMAS.map((b) => {
            const ativo = aparencia.bioma === b
            return (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => mudar({ bioma: b })}
                className={`flex flex-col overflow-hidden rounded-[var(--raio-item)] border-2 bg-panel text-left transition-colors duration-(--dur-fast) ${
                  ativo ? 'border-accent' : 'border-linha hover:border-muted'
                }`}
              >
                <ArteDoBioma bioma={b} className="aspect-video w-full" />
                <span className="px-3 py-2 text-[13px] font-bold">{NOMES_BIOMAS[b]}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted">
          O fundo de todas as telas. O vidro fica mais opaco sozinho onde precisa, para o texto
          continuar fácil de ler.
        </p>
      </Secao>

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

// Animação do fundo (Fase V2). Sem escolha salva: completa, ou leve com menos movimento pedido.
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
      <LinhaControle
        rotulo="Partículas sobre a minha imagem"
        ligado={aparencia.particulasSobreImagem}
        aoMudar={(v) => mudar({ particulasSobreImagem: v })}
      >
        Com uma imagem sua no fundo ou no banner, as partículas do bioma passam por cima dela.
      </LinhaControle>
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

function AbaFundo(): React.JSX.Element {
  const { aparencia, fundoUrl, screenshots, mudar, escolherFundo, usarScreenshot, removerFundo } =
    useAparencia()
  if (!aparencia) return <></>
  // Ao escolher "em todo o app", o escurecimento começa no mínimo de 40% (seção 7).
  const escurecimento = Math.max(0.4, aparencia.escurecimento)

  return (
    <>
      <Secao titulo="Imagem de fundo">
        <div className="flex max-w-[720px] flex-col gap-3">
          <p className="text-[13px] text-muted">
            A imagem aparece no banner do Painel. Ela é copiada para a pasta do HubSquare, então
            você pode apagar ou mover o arquivo original.
          </p>
          {fundoUrl && (
            <img
              src={fundoUrl}
              alt=""
              className="aspect-video w-[300px] border border-linha object-cover"
            />
          )}
          <div className="flex gap-2">
            <Botao variante="primario" onClick={escolherFundo}>
              {fundoUrl ? 'Trocar imagem…' : 'Escolher imagem…'}
            </Botao>
            {fundoUrl && (
              <Botao variante="perigo" onClick={removerFundo}>
                Remover imagem
              </Botao>
            )}
          </div>
          <CaixaSelecao
            marcada={aparencia.fundoEmTodoApp}
            disabled={!fundoUrl}
            aoMudar={(v) => mudar({ fundoEmTodoApp: v, escurecimento })}
          >
            Usar em todo o app (atrás do conteúdo de todas as telas)
          </CaixaSelecao>
          {aparencia.fundoEmTodoApp && fundoUrl && (
            <Slider
              rotulo="Escurecimento (aumente se o texto ficar difícil de ler)"
              valor={Math.round(escurecimento * 100)}
              min={40}
              max={90}
              passo={5}
              aoMudar={(v) => mudar({ escurecimento: v / 100 })}
              formatar={(v) => `${v}%`}
            />
          )}
        </div>
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
              Clique num print para usar como fundo. Os mais recentes também aparecem nos cards de
              backup e de mundo.
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
                    onClick={() => usarScreenshot(s.nome)}
                    title={`Usar ${s.nome} como fundo`}
                    className="block w-full border border-linha transition-colors duration-(--dur-fast) hover:border-muted"
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
