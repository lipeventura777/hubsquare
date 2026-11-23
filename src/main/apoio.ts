import { shell } from 'electron'
import type { DadosApoio } from '../shared/tipos'
import {
  GITHUB_SPONSORS_ATIVO,
  GITHUB_SPONSORS_URL,
  PIX_CHAVE_ALEATORIA,
  PIX_CIDADE,
  PIX_COPIA_E_COLA,
  PIX_TITULAR,
  urlDeSponsors
} from '../shared/apoioRegras'
import { ErroApp } from './erros'
import { t } from '../shared/i18n'

// Doações: o que a tela de Sobre precisa para mostrar "Apoiar o projeto". O app só abre a página do
// GitHub Sponsors no navegador (nunca recebe pagamento) e nada daqui entra em log ou relatório.
// Nos testes, HUBSQUARE_SPONSORS_TESTE=<url do Sponsors> liga o Sponsors sem mexer no código.
function sponsors(): string | null {
  const dosTestes = process.env.HUBSQUARE_SPONSORS_TESTE
  if (dosTestes) return urlDeSponsors(dosTestes)
  return GITHUB_SPONSORS_ATIVO ? urlDeSponsors(GITHUB_SPONSORS_URL) : null
}

export function dadosDeApoio(): DadosApoio {
  return {
    pix: PIX_COPIA_E_COLA,
    titular: PIX_TITULAR,
    cidade: PIX_CIDADE,
    chave: PIX_CHAVE_ALEATORIA,
    sponsorsAtivo: sponsors() !== null
  }
}

export async function abrirSponsors(): Promise<void> {
  const url = sponsors()
  if (!url) throw new ErroApp(t('p.apoio.indisponivel'))
  await shell.openExternal(url)
}
