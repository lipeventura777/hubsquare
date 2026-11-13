// Tipos usados pelos dois lados do app: processo principal e tela.
import type { Fonte } from './fontes'

export type TipoId = 'paper' | 'vanilla' | 'fabric' | 'forge' | 'neoforge'

export const NOMES_TIPOS: Record<TipoId, string> = {
  paper: 'Paper',
  vanilla: 'Vanilla',
  fabric: 'Fabric',
  forge: 'Forge',
  neoforge: 'NeoForge'
}

// Pasta de extras de cada loader. Plugins do Paper não rodam em loaders de mods, e vice-versa.
export const EXTRAS_TIPOS: Partial<Record<TipoId, 'plugins' | 'mods'>> = {
  paper: 'plugins',
  fabric: 'mods',
  forge: 'mods',
  neoforge: 'mods'
}

export interface InfoServidor {
  id: string // do índice de servidores (servidores.json, na pasta de dados do app)
  nome: string
  tipo: TipoId
  versao: string
  java: number
  javaDosMods?: number // Java mínimo pedido pelos mods, maior que o do Minecraft (conserto ao ligar)
  pasta: string
  ram?: number // GB; sem valor, usa a sugestão pela memória do PC
  pvp?: boolean // só usado em versões onde o PvP é regra do jogo (1.21.9+)
  versaoLoader?: string // ex.: "0.20.1" (Fabric), "66.1.5" (Forge); a partir da Fase 17
  modpack?: ModpackDoServidor // criado a partir de um modpack (Fase 17)
  javaOtimizado?: boolean // flags do Aikar (tela Desempenho); ligado em servidores novos
  automacao?: Automacao // tela Automação (Fase 19); sem valor, tudo desligado
  // PlaySquare (Fase P3): presente quando o "servidor" é uma instalação do jogador. As telas de
  // mods do ServSquare são as mesmas; isto muda para onde vai cada coisa e as explicações.
  jogador?: ContextoJogador
  // Fase M7: o mesmo servidor em qualquer PC (vai no .hubserver e no convite). Sem valor, vale o id.
  idFixo?: string
  // Fase M7: passado para um amigo hospedar. Ligar aqui pede confirmação até o mundo voltar.
  emprestado?: { com: string; desde: string }
}

export interface ContextoJogador {
  instalacaoId: string
  servidor: string | null // nome do servidor ligado à instalação (convite ou do ServSquare)
  proibidos: string[] // trechos do nome do .jar que o servidor proíbe
  doServidor: string[] // caminhos ("mods/x.jar") que vieram do servidor
  obrigatorios: string[] // os do servidor que não dá para tirar
}

export interface ModpackDoServidor {
  fonte?: Fonte // sem valor: Modrinth (Fase 17)
  nome: string
  versao: string // versão do pack (versionId do índice)
  projetoId: string | null // null: veio de um arquivo .mrpack sem origem no Modrinth
  versaoId: string | null
}

export const MODOS = ['survival', 'creative', 'adventure', 'spectator'] as const
export type ModoDeJogo = (typeof MODOS)[number]
export const NOMES_MODOS: Record<ModoDeJogo, string> = {
  survival: 'Sobrevivência',
  creative: 'Criativo',
  adventure: 'Aventura',
  spectator: 'Espectador'
}

export const DIFICULDADES = ['peaceful', 'easy', 'normal', 'hard'] as const
export type Dificuldade = (typeof DIFICULDADES)[number]
export const NOMES_DIFICULDADES: Record<Dificuldade, string> = {
  peaceful: 'Pacífico',
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil'
}

export interface Configuracoes {
  modoDeJogo: ModoDeJogo
  dificuldade: Dificuldade
  maxJogadores: number
  motd: string
  pvp: boolean
  ramGb: number
}

export interface LimitesRam {
  min: number
  max: number
  sugerida: number
}

export interface DadosConfiguracoes {
  configuracoes: Configuracoes
  ram: LimitesRam
}

export interface AvisoJogador {
  nome: string
  tipo: 'entrou' | 'saiu'
}

// Uso do processo do servidor; cpu em % do PC inteiro, ram em bytes.
export interface UsoServidor {
  cpu: number
  ram: number
  ramMax: number
}

export type ModoConexao = 'playit' | 'radmin' | 'lan' | 'porta'

export interface EstadoConexao {
  modo: ModoConexao
  porta: number
  playit: {
    vinculado: boolean
    vinculando: boolean
    endereco: string | null
    agenteLigado: boolean
  }
  radminIp: string | null
  lanIp: string | null
  firewallLiberado: boolean | null // null: ainda não existe servidor
}

export interface ResultadoTeste {
  ok: boolean
  mensagem: string
}

export interface ResultadoUpnp {
  ok: boolean
  mensagem: string
  ipPublico: string | null
}

export interface Backup {
  arquivo: string // ex.: 2026-11-09_16-46-05.zip
  data: string // ISO
  tamanho: number // bytes
  tipo: TipoBackup | null // null: feito antes da Fase 23.2, sem tipo anotado
  protegido: boolean // a rotação e o "Apagar selecionados" nunca apagam
}

// Por que o backup foi feito (Fase 23.2).
export const TIPOS_BACKUP = [
  'desligar',
  'agendado',
  'atualizar',
  'software',
  'modpack',
  'mundos',
  'restaurar',
  'jogadores',
  'apagar'
] as const
export type TipoBackup = (typeof TIPOS_BACKUP)[number]

