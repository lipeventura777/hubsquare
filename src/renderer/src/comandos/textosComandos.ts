import { t } from '../../../shared/i18n'
// Textos da Central de comandos (Fase 26).

// Descrição das regras mais usadas. Os nomes mudaram na 1.21.11 (camelCase → snake_case):
// cada descrição vale para os dois.
const REGRAS: [string[], string, string][] = [
  [
    ['keep_inventory', 'keepInventory'],
    t('textosComandos.manterInventario'),
    t('textosComandos.quemMorreNaoPerdeOs')
  ],
  [
    ['advance_time', 'doDaylightCycle'],
    t('textosComandos.cicloDoDia'),
    t('textosComandos.oSolEALua')
  ],
  [
    ['advance_weather', 'doWeatherCycle'],
    t('textosComandos.climaMudaSozinho'),
    t('textosComandos.chuvaESolVemE')
  ],
  [['doFireTick'], t('textosComandos.propagacaoDoFogo'), t('textosComandos.oFogoSeEspalhaE')],
  [
    ['fire_spread_radius_around_player'],
    t('textosComandos.propagacaoDoFogo'),
    t('textosComandos.ateQuantosBlocosPertoDe')
  ],
  [
    ['mob_griefing', 'mobGriefing'],
    t('textosComandos.mobsDestroemBlocos'),
    t('textosComandos.creepersExplodemBlocosEndermenPegam')
  ],
  [
    ['players_sleeping_percentage', 'playersSleepingPercentage'],
    t('textosComandos.dormirParaPularANoite'),
    t('textosComandos.quantosDosJogadoresPrecisamDormir')
  ],
  [
    ['spawn_mobs', 'doMobSpawning'],
    t('textosComandos.mobsNascemSozinhos'),
    t('textosComandos.animaisEMonstrosAparecemNaturalmente')
  ],
  [
    ['spawn_monsters'],
    t('textosComandos.monstrosNascem'),
    t('textosComandos.monstrosAparecemNoEscuro')
  ],
  [
    ['natural_health_regeneration', 'naturalRegeneration'],
    t('textosComandos.vidaVoltaSozinha'),
    t('textosComandos.aVidaRecuperaComA')
  ],
  [['pvp'], 'PvP', t('textosComandos.jogadoresPodemMachucarUnsAos')],
  [
    ['show_death_messages', 'showDeathMessages'],
    t('textosComandos.mensagensDeMorte'),
    t('textosComandos.avisaNoChatQuandoAlguem')
  ],
  [
    ['show_advancement_messages', 'announceAdvancements'],
    t('textosComandos.avisarConquistas'),
    t('textosComandos.avisaNoChatAsConquistas')
  ],
  [
    ['immediate_respawn', 'doImmediateRespawn'],
    t('textosComandos.renascerNaHora'),
    t('textosComandos.semATelaDeVoce')
  ],
  [
    ['spawn_phantoms', 'doInsomnia'],
    t('textosComandos.phantoms'),
    t('textosComandos.phantomsAparecemParaQuemPassa')
  ],
  [
    ['block_drops', 'doTileDrops'],
    t('textosComandos.blocosSoltamItens'),
    t('textosComandos.quebrarUmBlocoSoltaO')
  ],
  [
    ['mob_drops', 'doMobLoot'],
    t('textosComandos.mobsSoltamItens'),
    t('textosComandos.mobsSoltamItensEXp')
  ],
  [
    ['entity_drops', 'doEntityDrops'],
    t('textosComandos.entidadesSoltamItens'),
    t('textosComandos.carrinhosMoldurasEAfinsSoltam')
  ],
  [
    ['tnt_explodes', 'tntExplodes'],
    t('textosComandos.tntExplode'),
    t('textosComandos.tntAcesaExplode')
  ],
  [
    ['fall_damage', 'fallDamage'],
    t('textosComandos.danoDeQueda'),
    t('textosComandos.cairDeAltoMachuca')
  ],
  [
    ['fire_damage', 'fireDamage'],
    t('textosComandos.danoDeFogo'),
    t('textosComandos.fogoELavaMachucam')
  ],
  [
    ['drowning_damage', 'drowningDamage'],
    t('textosComandos.afogamento'),
    t('textosComandos.ficarSemArDebaixoD')
  ],
  [
    ['freeze_damage', 'freezeDamage'],
    t('textosComandos.congelamento'),
    t('textosComandos.neveFofaCongelaEMachuca')
  ],
  [
    ['random_tick_speed', 'randomTickSpeed'],
    t('textosComandos.velocidadeDoCrescimento'),
    t('textosComandos.quaoRapidoPlantasCrescemE')
  ],
  [
    ['respawn_radius', 'spawnRadius'],
    t('textosComandos.raioDoSpawn'),
    t('textosComandos.emQuantosBlocosEmVolta')
  ],
  [
    ['max_entity_cramming', 'maxEntityCramming'],
    t('textosComandos.mobsEmpilhados'),
    t('textosComandos.quantosMobsCabemNoMesmo')
  ],
  [
    ['spawn_patrols', 'doPatrolSpawning'],
    t('textosComandos.patrulhasDeSaqueadores'),
    t('textosComandos.patrulhasDeSaqueadoresAparecem')
  ],
  [
    ['spawn_wandering_traders', 'doTraderSpawning'],
    t('textosComandos.vendedorAmbulante'),
    t('textosComandos.oVendedorAmbulanteAparece')
  ],
  [
    ['spawn_wardens', 'doWardenSpawning'],
    t('textosComandos.warden'),
    t('textosComandos.oWardenPodeAparecerNa')
  ],
  [['raids'], t('textosComandos.invasoes'), t('textosComandos.invasoesDeSaqueadoresAcontecem')],
  [['disableRaids'], t('textosComandos.semInvasoes'), t('textosComandos.ligadoNaoHaInvasoesDe')],
  [
    ['send_command_feedback', 'sendCommandFeedback'],
    t('textosComandos.respostasDeComandosNoChat'),
    t('textosComandos.mostraNoChatOResultado')
  ],
  [
    ['command_block_output', 'commandBlockOutput'],
    t('textosComandos.avisosDosBlocosDeComando'),
    t('textosComandos.blocosDeComandoAvisamOs')
  ],
  [
    ['locator_bar', 'locatorBar'],
    t('textosComandos.barraDeLocalizacao'),
    t('textosComandos.mostraNaTelaADirecao')
  ],
  [
    ['reduced_debug_info', 'reducedDebugInfo'],
    t('textosComandos.menosInformacoesNoF3'),
    t('textosComandos.escondeCoordenadasEOutrasInformacoes')
  ],
  [
    ['universal_anger', 'universalAnger'],
    t('textosComandos.raivaParaTodos'),
    t('textosComandos.mobsNeutrosIrritadosAtacamQualquer')
  ],
  [
    ['ender_pearls_vanish_on_death', 'enderPearlsVanishOnDeath'],
    t('textosComandos.perolasSomemAoMorrer'),
    t('textosComandos.perolasDoEnderLancadasSomem')
  ],
  [
    ['limited_crafting', 'doLimitedCrafting'],
    t('textosComandos.soReceitasDesbloqueadas'),
    t('textosComandos.soDaParaFabricarO')
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
  white: { nome: t('textosComandos.branco'), hex: '#ffffff' },
  gray: { nome: t('textosComandos.cinza'), hex: '#aaaaaa' },
  dark_gray: { nome: 'Cinza-escuro', hex: '#555555' },
  black: { nome: t('textosComandos.preto'), hex: '#000000' },
  red: { nome: t('textosComandos.vermelho'), hex: '#ff5555' },
  dark_red: { nome: 'Vermelho-escuro', hex: '#aa0000' },
  gold: { nome: t('textosComandos.dourado'), hex: '#ffaa00' },
  yellow: { nome: t('textosComandos.amarelo'), hex: '#ffff55' },
  green: { nome: t('textosComandos.verde'), hex: '#55ff55' },
  dark_green: { nome: 'Verde-escuro', hex: '#00aa00' },
  aqua: { nome: t('textosComandos.ciano'), hex: '#55ffff' },
  dark_aqua: { nome: 'Ciano-escuro', hex: '#00aaaa' },
  blue: { nome: t('textosComandos.azul'), hex: '#5555ff' },
  dark_blue: { nome: 'Azul-escuro', hex: '#0000aa' },
  light_purple: { nome: t('textosComandos.rosa'), hex: '#ff55ff' },
  dark_purple: { nome: t('textosComandos.roxo'), hex: '#aa00aa' }
}
