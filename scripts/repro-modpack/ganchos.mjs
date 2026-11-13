// Ganchos do Node para rodar o código do app (TypeScript, importado sem extensão) pelo terminal:
// "electron" vira o substituto de testes e "?asset" (ícones do Vite) vira um texto vazio.
import { registerHooks } from 'node:module'

const real = globalThis.__electronReal
const falso = real
  ? 'data:text/javascript,' +
    encodeURIComponent(
      'const e = globalThis.__electronReal; export default e; ' +
        Object.keys(real)
          .map((k) => `export const ${k} = e.${k};`)
          .join(' ')
    )
  : new URL('./electron-falso.mjs', import.meta.url).href

registerHooks({
  resolve(especificador, contexto, proximo) {
    if (especificador === 'electron') return { url: falso, shortCircuit: true }
    if (especificador.includes('?asset'))
      return { url: 'data:text/javascript,export default ""', shortCircuit: true }
    try {
      return proximo(especificador, contexto)
    } catch (erro) {
      if (!especificador.startsWith('.') || /\.\w+$/.test(especificador)) throw erro
      try {
        return proximo(`${especificador}.ts`, contexto)
      } catch {
        return proximo(`${especificador}/index.ts`, contexto)
      }
    }
  }
})