export const NOMES_BACKUP: Record<TipoBackup, string> = {
  desligar: 'Ao desligar',
  agendado: 'Agendado',
  atualizar: 'Antes de atualizar',
  software: 'Antes de trocar o software',
  modpack: 'Antes de atualizar o modpack',
  mundos: 'Antes de mexer nos mundos',
  restaurar: 'Antes de restaurar',
  jogadores: 'Antes de apagar dados de jogador',
  apagar: 'Antes de apagar o servidor'
}

export const TEMAS = ['sistema', 'claro', 'escuro'] as const
export type Tema = (typeof TEMAS)[number]

import type { ModoAnimacao } from './animacaoRegras'
export type SituacaoPedido = 'pendente' | 'aprovado' | 'recusado' | 'desconhecido'

// Fase M4: o que o amigo manda ao aceitar o convite, e o pedido como o dono vê.
export interface PedidoConvite {
  nick: string
  recado: string
}
export interface PedidoParaEntrar {
  nick: string
  uuid: string
  recado: string
  em: string // ISO
}

// Fundos de bioma (Fase V1). "Dia claro" é o único claro.
export const BIOMAS = ['diaClaro', 'dia', 'noite', 'mar', 'nether'] as const
export type Bioma = (typeof BIOMAS)[number]
export const NOMES_BIOMAS: Record<Bioma, string> = {
  diaClaro: 'Dia claro',
  dia: 'Dia',
  noite: 'Noite',
  mar: 'Mar',
  nether: 'Nether'
}

export interface Aparencia {
  tema: Tema // antigo (até a Fase V1); fica no arquivo para versões antigas do app
  bioma: Bioma
  vidroLeve: boolean // sem desfoque, para PCs fracos
  animacaoFundo?: ModoAnimacao // Fase V2; sem valor: completa (leve se o Windows pede menos movimento)
  particulasSobreImagem: boolean // Fase V2: partículas do bioma por cima de uma imagem do usuário
  destaque: string | null // #rrggbb da área ServSquare; null = a cor do bioma
  destaquePlay: string | null // #rrggbb da área PlaySquare; null = a cor do bioma
  escurecimento: number // 0 a 0.9: quanto o fundo cobre a imagem
  fundo: string | null // nome do arquivo copiado para a pasta de dados do app
  fundoEmTodoApp: boolean // false: a imagem aparece só no banner do Painel
  reduzirAnimacoes: boolean // escolha do usuário; o Windows também pode pedir (prefers-reduced-motion)
}

// Print do Minecraft (.minecraft/screenshots), com miniatura pequena para a tela.
export interface Screenshot {
  nome: string
  miniatura: string // data URL JPEG
}

// Mesmo formato do whitelist.json do Minecraft.
export interface Amigo {
  uuid: string
  name: string
}

export interface PedidoCriacao {
  tipo: TipoId
  versao: string
  nome: string
  aceitouEula: boolean
}

export interface ErroTela {
  mensagem: string
  detalhes: string
  falhas?: string[] // arquivos que não deram certo (a tela oferece tentar de novo só esses)
  cancelado?: boolean // o usuário cancelou: a tela não mostra como erro
  emprestado?: boolean // Fase M7: ligar um servidor passado a um amigo (a tela oferece ligar mesmo assim)
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: ErroTela }

export type EstadoServidor = 'desligado' | 'ligando' | 'ligado' | 'desligando'

export interface AvisoEstado {
  estado: EstadoServidor
  erro?: ErroTela
}

export interface LinhaConsole {
  n: number
  texto: string
}

export interface Progresso {
  etapa: string
  recebido: number
  total: number
}

// Um servidor da lista (tela Servidores). Só um fica ativo, e só o ativo pode estar ligado.
export interface ItemServidor {
  id: string
  nome: string
  tipo: TipoId
  versao: string
  ativo: boolean
  estado: EstadoServidor // "desligado" para todos menos o ativo
  icone: string | null // server-icon.png como data URL (Fase 21)
  emprestado?: string // Fase M7: "Com Bia desde 13/11/2026"
}

// Resultado da análise de um .zip para importar.
export interface AnaliseZip {
  token: string // identifica o zip escolhido; o caminho fica só no processo principal
  arquivo: string
  conteudo: 'servidor' | 'mundo'
  nomeSugerido: string
  versaoDoMundo: string | null // lida do level.dat, quando dá
  loader: { tipo: TipoId; versao: string | null } | null // server pack com mods (ex.: CurseForge)
}

export interface PedidoImportacao {
  token: string
  nome: string
  tipo: TipoId
  versao: string
  aceitouEula: boolean
}

export interface PedidoSoftware {
  tipo: TipoId
  versao: string
  confirmouVersaoAntiga: boolean
}

// ---------- Jogadores (Fase 12) ----------

// Listas que o servidor guarda em .json. Nos IPs banidos, "name" é o endereço e "uuid" fica vazio.
export const LISTAS = ['whitelist', 'ops', 'banidos', 'ipsBanidos'] as const
export type ListaId = (typeof LISTAS)[number]

export interface JogadorResumo {
  nome: string
  uuid: string
  online: boolean
  whitelist: boolean
  op: boolean
  banido: boolean
}

export interface Local {
  x: number
  y: number
  z: number
  dimensao: string // ex.: minecraft:the_nether
}

// Lido do <uuid>.dat do jogador (só leitura).
export interface DadosJogador {
  vida: number // 0 a 20 (meio coração = 1)
  fome: number // 0 a 20
  nivel: number
  progresso: number // 0 a 1 até o próximo nível
  modo: ModoDeJogo | null
  posicao: Local | null
  renascimento: Local | null
  ultimaMorte: Local | null
}

