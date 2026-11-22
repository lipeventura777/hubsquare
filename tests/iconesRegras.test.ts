import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FORMAS, NOMES_ICONES } from '../src/renderer/src/icones/formas'

// Fase P7 (DESIGN.md 6.11): grade de 24 px com 2 px de margem, pontos inteiros, retas só a 0°,
// 90° ou 45°, e curva só quando o objeto pede.
const COM_CURVA = new Set(['mundos'])

interface Segmento {
  de: [number, number]
  para: [number, number]
  curva: boolean
}

// Lê um caminho SVG (M L H V Z, A e C, absolutos e relativos) e devolve os segmentos.
function segmentos(d: string): Segmento[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? []
  const lista: Segmento[] = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let inicio: [number, number] = [0, 0]
  const num = (): number => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const de: [number, number] = [x, y]
    switch (cmd.toLowerCase()) {
      case 'm': {
        const nx = num()
        const ny = num()
        ;[x, y] = rel ? [x + nx, y + ny] : [nx, ny]
        inicio = [x, y]
        cmd = rel ? 'l' : 'L' // pares depois do M são linhas
        lista.push({ de: [x, y], para: [x, y], curva: false })
        continue
      }
      case 'l': {
        const nx = num()
        const ny = num()
        ;[x, y] = rel ? [x + nx, y + ny] : [nx, ny]
        break
      }
      case 'h': {
        const n = num()
        x = rel ? x + n : n
        break
      }
      case 'v': {
        const n = num()
        y = rel ? y + n : n
        break
      }
      case 'z':
        ;[x, y] = inicio
        lista.push({ de, para: [x, y], curva: false })
        continue
      case 'a': {
        i += 5 // rx ry rotação arco-grande sentido
        const nx = num()
        const ny = num()
        ;[x, y] = rel ? [x + nx, y + ny] : [nx, ny]
        lista.push({ de, para: [x, y], curva: true })
        continue
      }
      case 'c': {
        i += 4 // dois pontos de controle
        const nx = num()
        const ny = num()
        ;[x, y] = rel ? [x + nx, y + ny] : [nx, ny]
        lista.push({ de, para: [x, y], curva: true })
        continue
      }
      default:
        throw new Error(`comando de caminho não aceito: ${cmd}`)
    }
    lista.push({ de, para: [x, y], curva: false })
  }
  return lista
}

test('todo ícone segue a grade: pontos inteiros entre 3 e 21', () => {
  for (const nome of NOMES_ICONES) {
    const f = FORMAS[nome] as { traco: string; detalhe?: string }
    for (const d of [f.traco, f.detalhe].filter(Boolean) as string[]) {
      for (const s of segmentos(d)) {
        for (const [px, py] of [s.de, s.para]) {
          assert.ok(Number.isInteger(px) && Number.isInteger(py), `${nome}: ponto ${px},${py}`)
          assert.ok(
            px >= 3 && px <= 21 && py >= 3 && py <= 21,
            `${nome}: fora da margem ${px},${py}`
          )
        }
      }
    }
  }
})

test('retas só na horizontal, na vertical ou a 45°; curva só onde o objeto pede', () => {
  for (const nome of NOMES_ICONES) {
    for (const s of segmentos((FORMAS[nome] as { traco: string }).traco)) {
      if (s.curva) {
        assert.ok(COM_CURVA.has(nome), `${nome}: curva num ícone que não pede`)
        continue
      }
      const dx = Math.abs(s.para[0] - s.de[0])
      const dy = Math.abs(s.para[1] - s.de[1])
      assert.ok(
        dx === 0 || dy === 0 || dx === dy,
        `${nome}: reta fora de 0°/90°/45° (${dx}, ${dy})`
      )
    }
  }
})

test('o conjunto cobre o inventário da Fase P7', () => {
  assert.equal(NOMES_ICONES.length, new Set(NOMES_ICONES).size)
  for (const nome of ['servidor', 'instalacoes', 'maisAcoes', 'favorito', 'recarregar', 'erro']) {
    assert.ok(NOMES_ICONES.includes(nome as never), nome)
  }
})
