import { useCallback, useEffect, useState } from 'react'
import type { ErroTela, MundoServidor, Resultado } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { dataHora, tamanho } from '../componentes/formato'
import { IconeMundos } from '../componentes/icones'
import { Esqueleto } from '../componentes/movimento'
import {
  Aviso,
  Botao,
  Campo,
  CardImagem,
  Dialogo,
  EstadoVazio,
  PaginaAjustes,
  Secao
} from '../componentes/ui'
import { useEstadoServidor } from '../servidor/comandos'

type Pedido = { tipo: 'apagar'; mundo: MundoServidor } | { tipo: 'gerar' }

// Tela Mundos: um card por mundo (DESIGN.md, 6.6). Toda ação pede o servidor desligado;
// apagar e gerar novo fazem backup antes (no processo principal).
export function TelaMundos(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [mundos, setMundos] = useState<MundoServidor[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [nome, setNome] = useState('')
  const [seed, setSeed] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const desligado = estado === 'desligado'

  const carregar = useCallback(async (): Promise<void> => {
    const r = await window.api.listarMundos()
    if (r.ok) setMundos(r.valor)
    else setErro(r.erro)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura da lista
    void carregar()
  }, [carregar])

  async function executar<T>(
    acao: () => Promise<Resultado<T>>,
    sucesso: (valor: T) => string | null
  ): Promise<void> {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(false)
    setPedido(null)
    if (!r.ok) setErro(r.erro)
    else setAviso(sucesso(r.valor))
    await carregar()
  }

  function confirmar(): void {
    if (pedido?.tipo === 'apagar') {
      const alvo = pedido.mundo.nome
      void executar(
        () => window.api.apagarMundo(alvo),
        () => `Mundo "${alvo}" apagado. O backup dele está em Cópias de segurança.`
      )
    } else if (pedido?.tipo === 'gerar') {
      const novo = nome.trim()
      void executar(
        () => window.api.gerarMundo(novo, seed),
        () => `Mundo "${novo}" escolhido. Ele é criado na próxima vez que o servidor ligar.`
      )
    }
  }

  const importado = (n: string | null): string | null =>
    n && `Mundo "${n}" importado. Use "Tornar ativo" para jogar nele.`

  return (
    <PaginaAjustes largo>
      <Secao titulo="Mundos">
        <p className="text-[13px] text-muted">
          O mundo ativo é o que abre quando o servidor liga.
          {!desligado && ' Desligue o servidor para mexer nos mundos.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="primario"
            disabled={!desligado || ocupado}
            onClick={() => {
              setNome('')
              setSeed('')
              setPedido({ tipo: 'gerar' })
            }}
          >
            Gerar mundo novo
          </Botao>
          <Botao
            disabled={!desligado || ocupado}
            onClick={() => void executar(() => window.api.importarMundoDePasta(), importado)}
          >
            Importar pasta…
          </Botao>
          <Botao
            disabled={!desligado || ocupado}
            onClick={() => void executar(() => window.api.importarMundoDeZip(), importado)}
          >
            Importar .zip…
          </Botao>
        </div>
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && <MensagemErro erro={erro} />}

        {!mundos ? (
          !erro && <Esqueleto linhas={3} />
        ) : mundos.length === 0 ? (
          <EstadoVazio
            icone={<IconeMundos />}
            titulo="Nenhum mundo ainda"
            texto="O servidor cria o primeiro mundo na primeira vez que liga."
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {mundos.map((m, i) => (
              <CardImagem
                key={m.nome}
                ordem={i}
                etiqueta={m.ativo ? 'Mundo atual' : 'Mundo'}
                titulo={m.nome}
                info={`${dataHora(m.data)} · ${tamanho(m.tamanho)}`}
              >
                {m.versao && <p className="text-xs text-muted">Versão {m.versao}</p>}
                <div className="flex flex-wrap gap-2">
                  {!m.ativo && (
                    <Botao
                      tamanho="pequeno"
                      variante="primario"
                      disabled={!desligado || ocupado}
                      onClick={() =>
                        void executar(
                          () => window.api.ativarMundo(m.nome),
                          () => `"${m.nome}" agora é o mundo ativo.`
                        )
                      }
                    >
                      Tornar ativo
                    </Botao>
                  )}
                  <Botao
                    tamanho="pequeno"
                    disabled={!desligado || ocupado}
                    onClick={() =>
                      void executar(
                        () => window.api.exportarMundo(m.nome),
                        (salvo) => (salvo ? `Mundo "${m.nome}" exportado.` : null)
                      )
                    }
                  >
                    Exportar .zip
                  </Botao>
                  {!m.ativo && (
                    <Botao
                      tamanho="pequeno"
                      variante="perigo"
                      disabled={!desligado || ocupado}
                      onClick={() => setPedido({ tipo: 'apagar', mundo: m })}
                    >
                      Apagar
                    </Botao>
                  )}
                </div>
              </CardImagem>
            ))}
          </div>
        )}
      </Secao>

      <Dialogo
        aberto={!!pedido}
        titulo={pedido?.tipo === 'apagar' ? `Apagar "${pedido.mundo.nome}"?` : 'Gerar mundo novo'}
        aoCancelar={() => setPedido(null)}
        acao={{
          rotulo: pedido?.tipo === 'apagar' ? 'Apagar' : 'Gerar',
          variante: pedido?.tipo === 'apagar' ? 'perigo' : 'primario',
          aoClicar: confirmar,
          ocupado,
          desabilitado: pedido?.tipo === 'gerar' && !nome.trim()
        }}
      >
        {pedido?.tipo === 'apagar' ? (
          <p>
            O mundo e o Nether e o End dele vão ser apagados. Antes, o app faz um backup, que fica
            em Cópias de segurança.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[13px]">
              Nome da pasta do mundo
              <Campo autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              Seed (opcional)
              <Campo
                value={seed}
                placeholder="Deixe vazio para uma seed aleatória"
                onChange={(e) => setSeed(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted">
              Antes, o app faz um backup do mundo ativo. O mundo novo é criado quando o servidor
              ligar.
            </p>
          </div>
        )}
      </Dialogo>
    </PaginaAjustes>
  )
}
