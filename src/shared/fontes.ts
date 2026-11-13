// Fontes de conteúdo do Explorar (Fase 24) e os CDNs oficiais de cada uma.
// Usado pelo processo principal e pela tela (imagens das descrições).

export const FONTES = ['modrinth', 'curseforge', 'hangar'] as const
export type Fonte = (typeof FONTES)[number]

export const NOMES_FONTES: Record<Fonte, string> = {
  modrinth: 'Modrinth',
  curseforge: 'CurseForge',
  hangar: 'Hangar'
}

// Imagens (ícones, galeria e descrições) só destes endereços (a política da janela também).
const IMAGENS = ['cdn.modrinth.com', 'media.forgecdn.net', 'hangarcdn.papermc.io']

// Downloads de arquivos só do CDN oficial de cada fonte.
const DOWNLOADS: Record<Fonte, string[]> = {
  modrinth: ['cdn.modrinth.com'],
  curseforge: ['edge.forgecdn.net', 'mediafilez.forgecdn.net'],
  hangar: ['hangarcdn.papermc.io']
}

function hostHttps(url: string | null | undefined): string | null {
  try {
    const u = new URL(url ?? '')
    return u.protocol === 'https:' ? u.hostname : null
  } catch {
    return null
  }
}

export function imagemPermitida(url: string | null | undefined): boolean {
  const h = hostHttps(url)
  return !!h && IMAGENS.includes(h)
}

export function downloadPermitido(url: string | null | undefined, fonte: Fonte): boolean {
  const h = hostHttps(url)
  return !!h && DOWNLOADS[fonte].includes(h)
}
