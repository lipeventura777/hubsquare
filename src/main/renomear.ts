import { shell } from 'electron'
import { ErroApp } from './erros'
import { atualizarInfo, exigirServidor, validarNome } from './servidor'
import { acharItem, lerIndice, lerInfo } from './servidores'
import { t } from '../shared/i18n'

export async function abrirPastaDoServidor(): Promise<void> {
  const info = await exigirServidor()
  const erro = await shell.openPath(info.pasta)
  if (erro) {
    throw new ErroApp(t('p.renomear.naoConseguiAbrirAPasta', { pasta: info.pasta }), erro)
  }
}

// Renomeia só o nome mostrado (índice e hubsquare.json). A pasta do servidor e a de backups
// não mudam de lugar: nada é movido fora do fluxo "Apagar servidor".
// Sem id, renomeia o servidor ativo.
export async function renomearServidor(valor: unknown, id?: unknown): Promise<void> {
  const item = id === undefined ? undefined : await acharItem(id)
  if (id !== undefined && !item) throw new ErroApp(t('p.renomear.esseServidorNaoEstaMais'))
  const info = item ? await lerInfo(item) : await exigirServidor()
  if (!info) throw new ErroApp(t('p.renomear.aPastaDesseServidorNao'))

  const nome = validarNome(valor)
  if (nome === info.nome) return
  const repetido = (await lerIndice()).servidores.some(
    (s) => s.id !== info.id && s.nome.toLowerCase() === nome.toLowerCase()
  )
  if (repetido) throw new ErroApp(t('p.renomear.jaExisteUmServidorChamado', { nome }))
  await atualizarInfo(info, { nome })
}
