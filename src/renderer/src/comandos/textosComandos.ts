// Textos da Central de comandos (Fase 26).

// Descrição das regras mais usadas. Os nomes mudaram na 1.21.11 (camelCase → snake_case):
// cada descrição vale para os dois.
const REGRAS: [string[], string, string][] = [
  [
    ['keep_inventory', 'keepInventory'],
    'Manter inventário',
    'Quem morre não perde os itens nem o XP.'
  ],
  [
    ['advance_time', 'doDaylightCycle'],
    'Ciclo do dia',
    'O sol e a lua andam. Desligado, a hora fica parada.'
  ],
  [['advance_weather', 'doWeatherCycle'], 'Clima muda sozinho', 'Chuva e sol vêm e vão sozinhos.'],
  [['doFireTick'], 'Propagação do fogo', 'O fogo se espalha e queima blocos.'],
  [
    ['fire_spread_radius_around_player'],
    'Propagação do fogo',
    'Até quantos blocos perto de um jogador o fogo se espalha (0 desliga; -1 sem limite).'
  ],
  [
    ['mob_griefing', 'mobGriefing'],
    'Mobs destroem blocos',
    'Creepers explodem blocos, endermen pegam blocos, aldeões colhem.'
  ],
  [
    ['players_sleeping_percentage', 'playersSleepingPercentage'],
    'Dormir para pular a noite',
    'Quantos % dos jogadores precisam dormir para virar dia (100 = todos).'
  ],
  [
    ['spawn_mobs', 'doMobSpawning'],
    'Mobs nascem sozinhos',
    'Animais e monstros aparecem naturalmente.'
  ],
  [['spawn_monsters'], 'Monstros nascem', 'Monstros aparecem no escuro.'],
  [
    ['natural_health_regeneration', 'naturalRegeneration'],
    'Vida volta sozinha',
    'A vida recupera com a barra de fome cheia.'
  ],
  [['pvp'], 'PvP', 'Jogadores podem machucar uns aos outros.'],
  [
    ['show_death_messages', 'showDeathMessages'],
    'Mensagens de morte',
    'Avisa no chat quando alguém morre.'
  ],
  [
    ['show_advancement_messages', 'announceAdvancements'],
    'Avisar conquistas',
    'Avisa no chat as conquistas dos jogadores.'
  ],
  [['immediate_respawn', 'doImmediateRespawn'], 'Renascer na hora', 'Sem a tela de "Você morreu".'],
  [
    ['spawn_phantoms', 'doInsomnia'],
    'Phantoms',
    'Phantoms aparecem para quem passa noites sem dormir.'
  ],
  [['block_drops', 'doTileDrops'], 'Blocos soltam itens', 'Quebrar um bloco solta o item.'],
  [['mob_drops', 'doMobLoot'], 'Mobs soltam itens', 'Mobs soltam itens e XP ao morrer.'],
  [
    ['entity_drops', 'doEntityDrops'],
    'Entidades soltam itens',
    'Carrinhos, molduras e afins soltam o item ao quebrar.'
  ],
  [['tnt_explodes', 'tntExplodes'], 'TNT explode', 'TNT acesa explode.'],
  [['fall_damage', 'fallDamage'], 'Dano de queda', 'Cair de alto machuca.'],
  [['fire_damage', 'fireDamage'], 'Dano de fogo', 'Fogo e lava machucam.'],
  [['drowning_damage', 'drowningDamage'], 'Afogamento', 'Ficar sem ar debaixo d’água machuca.'],
  [['freeze_damage', 'freezeDamage'], 'Congelamento', 'Neve fofa congela e machuca.'],
  [
    ['random_tick_speed', 'randomTickSpeed'],
    'Velocidade do crescimento',
    'Quão rápido plantas crescem e folhas caem (padrão 3).'
  ],
  [
    ['respawn_radius', 'spawnRadius'],
    'Raio do spawn',
    'Em quantos blocos em volta do spawn os jogadores aparecem.'
  ],
  [
    ['max_entity_cramming', 'maxEntityCramming'],
    'Mobs empilhados',
    'Quantos mobs cabem no mesmo bloco antes de se machucarem.'
  ],
  [
    ['spawn_patrols', 'doPatrolSpawning'],
    'Patrulhas de saqueadores',
    'Patrulhas de saqueadores aparecem.'
  ],
  [
    ['spawn_wandering_traders', 'doTraderSpawning'],
    'Vendedor ambulante',
    'O vendedor ambulante aparece.'
  ],
  [
    ['spawn_wardens', 'doWardenSpawning'],
    'Warden',
    'O Warden pode aparecer na Escuridão Profunda.'
  ],
  [['raids'], 'Invasões', 'Invasões de saqueadores acontecem.'],
  [['disableRaids'], 'Sem invasões', 'Ligado, não há invasões de saqueadores.'],
  [
    ['send_command_feedback', 'sendCommandFeedback'],
    'Respostas de comandos no chat',
    'Mostra no chat o resultado dos comandos.'
  ],
  [
    ['command_block_output', 'commandBlockOutput'],
    'Avisos dos blocos de comando',
    'Blocos de comando avisam os operadores no chat.'
  ],
  [
    ['locator_bar', 'locatorBar'],
    'Barra de localização',
    'Mostra na tela a direção dos outros jogadores.'
  ],
  [
    ['reduced_debug_info', 'reducedDebugInfo'],
    'Menos informações no F3',
    'Esconde coordenadas e outras informações do F3.'
  ],
  [
    ['universal_anger', 'universalAnger'],
    'Raiva para todos',
    'Mobs neutros irritados atacam qualquer jogador por perto.'
  ],
  [
    ['ender_pearls_vanish_on_death', 'enderPearlsVanishOnDeath'],
    'Pérolas somem ao morrer',
    'Pérolas do Ender lançadas somem quando o jogador morre.'
  ],
  [
    ['limited_crafting', 'doLimitedCrafting'],
    'Só receitas desbloqueadas',
    'Só dá para fabricar o que já está no livro de receitas.'
  ]
]

