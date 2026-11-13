// Os arquivos do app importam sem extensão ("./erros"), como o bundler aceita. Nos testes, o Node
// precisa do ".ts": se não achar o caminho, tenta de novo com ele.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(especificador, contexto, proximo) {
    try {
      return proximo(especificador, contexto)
    } catch (erro) {
      if (!especificador.startsWith('.') || /\.\w+$/.test(especificador)) throw erro
      return proximo(`${especificador}.ts`, contexto)
    }
  }
})
