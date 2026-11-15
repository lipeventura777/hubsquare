import { useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Campo, Dialogo } from '../componentes/ui'
import { t } from '../../../shared/i18n'

// Diálogo de renomear um servidor da lista (✎ da tela Servidores). Só muda o nome mostrado;
// a pasta do servidor não sai do lugar.
export function DialogoRenomear({
  servidor,
  aoFechar
}: {
  servidor: { id: string; nome: string } | null
  aoFechar: () => void
}): React.JSX.Element {
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)

  // Ao abrir para outro servidor, começa com o nome atual dele.
  if (servidor && aberto !== servidor.id) {
    setAberto(servidor.id)
    setNome(servidor.nome)
    setErro(null)
  }
  if (!servidor && aberto !== null) setAberto(null)

  async function renomear(): Promise<void> {
    if (!servidor) return
    setSalvando(true)
    const r = await window.api.renomearServidor(nome, servidor.id)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    // O nome aparece em várias telas; recarregar a janela é o jeito mais simples de atualizar todas.
    location.reload()
  }

  return (
    <Dialogo
      aberto={servidor !== null}
      titulo={t('renomearServidor.renomearServidor')}
      aoCancelar={aoFechar}
      acao={{
        rotulo: salvando ? t('renomearServidor.salvando') : t('renomearServidor.renomear'),
        aoClicar: renomear,
        ocupado: salvando,
        desabilitado: !nome.trim()
      }}
    >
      <label className="flex flex-col gap-1 text-[13px]">
        {t('renomearServidor.novoNomeAPastaDo')}
        <Campo
          value={nome}
          maxLength={32}
          autoFocus
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && renomear()}
        />
      </label>
      {erro && (
        <div className="mt-3">
          <MensagemErro erro={erro} />
        </div>
      )}
    </Dialogo>
  )
}
