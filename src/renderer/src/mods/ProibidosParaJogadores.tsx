import { useEffect, useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import { Aviso, Botao, PaginaAjustes, Secao } from '../componentes/ui'
import { t } from '../../../shared/i18n'

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
      <Secao titulo={t('proibidosParaJogadores.proibidosParaJogadores')}>
        <p className="text-[13px] text-muted">{t('proibidosParaJogadores.umPorLinhaComParte')}</p>
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setSalvo(false)
          }}
          rows={6}
          aria-label={t('proibidosParaJogadores.modsProibidosParaJogadores')}
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
          {t('proibidosParaJogadores.salvarLista')}
        </Botao>
        {salvo && <Aviso tipo="sucesso">{t('proibidosParaJogadores.salvoOsAmigosRecebemA')}</Aviso>}
        {erro && <MensagemErro erro={erro} />}
      </Secao>
    </PaginaAjustes>
  )
}
