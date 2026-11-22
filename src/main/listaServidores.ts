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
import { t } from '../shared/i18n'

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
  if (!item) throw new ErroApp(t('p.listaServidores.esseServidorNaoEstaMais'))
  const indice = await lerIndice()
  if (item.id === indice.ativo) return
  if (lerEstado() !== 'desligado') {
    throw new ErroApp(t('p.listaServidores.outroServidorEstaLigadoDesligue'))
  }
  await definirAtivo(item.id)
}

// "Desligar X e ligar Y": desliga o ligado do jeito certo, espera o backup, troca e (se pedido) liga.
export async function trocarServidor(id: unknown, ligarDepois: unknown): Promise<void> {
  const item = await acharItem(id)
  if (!item) throw new ErroApp(t('p.listaServidores.esseServidorNaoEstaMais'))
  if (!(await lerInfo(item))) {
    throw new ErroApp(t('p.listaServidores.aPastaDoServidorNao', { nome: item.nome }))
  }
  await desligar()
  await esperarTarefas() // o backup feito ao desligar precisa terminar antes
  await definirAtivo(item.id)
  if (ligarDepois === true) await ligar()
}

// Apagar: só desligado, com o nome digitado igual, backup final do mundo antes,
// e só se a pasta estiver dentro de Documentos/HubSquare/servidores.
export async function apagarServidor(id: unknown, confirmacao: unknown): Promise<void> {
  const item = await acharItem(id)
  if (!item) throw new ErroApp(t('p.listaServidores.esseServidorNaoEstaMais'))
  if (confirmacao !== item.nome) {
    throw new ErroApp(t('p.listaServidores.oNomeDigitadoNaoConfere'))
  }
  const indice = await lerIndice()
  if (item.id === indice.ativo && lerEstado() !== 'desligado') {
    throw new ErroApp(t('p.listaServidores.desligueOServidorAntesDe'))
  }
  if (!dentroDe(pastaServidores(), item.pasta) || item.pasta === pastaServidores()) {
    throw new ErroApp(t('p.listaServidores.aPastaDesseServidorFica'), item.pasta)
  }

  return comServidorDesligado(async () => {
    const info = await lerInfo(item)
    if (info) {
      try {
        await compactarMundo(info, undefined, 'apagar') // backup final; ele fica em Documentos/HubSquare/backups
      } catch (e) {
        throw new ErroApp(t('p.listaServidores.naoConseguiFazerOBackup'), detalhar(e))
      }
    }
    if (existsSync(item.pasta)) {
      try {
        await rm(item.pasta, { recursive: true, force: true })
      } catch (e) {
        throw new ErroApp(t('p.listaServidores.naoConseguiApagarAPasta'), detalhar(e))
      }
    }
    await removerItem(item.id)
  })
}
