import { diferencas } from './pastasReais'

// Depois da rodada: se qualquer teste tocou nas pastas reais do app, a rodada falha.
export default function (): void {
  const mudou = diferencas()
  if (mudou.length) {
    throw new Error(
      `Os testes mexeram nas pastas reais do app (proibido):\n${mudou.slice(0, 20).join('\n')}`
    )
  }
  console.log('Isolamento: pastas reais do app iguais antes e depois dos testes.')
}