export interface DetalhesJogador extends JogadorResumo {
  dados: DadosJogador | null // null: o jogador ainda não tem arquivo salvo
}

export type AcaoJogador =
  | { tipo: 'matar' | 'curar' | 'alimentar' | 'faminto' }
  | { tipo: 'modo'; modo: ModoDeJogo }
  | { tipo: 'teleportar'; local: Local }

// ---------- Inventário, estatísticas e exclusão (Fase 13) ----------

export interface ItemJogador {
  id: string
  nome: string // traduzido (ou o id técnico, se não houver tradução)
  nomeProprio: string | null // dado na bigorna
  quantidade: number
  encantamentos: string[] // já traduzidos, ex.: "Afiação V"
  dano: number
  danoMax: number | null // null: o item não gasta
  icone: string | null // data URL; null usa o bloco "?"
}

export type SlotItem = ItemJogador | null

export interface InventarioJogador {
  online: boolean
  semDados: boolean
  armadura: SlotItem[] // cabeça, peito, pernas, pés
  segundaMao: SlotItem
  inventario: SlotItem[] // 27
  barra: SlotItem[] // 9
  ender: SlotItem[] // 27
}

export interface LinhaEstatistica {
  id: string
  nome: string
  valor: number
  icone: string | null
}

export interface EstatisticasJogador {
  tempo: number // ticks
  abates: number
  mortes: number
  distancia: LinhaEstatistica[] // em blocos
  quebrados: LinhaEstatistica[]
  usados: LinhaEstatistica[]
  mortos: LinhaEstatistica[]
}

export interface EstadoIcones {
  baixados: boolean
  tamanho: number // bytes do client.jar oficial
}

export const OPCOES_EXCLUSAO = [
  'xp',
  'inventario',
  'ender',
  'dados',
  'estatisticas',
  'avancos'
] as const
export type OpcaoExclusao = (typeof OPCOES_EXCLUSAO)[number]

// ---------- Arquivos, mundos e logs (Fase 14) ----------

// Arquivos que a tela Arquivos abre no editor de texto (até 1 MB).
export const EXTENSOES_TEXTO = [
  '.properties',
  '.yml',
  '.yaml',
  '.json',
  '.json5',
  '.txt',
  '.toml',
  '.cfg'
]
export const LIMITE_TEXTO = 1024 * 1024

export interface ItemArquivo {
  nome: string
  pasta: boolean
  tamanho: number // bytes (0 nas pastas)
  data: string // ISO
  protegido: boolean // mundo ativo com o servidor ligado: não pode apagar nem renomear
}

export interface ListaArquivos {
  caminho: string // relativo à pasta do servidor, com "/" ("" é a raiz)
  itens: ItemArquivo[]
}

export interface MundoServidor {
  nome: string // nome da pasta
  ativo: boolean // é o level-name do server.properties
  tamanho: number // bytes, contando o Nether e o End do Paper
  data: string // ISO, última mudança no level.dat
  versao: string | null
}

export interface ArquivoLog {
  nome: string
  tamanho: number
  data: string // ISO
}

export interface RelatorioTravamento {
  texto: string
  causa: string | null // explicação simples, quando dá para identificar
}

// ---------- Mods e plugins pelo Modrinth (Fase 16) ----------

export type AcaoPendente = 'instalar' | 'ativar' | 'desativar' | 'remover'

export interface ModInstalado {
  arquivo: string // nome do .jar, sem o ".disabled"
  ativo: boolean
  projetoId: string | null // null: não identificado no Modrinth ("Instalado manualmente")
  titulo: string
  versao: string | null
  icone: string | null
  pendente: AcaoPendente | null // mudança que espera o servidor desligar
  fonte: FonteInstalado
  tamanho: number | null // bytes
  data: string | null // ISO, quando o arquivo chegou na pasta
  dependencias: string[] // projetos do Modrinth que esta versão exige
  // Fase 25, para os problemas e as versões (vazios sem internet ou fora do Modrinth):
  versaoId: string | null
  jogos: string[] // versões do Minecraft desta versão do mod (Modrinth)
  incompativeis: string[] // projetos do Modrinth que não funcionam junto
  soDoJogador: boolean
  categorias: string[]
}

export interface ListaMods {
  itens: ModInstalado[]
  pendentes: number
  semInternet: boolean // não deu para identificar no Modrinth agora
}

export interface ItemPlano {
  titulo: string
  versao: string
  arquivo: string
  tamanho: number // bytes
  dependencia: boolean
}

// Mostrado antes de confirmar a instalação.
export interface PlanoMods {
  token: string
  itens: ItemPlano[]
  avisos: string[] // ex.: dependência só do jogador, que fica de fora
  problemas: string[] // impedem a instalação
  manuais: ArquivoManual[] // o autor não deixa outros apps baixarem: "Baixe pelo site"
}

export interface ArquivoManual {
  titulo: string
  url: string // página do arquivo no site da fonte
  // Fase D: o que o assistente de downloads usa para reconhecer o arquivo (só o CurseForge dá).
  arquivo?: string
  tamanho?: number
  sha1?: string
  md5?: string
  icone?: string | null
  projetoId?: string
  versaoId?: string
  versao?: string
  fonte?: 'curseforge' | 'modrinth' // sem valor: CurseForge; Modrinth = mod que faltou ao ligar o servidor
}

// Fase D: um arquivo que o usuário precisa baixar pela página oficial.
export type EstadoDownloadManual = 'aguardando' | 'conferindo' | 'pronto' | 'diferente'

