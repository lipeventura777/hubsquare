import { app, safeStorage } from 'electron'
import { readFile, rm } from 'fs/promises'
import { join } from 'path'
import { gravarComSeguranca } from './config'
import { ErroApp } from './erros'

// Chave da API do CurseForge (Fase 24): cada usuário pede a própria e cola em
// Opções › Integrações. Fica só na pasta de dados do app, criptografada pelo Windows
// (safeStorage); nunca no código, no repositório nem no instalador, e nunca volta para a tela.

const arquivo = (): string => join(app.getPath('userData'), 'curseforge.json')

export async function lerChave(): Promise<string | null> {
  try {
    const { chave } = JSON.parse(await readFile(arquivo(), 'utf8'))
    if (typeof chave !== 'string' || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(Buffer.from(chave, 'base64'))
  } catch {
    return null
  }
}

export async function temChave(): Promise<boolean> {
  return (await lerChave()) !== null
}

// Confere a chave com um pedido simples antes de guardar.
export async function salvarChave(
  valor: unknown,
  testar: (chave: string) => Promise<boolean>
): Promise<void> {
  const chave = typeof valor === 'string' ? valor.trim() : ''
  if (!/^[\x21-\x7e]{20,200}$/.test(chave)) {
    throw new ErroApp('Essa chave não parece certa. Copie a chave inteira do e-mail do CurseForge.')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new ErroApp(
      'O Windows não deixou criptografar a chave, então ela não foi guardada. Reinicie o PC e tente de novo.'
    )
  }
  if (!(await testar(chave))) {
    throw new ErroApp(
      'O CurseForge recusou essa chave. Confira se copiou certo e se ela já foi aprovada.'
    )
  }
  const cifrada = safeStorage.encryptString(chave).toString('base64')
  await gravarComSeguranca(arquivo(), JSON.stringify({ chave: cifrada }))
}

export async function apagarChave(): Promise<void> {
  await rm(arquivo(), { force: true })
}
