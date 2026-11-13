import { useState } from 'react'
import { AvisoDeJogador } from './Avisos'
import { MensagemErro } from './MensagemErro'
import { cartao, rotuloPequeno } from './estilos'
import type { EstadoServidor, InfoServidor } from '../../../shared/tipos'
import { Assistente } from '../assistente/Assistente'
import { BarraDeAcao } from '../servidor/BarraDeAcao'
import { Banner } from '../servidor/Banner'
import { useAparencia } from '../aparencia/useAparencia'
import { IconeBackups, IconeJogadores, IconeMundos, IconeServidor } from './icones'
import { BarraProgresso, BolinhaStatus, Esqueleto, NumeroAnimado } from './movimento'
import { Acordeao, BotoesBloco, CabecaJogador, CardPainel, TituloPagina } from './paineis'
import {
  Botao,
  CaixaSelecao,
  Campo,
  Dialogo,
  EstadoVazio,
  Interruptor,
  LinhaControle,
  Selecao,
  Slider
} from './ui'

// Servidor de exemplo, só para a vitrine.
const EXEMPLO: InfoServidor = {
  id: 'exemplo',
  nome: 'Meu Servidor',
  tipo: 'paper',
  versao: '26.3',
  java: 25,
  pasta: 'C:/exemplo'
}
const ESTADOS: EstadoServidor[] = ['desligado', 'ligando', 'ligado', 'desligando']