export interface DownloadManual {
  id: string
  alvo: string // id do servidor ou "jogo:<id da instalação>"
  nomeAlvo: string
  titulo: string
  arquivo: string
  tamanho: number
  url: string
  icone: string | null
  estado: EstadoDownloadManual
  motivo?: string // em "diferente"
}

export interface AtualizacaoMod {
  arquivo: string
  titulo: string
  icone: string | null
  versaoAtual: string
  versaoNova: string
  fonte: Fonte // cada item é conferido na sua fonte (Fase 24)
  manual: string | null // o autor não deixa outros apps baixarem: página para baixar pelo site
}

// ---------- Explorar (Fase 23) ----------

export const TIPOS_CONTEUDO = [
  'mod',
  'plugin',
  'modpack',
  'resourcepack',
  'shader',
  'datapack'
] as const
export type TipoConteudo = (typeof TIPOS_CONTEUDO)[number]

export const NOMES_CONTEUDO: Record<TipoConteudo, string> = {
  mod: 'Mods',
  plugin: 'Plugins',
  modpack: 'Modpacks',
  resourcepack: 'Resource packs',
  shader: 'Shaders',
  datapack: 'Datapacks'
}

// Loaders que o filtro oferece em cada tipo (nomes do Modrinth). Vazio: o tipo não tem loader.
export const LOADERS_CONTEUDO: Record<TipoConteudo, string[]> = {
  mod: ['fabric', 'forge', 'neoforge', 'quilt'],
  plugin: ['paper', 'spigot', 'bukkit', 'purpur', 'folia'],
  modpack: ['fabric', 'forge', 'neoforge', 'quilt'],
  resourcepack: [],
  shader: ['iris', 'optifine', 'canvas', 'vanilla'],
  datapack: []
}

// Onde o projeto roda, pelo campo "environment" do Modrinth.
export type Ambiente = 'servidor' | 'jogador' | 'ambos'
export type OrdemExplorar = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'

// Tipos que cada fonte oferece (Fase 24). O Hangar só tem plugins para Paper.
export const TIPOS_POR_FONTE: Record<Fonte, TipoConteudo[]> = {
  modrinth: [...TIPOS_CONTEUDO],
  curseforge: ['mod', 'plugin', 'modpack', 'datapack'],
  hangar: ['plugin']
}

export interface FiltrosExplorar {
  fonte: Fonte
  tipo: TipoConteudo
  termo: string
  versao: string | null // null: todas
  loader: string | null // "servidor": os do servidor ativo; null: todos
  categorias: string[]
  ambiente: Ambiente | null
  codigoAberto: boolean
  esconderInstalados: boolean
  ordem: string // cada fonte tem as suas (OrdemExplorar no Modrinth)
  offset: number
}

export interface CategoriaExplorar {
  nome: string // valor do filtro: nome no Modrinth e no Hangar, id no CurseForge
  rotulo?: string // nome para mostrar, quando a fonte manda (CurseForge)
  grupo: string // "categories", "features", "resolutions"...
}

export interface OpcoesExplorar {
  versoes: string[] // versões do Minecraft (só as finais), da mais nova para a mais velha
  categorias: CategoriaExplorar[]
}

export interface ProjetoExplorar {
  fonte: Fonte
  id: string
  titulo: string
  autor: string
  descricao: string
  downloads: number
  seguidores: number
  icone: string | null
  categorias: string[]
  ambiente: Ambiente | null
  instalado: boolean // no servidor, no mundo ou no Pacote pros amigos
}

export interface ResultadoExplorar {
  itens: ProjetoExplorar[]
  total: number
}

// Para onde vai o projeto (requisito da Fase 23: shaders e itens do jogador nunca no servidor).
export type DestinoProjeto =
  | 'servidor' // pasta mods/plugins
  | 'datapack' // pasta datapacks do mundo ativo
  | 'resourcepack' // server.properties (e, se quiser, Pacote pros amigos)
  | 'amigos' // Pacote pros amigos
  | 'modpack' // servidor novo
  | 'incompativel'

export type EstadoInstalacao = 'instalar' | 'instalado' | 'atualizar'

export interface VersaoProjeto {
  id: string
  nome: string
  numero: string
  tipo: string // release, beta, alpha
  data: string
  jogos: string[]
  loaders: string[]
  changelog: string | null
}

export interface DependenciaProjeto {
  id: string
  titulo: string
  icone: string | null
  obrigatoria: boolean
}

export interface DetalhesProjeto {
  fonte: Fonte
  id: string
  slug: string
  tipo: TipoConteudo
  titulo: string
  descricao: string
  corpo: string // markdown do Modrinth (a tela sanitiza antes de mostrar)
  icone: string | null
  galeria: { url: string; titulo: string | null; descricao: string | null }[]
  licenca: { id: string; nome: string; url: string | null }
  links: { rotulo: string; url: string }[]
  downloads: number
  seguidores: number
  ambiente: Ambiente | null
  versoes: VersaoProjeto[] // compatíveis com o servidor ativo, a mais nova primeiro
  dependencias: DependenciaProjeto[] // da versão que vai ser instalada
  destino: DestinoProjeto
  frase: string // para onde vai, numa frase
  estado: EstadoInstalacao // no destino principal
  noPacote: boolean // já está no Pacote pros amigos
  obrigatorio: boolean // resource pack do servidor: obrigatório para entrar
  arquivo: string | null // mod/plugin já instalado (o "Atualizar" troca este arquivo)
  baixarPeloSite: string | null // o autor não deixa outros apps baixarem: link da página
  compat?: Compat // PlaySquare: vai funcionar no jogo do jogador?
}

// ---------- Compatibilidade no jogo do jogador (Fase P3) ----------

