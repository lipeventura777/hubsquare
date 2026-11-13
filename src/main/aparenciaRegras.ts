import { BIOMAS, TEMAS, type Aparencia, type Bioma, type Tema } from '../shared/tipos'
import { MODOS_ANIMACAO, type ModoAnimacao } from '../shared/animacaoRegras'

// Migração do aparencia.json (Fase V1), sem Electron: testada em tests/aparenciaRegras.test.ts.
// Claro vira Dia claro e escuro vira Dia ("seguir o Windows" usa o que o Windows mostra agora).
// As cores de destaque que eram as padrão antigas passam a seguir o bioma; cor escolhida pelo
// usuário continua. Imagem de fundo, escurecimento e o resto ficam como estavam. Os campos
// antigos continuam no arquivo, para uma versão antiga do app ainda conseguir ler.

export const DESTAQUE_ANTIGO = '#3c8527'
export const DESTAQUE_PLAY_ANTIGO = '#2f6fd6'

export const PADRAO: Aparencia = {
  tema: 'sistema',
  bioma: 'dia',
  vidroLeve: false,
  particulasSobreImagem: true,
  destaque: null,
  destaquePlay: null,
  escurecimento: 0.6,
  fundo: null,
  fundoEmTodoApp: false,
  reduzirAnimacoes: false
}

const ehCor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

export const biomaDoTema = (tema: Tema, windowsEscuro: boolean): Bioma =>
  tema === 'claro' ? 'diaClaro' : tema === 'escuro' ? 'dia' : windowsEscuro ? 'dia' : 'diaClaro'

// Devolve as preferências já no formato novo e se o arquivo precisa ser regravado.
export function migrarAparencia(
  salvo: Record<string, unknown>,
  windowsEscuro: boolean
): { aparencia: Aparencia; migrou: boolean } {
  const tema = TEMAS.includes(salvo.tema as Tema) ? (salvo.tema as Tema) : PADRAO.tema
  const antigo = !BIOMAS.includes(salvo.bioma as Bioma)
  const cor = (v: unknown, padraoAntigo: string): string | null =>
    !ehCor(v) || (antigo && v.toLowerCase() === padraoAntigo) ? null : v
  const aparencia: Aparencia = {
    ...PADRAO,
    ...salvo,
    tema,
    bioma: antigo ? biomaDoTema(tema, windowsEscuro) : (salvo.bioma as Bioma),
    vidroLeve: salvo.vidroLeve === true,
    animacaoFundo: MODOS_ANIMACAO.includes(salvo.animacaoFundo as ModoAnimacao)
      ? (salvo.animacaoFundo as ModoAnimacao)
      : undefined,
    particulasSobreImagem: salvo.particulasSobreImagem !== false,
    destaque: cor(salvo.destaque, DESTAQUE_ANTIGO),
    destaquePlay: cor(salvo.destaquePlay, DESTAQUE_PLAY_ANTIGO)
  }
  return { aparencia, migrou: antigo }
}