// Página /dev/componentes: vitrine dos componentes, só no modo de desenvolvimento.
// Serve para comparar com o DESIGN.md; não entra no app instalado.
export default function Galeria(): React.JSX.Element {
  const [marcada, setMarcada] = useState(true)
  const [ram, setRam] = useState(4)
  const [dialogo, setDialogo] = useState(false)
  const [ligado, setLigado] = useState(true)
  const [progresso, setProgresso] = useState(30)
  const { aparencia, mudar, windowsReduzAnimacoes } = useAparencia()

  return (
    <div className="flex h-screen flex-col gap-6 overflow-auto bg-app p-10 text-texto">
      <TituloPagina>/dev/componentes</TituloPagina>
      <div className="max-w-[720px]">
        <LinhaControle
          rotulo="Reduzir animações"
          ligado={windowsReduzAnimacoes || !!aparencia?.reduzirAnimacoes}
          disabled={windowsReduzAnimacoes}
          aoMudar={(v) => mudar({ reduzirAnimacoes: v })}
        >
          O mesmo interruptor de Aparência › Animações, para comparar as duas formas.
        </LinhaControle>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className={rotuloPequeno}>Card de painel, cabeça do jogador e botões-bloco</h2>
        <div className="grid gap-4 min-[1100px]:grid-cols-[2fr_1fr]">
          <CardPainel titulo="Atalhos" acoes={<Botao tamanho="pequeno">⟳</Botao>}>
            <BotoesBloco
              itens={[
                {
                  rotulo: 'Whitelist',
                  icone: <IconeJogadores />,
                  variante: 'primario',
                  aoClicar: () => {}
                },
                {
                  rotulo: 'Operadores',
                  icone: <IconeServidor />,
                  variante: 'primario',
                  aoClicar: () => {}
                },
                {
                  rotulo: 'Jogadores banidos',
                  icone: <IconeJogadores />,
                  variante: 'perigo',
                  aoClicar: () => {}
                },
                {
                  rotulo: 'IPs banidos',
                  icone: <IconeMundos />,
                  variante: 'perigo',
                  aoClicar: () => {}
                }
              ]}
            />
          </CardPainel>
          <CardPainel titulo="Cabeças (fallback)">
            <div className="flex items-end gap-4">
              <CabecaJogador nome="Fulano" tamanho={28} online />
              <CabecaJogador nome="Ciclano" tamanho={40} online={false} />
              <CabecaJogador nome="Beltrana" tamanho={72} online />
            </div>
          </CardPainel>
        </div>
      </section>

      <section className="flex max-w-[720px] flex-col gap-3">
        <h2 className={rotuloPequeno}>Interruptor e linha de controle</h2>
        <div className="flex items-center gap-3">
          <Interruptor rotulo="Exemplo" ligado={ligado} aoMudar={setLigado} />
          <span className="text-[13px]">{ligado ? 'Ligado' : 'Desligado'}</span>
        </div>
        <LinhaControle
          icone={<IconeJogadores className="h-5 w-5" />}
          rotulo="Na whitelist"
          ligado={ligado}
          aoMudar={setLigado}
        />
        <LinhaControle
          icone={<IconeServidor className="h-5 w-5" />}
          rotulo="Operador"
          ligado={!ligado}
          aoMudar={(v) => setLigado(!v)}
        />
      </section>

      <section className="flex max-w-[720px] flex-col gap-3">
        <h2 className={rotuloPequeno}>Acordeão</h2>
        <Acordeao
          itens={[
            {
              icone: <IconeMundos />,
              titulo: 'Posição atual',
              conteudo: (
                <p className="font-mono text-[13px]">
                  X 120,50 · Y 64,00 · Z -33,25 (Mundo normal)
                </p>
              )
            },
            {
              icone: <IconeServidor />,
              titulo: 'Local de renascimento',
              conteudo: <p className="text-[13px] text-muted">Sem dados</p>
            },
            {
              icone: <IconeBackups />,
              titulo: 'Local da última morte',
              conteudo: <p className="text-[13px] text-muted">Sem dados</p>
            }
          ]}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={rotuloPequeno}>Estados vazio e carregando, status, números e progresso</h2>
        <div className="grid gap-4 min-[1100px]:grid-cols-2">
          <CardPainel titulo="Vazio">
            <EstadoVazio
              icone={<IconeJogadores />}
              titulo="Ninguém online agora"
              texto="Quando alguém entrar, aparece aqui."
            >
              <Botao variante="primario">Convidar amigos</Botao>
            </EstadoVazio>
          </CardPainel>
          <CardPainel titulo="Carregando">
            <Esqueleto linhas={4} />
          </CardPainel>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[13px]">
          {ESTADOS.map((e) => (
            <span key={e} className="flex items-center gap-2">
              <BolinhaStatus estado={e} /> {e}
            </span>
          ))}
          <span className="flex items-center gap-2">
            <BolinhaStatus estado="erro" /> erro
          </span>
          <span>
            CPU{' '}
            <b>
              <NumeroAnimado valor={progresso} formatar={(v) => `${Math.round(v)}%`} />
            </b>
          </span>
        </div>
        <div className="flex max-w-[720px] items-center gap-3">
          <BarraProgresso rotulo="Baixando" valor={progresso} maximo={100} />
          <Botao tamanho="pequeno" onClick={() => setProgresso((p) => (p >= 100 ? 10 : p + 30))}>
            +30
          </Botao>
        </div>
      </section>

      <section id="assistente" className="flex flex-col gap-3">
        <h2 className={rotuloPequeno}>Assistente (só vitrine: nada é criado sem marcar o EULA)</h2>
        <div className="flex h-[640px] flex-col border border-linha">
          <Assistente aoConcluir={() => {}} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={rotuloPequeno}>Banner e barra de ação (4 estados)</h2>
        <Banner info={EXEMPLO} endereco="nome.joinmc.link" aviso="" />
        {ESTADOS.map((e) => (
          <BarraDeAcao
            key={e}
            info={EXEMPLO}
            estado={e}
            endereco={e === 'ligado' ? '26.1.2.3:25565' : null}
            aoLigarDesligar={() => {}}
            aoReiniciar={() => {}}
            aoAbrirPasta={() => {}}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={rotuloPequeno}>Botões</h2>
        <div className="flex flex-wrap gap-3">
          <Botao variante="primario">Salvar</Botao>
          <Botao variante="secundario">Cancelar</Botao>
          <Botao variante="perigo">Remover</Botao>
          <Botao variante="atencao">Atenção</Botao>
          <Botao variante="destaque">Copiar endereço</Botao>
          <Botao variante="primario" disabled>
            Desativado
          </Botao>
        </div>
        <div className="flex flex-wrap gap-3">
          <Botao variante="primario" tamanho="pequeno">
            Pequeno
          </Botao>
          <Botao variante="secundario" tamanho="pequeno">
            Dia
          </Botao>
          <Botao variante="secundario" tamanho="pequeno">
            Noite
          </Botao>
        </div>
      </section>

      <section className="flex max-w-[720px] flex-col gap-3">
        <h2 className={rotuloPequeno}>Ajustes</h2>
        <CaixaSelecao marcada={marcada} aoMudar={setMarcada}>
          PvP (jogadores podem atacar uns aos outros)
        </CaixaSelecao>
        <CaixaSelecao marcada={false} aoMudar={() => {}} disabled>
          Opção desativada
        </CaixaSelecao>
        <Campo placeholder="Mensagem do servidor (MOTD)" />
        <Selecao defaultValue="survival" aria-label="Modo de jogo">
          <option value="survival">Sobrevivência</option>
          <option value="creative">Criativo</option>
        </Selecao>
        <Slider
          rotulo="RAM do servidor"
          valor={ram}
          min={1}
          max={13}
          aoMudar={setRam}
          formatar={(v) => `${v} GB`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={rotuloPequeno}>Card, erro e aviso</h2>
        <div className={`${cartao} max-w-[340px]`}>
          <div className="texto-pixel text-[22px]">Chame seus amigos!</div>
          <p className="mt-1 text-sm text-muted">Card com fundo --bg-panel e borda --border.</p>
        </div>
        <div className="max-w-[720px]">
          <MensagemErro
            erro={{
              mensagem:
                'A porta 25565 já está em uso. Feche outro servidor de Minecraft aberto no PC e tente de novo.',
              detalhes: 'Error: listen EADDRINUSE: address already in use :::25565'
            }}
          />
        </div>
        <div className="flex">
          <AvisoDeJogador aviso={{ nome: 'Fulano', tipo: 'entrou' }} aoFechar={() => {}} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={rotuloPequeno}>Diálogo</h2>
        <Botao variante="perigo" className="self-start" onClick={() => setDialogo(true)}>
          Abrir diálogo
        </Botao>
        <Dialogo
          aberto={dialogo}
          titulo="Restaurar backup?"
          aoCancelar={() => setDialogo(false)}
          acao={{ rotulo: 'Restaurar', variante: 'perigo', aoClicar: () => setDialogo(false) }}
        >
          O mundo atual vira um backup novo e também fica guardado em &quot;mundos-antigos&quot;.
        </Dialogo>
      </section>
    </div>
  )
}
