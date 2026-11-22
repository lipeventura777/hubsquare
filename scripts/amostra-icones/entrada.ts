// Fase P7: página de amostra dos ícones (só para conferir; não entra no app). Desenha o quadro
// parado do bioma de verdade (ARTE), põe por cima um painel de vidro com os tokens do app e cada
// ícone em 16, 20 e 24 px: na cor do texto, na cor de destaque do bioma e numa cor qualquer.
import type { Bioma } from '../../src/shared/tipos'
import { ALTURA, ARTE, LARGURA } from '../../src/renderer/src/fundo/biomas'
import { FORMAS, NOMES_ICONES } from '../../src/renderer/src/icones/formas'

const parametros = new URLSearchParams(location.search)
const bioma = (parametros.get('bioma') ?? 'noite') as Bioma
const titulo = parametros.get('titulo') ?? bioma
document.documentElement.dataset.bioma = bioma

const tela = document.querySelector('canvas')!
tela.width = LARGURA
tela.height = ALTURA
const c = tela.getContext('2d')!
ARTE[bioma].criar().quadro(c, 0, 0, 0, false)

const svg = (nome: string, px: number, cheio = false): string => {
  const f = FORMAS[nome as keyof typeof FORMAS] as { traco: string; detalhe?: string }
  const fundo = cheio
    ? `<path d="${f.traco}" fill="currentColor" stroke="none"/>`
    : f.detalhe
      ? `<path d="${f.detalhe}" fill="currentColor" stroke="none" opacity="0.25"/>`
      : ''
  return `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${fundo}<path d="${f.traco}"/></svg>`
}

const CHEIOS = new Set(['coracao', 'comida', 'favorito'])
const celulas = NOMES_ICONES.map(
  (n) => `<div class="celula">
    <div class="tamanhos">${svg(n, 16)}${svg(n, 20)}${svg(n, 24)}</div>
    <div class="tamanhos accent">${svg(n, 20)}${CHEIOS.has(n) ? svg(n, 20, true) : ''}</div>
    <div class="tamanhos outra">${svg(n, 20)}</div>
    <span>${n}</span>
  </div>`
).join('')

document.querySelector('#painel')!.innerHTML = `
  <h1>Ícones HubSquare · ${titulo}</h1>
  <p>Cada célula: 16, 20 e 24 px na cor do texto · 20 px no destaque do bioma (e o "cheio") · 20 px numa cor qualquer.</p>
  <div class="grade">${celulas}</div>`
