import type { Ambiente } from '../../../shared/tipos'
import { t } from '../../../shared/i18n'

export const NOMES_AMBIENTE: Record<Ambiente, string> = {
  servidor: t('nomesModrinth.soNoServidor'),
  jogador: t('nomesModrinth.soNoJogador'),
  ambos: t('nomesModrinth.servidorEJogador')
}

// Nomes em português das etiquetas do Modrinth. Etiqueta nova, sem tradução, aparece como veio.

const CATEGORIAS: Record<string, string> = {
  adventure: t('nomesModrinth.aventura'),
  cursed: t('nomesModrinth.bizarro'),
  decoration: t('nomesModrinth.decoracao'),
  economy: t('nomesModrinth.economia'),
  equipment: t('nomesModrinth.equipamentos'),
  food: t('nomesModrinth.comida'),
  'game-mechanics': t('nomesModrinth.mecanicasDoJogo'),
  library: t('nomesModrinth.biblioteca'),
  magic: t('nomesModrinth.magia'),
  management: t('nomesModrinth.administracao'),
  minigame: t('nomesModrinth.minigame'),
  mobs: t('nomesModrinth.criaturas'),
  optimization: t('nomesModrinth.otimizacao'),
  social: t('nomesModrinth.social'),
  storage: t('nomesModrinth.armazenamento'),
  technology: t('nomesModrinth.tecnologia'),
  transportation: t('nomesModrinth.transporte'),
  utility: t('nomesModrinth.utilidades'),
  worldgen: t('nomesModrinth.geracaoDeMundo'),
  challenging: t('nomesModrinth.desafiador'),
  combat: t('nomesModrinth.combate'),
  'kitchen-sink': t('nomesModrinth.deTudoUmPouco'),
  lightweight: t('nomesModrinth.leve'),
  multiplayer: t('nomesModrinth.multijogador'),
  quests: t('nomesModrinth.missoes'),
  modded: t('nomesModrinth.paraMods'),
  realistic: t('nomesModrinth.realista'),
  simplistic: t('nomesModrinth.simples'),
  themed: t('nomesModrinth.tematico'),
  tweaks: t('nomesModrinth.ajustes'),
  'vanilla-like': t('nomesModrinth.parecidoComOOriginal'),
  cartoon: t('nomesModrinth.desenhoAnimado'),
  fantasy: t('nomesModrinth.fantasia'),
  'semi-realistic': t('nomesModrinth.semirrealista'),
  atmosphere: t('nomesModrinth.atmosfera'),
  bloom: t('nomesModrinth.brilhoBloom'),
  'colored-lighting': t('nomesModrinth.luzColorida'),
  foliage: t('nomesModrinth.folhagem'),
  'path-tracing': t('nomesModrinth.pathTracing'),
  pbr: t('nomesModrinth.pbr'),
  reflections: t('nomesModrinth.reflexos'),
  shadows: t('nomesModrinth.sombras'),
  audio: t('nomesModrinth.audio'),
  blocks: t('nomesModrinth.blocos'),
  'core-shaders': t('nomesModrinth.coreShaders'),
  entities: t('nomesModrinth.entidades'),
  environment: t('nomesModrinth.ambiente'),
  fonts: t('nomesModrinth.fontes'),
  gui: t('nomesModrinth.interface'),
  items: t('nomesModrinth.itens'),
  locale: t('nomesModrinth.idioma'),
  models: t('nomesModrinth.modelos'),
  high: t('nomesModrinth.alto'),
  medium: t('nomesModrinth.medio'),
  low: t('nomesModrinth.baixo'),
  potato: t('nomesModrinth.pcFraco'),
  screenshot: t('nomesModrinth.soParaFotos')
}

const GRUPOS: Record<string, string> = {
  categories: t('nomesModrinth.categorias'),
  features: t('nomesModrinth.recursos'),
  resolutions: t('nomesModrinth.resolucao'),
  'performance impact': t('nomesModrinth.impactoNoDesempenho')
}

const LOADERS: Record<string, string> = {
  fabric: t('nomesModrinth.fabric'),
  forge: t('nomesModrinth.forge'),
  neoforge: 'NeoForge',
  quilt: t('nomesModrinth.quilt'),
  paper: t('nomesModrinth.paper'),
  spigot: t('nomesModrinth.spigot'),
  bukkit: t('nomesModrinth.bukkit'),
  purpur: t('nomesModrinth.purpur'),
  folia: t('nomesModrinth.folia'),
  iris: t('nomesModrinth.iris'),
  optifine: 'OptiFine',
  canvas: t('nomesModrinth.canvas'),
  vanilla: t('nomesModrinth.vanilla'),
  datapack: t('nomesModrinth.datapack'),
  minecraft: t('nomesModrinth.minecraft')
}

export const nomeCategoria = (c: string): string => CATEGORIAS[c] ?? c
export const nomeGrupo = (g: string): string => GRUPOS[g] ?? g
export const nomeLoader = (l: string): string => LOADERS[l] ?? l
