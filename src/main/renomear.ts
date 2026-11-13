import { shell } from 'electron'
import { ErroApp } from './erros'
import { atualizarInfo, exigirServidor, validarNome } from './servidor'
import { acharItem, lerIndice, lerInfo } from './servidores'

export async function abrirPastaDoServidor(): Promise<void> {
  const info = await exigirServidor()
  const erro = await shell.openPath(info.pasta)
  if (erro) {
    throw new ErroApp(
      `Não consegui abrir a pasta do servidor. Abra pelo Explorador: ${info.pasta}`,
      erro
    )
  }
}

// Renomeia só o nome mostrado (índice e servsquare.json). A pasta do servidor e a de backups
// não mudam de lugar: nada é movido fora do fluxo "Apagar servidor".
// Sem id, renomeia o servidor ativo.
export async function renomearServidor(valor: unknown, id?: unknown): Promise<void> {
  const item = id === undefined ? undefined : await acharItem(id)
  if (id !== undefined && !item) throw new ErroApp('Esse servidor não está mais na lista.')
  const info = item ? await lerInfo(item) : await exigirServidor()
  if (!info) throw new ErroApp('A pasta desse servidor não foi encontrada.')

  const nome = validarNome(valor)
  if (nome === info.nome) return
  const repetido = (await lerIndice()).servidores.some(
    (s) => s.id !== info.id && s.nome.toLowerCase() === nome.toLowerCase()
  )
  if (repetido) throw new ErroApp(`Já existe um servidor chamado "${nome}". Escolha outro nome.`)
  await atualizarInfo(info, { nome })
}
