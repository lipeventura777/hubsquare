// Regras do Explorar sem rede nem arquivos (testadas em tests/explorarRegras.test.ts).
import type {
  Ambiente,
  DestinoProjeto,
  FiltrosExplorar,
  TipoConteudo,
  TipoId
} from '../shared/tipos'

// Valores do campo "environment" do Modrinth em cada opção do filtro "ambiente".
export const AMBIENTES: Record<Ambiente, string[]> = {
  servidor: ['server_only', 'server_only_client_optional', 'dedicated_server_only'],
  jogador: ['client_only', 'singleplayer_only'],
  ambos: [
    'client_and_server',
    'client_or_server',
    'client_or_server_prefers_both',
    'client_only_server_optional'
  ]
}

// Usa o campo novo (environment) e, sem ele, os antigos (client_side/server_side).
export function ambienteDe(
  environment?: string[] | null,
  serverSide?: string,
  clientSide?: string
): Ambiente | null {
  const valores = environment?.filter((e) => e !== 'unknown') ?? []
  if (valores.length) {
    for (const a of ['jogador', 'servidor', 'ambos'] as const) {
      if (valores.every((v) => AMBIENTES[a].includes(v))) return a
    }
    return 'ambos'
  }
  if (serverSide === 'unsupported') return 'jogador'
  if (clientSide === 'unsupported') return 'servidor'
  if (serverSide && clientSide && serverSide !== 'unknown') return 'ambos'
  return null
}

// O filtro de ambiente só faz sentido para o que roda no jogo (não para packs e shaders).
export function temAmbiente(tipo: TipoConteudo): boolean {
  return tipo === 'mod' || tipo === 'plugin' || tipo === 'datapack'
}

// Plugins e datapacks usam as mesmas categorias dos mods no Modrinth.
export function tipoDasCategorias(tipo: TipoConteudo): string {
  return tipo === 'plugin' || tipo === 'datapack' ? 'mod' : tipo
}

const ID = /^[\w-]{1,64}$/

// Filtros do Explorar no formato "facets" da busca do Modrinth: grupos de fora são E, de dentro OU.
// `loadersDoServidor` substitui o loader "servidor"; `esconder` são ids de projetos instalados.
export function facetsExplorar(
  f: FiltrosExplorar,
  loadersDoServidor: string[],
  esconder: string[]
): string[][] {
  const facets: string[][] = [[`project_type:${f.tipo}`]]
  const loaders = f.loader === 'servidor' ? loadersDoServidor : f.loader ? [f.loader] : []
  if (loaders.length) facets.push(loaders.map((l) => `categories:${l}`))
  if (f.versao) facets.push([`versions:${f.versao}`])
  for (const c of f.categorias) facets.push([`categories:${c}`])
  if (f.ambiente && temAmbiente(f.tipo)) {
    facets.push(AMBIENTES[f.ambiente].map((e) => `environment:${e}`))
  }
  if (f.codigoAberto) facets.push(['open_source:true'])
  if (f.esconderInstalados) {
    for (const id of esconder.filter((i) => ID.test(i)).slice(0, 100)) {
      facets.push([`project_id!=${id}`])
    }
  }
  return facets
}

// Para onde vai o projeto, conforme o tipo, onde ele roda e o software do servidor ativo.
// `jogador`: o alvo é uma instalação do PlaySquare (Fase P3). Aí "servidor" é a pasta mods da
// instalação e "amigos" é a pasta certa dela (shaderpacks, resourcepacks ou mods), na hora.
export function destinoDe(
  tipo: TipoConteudo,
  ambiente: Ambiente | null,
  servidor: TipoId,
  jogador = false
): { destino: DestinoProjeto; motivo?: string } {
  const deMods = servidor === 'fabric' || servidor === 'forge' || servidor === 'neoforge'
  if (jogador) {
    switch (tipo) {
      case 'modpack':
        return { destino: 'modpack' }
      case 'shader':
        return deMods
          ? { destino: 'amigos' }
          : {
              destino: 'incompativel',
              motivo: 'Shaders precisam do Iris ou do Oculus, que pedem Fabric, Forge ou NeoForge.'
            }
      case 'resourcepack':
        return { destino: 'amigos' }
      case 'datapack':
        return {
          destino: 'incompativel',
          motivo: 'Datapacks ficam dentro de cada mundo. Adicione pelo ServSquare, no servidor.'
        }
      case 'plugin':
        return { destino: 'incompativel', motivo: 'Plugins rodam só em servidores Paper.' }
      case 'mod':
        if (!deMods) {
          return {
            destino: 'incompativel',
            motivo: 'Mods precisam de Fabric, Forge ou NeoForge, e esta instalação é Vanilla.'
          }
        }
        // Mods com dependências vão pela pasta mods (o planejamento instala as dependências).
        return { destino: ambiente === 'jogador' ? 'amigos' : 'servidor' }
    }
  }
  switch (tipo) {
    case 'modpack':
      return { destino: 'modpack' }
    case 'shader':
      return { destino: 'amigos' }
    case 'resourcepack':
      return { destino: 'resourcepack' }
    case 'datapack':
      return { destino: 'datapack' }
    case 'plugin':
      return servidor === 'paper'
        ? { destino: 'servidor' }
        : { destino: 'incompativel', motivo: 'Plugins precisam do Paper. Troque na tela Software.' }
    case 'mod':
      if (!deMods) {
        return {
          destino: 'incompativel',
          motivo: 'Mods precisam de Fabric, Forge ou NeoForge. Troque na tela Software.'
        }
      }
      return { destino: ambiente === 'jogador' ? 'amigos' : 'servidor' }
  }
}

// Pasta do item dentro do .mrpack dos amigos.
export function pastaNoPacote(tipo: TipoConteudo): 'mods' | 'shaderpacks' | 'resourcepacks' {
  return tipo === 'shader' ? 'shaderpacks' : tipo === 'resourcepack' ? 'resourcepacks' : 'mods'
}