// Cada tipo de aviso tem "Não mostrar de novo" (reativável em Ajustes do jogo), menos os que
// impedem a instalação (loader e versão).
export const AVISOS = [
  'soServidor',
  'precisaServidor',
  'proibido',
  'shader',
  'loader',
  'versao'
] as const
export type TipoAviso = (typeof AVISOS)[number]

export const NOMES_AVISOS: Record<TipoAviso, string> = {
  soServidor: 'Mod que roda só no servidor',
  precisaServidor: 'Mod que precisa estar também no servidor',
  proibido: 'Mod proibido pelo servidor',
  shader: 'Shaders precisam do Iris ou do Oculus e pesam no PC',
  loader: 'Loader da instalação não serve',
  versao: 'Sem versão para esta instalação'
}

export interface Compat {
  vai: boolean // vai funcionar?
  frase: string // "Vai funcionar: ..." ou "Não vai funcionar: ..."
  aviso: TipoAviso | null // null: tudo certo (sem aviso)
  bloqueia: boolean // impede instalar
}

export interface AjustesJogo {
  avisosOcultos: TipoAviso[]
  // Fase P5:
  memoriaPadrao: number | null // GB das instalações novas; null: a sugestão do app
  resolucao: { largura: number; altura: number } | null // janela do jogo; null: a do launcher
  pastaInstalacoes: string | null // onde ficam as instalações novas; null: Documentos/ServSquare/jogo
  pastasDownloads: string[] // Fase D: onde mais procurar downloads manuais (além de Downloads)
  nick?: string // Fase M4: o nick do Minecraft do jogador, lembrado para os próximos convites
}

// Uma captura de tela (F2) de uma instalação (Fase P5).
export interface Captura {
  instalacaoId: string
  instalacao: string
  nome: string
  data: string
  miniatura: string
}

// ---------- Instalados (Fase 23.2) ----------

export const CATEGORIAS_INSTALADO = [
  'extras', // pasta mods ou plugins
  'datapack',
  'resourcepack', // do servidor (server.properties)
  'amigos', // Pacote pros amigos
  'modpack', // de onde o servidor veio
  'outros' // arquivos que o app não reconhece
] as const
export type CategoriaInstalado = (typeof CATEGORIAS_INSTALADO)[number]

export type FonteInstalado = 'modrinth' | 'curseforge' | 'hangar' | 'manual'

export interface ItemInstalado {
  chave: string // identifica o item ao remover (ex.: "extras:fabric-api.jar")
  categoria: CategoriaInstalado
  tipo: TipoConteudo // para abrir os detalhes
  titulo: string
  versao: string | null
  icone: string | null
  fonte: FonteInstalado
  projetoId: string | null // do Modrinth, quando conhecido
  caminho: string | null // relativo à pasta do servidor
  tamanho: number | null // bytes
  data: string | null // ISO, quando foi instalado
  ativo: boolean
  atualizacao: boolean
  mundo: string | null // datapacks
  mundoAtivo: boolean
  obrigatorio: boolean // resource pack do servidor
  removerAoDesligar: boolean
  pendente: AcaoPendente | null // mods/plugins: mudança que espera o servidor desligar
  dependencias: string[] // projetos do Modrinth que este item exige
  removivel: boolean
  // Fase 25 (mods e plugins):
  idMod: string // "fonte:projeto" ou "arquivo:nome": etiqueta, perfil e versões seguem o mod
  problemas: ProblemaMod[]
  cor: CorEtiqueta | null
  nota: string
  travado: boolean // não sugerir atualização
  anterior: string | null // versão anterior guardada (para voltar)
  categorias: string[] // do projeto na fonte (Modrinth, CurseForge ou Hangar)
  // PlaySquare (Fase P3):
  doServidor?: boolean // veio do servidor (sincronização); o resto é "meu"
  compat?: Compat
}

// ---------- Mods personalizáveis (Fase 25) ----------

export const CORES_ETIQUETA = [
  'vermelho',
  'laranja',
  'amarelo',
  'verde',
  'azul',
  'roxo',
  'cinza'
] as const
export type CorEtiqueta = (typeof CORES_ETIQUETA)[number]

export type CorrecaoMod =
  | { tipo: 'instalar'; rotulo: string; id: string; projeto: boolean } // id do mod (.jar) ou do projeto
  | { tipo: 'desativar' | 'remover' | 'versao'; rotulo: string; chave: string }

export interface ProblemaMod {
  tipo: 'dependencia' | 'versao' | 'loader' | 'duplicado' | 'jogador' | 'incompativel'
  texto: string
  correcao: CorrecaoMod | null
}

export type TipoCampo = 'bool' | 'numero' | 'texto' | 'lista' | 'leitura'

export interface CampoConfig {
  id: string // posição do valor no texto lido
  chave: string // caminho completo, ex.: "client.renderDistance"
  nome: string
  secao: string | null
  tipo: TipoCampo
  valor: boolean | string | string[]
  descricao: string | null // os comentários do próprio arquivo
}

export interface ConfigLida {
  caminho: string // relativo à pasta do servidor
  campos: CampoConfig[]
  hash: string // o salvar confere que o arquivo não mudou no meio
}

export interface VersaoDoMod {
  id: string
  nome: string
  data: string
  tipo: string // release, beta, alpha
  atual: boolean
}

export interface VersoesDoMod {
  idMod: string
  versoes: VersaoDoMod[] // compatíveis com o servidor, a mais nova primeiro
  travado: boolean
  anterior: string | null
}

export interface PerfilMods {
  nome: string
  ativos: number
  criado: string
}

