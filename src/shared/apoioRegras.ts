// Doações (apoio ao projeto): o ÚNICO arquivo com os dados.
//
// Regras fixas: a doação é totalmente opcional e NUNCA libera recurso, tira aviso ou dá vantagem;
// o pagamento acontece sempre fora do app (o app só mostra o QR do Pix ou abre a página do GitHub
// Sponsors no navegador). Pix só funciona com conta em banco brasileiro: o português mostra o Pix;
// o inglês só mostra algo se o GitHub Sponsors estiver ativo.
//
// Quem pode importar este arquivo: só `src/main/apoio.ts` (que serve a tela de Sobre). Nenhum
// recurso do app lê estado de doação (tests/apoioRegras.test.ts confere).

// Pix: dado público de recebimento (não é segredo). O código tem CRC16 no fim: não mexa no texto.
export const PIX_TITULAR = 'Felipe Segantini Ventura'
export const PIX_CIDADE = 'SÃO PAULO'
export const PIX_CHAVE_ALEATORIA = 'c7635702-b5df-4323-8885-c5216230c3c6'
export const PIX_COPIA_E_COLA =
  '00020126580014BR.GOV.BCB.PIX0136c7635702-b5df-4323-8885-c5216230c3c65204000053039865802BR5924Felipe Segantini Ventura6009SAO PAULO62140510XWemeFnmCm63049010'

// GitHub Sponsors: a conta ainda não existe. `npm run ativar:sponsors -- <usuario> <url>` troca o
// marcador, liga o ativo e arruma o README e o FUNDING (docs/ATIVAR-SPONSORS.md).
export const GITHUB_SPONSORS_ATIVO = false
export const GITHUB_SPONSORS_URL = '[LINK_PAGINA_APOIO]'

// CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF) do padrão Pix, em 4 letras maiúsculas.
export function crc16Pix(texto: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// O copia e cola está inteiro? Termina em "6304" + o CRC16 de tudo que vem antes.
export function pixValido(copiaECola: string): boolean {
  return copiaECola.length > 8 && copiaECola.endsWith(crc16Pix(copiaECola.slice(0, -4)))
}

// Lê os campos de primeiro nível do código (formato TLV: 2 letras de id + 2 de tamanho + valor).
function campos(texto: string): Map<string, string> {
  const achados = new Map<string, string>()
  for (let i = 0; i + 4 <= texto.length;) {
    const tamanho = Number(texto.slice(i + 2, i + 4))
    achados.set(texto.slice(i, i + 2), texto.slice(i + 4, i + 4 + tamanho))
    i += 4 + tamanho
  }
  return achados
}

// A chave Pix que o código leva (campo 26, subcampo 01).
export const chaveDoPix = (copiaECola: string): string | null =>
  campos(campos(copiaECola).get('26') ?? '').get('01') ?? null

// Só aceita a página do GitHub Sponsors (https). Devolve a URL limpa ou null.
export function urlDeSponsors(url: string): string | null {
  return /^https:\/\/github\.com\/sponsors\/[A-Za-z0-9-]+\/?$/.test(url) ? url : null
}
