import type { Ambiente } from '../../../shared/tipos'

export const NOMES_AMBIENTE: Record<Ambiente, string> = {
  servidor: 'Só no servidor',
  jogador: 'Só no jogador',
  ambos: 'Servidor e jogador'
}

// Nomes em português das etiquetas do Modrinth. Etiqueta nova, sem tradução, aparece como veio.

const CATEGORIAS: Record<string, string> = {
  adventure: 'Aventura',
  cursed: 'Bizarro',
  decoration: 'Decoração',
  economy: 'Economia',
  equipment: 'Equipamentos',
  food: 'Comida',
  'game-mechanics': 'Mecânicas do jogo',
  library: 'Biblioteca',
  magic: 'Magia',
  management: 'Administração',
  minigame: 'Minigame',
  mobs: 'Criaturas',
  optimization: 'Otimização',
  social: 'Social',
  storage: 'Armazenamento',
  technology: 'Tecnologia',
  transportation: 'Transporte',
  utility: 'Utilidades',
  worldgen: 'Geração de mundo',
  challenging: 'Desafiador',
  combat: 'Combate',
  'kitchen-sink': 'De tudo um pouco',
  lightweight: 'Leve',
  multiplayer: 'Multijogador',
  quests: 'Missões',
  modded: 'Para mods',
  realistic: 'Realista',
  simplistic: 'Simples',
  themed: 'Temático',
  tweaks: 'Ajustes',
  'vanilla-like': 'Parecido com o original',
  cartoon: 'Desenho animado',
  fantasy: 'Fantasia',
  'semi-realistic': 'Semirrealista',
  atmosphere: 'Atmosfera',
  bloom: 'Brilho (bloom)',
  'colored-lighting': 'Luz colorida',
  foliage: 'Folhagem',
  'path-tracing': 'Path tracing',
  pbr: 'PBR',
  reflections: 'Reflexos',
  shadows: 'Sombras',
  audio: 'Áudio',
  blocks: 'Blocos',
  'core-shaders': 'Core shaders',
  entities: 'Entidades',
  environment: 'Ambiente',
  fonts: 'Fontes',
  gui: 'Interface',
  items: 'Itens',
  locale: 'Idioma',
  models: 'Modelos',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
  potato: 'PC fraco',
  screenshot: 'Só para fotos'
}

const GRUPOS: Record<string, string> = {
  categories: 'Categorias',
  features: 'Recursos',
  resolutions: 'Resolução',
  'performance impact': 'Impacto no desempenho'
}

const LOADERS: Record<string, string> = {
  fabric: 'Fabric',
  forge: 'Forge',
  neoforge: 'NeoForge',
  quilt: 'Quilt',
  paper: 'Paper',
  spigot: 'Spigot',
  bukkit: 'Bukkit',
  purpur: 'Purpur',
  folia: 'Folia',
  iris: 'Iris',
  optifine: 'OptiFine',
  canvas: 'Canvas',
  vanilla: 'Vanilla',
  datapack: 'Datapack',
  minecraft: 'Minecraft'
}

export const nomeCategoria = (c: string): string => CATEGORIAS[c] ?? c
export const nomeGrupo = (g: string): string => GRUPOS[g] ?? g
export const nomeLoader = (l: string): string => LOADERS[l] ?? l
