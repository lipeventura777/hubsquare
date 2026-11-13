// Cores derivadas da cor de destaque (DESIGN.md, seção 3):
// hover = 15% menos luminosidade, sombra do relevo = 35% menos,
// e texto escuro quando a cor é clara (luminância maior que 0,5).
// Sem imports, para poder testar com o Node (tests/accent.test.ts).

function paraRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function paraHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  ;[r, g, b] = [r / 255, g / 255, b / 255]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function hslParaHex(h: number, s: number, l: number): string {
  if (s === 0) return paraHex(l * 255, l * 255, l * 255)
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const canal = (t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return paraHex(canal(h + 1 / 3) * 255, canal(h) * 255, canal(h - 1 / 3) * 255)
}

// Luminância relativa (a mesma do cálculo de contraste do WCAG).
export function luminancia(hex: string): number {
  const [r, g, b] = paraRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function derivarAccent(hex: string): {
  hover: string
  sombra: string
  textoEscuro: boolean
} {
  const [h, s, l] = rgbParaHsl(...paraRgb(hex))
  return {
    hover: hslParaHex(h, s, l * 0.85),
    sombra: hslParaHex(h, s, l * 0.65),
    // O texto que der mais contraste: o escuro (#0f172a) vence o branco acima de 0,198.
    textoEscuro: luminancia(hex) > 0.198
  }
}
