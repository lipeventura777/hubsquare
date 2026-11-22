import { IconeMaisAcoes } from '../icones'
import { useState } from 'react'
import { MODOS, NOMES_MODOS, type ErroTela } from '../../../shared/tipos'
import { rotuloPequeno } from '../componentes/estilos'
import { CabecaJogador } from '../componentes/paineis'
import { Campo, Dialogo, Menu } from '../componentes/ui'
import { comandos, enviar, useJogadores } from './comandos'
import { t } from '../../../shared/i18n'

// Lista de jogadores online (seção 6.5): quadrado com a inicial (nunca skins), nome e menu ⋯.
export function ListaJogadores({
  aoErro
}: {
  aoErro: (erro: ErroTela | null) => void
}): React.JSX.Element {
  const jogadores = useJogadores()
  const [expulsando, setExpulsando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  async function executar(comando: string): Promise<boolean> {
    aoErro(null)
    const r = await enviar(comando)
    if (!r.ok) aoErro(r.erro)
    return r.ok
  }

  async function expulsar(): Promise<void> {
    if (expulsando && (await executar(comandos.expulsar(expulsando, motivo)))) {
      setExpulsando(null)
      setMotivo('')
    }
  }

  return (
    <div className="flex min-h-0 flex-col border border-linha bg-panel">
      <div className={`${rotuloPequeno} border-b border-linha px-3 py-2`}>
        {t('listaJogadores.jogadores', { length: jogadores.length })}
      </div>
      {jogadores.length === 0 ? (
        <p className="p-3 text-[13px] text-muted">{t('listaJogadores.ninguemOnlineAgora')}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto">
          {jogadores.map((nome, i) => (
            <li
              key={nome}
              className="anim-item flex h-11 items-center gap-3 px-3"
              style={{ '--ordem': i } as React.CSSProperties}
            >
              <CabecaJogador nome={nome} tamanho={28} online />
              <span className="min-w-0 flex-1 truncate text-[13px]" title={nome}>
                {nome}
              </span>
              <Menu
                rotulo={t('listaJogadores.acoesPara', { nome })}
                classeBotao="flex h-8 w-8 items-center justify-center font-bold hover:bg-tile-active"
                itens={[
                  {
                    rotulo: t('listaJogadores.darOp'),
                    aoClicar: () => executar(comandos.darOp(nome))
                  },
                  {
                    rotulo: t('listaJogadores.tirarOp'),
                    aoClicar: () => executar(comandos.tirarOp(nome))
                  },
                  ...MODOS.map((m) => ({
                    rotulo: t('listaJogadores.modo', { v: NOMES_MODOS[m] }),
                    aoClicar: () => executar(comandos.mudarModo(nome, m))
                  })),
                  { rotulo: t('listaJogadores.expulsar'), aoClicar: () => setExpulsando(nome) }
                ]}
              >
                <IconeMaisAcoes />
              </Menu>
            </li>
          ))}
        </ul>
      )}

      <Dialogo
        aberto={expulsando !== null}
        titulo={t('listaJogadores.expulsar2', { v: expulsando ?? '' })}
        aoCancelar={() => setExpulsando(null)}
        acao={{ rotulo: t('listaJogadores.expulsar3'), variante: 'perigo', aoClicar: expulsar }}
      >
        <label className="flex flex-col gap-1 text-[13px]">
          {t('listaJogadores.motivoOpcionalApareceParaO')}
          <Campo value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} />
        </label>
      </Dialogo>
    </div>
  )
}
