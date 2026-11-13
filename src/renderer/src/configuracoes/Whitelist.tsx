import { useEffect, useState } from 'react'
import type { Amigo, ErroTela, ListaId, Resultado } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Botao, Campo, Secao } from '../componentes/ui'

const TEXTOS: Record<
  ListaId,
  { explicacao: string; titulo: string; campo: string; maximo: number; remover: string }
> = {
  whitelist: {
    explicacao:
      'Só quem está nesta lista pode entrar no servidor. Adicione você e seus amigos pelo nome usado no jogo.',
    titulo: 'Na whitelist',
    campo: 'Nome no jogo',
    maximo: 16,
    remover: 'Remover'
  },
  ops: {
    explicacao: 'Operadores podem usar todos os comandos do servidor. Dê só para quem você confia.',
    titulo: 'Operadores',
    campo: 'Nome no jogo',
    maximo: 16,
    remover: 'Tirar OP'
  },
  banidos: {
    explicacao: 'Quem está nesta lista não consegue entrar no servidor.',
    titulo: 'Jogadores banidos',
    campo: 'Nome no jogo',
    maximo: 16,
    remover: 'Desbanir'
  },
  ipsBanidos: {
    explicacao: 'Ninguém consegue entrar no servidor a partir destes endereços.',
    titulo: 'IPs banidos',
    campo: 'Endereço IP (ex.: 123.45.67.89)',
    maximo: 15,
    remover: 'Desbanir'
  }
}

// Uma das listas .json do servidor, com adicionar e remover. Ligado, o app manda o comando;
// desligado, edita o arquivo.
export function ListaDoServidor({ lista }: { lista: ListaId }): React.JSX.Element {
  const textos = TEXTOS[lista]
  const [itens, setItens] = useState<Amigo[]>([])
  const [valor, setValor] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.listarLista(lista).then((r) => (r.ok ? setItens(r.valor) : setErro(r.erro)))
  }, [lista])

  async function executar(acao: () => Promise<Resultado<Amigo[]>>): Promise<boolean> {
    setErro(null)
    setOcupado(true)
    const r = await acao()
    setOcupado(false)
    if (r.ok) setItens(r.valor)
    else setErro(r.erro)
    return r.ok
  }

  async function adicionar(evento: React.FormEvent): Promise<void> {
    evento.preventDefault()
    if (valor.trim() && (await executar(() => window.api.adicionarNaLista(lista, valor)))) {
      setValor('')
    }
  }

  return (
    <>
      <Secao titulo="Adicionar">
        <p className="text-[13px] text-muted">{textos.explicacao}</p>
        <form onSubmit={adicionar} className="flex gap-2">
          <Campo
            value={valor}
            maxLength={textos.maximo}
            placeholder={textos.campo}
            aria-label={textos.campo}
            onChange={(e) => setValor(e.target.value)}
          />
          <Botao type="submit" variante="primario" disabled={ocupado || !valor.trim()}>
            Adicionar
          </Botao>
        </form>
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Secao titulo={`${textos.titulo} (${itens.length})`}>
        {itens.length === 0 ? (
          <p className="text-[13px] text-muted">Ninguém na lista ainda.</p>
        ) : (
          <ul className="divide-y divide-linha border border-linha bg-panel">
            {itens.map((a, i) => (
              <li
                key={a.uuid || a.name}
                className="anim-item flex h-11 items-center justify-between px-3"
                style={{ '--ordem': i } as React.CSSProperties}
              >
                <span className="text-[13px]">{a.name}</span>
                <Botao
                  variante="perigo"
                  tamanho="pequeno"
                  onClick={() => executar(() => window.api.removerDaLista(lista, a.name))}
                  disabled={ocupado}
                >
                  {textos.remover}
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </>
  )
}