const PORNOME = new Map(
  REGRAS.flatMap(([nomes, titulo, descricao]) => nomes.map((n) => [n, { titulo, descricao }]))
)

export function textoDaRegra(nome: string): { titulo: string; descricao: string | null } {
  return PORNOME.get(nome) ?? { titulo: nome, descricao: null }
}

// Cor de cada efeito do jogo, para o frasco próprio do app (efeitos de mods: cinza).
const CORES_EFEITO: Record<string, string> = {
  speed: '#33ebff',
  slowness: '#8bafe0',
  haste: '#d9c043',
  mining_fatigue: '#4a4217',
  strength: '#ffc700',
  instant_health: '#f82423',
  instant_damage: '#a9656a',
  jump_boost: '#fdff84',
  nausea: '#551d4a',
  regeneration: '#cd5cab',
  resistance: '#9146f0',
  fire_resistance: '#ff9900',
  water_breathing: '#98dac0',
  invisibility: '#f6f6f6',
  blindness: '#5a5a66',
  night_vision: '#c2ff66',
  hunger: '#587653',
  weakness: '#848a84',
  poison: '#87a363',
  wither: '#736156',
  health_boost: '#f87d23',
  absorption: '#2552a5',
  saturation: '#f82423',
  glowing: '#94a061',
  levitation: '#ceffff',
  luck: '#59c106',
  unluck: '#c0a44d',
  slow_falling: '#f3cfb9',
  conduit_power: '#1dc2d1',
  dolphins_grace: '#88a3be',
  bad_omen: '#0b6138',
  hero_of_the_village: '#44ff44',
  darkness: '#5a5650',
  trial_omen: '#16a6a6',
  raid_omen: '#de4058',
  wind_charged: '#bdc9ff',
  weaving: '#78695a',
  oozing: '#99ffa3',
  infested: '#8c9b8c'
}

export function corDoEfeito(id: string): string {
  const [ns, nome] = id.split(':')
  return (ns === 'minecraft' && CORES_EFEITO[nome]) || '#9aa0a6'
}

// Cores do texto do chat/título: nome usado no comando e a cor para a prévia.
export const CORES_DO_TEXTO: Record<string, { nome: string; hex: string }> = {
  white: { nome: 'Branco', hex: '#ffffff' },
  gray: { nome: 'Cinza', hex: '#aaaaaa' },
  dark_gray: { nome: 'Cinza-escuro', hex: '#555555' },
  black: { nome: 'Preto', hex: '#000000' },
  red: { nome: 'Vermelho', hex: '#ff5555' },
  dark_red: { nome: 'Vermelho-escuro', hex: '#aa0000' },
  gold: { nome: 'Dourado', hex: '#ffaa00' },
  yellow: { nome: 'Amarelo', hex: '#ffff55' },
  green: { nome: 'Verde', hex: '#55ff55' },
  dark_green: { nome: 'Verde-escuro', hex: '#00aa00' },
  aqua: { nome: 'Ciano', hex: '#55ffff' },
  dark_aqua: { nome: 'Ciano-escuro', hex: '#00aaaa' },
  blue: { nome: 'Azul', hex: '#5555ff' },
  dark_blue: { nome: 'Azul-escuro', hex: '#0000aa' },
  light_purple: { nome: 'Rosa', hex: '#ff55ff' },
  dark_purple: { nome: 'Roxo', hex: '#aa00aa' }
}
