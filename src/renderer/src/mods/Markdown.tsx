import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'
import { imagemPermitida } from '../../../shared/fontes'

// Descrições e changelogs do Modrinth: markdown com HTML misturado, vindo de terceiros.
// O marked converte e o DOMPurify limpa: sai script, estilo, formulário, iframe e todo atributo
// on*. Links abrem no navegador (a janela barra o resto); imagens fora dos CDNs oficiais (Modrinth, CurseForge, Hangar)
// viram link, porque a política da janela só carrega imagens deles.

const PROIBIDAS = ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object']

DOMPurify.addHook('afterSanitizeAttributes', (no) => {
  if (no.tagName === 'A') {
    no.setAttribute('target', '_blank')
    no.setAttribute('rel', 'noreferrer')
  }
})

function linkExterno(texto: string, url: string): HTMLAnchorElement {
  const link = document.createElement('a')
  link.textContent = texto
  if (url.startsWith('https://')) {
    link.href = url
    link.target = '_blank'
    link.rel = 'noreferrer'
  }
  return link
}

function htmlSeguro(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true })
  const limpo = DOMPurify.sanitize(html, {
    FORBID_TAGS: PROIBIDAS,
    FORBID_ATTR: ['style'],
    RETURN_DOM_FRAGMENT: true
  })
  for (const img of limpo.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? ''
    if (imagemPermitida(src)) img.loading = 'lazy'
    else img.replaceWith(linkExterno(`[imagem: ${img.alt || 'site externo'}]`, src))
  }
  const caixa = document.createElement('div')
  caixa.append(limpo)
  return caixa.innerHTML
}

export function Markdown({ texto }: { texto: string }): React.JSX.Element {
  const html = useMemo(() => htmlSeguro(texto), [texto])
  return (
    // O HTML já passou pelo DOMPurify (htmlSeguro).
    <div
      className="markdown text-[13px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
