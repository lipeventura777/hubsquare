import { app } from 'electron'
import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'

// Fase R1: erros que o app engole para seguir em frente, mas que importam para entender um
// problema, vão para logs/erros.log (pasta de dados) com onde aconteceu e o que estava sendo
// feito. Só a mensagem (sem a pilha), em uma linha. Nunca lança: o fluxo continua igual.
//
// Uso: algo().catch(registrarErro('mods.ts', 'aplicar as mudanças ao desligar'))
export const registrarErro =
  (onde: string, fazendo: string) =>
  (e: unknown): void => {
    const motivo = (e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, ' ')
    const pasta = join(app.getPath('userData'), 'logs')
    void mkdir(pasta, { recursive: true })
      .then(() =>
        appendFile(
          join(pasta, 'erros.log'),
          `[${new Date().toISOString()}] ${onde}: ${fazendo}: ${motivo}\n`
        )
      )
      // Sem conseguir gravar o próprio log não há onde registrar.
      .catch(() => {})
  }
