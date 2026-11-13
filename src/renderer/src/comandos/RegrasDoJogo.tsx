import { useCallback, useEffect, useState } from 'react'
import type { RegraDoJogo } from '../../../shared/comandos'
import type { ErroTela, RespostaComando } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import { Botao, Campo, Interruptor } from '../componentes/ui'
import { Previa, Respostas, previa, type Central } from './pecas'
import { textoDaRegra } from './textosComandos'

// Aba Regras do jogo (Fase 26): todas as regras da versão (da árvore de comandos do servidor),
// com o valor atual lido do servidor. As consultas aparecem no console como comandos normais.
export function RegrasDoJogo({
  central,
  regras
}: {
  central: Central
  regras: RegraDoJogo[]
}): React.JSX.Element {
  const [valores, setValores] = useState<Record<string, string> | null>(null)
  const [termo, setTermo] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [respostas, setRespostas] = useState<RespostaComando[]>([])
  const [numeros, setNumeros] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)

  const ler = useCallback(async (): Promise<void> => {
    if (!central.ligado) return
    setLendo(true)
    setErro(null)
    const r = await window.api.lerGamerules()
    setLendo(false)
    if (r.ok) setValores(r.valor)
    else setErro(r.erro)
  }, [central.ligado])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê ao abrir (com o servidor ligado)
    void ler()
  }, [ler])

  async function mudar(regra: RegraDoJogo, valor: boolean | number): Promise<void> {
    setOcupado(regra.nome)
    setErro(null)
    const r = await window.api.executarAcao({ tipo: 'gamerule', nome: regra.nome, valor })
    setOcupado(null)
    if (!r.ok) return setErro(r.erro)
    setRespostas(r.valor)
    if (r.valor.every((x) => x.ok !== false))
      setValores((v) => ({ ...v, [regra.nome]: String(valor) }))
  }

  const t = termo.trim().toLowerCase()
  const visiveis = regras.filter((r) => {
    const { titulo, descricao } = textoDaRegra(r.nome)
    return !t || [r.nome, titulo, descricao ?? ''].some((x) => x.toLowerCase().includes(t))
  })
  // As que têm descrição em português primeiro (são as mais usadas).
  visiveis.sort(
    (a, b) => Number(!textoDaRegra(a.nome).descricao) - Number(!textoDaRegra(b.nome).descricao)
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Campo
          aria-label="Procurar regra"
          placeholder="Procurar regra (ex.: inventário, fogo, dormir)"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          className="max-w-[420px] flex-1"
        />
        <Botao tamanho="pequeno" disabled={!central.ligado || lendo} onClick={ler}>
          {lendo ? 'Lendo...' : 'Ler de novo do servidor'}
        </Botao>
        <span className="text-xs text-muted">{regras.length} regras nesta versão</span>
      </div>
      <Respostas respostas={respostas} />
      {erro && <MensagemErro erro={erro} />}
      {central.ligado && !valores && lendo && <Esqueleto linhas={6} />}

      <ul className="flex flex-col gap-2">
        {visiveis.map((r) => {
          const { titulo, descricao } = textoDaRegra(r.nome)
          const atual = valores?.[r.nome]
          const digitado = numeros[r.nome] ?? atual ?? ''
          const valor = r.tipo === 'bool' ? atual !== 'true' : Number(digitado)
          const { comandos, erro: invalido } = previa(
            { tipo: 'gamerule', nome: r.nome, valor },
            central.ctx
          )
          return (
            <li key={r.nome} className="flex flex-wrap items-center gap-3 bg-panel-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">{titulo}</p>
                {descricao && <p className="text-xs text-muted">{descricao}</p>}
                <Previa
                  comandos={
                    r.tipo === 'bool' || numeros[r.nome] !== undefined
                      ? comandos
                      : [`gamerule ${r.nome}`]
                  }
                  erro={numeros[r.nome] !== undefined ? invalido : null}
                />
              </div>
              {r.tipo === 'bool' ? (
                <Interruptor
                  ligado={atual === 'true'}
                  rotulo={titulo}
                  disabled={!central.ligado || atual === undefined || ocupado === r.nome}
                  aoMudar={(v) => mudar(r, v)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Campo
                    aria-label={titulo}
                    inputMode="numeric"
                    value={digitado}
                    onChange={(e) => setNumeros((n) => ({ ...n, [r.nome]: e.target.value }))}
                    className="w-28 font-mono"
                  />
                  <Botao
                    tamanho="pequeno"
                    variante="primario"
                    disabled={
                      !central.ligado ||
                      !!invalido ||
                      numeros[r.nome] === undefined ||
                      ocupado === r.nome
                    }
                    onClick={async () => {
                      await mudar(r, Number(digitado))
                      setNumeros((n) => {
                        const copia = { ...n }
                        delete copia[r.nome]
                        return copia
                      })
                    }}
                  >
                    Salvar
                  </Botao>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
