import { join } from 'path'
import { NOMES_TIPOS, type InfoServidor, type Progresso } from '../shared/tipos'
import { compararVersoes } from '../shared/versoes'
import { compactarMundo } from './backup'
import { ErroApp, detalhar } from './erros'
import { nivelDoMundo } from './mundo'
import { prepararMundoDoPaper } from './mundoPaper'
import {
  aoLigar,
  atualizarInfo,
  comServidorDesligado,
  exigirServidor,
  instalarJarEJava,
  registrarNoConsole,
  validarVersao
} from './servidor'
import { ehTipo } from './tipos'

// Mundo que veio do Paper e agora roda em outro software: sem isso, o servidor fecha com
// "Overworld settings missing". Roda antes de cada ligar (também conserta trocas antigas).
aoLigar(async (info) => {
  if (info.tipo === 'paper') return
  if (await prepararMundoDoPaper(join(info.pasta, await nivelDoMundo(info.pasta)))) {
    registrarNoConsole(
      `[ServSquare] O mundo veio do Paper: copiei a seed e as dimensões para onde o ${NOMES_TIPOS[info.tipo]} procura.`
    )
  }
})

// Tela Software: troca o tipo (loader) e a versão do servidor ativo. Só desligado,
// com backup antes, e com confirmação extra para voltar a uma versão mais antiga.
export async function trocarSoftware(
  pedido: unknown,
  aoProgredir: (p: Progresso) => void
): Promise<InfoServidor> {
  const info = await exigirServidor()
  const { tipo, versao, confirmouVersaoAntiga } = (pedido ?? {}) as Record<string, unknown>
  if (!ehTipo(tipo)) throw new ErroApp('Tipo de servidor desconhecido. Escolha um tipo da lista.')
  const versaoOk = await validarVersao(tipo, versao)
  if (tipo === info.tipo && versaoOk === info.versao) return info

  if (compararVersoes(versaoOk, info.versao) < 0 && confirmouVersaoAntiga !== true) {
    throw new ErroApp(
      'Voltar para uma versão mais antiga pode estragar o mundo. Marque a confirmação na tela para continuar.'
    )
  }

  return comServidorDesligado(async () => {
    aoProgredir({ etapa: 'Fazendo backup do mundo', recebido: 0, total: 0 })
    try {
      await compactarMundo(info, undefined, 'software')
    } catch (e) {
      throw new ErroApp(
        'Não consegui fazer o backup antes de trocar, então nada foi mudado. Tente de novo.',
        detalhar(e)
      )
    }
    const { java, versaoLoader } = await instalarJarEJava(info.pasta, tipo, versaoOk, aoProgredir)
    // Trocou o software: o servidor deixa de seguir o modpack de onde veio.
    const mudancas = { tipo, versao: versaoOk, java, versaoLoader, modpack: undefined }
    await atualizarInfo(info, mudancas)
    return { ...info, ...mudancas }
  })
}
