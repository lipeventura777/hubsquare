import { t } from '../shared/i18n'
import { limparTexto, type Limpeza } from './relatorioRegras'

// Relatar problema (Fase R1), sem Electron: monta o link mailto: e a URL da issue nova do GitHub
// com o texto já limpo de segredos. Nada é enviado daqui: o app só abre o link com o clique.

export const EMAIL_SUPORTE = 'suporte.hubsquare@gmail.com'
export const REPOSITORIO = 'https://github.com/lipeventura777/hubsquare'

export const TIPOS_RELATO = ['bug', 'problema', 'sugestao', 'outro'] as const
export type TipoRelato = (typeof TIPOS_RELATO)[number]
export const ehTipoRelato = (x: unknown): x is TipoRelato => TIPOS_RELATO.includes(x as TipoRelato)

// O relatório de erro vem marcado para bug e problema.
export const relatorioPorPadrao = (tipo: TipoRelato): boolean =>
  tipo === 'bug' || tipo === 'problema'

// O Windows corta links longos ao abrir o programa de e-mail (por volta de 2.048 caracteres);
// o GitHub recusa URLs muito longas (por volta de 8.000).
export const LIMITE_MAILTO = 2000
export const LIMITE_ISSUE = 7500
const COMECO_NO_TITULO = 60
export const LIMITE_DESCRICAO = 5000 // o que a tela deixa digitar

export interface Relato {
  tipo: TipoRelato
  descricao: string
  versao: string
  windows: string
  idioma: string
  arquivo: string | null // nome do .zip do relatório, se foi gerado
}

// Tira segredos e o nome do usuário do Windows do que a pessoa digitou (mesma limpeza da M8).
export const limparDescricao = (texto: string, l: Limpeza): string =>
  limparTexto(texto.slice(0, LIMITE_DESCRICAO), l).trim()

const nomeDoTipo = (tipo: TipoRelato): string =>
  ({
    bug: t('relatar.tipoBug'),
    problema: t('relatar.tipoProblema'),
    sugestao: t('relatar.tipoSugestao'),
    outro: t('relatar.tipoOutro')
  })[tipo]

function comecoDe(descricao: string): string {
  const linha =
    descricao
      .split(/\r?\n/)
      .find((l) => l.trim())
      ?.trim() ?? ''
  return linha.length > COMECO_NO_TITULO ? `${linha.slice(0, COMECO_NO_TITULO - 1)}…` : linha
}

export const assuntoDoRelato = (r: Relato): string =>
  `[HubSquare ${r.versao}] ${nomeDoTipo(r.tipo)}: ${comecoDe(r.descricao)}`.trim()

function rodape(r: Relato): string {
  return [
    `${t('relatar.corpoVersao')}: ${r.versao}`,
    `${t('relatar.corpoWindows')}: ${r.windows}`,
    `${t('relatar.corpoIdioma')}: ${r.idioma}`,
    r.arquivo ? `${t('relatar.corpoRelatorio')}: ${r.arquivo}` : t('relatar.corpoSemRelatorio')
  ].join('\n')
}

// Corta a descrição até o link caber no limite (o resto do corpo é pequeno e sempre vai).
function caber(montar: (descricao: string) => string, descricao: string, limite: number): string {
  let url = montar(descricao)
  if (url.length <= limite) return url
  const marca = `\n[${t('relatar.corpoCortado')}]`
  let fim = descricao.length
  while (fim > 0) {
    // Corta proporcionalmente ao excesso (cada caractere pode virar até 9 no link: %XX%XX%XX).
    fim = Math.max(0, fim - Math.max(1, Math.ceil((url.length - limite) / 3)))
    url = montar(descricao.slice(0, fim).replace(/[\uD800-\uDBFF]$/, '') + marca)
    if (url.length <= limite) return url
  }
  return montar(marca.trim())
}

const codificar = (s: string): string => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'))

export function montarMailto(r: Relato, email = EMAIL_SUPORTE): string {
  const assunto = assuntoDoRelato(r)
  return caber(
    (d) =>
      `mailto:${email}?subject=${codificar(assunto)}&body=${codificar(`${d}\n\n---\n${rodape(r)}`)}`,
    r.descricao,
    LIMITE_MAILTO
  )
}

// Os modelos de .github/ISSUE_TEMPLATE: bug.yml (campos versao, oque, relatorio) e sugestao.yml
// (campos problema, ideia). O GitHub preenche os campos pelo id na consulta.
const ETIQUETA: Record<TipoRelato, string> = {
  bug: 'bug',
  problema: 'bug',
  sugestao: 'enhancement',
  outro: 'question'
}

export function montarUrlIssue(r: Relato, repositorio = REPOSITORIO): string {
  const sugestao = r.tipo === 'sugestao'
  return caber(
    (d) => {
      const q = new URLSearchParams({
        template: sugestao ? 'sugestao.yml' : 'bug.yml',
        title: assuntoDoRelato(r),
        labels: ETIQUETA[r.tipo]
      })
      if (sugestao) {
        q.set('problema', d)
        q.set('ideia', `${t('relatar.corpoVejaAcima')}\n\n---\n${rodape(r)}`)
      } else {
        q.set('versao', r.versao)
        q.set('oque', `${d}\n\n---\n${rodape(r)}`)
        if (r.arquivo) q.set('relatorio', t('relatar.corpoArrasteOArquivo', { arquivo: r.arquivo }))
      }
      return `${repositorio}/issues/new?${q.toString().replace(/\+/g, '%20')}`
    },
    r.descricao,
    LIMITE_ISSUE
  )
}
