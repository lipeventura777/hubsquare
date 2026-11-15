import { definirIdioma } from '../../shared/i18n'

// Fase I1: a tela usa o idioma que o processo principal decidiu. Este arquivo é importado
// primeiro em main.tsx, antes de qualquer tela montar textos.
const { idioma } = window.api.idioma
definirIdioma(idioma)
document.documentElement.lang = idioma

// Trocar o idioma recarrega só a tela (o app, o servidor e os downloads continuam rodando) e
// volta para a aba Idioma / Language, de onde a troca saiu.
const VOLTAR = 'hubsquare:voltarIdioma'
window.api.aoMudarIdioma(() => {
  try {
    sessionStorage.setItem(VOLTAR, '1')
  } catch {
    // sem armazenamento: recarrega na tela inicial
  }
  location.reload()
})

export const voltouDoIdioma = ((): boolean => {
  try {
    const v = sessionStorage.getItem(VOLTAR) === '1'
    sessionStorage.removeItem(VOLTAR)
    return v
  } catch {
    return false
  }
})()
