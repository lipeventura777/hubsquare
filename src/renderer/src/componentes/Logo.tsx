import completaSvg from '../../../../build/logo/hubsquare-logo.svg?raw'
import pequenaSvg from '../../../../build/logo/hubsquare-logo-pequena.svg?raw'
import { versaoDaLogo } from '../../../shared/marcaRegras'
import { OFICIAIS, VARIAVEIS, type PaletaLogo } from '../../../shared/logoCoresRegras'

// Marca do HubSquare (DESIGN.md, seção Marca): os dois SVGs de build/logo/, nunca redesenhados.
// Abaixo de 56 px vai a versão PEQUENA; de 56 px para cima, a COMPLETA. Dentro do app as cores
// vêm das variáveis --logo-* (logoCoresRegras.ts): as oficiais por padrão, ou as que acompanham o
// fundo. Só a cor muda; desenho, proporções e contorno são os do arquivo.

const CHAVES = Object.keys(OFICIAIS) as (keyof PaletaLogo)[]

// Troca cada cor oficial do arquivo pela variável dela (com a oficial de reserva). O branco só
// aparece nas letras da pequena: o primeiro é o H (face esquerda), o segundo o S (face direita).
function comVariaveis(svg: string): string {
  let brancos = 0
  return svg
    .replace(/width="512" height="512"/, 'width="100%" height="100%"')
    .replace(/(fill|stroke)="(#[0-9A-Fa-f]{6})"/g, (texto, propriedade: string, cor: string) => {
      const c = cor.toLowerCase()
      const chave =
        c === '#ffffff'
          ? brancos++ === 0
            ? 'esquerdaLetraPequena'
            : 'direitaLetraPequena'
          : CHAVES.find((k) => OFICIAIS[k] === c)
      return chave ? `style="${propriedade}:var(${VARIAVEIS[chave]},${c})"` : texto
    })
}
const SVG = { completa: comVariaveis(completaSvg), pequena: comVariaveis(pequenaSvg) }

export function Logo({ tamanho }: { tamanho: number }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      data-logo={versaoDaLogo(tamanho)}
      className="logo-cores inline-block shrink-0 select-none"
      style={{ width: tamanho, height: tamanho }}
      // O SVG é um arquivo do próprio app (build/logo/), não vem de fora.
      dangerouslySetInnerHTML={{ __html: SVG[versaoDaLogo(tamanho)] }}
    />
  )
}

// "HubSquare" em Inter ExtraBold. Com a paleta da cena do fundo, "Hub" fica no tom da face do H e
// "Square" no da face do S, na claridade que dá 4,5:1 (--logo-nome-hub e --logo-nome-square); sem
// ela, as cores oficiais do nome (--marca-hub e --marca-square, claras ou escuras pelo bioma).
export function Wordmark({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <span className={`wordmark font-extrabold tracking-[-0.02em] whitespace-nowrap ${className}`}>
      <span className="text-(--logo-nome-hub,var(--marca-hub))">Hub</span>
      <span className="text-(--logo-nome-square,var(--marca-square))">Square</span>
    </span>
  )
}
