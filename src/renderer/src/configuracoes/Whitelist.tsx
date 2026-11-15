import { useEffect, useState } from 'react'
import type { Amigo, ErroTela, ListaId, Resultado } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Botao, Campo, Secao } from '../componentes/ui'
import { t } from '../../../shared/i18n'

const TEXTOS: Record<
  ListaId,
  { explicacao: string; titulo: string; campo: string; maximo: number; remover: string }
> = {
  whitelist: {
    explicacao: t('whitelist.soQuemEstaNestaLista'),
    titulo: t('whitelist.naWhitelist'),
    campo: t('whitelist.nomeNoJogo'),
    maximo: 16,
    remover: t('whitelist.remover')
  },
  ops: {
    explicacao: t('whitelist.operadoresPodemUsarTodosOs'),
    titulo: t('whitelist.operadores'),
    campo: t('whitelist.nomeNoJogo'),
    maximo: 16,
    remover: t('whitelist.tirarOp')
  },
  banidos: {
    explicacao: t('whitelist.quemEstaNestaListaNao'),
    titulo: t('whitelist.jogadoresBanidos'),
    campo: t('whitelist.nomeNoJogo'),
    maximo: 16,
    remover: t('whitelist.desbanir')
  },
  ipsBanidos: {
    explicacao: t('whitelist.ninguemConsegueEntrarNoServidor'),
    titulo: t('whitelist.ipsBanidos'),
    campo: t('whitelist.enderecoIpEx12345'),
    maximo: 15,
    remover: t('whitelist.desbanir')
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
      <Secao titulo={t('whitelist.adicionar')}>
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
            {t('whitelist.adicionar')}
          </Botao>
        </form>
        {erro && <MensagemErro erro={erro} />}
      </Secao>

      <Secao titulo={`${textos.titulo} (${itens.length})`}>
        {itens.length === 0 ? (
          <p className="text-[13px] text-muted">{t('whitelist.ninguemNaListaAinda')}</p>
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
