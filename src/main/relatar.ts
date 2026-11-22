import { app, shell } from 'electron'
import { release, version } from 'os'
import { join } from 'path'
import type { RelatoEnviado } from '../shared/tipos'
import { idiomaAtual, t } from '../shared/i18n'
import { ErroApp } from './erros'
import {
  ehTipoRelato,
  limparDescricao,
  montarMailto,
  montarUrlIssue,
  EMAIL_SUPORTE
} from './relatarRegras'
import { gerarRelatorio, limpezaDoPc, opcoesRelatorio } from './relatorio'

// Relatar problema (Fase R1): com o clique do usuário, gera o relatório da M8 (se ele quiser),
// limpa a descrição e abre o programa de e-mail (mailto:) ou a issue nova do GitHub já preenchida.
// O app não envia nada: quem envia é o usuário, no e-mail ou no navegador.

let ultimoRelatorio: string | null = null // caminho do último .zip, para "Mostrar o arquivo"

export async function enviarRelato(pedido: unknown): Promise<RelatoEnviado> {
  const { tipo, descricao, incluirRelatorio, via } = (pedido ?? {}) as Record<string, unknown>
  if (!ehTipoRelato(tipo) || typeof descricao !== 'string' || !descricao.trim()) {
    throw new ErroApp(t('p.relatar.faltaADescricao'), String(tipo))
  }
  if (via !== 'email' && via !== 'github')
    throw new ErroApp(t('p.relatar.faltaADescricao'), String(via))

  let caminho: string | null = null
  if (incluirRelatorio === true) {
    // A escolha padrão da M8: o servidor ativo e a instalação usada por último, todos os itens.
    const opcoes = await opcoesRelatorio()
    const gerado = await gerarRelatorio({
      servidorId: opcoes.servidorPadrao,
      instalacaoId: opcoes.instalacaoPadrao,
      tirar: []
    })
    caminho = join(app.getPath('desktop'), gerado.arquivo)
    ultimoRelatorio = caminho
  }

  const relato = {
    tipo,
    descricao: limparDescricao(descricao, await limpezaDoPc()),
    versao: app.getVersion(),
    windows: `${version()} (${release()})`,
    idioma: idiomaAtual(),
    arquivo: caminho ? caminho.split(/[\\/]/).pop()! : null
  }
  const url = via === 'email' ? montarMailto(relato) : montarUrlIssue(relato)
  // Sem programa de e-mail configurado, o Windows recusa o mailto: e a tela mostra o endereço.
  const abriu = await shell.openExternal(url).then(
    () => true,
    () => false
  )
  if (via === 'email' && abriu && caminho) shell.showItemInFolder(caminho)
  return { url, abriu, email: EMAIL_SUPORTE, arquivo: relato.arquivo, caminho }
}

export function mostrarUltimoRelatorio(): void {
  if (!ultimoRelatorio) throw new ErroApp(t('p.relatar.semRelatorio'), '')
  shell.showItemInFolder(ultimoRelatorio)
}