export interface TravamentoMods {
  nome: string // arquivo do relatório
  data: string
  causa: string | null
  suspeitos: { chave: string; titulo: string; motivo: string }[]
}

export interface ResultadoImportacao {
  plano: PlanoMods | null // o que falta instalar
  notas: number // etiquetas e notas aplicadas
  faltam: string[] // mods sem fonte (instalados à mão no outro servidor)
}

export interface ListaInstalados {
  itens: ItemInstalado[]
  semInternet: boolean
}

export interface ItemRemovido {
  id: string
  titulo: string
  categoria: CategoriaInstalado
  quando: string // ISO; some 7 dias depois
}

export interface ResultadoRemocao {
  lote: string // para o "Desfazer"
  removidos: number
  agendados: number // saem quando o servidor desligar
}

// ---------- Modpacks e Pacote pros amigos (Fase 17) ----------

export interface ModpackBusca {
  id: string
  titulo: string
  autor: string
  descricao: string
  downloads: number
  icone: string | null
  versaoJogo: string | null // a mais nova que o pack aceita
  loaders: TipoId[]
}

export interface ResultadoBuscaModpacks {
  itens: ModpackBusca[]
  total: number
}

// Mostrada antes de criar o servidor.
export interface AnaliseModpack {
  token: string
  nome: string
  versaoPack: string
  resumo: string | null
  icone: string | null
  versaoJogo: string
  tipo: TipoId
  versaoLoader: string
  mods: number
  manuais: ArquivoManual[] // CurseForge: arquivos que o autor não deixa outros apps baixarem
  arquivos: number // baixados no servidor
  tamanho: number // bytes a baixar
  ram: { gb: number; explicacao: string }
  nomeSugerido: string
}

export interface PedidoModpack {
  token: string
  nome: string
  aceitouEula: boolean
}

export interface AtualizacaoModpack {
  nome: string
  versaoAtual: string
  versaoNova: string
}

export interface ConflitoModpack {
  caminho: string
  motivo: string
}

export interface PlanoAtualizacaoModpack {
  token: string
  versaoNova: string
  escrever: number
  apagar: number
  conflitos: ConflitoModpack[]
  trocaLoader: string | null // nova versão do loader, se mudar
}

// "meu": mantém o arquivo do usuário; "pack": usa (ou apaga, se o pack tirou) o do pack.
export type EscolhaConflito = 'meu' | 'pack'

export interface PacoteAmigos {
  arquivo: string
  mods: number
  semModrinth: string[] // incluídos no pacote (licença aberta)
  manuais: string[] // o amigo precisa baixar sozinho
  extras: number // shaders, resource packs e mods só do jogador vindos do Explorar
}

// ---------- Desempenho (Fase 18) ----------

export interface AmostraDesempenho {
  t: number // ms (Date.now)
  cpu: number // %
  ram: number // bytes
  ramMax: number // bytes
  jogadores: number
  tps: number | null
}

export interface VisaoDesempenho {
  amostras: AmostraDesempenho[] // últimos 10 minutos, uma a cada 10 s
  tps: number | null
  tpsDisponivel: boolean // o software informa o TPS
  dicas: string[]
  javaOtimizado: boolean
  flags: string[] // as que entram com o interruptor ligado
}

// "embutido": já vem com o software (spark no Paper 1.21+).
export type EstadoFerramenta =
  'indisponivel' | 'ausente' | 'pendente' | 'instalado' | 'desativado' | 'embutido'

export interface Ferramenta {
  projetoId: string | null
  nome: string
  estado: EstadoFerramenta
  motivo: string | null // por que está indisponível
}

export interface TarefaChunky {
  estado: 'parado' | 'iniciando' | 'rodando' | 'pausado' | 'concluido' | 'pergunta'
  porcentagem: number
  chunks: number
  eta: string | null
  velocidade: number | null // chunks por segundo
  pergunta: { motivo: 'tarefa-antiga' | 'pouco-espaco'; texto: string } | null
}

export interface EstadoPregeracao {
  ferramenta: Ferramenta
  tarefa: TarefaChunky
}

export interface ResultadoDiagnostico {
  link: string
  culpados: { nome: string; porcentagem: number }[]
  resumo: string
}

export interface EstadoDiagnostico {
  ferramenta: Ferramenta
  rodandoDesde: number | null // ms; o perfil leva 60 s
}

export interface EstadoMapa {
  ferramenta: Ferramenta
  precisaAceitar: boolean // BlueMap: accept-download ainda está false
  configCriada: boolean // o plugin já ligou uma vez e criou a configuração
  porta: number | null
  rede: string | null // http://192.168.x.x:8100
  radmin: string | null
  render: { porcentagem: number | null; ocioso: boolean } | null
}

// ---------- Automação (Fase 19) ----------

export interface Automacao {
  vazio: { ligado: boolean; minutos: number } // 5 a 120
  reinicio: { ligado: boolean; dias: number[]; hora: string } // dias: 0 = domingo; hora "HH:MM"
  backup: { ligado: boolean; horas: number; manter: number } // manter vale para todos os backups
}

export interface EstadoAutomacao {
  config: Automacao
  vazioDesligaEm: number | null // ms (Date.now) em que desliga, se ninguém entrar
  proximoReinicio: number | null
  proximoBackup: number | null
  backupRodando: boolean
}

// Uma linha do registro de ações do app (Registro de eventos › Ações do app).
export interface AcaoApp {
  data: string // ISO
  texto: string
}

// ---------- Painel pelo celular (Fase 20) ----------

export interface EstadoCelular {
  ativo: boolean
  porta: number
  temPin: boolean
  enderecos: { rotulo: string; url: string | null; escutando: boolean }[]
  erro: string | null // ex.: porta em uso
  aparelhos: { id: string; aparelho: string; criada: number; usada: number }[]
}

