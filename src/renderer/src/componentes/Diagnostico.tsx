/* eslint-disable react-refresh/only-export-components -- o botão e o conserto do dono andam juntos */
import { useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import {
  NOMES_CONSERTOS,
  primeiroProblema,
  textoParaCopiar,
  type Conserto,
  type LinhaDiagnostico,
  type ResultadoChecagem
} from '../../../shared/diagnosticoRegras'
import { abrirTela } from '../estrutura/navegar'
import { MensagemErro } from './MensagemErro'
import { Esqueleto } from './movimento'
import { Botao, Dialogo } from './ui'
import type { Variante } from './estilos'

// Diagnóstico de conexão (Fase M5, DESIGN.md seção 6.22.9): um botão que confere em ordem e
// mostra a lista, com o primeiro problema em destaque, o conserto quando existe (sempre com o
// clique) e "Copiar resultado" (sem tokens nem IP público completo).

const ICONE: Record<ResultadoChecagem, { simbolo: string; classe: string; rotulo: string }> = {
  ok: { simbolo: '✓', classe: 'text-online', rotulo: 'certo' },
  falhou: { simbolo: '✗', classe: 'text-danger', rotulo: 'problema' },
  aviso: { simbolo: '!', classe: 'text-warning', rotulo: 'aviso' },
  pulada: { simbolo: '–', classe: 'text-muted', rotulo: 'não conferido' }
}

export function BotaoDiagnostico({
  rotulo,
  titulo,
  rodar,
  aoConsertar,
  variante,
  tamanho
}: {
  rotulo: string
  titulo: string
  rodar: () => Promise<{ ok: true; valor: LinhaDiagnostico[] } | { ok: false; erro: ErroTela }>
  // "fechar": o conserto abre outra coisa (ex.: Jogadores, atualizar); senão confere de novo.
  aoConsertar: (c: Conserto) => Promise<'fechar' | void>
  variante?: Variante
  tamanho?: 'pequeno' | 'normal'
}): React.JSX.Element {
  const [aberto, setAberto] = useState(false)
  const [linhas, setLinhas] = useState<LinhaDiagnostico[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function conferir(): Promise<void> {
    setOcupado(true)
    setLinhas(null)
    setErro(null)
    const r = await rodar()
    setOcupado(false)
    if (r.ok) setLinhas(r.valor)
    else setErro(r.erro)
  }

  async function consertar(c: Conserto): Promise<void> {
    setOcupado(true)
    try {
      if ((await aoConsertar(c)) === 'fechar') return setAberto(false)
    } finally {
      setOcupado(false)
    }
    await conferir()
  }

  const problema = linhas ? primeiroProblema(linhas) : null
  return (
    <>
      <Botao
        variante={variante}
        tamanho={tamanho}
        onClick={() => {
          setAberto(true)
          void conferir()
        }}
      >
        {rotulo}
      </Botao>
      <Dialogo
        aberto={aberto}
        titulo={titulo}
        aoCancelar={() => setAberto(false)}
        acao={{ rotulo: 'Conferir de novo', aoClicar: () => void conferir(), ocupado }}
      >
        <div className="flex min-w-0 flex-col gap-3 text-[13px]">
          {erro && <MensagemErro erro={erro} />}
          {!linhas && !erro && <Esqueleto linhas={4} />}
          {linhas && (
            <>
              <p className="font-bold">
                {problema
                  ? `O que impede a entrada: ${problema.nome}.`
                  : 'Tudo certo: nada impede a entrada.'}
              </p>
              <ul className="flex flex-col gap-1" aria-label="Resultado do diagnóstico">
                {linhas.map((l) => {
                  const icone = ICONE[l.resultado]
                  return (
                    <li
                      key={l.id}
                      className={`flex flex-wrap items-start gap-3 bg-panel-2 px-3 py-2 ${
                        l === problema ? 'border-l-4 border-danger' : ''
                      }`}
                    >
                      <span
                        className={`w-4 shrink-0 text-center font-bold ${icone.classe}`}
                        aria-label={icone.rotulo}
                      >
                        {icone.simbolo}
                      </span>
                      <div
                        className={`min-w-0 flex-1 ${l.resultado === 'pulada' ? 'text-muted' : ''}`}
                      >
                        <div className="font-bold">{l.nome}</div>
                        <div>{l.frase}</div>
                      </div>
                      {l.conserto && (l.resultado === 'falhou' || l.resultado === 'aviso') && (
                        <Botao
                          tamanho="pequeno"
                          variante="primario"
                          disabled={ocupado}
                          onClick={() => void consertar(l.conserto!)}
                        >
                          {NOMES_CONSERTOS[l.conserto]}
                        </Botao>
                      )}
                    </li>
                  )
                })}
              </ul>
              <Botao
                className="self-start"
                onClick={async () => {
                  await window.api.copiar(textoParaCopiar(titulo, linhas))
                  setCopiado(true)
                  setTimeout(() => setCopiado(false), 2000)
                }}
              >
                {copiado ? 'Copiado!' : 'Copiar resultado'}
              </Botao>
            </>
          )}
        </div>
      </Dialogo>
    </>
  )
}

// Consertos do dono (Conexão e Painel). "Ver os pedidos" abre Jogadores; o resto roda no
// processo principal, sempre por este clique.
export async function consertoDoDono(c: Conserto): Promise<'fechar' | void> {
  if (c === 'abrirPedidos') {
    abrirTela('Jogadores', 'Todos')
    return 'fechar'
  }
  await window.api.consertarDono(c)
}
