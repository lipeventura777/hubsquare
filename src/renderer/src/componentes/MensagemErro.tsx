import { useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { Botao } from './ui'
import { BotaoRelatorio } from './RelatorioErro'

// A mensagem vem como "O que aconteceu. O que fazer.": a primeira frase vira o título.
function dividir(mensagem: string): [string, string] {
  const fim = mensagem.search(/[.!?]\s/)
  return fim < 0 ? [mensagem, ''] : [mensagem.slice(0, fim + 1), mensagem.slice(fim + 2)]
}

// Painel de erro (seção 6.9): fundo --danger a 12%, barra de 4px à esquerda e "Ver detalhes".
// Com `falhas`, lista os arquivos que não deram certo; com `aoTentarDeNovo`, oferece repetir só eles.
export function MensagemErro({
  erro,
  aoTentarDeNovo
}: {
  erro: ErroTela
  aoTentarDeNovo?: () => void
}): React.JSX.Element {
  const [titulo, oQueFazer] = dividir(erro.mensagem)
  const [copiado, setCopiado] = useState(false)
  const [ligando, setLigando] = useState(false)
  const [erroLigar, setErroLigar] = useState<string | null>(null)

  async function ligarMesmoAssim(): Promise<void> {
    setLigando(true)
    const r = await window.api.ligarMesmoEmprestado()
    setLigando(false)
    setErroLigar(r.ok ? null : r.erro.mensagem)
  }

  async function copiar(): Promise<void> {
    // A área de transferência da página (o canal app:copiar só aceita textos curtos, como endereços).
    await navigator.clipboard.writeText(erro.detalhes)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div role="alert" className="border-l-4 border-danger bg-danger/12 px-4 py-3 text-texto">
      <p className="font-bold">{titulo}</p>
      {oQueFazer && <p className="mt-1 text-sm">{oQueFazer}</p>}
      {erro.falhas && erro.falhas.length > 0 && (
        <ul className="mt-2 max-h-32 overflow-auto font-mono text-xs">
          {erro.falhas.map((f) => (
            <li key={f} className="truncate" title={f}>
              {f}
            </li>
          ))}
        </ul>
      )}
      {erro.emprestado && (
        <>
          <Botao
            variante="perigo"
            tamanho="pequeno"
            className="mt-2"
            onClick={ligarMesmoAssim}
            disabled={ligando}
          >
            {ligando ? 'Ligando...' : 'Ligar mesmo assim'}
          </Botao>
          {erroLigar && <p className="mt-1 text-sm">{erroLigar}</p>}
        </>
      )}
      {aoTentarDeNovo && (
        <Botao variante="perigo" tamanho="pequeno" className="mt-2" onClick={aoTentarDeNovo}>
          Tentar de novo só os que falharam
        </Botao>
      )}
      {erro.detalhes && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted underline">Ver detalhes</summary>
          <pre className="mt-2 max-h-48 overflow-auto bg-console p-3 font-mono text-xs break-all whitespace-pre-wrap text-console-muted">
            {erro.detalhes}
          </pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <Botao tamanho="pequeno" onClick={copiar}>
              {copiado ? 'Copiado!' : 'Copiar'}
            </Botao>
            <BotaoRelatorio pequeno />
          </div>
        </details>
      )}
    </div>
  )
}