// ---------- Avisos de atualização (Fase 21) ----------

export interface AtualizacoesDisponiveis {
  servidorId: string
  build: { atual: string | null; nova: string } | null // mesma versão do Minecraft
  minecraft: string | null // versão nova do Minecraft que o loader já aceita
  mods: number // mods/plugins do Modrinth com versão nova
  modpack: AtualizacaoModpack | null
  verificadoEm: number
}

export interface AjustesApp {
  verificarAtualizacoes: boolean
}

// Versão nova do HubSquare publicada no GitHub (Fase M2).
export interface ReleaseApp {
  versao: string // sem o "v" ("1.2.0")
  url: string // página do release no GitHub
  notas: string // markdown escrito no release
}

// ---------- Central de comandos (Fase 26) ----------

export interface EstadoDadosComandos {
  pronto: boolean // os comandos desta versão já foram lidos do servidor oficial
  tamanho: number // bytes a baixar (o server.jar oficial), quando ainda não
}

export interface ItemCentral {
  id: string // ex.: minecraft:diamond ou create:wrench
  nome: string // em português quando a versão (ou o mod) tem tradução
  mod: boolean
}

export interface DadosCentral {
  capacidades: import('./comandos').Capacidades
  arvore: import('./comandos').NoComando
  itens: ItemCentral[]
  efeitos: ItemCentral[]
  iconesBaixados: boolean // ícones de itens da Fase 13
}

export interface RespostaComando {
  comando: string
  ok: boolean | null // null: o servidor não respondeu nada que o app reconheça
  texto: string // em português quando a versão tem a tradução
}

export const ICONES_ATALHO = [
  'mundo',
  'jogadores',
  'coracao',
  'comida',
  'console',
  'automacao',
  'desempenho',
  'mods'
] as const
export type IconeAtalho = (typeof ICONES_ATALHO)[number]

export interface Atalho {
  id: string
  nome: string
  icone: IconeAtalho
  cor: CorEtiqueta
  comandos: string[] // pode ter {jogador}
  intervalo: number // segundos entre um comando e outro
  estrela: boolean // aparece no Painel
}

export interface HistoricoConsole {
  historico: string[] // o mais recente por último
  favoritos: string[]
}

// ---------- PlaySquare: instalações (Fase P1) ----------

export const LOADERS_CLIENTE = ['vanilla', 'fabric', 'forge', 'neoforge'] as const
export type LoaderCliente = (typeof LOADERS_CLIENTE)[number]

// De onde a instalação veio. As de servidor são criadas e mantidas pelo app.
export type OrigemInstalacao =
  | { tipo: 'servidor'; servidorId: string }
  | { tipo: 'modpack'; projetoId: string; versaoId: string; nomePack: string }
  | { tipo: 'zero' }
  // Convite de um amigo (Fase P2): o servidor dele manda o que instalar.
  | { tipo: 'convite'; conviteId: string; enderecos: string[]; token: string; servidor: string }

export interface Instalacao {
  id: string
  nome: string
  versao: string // Minecraft
  loader: LoaderCliente
  versaoLoader: string | null // null: a mais nova estável na hora de jogar
  ram: number // GB
  pasta: string // Documentos/ServSquare/jogo/<instalação>
  origem: OrigemInstalacao
  criada: string // ISO
  ultimoUso: string | null // ISO
  imagem: string | null // data URL (ícone do servidor, capa do modpack ou imagem escolhida)
  convite?: EstadoConviteInstalacao // só nas instalações de convite
  temFundo: boolean // fundo próprio do banner da tela Jogar (Fase P4)
  bannerBioma?: Bioma | null // banner com um bioma (Fase V1); sem ele, imagem/capa ou o padrão
  instalada: boolean // a pasta já foi montada pelo INSTALAR (Correção P1)
  atualizar: boolean // instalada, mas o servidor ou a instalação mudou desde então
}

export interface PedidoInstalacao {
  nome: string
  versao: string
  loader: LoaderCliente
  ram: number
}

// O que a tela pode mudar numa instalação (as de servidor seguem o servidor em versão e loader).
export interface EdicaoInstalacao {
  nome: string
  ram: number
  versao?: string
  loader?: LoaderCliente
}

// Resultado de "Jogar": o launcher oficial faz o login e abre o jogo; o app só prepara.
export type ResultadoJogar =
  | { situacao: 'semLauncher' }
  | { situacao: 'launcherAberto' }
  | { situacao: 'pronto'; frase: string; avisos: string[] }
  // Convite com versão nova: só joga depois de atualizar (a tela mostra o que entra e o que sai).
  | { situacao: 'desatualizada'; convite: EstadoConviteInstalacao }
  // Mods do jogador que o servidor não aceita.
  | { situacao: 'proibidos'; arquivos: string[] }
  // Primeira vez: copiar teclas, vídeo e som da pasta .minecraft normal? (Fase P3)
  | { situacao: 'copiarOpcoes' }

// ---------- Convites (Fase P2) ----------

// Um arquivo que o jogador precisa: só a referência (link oficial + hash), nunca o arquivo.
export interface ArquivoManifesto {
  path: string // ex.: "mods/sodium.jar", "resourcepacks/x.zip"
  sha1: string
  sha512: string
  tamanho: number
  downloads: string[]
  obrigatorio: boolean // false: recomendado (o amigo pode recusar)
}

