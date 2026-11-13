import { useEffect, useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import { Aviso, Botao, PaginaAjustes, Secao } from '../componentes/ui'

// Mods › Proibidos para jogadores (Fases P2 e P3): mods que o dono pede para os amigos não usarem.
// Vai no convite; o PlaySquare avisa e não abre o servidor com eles ativos. É um combinado entre
// amigos, não um antitrapaça: quem quiser burlar consegue.
export function ProibidosParaJogadores(): React.JSX.Element {
  const [texto, setTexto] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    window.api
      .estadoConvite()
      .then((r) => (r.ok ? setTexto(r.valor.proibidos.join('\n')) : setErro(r.erro)))
  }, [])

  if (texto === null) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={3} />}
      </PaginaAjustes>
    )
  }
  return (
    <PaginaAjustes>
      <Secao titulo="Proibidos para jogadores">
        <p className="text-[13px] text-muted">
          Um por linha, com parte do nome do arquivo do mod (ex.: “xray”). Quem entrar pelo convite
          vê o aviso no PlaySquare e não abre o servidor com um mod assim ativo. É um combinado
          entre amigos, não um antitrapaça: quem quiser burlar consegue.
        </p>
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setSalvo(false)
          }}
          rows={6}
          aria-label="Mods proibidos para jogadores"
          className="border border-linha bg-panel-2 p-2 font-mono text-[13px]"
        />
        <Botao
          className="self-start"
          variante="primario"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            const r = await window.api.salvarProibidos(texto.split(/\r?\n/).filter(Boolean))
            setOcupado(false)
            if (!r.ok) return setErro(r.erro)
            setErro(null)
            setTexto(r.valor.proibidos.join('\n'))
            setSalvo(true)
          }}
        >
          Salvar lista
        </Botao>
        {salvo && (
          <Aviso tipo="sucesso">
            Salvo. Os amigos recebem a lista nova da próxima vez que abrirem o PlaySquare.
          </Aviso>
        )}
        {erro && <MensagemErro erro={erro} />}
      </Secao>
    </PaginaAjustes>
  )
}
