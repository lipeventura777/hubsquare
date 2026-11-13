import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import type { ItemServidor } from '../shared/tipos'
import { compactarMundo } from './backup'
import { ErroApp, detalhar } from './erros'
import { dentroDe } from './mundo'
import {
  comServidorDesligado,
  desligar,
  esperarTarefas,
  lerEstado,
  ligar,
  pastaServidores
} from './servidor'
import { lerIcone } from './icone'
import { textoEmprestado } from './passarRegras'
import { acharItem, definirAtivo, lerIndice, lerInfo, removerItem } from './servidores'

// Ações da tela Servidores. Regra: só o servidor ativo pode estar ligado, então trocar o ativo
// com um servidor ligado sempre passa por desligar (com o backup de sempre) antes.

// Fase M7: "Com Bia desde 13/11/2026", enquanto o servidor está passado para um amigo.
async function emprestadoDe(s: Parameters<typeof lerInfo>[0]): Promise<string | undefined> {
  const e = (await lerInfo(s))?.emprestado
  return e ? textoEmprestado(e) : undefined
}

export async function listarServidores(): Promise<ItemServidor[]> {
  const indice = await lerIndice()
  return Promise.all(
    indice.servidores.map(async (s) => ({
      emprestado: await emprestadoDe(s),
      id: s.id,
      nome: s.nome,
      tipo: s.tipo,
      versao: s.versao,
      ativo: s.id === indice.ativo,
      estado: s.id === indice.ativo ? lerEstado() : 'desligado',
      icone: await lerIcone(s.pasta)
    }))
  )
}

export async function ativarServidor(id: unknown): Promise<void> {
  const item = await acharItem(id)
  if (!item) throw new ErroApp('Esse servidor não está mais na lista.')
  const indice = await lerIndice()
  if (item.id === indice.ativo) return
  if (lerEstado() !== 'desligado') {
    throw new ErroApp('Outro servidor está ligado. Desligue ele antes de trocar.')
  }
  await definirAtivo(item.id)
}

// "Desligar X e ligar Y": desliga o ligado do jeito certo, espera o backup, troca e (se pedido) liga.
export async function trocarServidor(id: unknown, ligarDepois: unknown): Promise<void> {
  const item = await acharItem(id)
  if (!item) throw new ErroApp('Esse servidor não está mais na lista.')
  if (!(await lerInfo(item))) {
    throw new ErroApp(`A pasta do servidor "${item.nome}" não foi encontrada.`)
  }
  await desligar()
  await esperarTarefas() // o backup feito ao desligar precisa terminar antes
  await definirAtivo(item.id)
  if (ligarDepois === true) await ligar()
}

// Apagar: só desligado, com o nome digitado igual, backup final do mundo antes,
// e só se a pasta estiver dentro de Documentos/ServSquare/servidores.
export async function apagarServidor(id: unknown, confirmacao: unknown): Promise<void> {
  const item = await acharItem(id)
  if (!item) throw new ErroApp('Esse servidor não está mais na lista.')
  if (confirmacao !== item.nome) {
    throw new ErroApp(
      'O nome digitado não confere. Digite o nome do servidor exatamente como aparece.'
    )
  }
  const indice = await lerIndice()
  if (item.id === indice.ativo && lerEstado() !== 'desligado') {
    throw new ErroApp('Desligue o servidor antes de apagar.')
  }
  if (!dentroDe(pastaServidores(), item.pasta) || item.pasta === pastaServidores()) {
    throw new ErroApp(
      'A pasta desse servidor fica fora da pasta do ServSquare, então o app não apaga ela sozinho. Apague pelo Explorador, se quiser.',
      item.pasta
    )
  }

  return comServidorDesligado(async () => {
    const info = await lerInfo(item)
    if (info) {
      try {
        await compactarMundo(info, undefined, 'apagar') // backup final; ele fica em Documentos/ServSquare/backups
      } catch (e) {
        throw new ErroApp(
          'Não consegui fazer o backup final do mundo, então o servidor não foi apagado. Tente de novo.',
          detalhar(e)
        )
      }
    }
    if (existsSync(item.pasta)) {
      try {
        await rm(item.pasta, { recursive: true, force: true })
      } catch (e) {
        throw new ErroApp(
          'Não consegui apagar a pasta do servidor. Feche janelas do Explorador abertas nela e tente de novo.',
          detalhar(e)
        )
      }
    }
    await removerItem(item.id)
  })
}