// O que o servidor publica para os amigos. "versao" sobe a cada mudança do conteúdo.
export interface Manifesto {
  formato: 1
  conviteId: string // o mesmo enquanto o dono não apagar o convite (revogar troca só o token)
  versao: number
  servidor: string // nome
  minecraft: string
  loader: LoaderCliente
  versaoLoader: string | null
  arquivos: ArquivoManifesto[]
  proibidos: string[] // trechos do nome do .jar que o servidor não aceita (ex.: "xray")
  semLink: string[] // mods que o app não pode mandar (sem fonte oficial): o amigo baixa à mão
  manuais?: ArquivoManual[] // Fase D: do CurseForge sem permissão; o amigo baixa pela página oficial
  enderecos: string[] // para entrar no jogo, em ordem de preferência
  packs?: string[] // resource packs do servidor, na ordem (o primeiro fica por cima) (Fase P3)
  mensagem?: string // recado do dono para os amigos (Fase P4); não sobe a versão
  servidorId?: string // Fase M7: id fixo do servidor (o mesmo com outro dono); não sobe a versão
  geradoEm: string
}

// Tela do dono (ServSquare › Conexão › Convites).
export interface ConviteServidor {
  ativo: boolean
  codigo: string | null
  link: string | null
  versao: number
  proibidos: string[]
  enderecosManifesto: string[] // onde o manifesto responde agora
  enderecoPlayitManifesto: string | null // túnel do playit criado pelo dono (opcional)
  porta: number
  erroEscuta: string | null
  aprovarAutomatico: boolean // Fase M4: quem usar este convite entra na whitelist sem pedir
}

// Situação do convite numa instalação do amigo.
export interface EstadoConviteInstalacao {
  versaoAplicada: number // 0: ainda não instalou nada
  versaoDisponivel: number
  online: boolean | null // null: ainda não verificou
  entra: string[] // nomes dos arquivos que entram na próxima atualização
  sai: string[]
  semLink: string[]
  opcionais: { path: string; recusado: boolean }[]
}

// ---------- Tela Jogar (Fase P4) ----------

// O que o jogo da instalação está fazendo (o launcher oficial abre o jogo; o app só observa).
export type EstadoJogo =
  | { fase: 'abrindo'; desde: string } // launcher aberto, esperando o jogador clicar em JOGAR lá
  | { fase: 'jogando'; desde: string }
  | { fase: 'fechou'; duracaoMs: number; travou: boolean; quando: string }

export interface StatusServidorJogo {
  dono: boolean // o servidor é deste PC (instalação do ServSquare)
  nome: string
  online: boolean | null // null: não deu para saber
  ligando: boolean
  jogadores: { nome: string; uuid: string | null }[]
  contagem: { online: number; max: number } | null
  endereco: string | null
  mensagem: string | null // recado do dono (ServSquare › Servidores)
  podeLigar: boolean // dono, desligado e nenhum outro servidor ligado
  faltando?: { quando: string; mods: ModFaltando[] } | null // dono: mods que faltaram ao ligar
  // Amigo (Fase M4): o pedido para entrar na whitelist. "naoEnviado": o dono estava desligado.
  pedido?: { nick: string; situacao: SituacaoPedido | 'naoEnviado' } | null
}

// Mod que faltou quando o servidor não ligou (tela Jogar). Achado no Modrinth: tem título e arquivo,
// e espera no assistente de downloads (alvo = id do servidor, mesmo arquivo).
export interface ModFaltando {
  id: string
  pedidoPor: string
  exige: string | null
  titulo: string | null
  arquivo: string | null
}

export interface MemoriaJogo {
  atual: number
  sugerida: number
  min: number
  max: number
  servidor: number | null // GB do servidor, quando ele roda neste PC
  disponivel: number // o que sobra para o jogo
  cabe: boolean
  mods: number
}

// Modo do app (Fase M6): o que a tela precisa saber ao abrir.
export interface EstadoModo {
  modo: import('./modoRegras').ModoApp | null // null: primeira abertura (boas-vindas)
  sugerirAmigo: boolean // aberto por um convite, sem servidores
  convite: string | null // o convite que abriu o app (já colado no "Entrar com convite")
}

// ---------- Passar o servidor (Fase M7) ----------

// O que vai e o que fica, mostrado antes de gerar o .hubserver.
export interface PreviaPassar {
  tamanho: number // bytes, antes de compactar
  vai: string[]
  fica: string[]
  mods: number // com link oficial
  manuais: number // o novo dono baixa pela página oficial
  semLink: string[] // .jar sem link: o novo dono põe à mão
}

export interface AnaliseHubserver {
  token: string
  arquivo: string
  nome: string
  tipo: TipoId
  versao: string
  mods: number
  manuais: number
  semLink: string[]
  // O mesmo servidor já está neste PC (mesmo id fixo).
  mesmo: { id: string; nome: string; motivoSemAtualizar: string | null } | null
}

export interface PedidoReceber {
  token: string
  modo: 'novo' | 'copia' | 'atualizar'
  nome?: string // novo e cópia
  aceitouEula?: boolean // novo e cópia
}

// ---------- Relatório de erro (Fase M8) ----------

export interface OpcoesRelatorio {
  servidores: { id: string; nome: string }[]
  instalacoes: { id: string; nome: string }[]
  servidorPadrao: string | null
  instalacaoPadrao: string | null
  itens: { id: string; nome: string; descricao: string }[]
}

export interface PedidoRelatorio {
  servidorId: string | null
  instalacaoId: string | null
  tirar: string[] // itens que o usuário desmarcou
}

export interface RelatorioGerado {
  arquivo: string // nome do .zip na Área de Trabalho
  itens: string[] // arquivos dentro dele
}
