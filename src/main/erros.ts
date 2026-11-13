import type { ErroTela, Resultado } from '../shared/tipos'

// Erro com mensagem pronta para o usuário: o que aconteceu + o que fazer.
export class ErroApp extends Error {
  readonly detalhes: string
  readonly falhas?: string[] // arquivos que falharam ("Tentar de novo só os que falharam")
  readonly cancelado?: boolean // o usuário clicou em Cancelar
  readonly emprestado?: boolean // Fase M7: servidor passado a um amigo
  constructor(
    mensagem: string,
    detalhes = '',
    extra: { falhas?: string[]; cancelado?: boolean; emprestado?: boolean } = {}
  ) {
    super(mensagem)
    this.detalhes = detalhes
    this.falhas = extra.falhas
    this.cancelado = extra.cancelado
    this.emprestado = extra.emprestado
  }
}

export function detalhar(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const causa = e.cause ? `\nCausa: ${detalhar(e.cause)}` : ''
  return (e.stack ?? e.message) + causa
}

export function paraTela(e: unknown): ErroTela {
  if (e instanceof ErroApp) {
    return {
      mensagem: e.message,
      detalhes: e.detalhes || detalhar(e),
      ...(e.falhas && { falhas: e.falhas }),
      ...(e.cancelado && { cancelado: true }),
      ...(e.emprestado && { emprestado: true })
    }
  }
  return {
    mensagem: 'Algo deu errado. Tente de novo. Se continuar, veja os detalhes abaixo.',
    detalhes: detalhar(e)
  }
}

// Toda resposta de IPC passa por aqui, para a tela sempre receber um erro legível.
export async function tentar<T>(fn: () => Promise<T> | T): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await fn() }
  } catch (e) {
    return { ok: false, erro: paraTela(e) }
  }
}
