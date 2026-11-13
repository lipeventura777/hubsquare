import { useCallback, useEffect, useState } from 'react'
import type { Captura, ErroTela, Instalacao } from '../../../shared/tipos'
import { IconeCaptura } from '../componentes/icones'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import { TituloPagina } from '../componentes/paineis'
import { Aviso, Botao, Dialogo, EstadoVazio, Selecao } from '../componentes/ui'

// PlaySquare › Capturas de tela (Fase P5, DESIGN.md seção 6.1.6): os prints (F2) da pasta
// screenshots de cada instalação, com filtro, visualização grande, copiar, abrir pasta, apagar
// (com confirmação; vai para a Lixeira) e "Usar como fundo" da instalação.

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function TelaCapturas(): React.JSX.Element {
  const [instalacoes, setInstalacoes] = useState<Instalacao[]>([])
  const [filtro, setFiltro] = useState<string>('')
  const [lista, setLista] = useState<Captura[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aberta, setAberta] = useState<Captura | null>(null)

  const carregar = useCallback(async (): Promise<void> => {
    const r = await window.api.listarCapturas(filtro || null)
    if (r.ok) setLista(r.valor)
    else setErro(r.erro)
  }, [filtro])

  useEffect(() => {
    window.api.listarInstalacoes().then((r) => r.ok && setInstalacoes(r.valor))
  }, [])
  useEffect(() => {
    let vivo = true
    window.api.listarCapturas(filtro || null).then((r) => {
      if (!vivo) return
      if (r.ok) setLista(r.valor)
      else setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [filtro])

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <TituloPagina>Capturas de tela</TituloPagina>
          <Selecao
            aria-label="Instalação"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="min-w-[220px]"
          >
            <option value="">Todas as instalações</option>
            {instalacoes.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <p className="-mt-6 text-[13px] text-muted">
          Os prints que você tira com F2 no jogo, de cada instalação. Os mais novos primeiro.
        </p>
        {erro && <MensagemErro erro={erro} />}
        {lista === null ? (
          <Esqueleto linhas={4} />
        ) : !lista.length ? (
          <EstadoVazio
            icone={<IconeCaptura />}
            titulo="Nenhum print ainda"
            texto="No jogo, aperte F2 para tirar um print. Ele aparece aqui."
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {lista.map((c, n) => (
              <button
                key={`${c.instalacaoId}/${c.nome}`}
                type="button"
                onClick={() => setAberta(c)}
                style={{ '--ordem': n } as React.CSSProperties}
                className="group anim-item flex flex-col overflow-hidden border-2 border-linha bg-panel text-left transition-[transform,border-color] duration-(--dur-fast) ease-(--ease-out) hover:-translate-y-0.5 hover:border-muted active:translate-y-px"
              >
                <span className="aspect-video overflow-hidden">
                  <img
                    src={c.miniatura}
                    alt={`Print de ${c.instalacao}`}
                    className="h-full w-full object-cover transition-transform duration-(--dur-fast) group-hover:scale-[1.03]"
                  />
                </span>
                <span className="flex flex-col p-2 text-xs">
                  <b className="truncate" title={c.instalacao}>
                    {c.instalacao}
                  </b>
                  <span className="text-muted">{dataHora.format(new Date(c.data))}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {aberta && (
        <VerCaptura
          c={aberta}
          aoFechar={() => setAberta(null)}
          aoMudar={async () => {
            setAberta(null)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function VerCaptura({
  c,
  aoFechar,
  aoMudar
}: {
  c: Captura
  aoFechar: () => void
  aoMudar: () => Promise<void>
}): React.JSX.Element {
  const [grande, setGrande] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [apagar, setApagar] = useState(false)

  useEffect(() => {
    window.api
      .capturaGrande(c.instalacaoId, c.nome)
      .then((r) => (r.ok ? setGrande(r.valor) : setErro(r.erro)))
  }, [c])

  async function rodar(
    acao: () => Promise<{ ok: true } | { ok: false; erro: ErroTela }>,
    feito: string
  ): Promise<boolean> {
    const r = await acao()
    if (!r.ok) {
      setErro(r.erro)
      return false
    }
    setErro(null)
    setAviso(feito)
    return true
  }

  if (apagar) {
    return (
      <Dialogo
        aberto
        titulo="Apagar este print?"
        aoCancelar={() => setApagar(false)}
        acao={{
          rotulo: 'Apagar',
          variante: 'perigo',
          aoClicar: async () => {
            if (await rodar(() => window.api.apagarCaptura(c.instalacaoId, c.nome), 'Apagado.'))
              await aoMudar()
          }
        }}
      >
        <p className="text-[13px]">
          O print {c.nome} vai para a Lixeira do Windows, de onde dá para recuperar.
        </p>
        {erro && <MensagemErro erro={erro} />}
      </Dialogo>
    )
  }

  return (
    <Dialogo
      aberto
      titulo={`${c.instalacao} · ${dataHora.format(new Date(c.data))}`}
      aoCancelar={aoFechar}
      acao={{ rotulo: 'Fechar', aoClicar: aoFechar }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex min-h-[200px] items-center justify-center bg-console">
          {grande ? (
            <img
              src={grande}
              alt={`Print de ${c.instalacao}`}
              className="max-h-[60vh] w-full object-contain"
            />
          ) : (
            <img
              src={c.miniatura}
              alt=""
              className="max-h-[60vh] w-full object-contain opacity-60"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao
            onClick={() =>
              void rodar(
                () => window.api.copiarCaptura(c.instalacaoId, c.nome),
                'Copiado: é só colar onde quiser.'
              )
            }
          >
            Copiar
          </Botao>
          <Botao
            onClick={() => void rodar(() => window.api.mostrarCaptura(c.instalacaoId, c.nome), '')}
          >
            Abrir pasta
          </Botao>
          <Botao
            variante="destaque"
            onClick={() =>
              void rodar(
                () => window.api.usarCapturaComoFundo(c.instalacaoId, c.nome),
                `Agora é o fundo da instalação ${c.instalacao} na tela Jogar.`
              )
            }
          >
            Usar como fundo
          </Botao>
          <Botao variante="perigo" onClick={() => setApagar(true)}>
            Apagar…
          </Botao>
        </div>
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && <MensagemErro erro={erro} />}
      </div>
    </Dialogo>
  )
}
