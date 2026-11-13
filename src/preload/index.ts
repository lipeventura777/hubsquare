import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Fonte } from '../shared/fontes'
import type { AcaoCentral } from '../shared/comandos'
import type {
  AjustesJogo,
  DownloadManual,
  Captura,
  EstadoJogo,
  ErroTela,
  MemoriaJogo,
  StatusServidorJogo,
  TipoAviso,
  ConviteServidor,
  EdicaoInstalacao,
  Instalacao,
  LoaderCliente,
  PedidoInstalacao,
  ResultadoJogar,
  AjustesApp,
  ReleaseApp,
  EstadoModo,
  PedidoConvite,
  PedidoParaEntrar,
  Bioma,
  AtualizacoesDisponiveis,
  EstadoCelular,
  AcaoApp,
  Automacao,
  EstadoAutomacao,
  EstadoDiagnostico,
  EstadoMapa,
  EstadoPregeracao,
  ResultadoDiagnostico,
  VisaoDesempenho,
  AnaliseModpack,
  AtualizacaoModpack,
  EscolhaConflito,
  PacoteAmigos,
  PedidoModpack,
  PlanoAtualizacaoModpack,
  ResultadoBuscaModpacks,
  AtualizacaoMod,
  ListaMods,
  PlanoMods,
  DetalhesProjeto,
  Atalho,
  DadosCentral,
  EstadoDadosComandos,
  HistoricoConsole,
  RespostaComando,
  ConfigLida,
  CorEtiqueta,
  PerfilMods,
  ResultadoImportacao,
  TravamentoMods,
  VersoesDoMod,
  ItemInstalado,
  ItemRemovido,
  ListaInstalados,
  ResultadoRemocao,
  FiltrosExplorar,
  OpcoesExplorar,
  ResultadoExplorar,
  TipoConteudo,
  ArquivoLog,
  ListaArquivos,
  MundoServidor,
  RelatorioTravamento,
  AcaoJogador,
  Amigo,
  DetalhesJogador,
  EstadoIcones,
  EstatisticasJogador,
  InventarioJogador,
  OpcaoExclusao,
  JogadorResumo,
  ListaId,
  AnaliseZip,
  ItemServidor,
  PedidoImportacao,
  PedidoReceber,
  OpcoesRelatorio,
  PedidoRelatorio,
  RelatorioGerado,
  PreviaPassar,
  AnaliseHubserver,
  PedidoSoftware,
  Aparencia,
  Backup,
  LimitesRam,
  AvisoEstado,
  AvisoJogador,
  Configuracoes,
  DadosConfiguracoes,
  EstadoConexao,
  ModoConexao,
  ResultadoTeste,
  ResultadoUpnp,
  Screenshot,
  EstadoServidor,
  InfoServidor,
  LinhaConsole,
  PedidoCriacao,
  Progresso,
  Resultado,
  TipoId,
  UsoServidor
} from '../shared/tipos'
import type { Conserto, LinhaDiagnostico } from '../shared/diagnosticoRegras'
import type { ModoApp } from '../shared/modoRegras'

// Assina um aviso do processo principal; devolve a função que cancela a assinatura.
function ouvir<T>(canal: string, aoReceber: (dado: T) => void): () => void {
  const ouvinte = (_evento: unknown, dado: T): void => aoReceber(dado)
  ipcRenderer.on(canal, ouvinte)
  return () => ipcRenderer.removeListener(canal, ouvinte)
}

// Única porta entre a tela (renderer) e o processo principal.
// Cada função aqui é um pedido permitido; nada além disso chega ao main.
// Telas de mods (Explorar, Instalados, configs): as mesmas para o servidor ativo (id null) e para
// uma instalação do PlaySquare (Fase P3), que usa os canais "play:..." com o id na frente.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- o tipo é o do objeto
function apiDoAlvo(id: string | null) {
  const c = (canal: string, ...a: unknown[]): Promise<never> =>
    (id
      ? ipcRenderer.invoke(`play:${canal}`, id, ...a)
      : ipcRenderer.invoke(canal, ...a)) as Promise<never>
  return {
    listarMods: (): Promise<Resultado<ListaMods>> => c('mods:instalados'),
    planejarMod: (projetoId: string, fonte: Fonte = 'modrinth'): Promise<Resultado<PlanoMods>> =>
      c('mods:planejar', projetoId, fonte),
    instalarMods: (token: string): Promise<Resultado<void>> => c('mods:instalar', token),
    alternarMod: (arquivo: string, ativo: boolean): Promise<Resultado<void>> =>
      c('mods:alternar', arquivo, ativo),
    listarAtualizacoesMods: (): Promise<Resultado<AtualizacaoMod[]>> => c('mods:atualizacoes'),
    atualizarMods: (arquivos?: string[]): Promise<Resultado<void>> => c('mods:atualizar', arquivos),

    // Explorar (Fase 23). Mods e plugins do servidor instalam por planejarMod/instalarMods.,
    opcoesExplorar: (tipo: TipoConteudo, fonte: Fonte): Promise<Resultado<OpcoesExplorar>> =>
      c('explorar:opcoes', tipo, fonte),
    buscarExplorar: (filtros: FiltrosExplorar): Promise<Resultado<ResultadoExplorar>> =>
      c('explorar:buscar', filtros),
    detalhesProjeto: (
      id: string,
      tipo: TipoConteudo,
      fonte: Fonte
    ): Promise<Resultado<DetalhesProjeto>> => c('explorar:detalhes', id, tipo, fonte),
    instalarDatapack: (id: string, fonte: Fonte): Promise<Resultado<void>> =>
      c('explorar:datapack', id, fonte),

    // Chave do CurseForge (Fase 24): a tela só sabe se existe; o valor nunca volta.,
    removerDatapack: (id: string): Promise<Resultado<boolean>> => c('explorar:removerDatapack', id),
    usarResourcePack: (id: string, obrigatorio: boolean): Promise<Resultado<void>> =>
      c('explorar:resourcePack', id, obrigatorio),
    pararResourcePack: (): Promise<Resultado<void>> => c('explorar:pararResourcePack'),
    adicionarAosAmigos: (id: string, tipo: TipoConteudo): Promise<Resultado<void>> =>
      c('explorar:amigos', id, tipo),
    removerDosAmigos: (id: string): Promise<Resultado<void>> => c('explorar:removerAmigos', id),

    // Central de comandos (Fase 26). A tela manda a ação, não o texto do comando.,
    configsDoMod: (arquivo: string): Promise<Resultado<string[]>> => c('mods:configs', arquivo),
    lerConfigMod: (caminho: string): Promise<Resultado<ConfigLida>> => c('mods:lerConfig', caminho),
    salvarConfigMod: (
      caminho: string,
      hash: string,
      mudancas: Record<string, unknown>
    ): Promise<Resultado<boolean>> => c('mods:salvarConfig', caminho, hash, mudancas),
    restaurarConfigMod: (caminho: string): Promise<Resultado<boolean>> =>
      c('mods:restaurarConfig', caminho),
    versoesDoMod: (arquivo: string): Promise<Resultado<VersoesDoMod>> => c('mods:versoes', arquivo),
    trocarVersaoMod: (arquivo: string, versaoId: string): Promise<Resultado<void>> =>
      c('mods:trocarVersao', arquivo, versaoId),
    trocarParaCompativel: (arquivo: string): Promise<Resultado<void>> =>
      c('mods:trocarCompativel', arquivo),
    voltarVersaoMod: (arquivo: string): Promise<Resultado<void>> => c('mods:voltarVersao', arquivo),
    travarVersaoMod: (idMod: string, travar: boolean): Promise<Resultado<void>> =>
      c('mods:travar', idMod, travar),
    mudarEtiquetaMod: (
      idMod: string,
      cor: CorEtiqueta | null,
      nota: string
    ): Promise<Resultado<void>> => c('mods:etiqueta', idMod, cor, nota),
    listarPerfisMods: (): Promise<Resultado<PerfilMods[]>> => c('mods:perfis'),
    salvarPerfilMods: (nome: string): Promise<Resultado<void>> => c('mods:salvarPerfil', nome),
    aplicarPerfilMods: (nome: string): Promise<Resultado<{ mudados: number; faltam: number }>> =>
      c('mods:aplicarPerfil', nome),
    apagarPerfilMods: (nome: string): Promise<Resultado<void>> => c('mods:apagarPerfil', nome),
    planejarModPorId: (modId: string): Promise<Resultado<PlanoMods>> =>
      c('mods:planejarPorId', modId),
    travamentoMods: (): Promise<Resultado<TravamentoMods | null>> => c('mods:travamento'),
    dispensarTravamento: (nome: string): Promise<Resultado<void>> =>
      c('mods:dispensarTravamento', nome),
    desativarETentar: (chaves: string[], nome: string): Promise<Resultado<void>> =>
      c('mods:desativarETentar', chaves, nome),
    exportarListaMods: (): Promise<Resultado<string | null>> => c('mods:exportar'),
    importarListaMods: (): Promise<Resultado<ResultadoImportacao | null>> => c('mods:importar'),

    // Aba Instalados (Fase 23.2). Remover devolve o lote para o "Desfazer".,
    listarTudoInstalado: (): Promise<Resultado<ListaInstalados>> => c('instalados:listar'),
    removerInstalados: (
      itens: Pick<ItemInstalado, 'chave' | 'titulo' | 'categoria'>[]
    ): Promise<Resultado<ResultadoRemocao>> => c('instalados:remover', itens),
    desfazerRemocao: (lote: string): Promise<Resultado<void>> => c('instalados:desfazer', lote),
    listarRemovidos: (): Promise<Resultado<ItemRemovido[]>> => c('instalados:removidos'),
    restaurarRemovido: (id: string): Promise<Resultado<void>> => c('instalados:restaurar', id)

    // Modpacks (Fase 17). analisarModpackArquivo devolve null se o usuário cancelar.
  }
}

const api = {
  ...apiDoAlvo(null),
  paraInstalacao: (id: string) => apiDoAlvo(id),
  versaoDoApp: (): Promise<string> => ipcRenderer.invoke('app:versao'),
  servidorAtual: (): Promise<Resultado<InfoServidor | null>> =>
    ipcRenderer.invoke('servidor:atual'),
  listarVersoes: (tipo: TipoId): Promise<Resultado<string[]>> =>
    ipcRenderer.invoke('servidor:versoes', tipo),
  criarServidor: (pedido: PedidoCriacao): Promise<Resultado<InfoServidor>> =>
    ipcRenderer.invoke('servidor:criar', pedido),
  ligar: (): Promise<Resultado<void>> => ipcRenderer.invoke('servidor:ligar'),
  // Fase M7: o "Ligar mesmo assim" de um servidor passado a um amigo.
  ligarMesmoEmprestado: (): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidor:ligarEmprestado'),
  desligar: (): Promise<Resultado<void>> => ipcRenderer.invoke('servidor:desligar'),
  enviarComando: (comando: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidor:comando', comando),
  lerConsole: (): Promise<{ estado: EstadoServidor; historico: LinhaConsole[] }> =>
    ipcRenderer.invoke('servidor:console'),
  reiniciar: (): Promise<Resultado<void>> => ipcRenderer.invoke('servidor:reiniciar'),
  abrirPastaServidor: (): Promise<Resultado<void>> => ipcRenderer.invoke('servidor:abrirPasta'),
  // Sem id, renomeia o servidor ativo.,
  renomearServidor: (nome: string, id?: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidor:renomear', nome, id),
  listarServidores: (): Promise<Resultado<ItemServidor[]>> =>
    ipcRenderer.invoke('servidores:listar'),
  ativarServidor: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidores:ativar', id),
  // Desliga o servidor ligado (com backup), troca o ativo e, se pedido, liga o novo.,
  trocarServidor: (id: string, ligarDepois: boolean): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidores:trocar', id, ligarDepois),
  apagarServidor: (id: string, confirmacao: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidores:apagar', id, confirmacao),
  // Abre o seletor de arquivo e analisa o .zip; null se o usuário cancelar.,
  analisarZip: (): Promise<Resultado<AnaliseZip | null>> => ipcRenderer.invoke('importar:analisar'),
  // Relatório de erro (Fase M8).
  opcoesRelatorio: (): Promise<Resultado<OpcoesRelatorio>> =>
    ipcRenderer.invoke('relatorio:opcoes'),
  gerarRelatorio: (pedido: PedidoRelatorio): Promise<Resultado<RelatorioGerado>> =>
    ipcRenderer.invoke('relatorio:gerar', pedido),
  abrirPastaDoRelatorio: (): Promise<Resultado<void>> => ipcRenderer.invoke('relatorio:abrirPasta'),
  // Passar o servidor (Fase M7).
  previaPassar: (id: string): Promise<Resultado<PreviaPassar>> =>
    ipcRenderer.invoke('passar:previa', id),
  passarServidor: (
    id: string,
    para: string
  ): Promise<Resultado<{ arquivo: string; tamanho: number } | null>> =>
    ipcRenderer.invoke('passar:gerar', id, para),
  analisarHubserver: (): Promise<Resultado<AnaliseHubserver | null>> =>
    ipcRenderer.invoke('passar:analisar'),
  receberHubserver: (pedido: PedidoReceber): Promise<Resultado<InfoServidor>> =>
    ipcRenderer.invoke('passar:receber', pedido),
  criarDeZip: (pedido: PedidoImportacao): Promise<Resultado<InfoServidor>> =>
    ipcRenderer.invoke('importar:criar', pedido),
  trocarSoftware: (pedido: PedidoSoftware): Promise<Resultado<InfoServidor>> =>
    ipcRenderer.invoke('software:trocar', pedido),
  lerConfiguracoes: (): Promise<Resultado<DadosConfiguracoes>> => ipcRenderer.invoke('config:ler'),
  salvarConfiguracoes: (c: Configuracoes): Promise<Resultado<{ precisaReiniciar: boolean }>> =>
    ipcRenderer.invoke('config:salvar', c),
  listarLista: (lista: ListaId): Promise<Resultado<Amigo[]>> =>
    ipcRenderer.invoke('listas:listar', lista),
  adicionarNaLista: (lista: ListaId, valor: string): Promise<Resultado<Amigo[]>> =>
    ipcRenderer.invoke('listas:adicionar', lista, valor),
  removerDaLista: (lista: ListaId, valor: string): Promise<Resultado<Amigo[]>> =>
    ipcRenderer.invoke('listas:remover', lista, valor),
  listarTodosJogadores: (): Promise<Resultado<JogadorResumo[]>> =>
    ipcRenderer.invoke('jogadores:todos'),
  detalhesJogador: (nome: string): Promise<Resultado<DetalhesJogador>> =>
    ipcRenderer.invoke('jogadores:detalhes', nome),
  cabecaJogador: (uuid: string): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('jogadores:cabeca', uuid),
  acaoJogador: (nome: string, acao: AcaoJogador): Promise<Resultado<void>> =>
    ipcRenderer.invoke('jogadores:acao', nome, acao),
  inventarioJogador: (nome: string): Promise<Resultado<InventarioJogador>> =>
    ipcRenderer.invoke('jogadores:inventario', nome),
  // null: o jogador ainda não tem estatísticas salvas.,
  estatisticasJogador: (nome: string): Promise<Resultado<EstatisticasJogador | null>> =>
    ipcRenderer.invoke('jogadores:estatisticas', nome),
  // Só com o servidor desligado; faz backup do mundo antes.,
  excluirDadosJogador: (nome: string, opcoes: OpcaoExclusao[]): Promise<Resultado<void>> =>
    ipcRenderer.invoke('jogadores:excluir', nome, opcoes),
  // Ícones e nomes traduzidos dos itens, baixados da Mojang só quando o usuário pede.,
  estadoIcones: (): Promise<Resultado<EstadoIcones>> => ipcRenderer.invoke('icones:estado'),
  baixarIcones: (): Promise<Resultado<void>> => ipcRenderer.invoke('icones:baixar'),

  // Tela Arquivos: caminhos relativos à pasta do servidor, com "/". O main recusa o que sair dela.,
  listarArquivos: (caminho: string): Promise<Resultado<ListaArquivos>> =>
    ipcRenderer.invoke('arquivos:listar', caminho),
  lerArquivoTexto: (caminho: string): Promise<Resultado<string>> =>
    ipcRenderer.invoke('arquivos:ler', caminho),
  // true: o servidor está ligado e a mudança só vale depois de reiniciar.,
  salvarArquivoTexto: (caminho: string, texto: string): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('arquivos:salvar', caminho, texto),
  renomearArquivo: (caminho: string, novoNome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('arquivos:renomear', caminho, novoNome),
  criarPasta: (caminho: string, nome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('arquivos:novaPasta', caminho, nome),
  apagarArquivo: (caminho: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('arquivos:apagar', caminho),
  baixarArquivo: (caminho: string): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('arquivos:baixar', caminho),
  // Arquivos arrastados do Windows: o caminho de cada um vem do webUtils (só existe no preload).,
  enviarArquivos: (caminho: string, arquivos: File[]): Promise<Resultado<void>> =>
    ipcRenderer.invoke(
      'arquivos:enviar',
      caminho,
      arquivos.map((f) => webUtils.getPathForFile(f))
    ),
  listarMundos: (): Promise<Resultado<MundoServidor[]>> => ipcRenderer.invoke('mundos:listar'),
  ativarMundo: (nome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('mundos:ativar', nome),
  gerarMundo: (nome: string, seed: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('mundos:gerar', nome, seed),
  apagarMundo: (nome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('mundos:apagar', nome),
  exportarMundo: (nome: string): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('mundos:exportar', nome),
  // Devolvem o nome da pasta do mundo importado, ou null se o usuário cancelar.,
  importarMundoDePasta: (): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('mundos:importarPasta'),
  importarMundoDeZip: (): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('mundos:importarZip'),
  listarLogs: (): Promise<Resultado<ArquivoLog[]>> => ipcRenderer.invoke('logs:listar'),
  lerLog: (nome: string): Promise<Resultado<string>> => ipcRenderer.invoke('logs:ler', nome),
  listarTravamentos: (): Promise<Resultado<ArquivoLog[]>> => ipcRenderer.invoke('logs:travamentos'),
  lerTravamento: (nome: string): Promise<Resultado<RelatorioTravamento>> =>
    ipcRenderer.invoke('logs:travamento', nome),
  baixarLog: (tipo: 'logs' | 'travamentos', nome: string): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('logs:baixar', tipo, nome),

  // Mods e plugins (Fase 16). Sem `arquivos`, atualiza todos.,
  temChaveCurseForge: (): Promise<Resultado<boolean>> => ipcRenderer.invoke('curseforge:temChave'),
  salvarChaveCurseForge: (chave: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('curseforge:salvarChave', chave),
  apagarChaveCurseForge: (): Promise<Resultado<void>> =>
    ipcRenderer.invoke('curseforge:apagarChave'),
  analisarModpackCurseForge: (projetoId: string): Promise<Resultado<AnaliseModpack>> =>
    ipcRenderer.invoke('modpacks:analisarCurseForge', projetoId),
  estadoDadosComandos: (): Promise<Resultado<EstadoDadosComandos>> =>
    ipcRenderer.invoke('central:estado'),
  prepararDadosComandos: (): Promise<Resultado<void>> => ipcRenderer.invoke('central:preparar'),
  dadosCentral: (): Promise<Resultado<DadosCentral>> => ipcRenderer.invoke('central:dados'),
  iconesDosItens: (ids: string[]): Promise<Resultado<Record<string, string | null>>> =>
    ipcRenderer.invoke('central:icones', ids),
  executarAcao: (acao: AcaoCentral, confirmado = false): Promise<Resultado<RespostaComando[]>> =>
    ipcRenderer.invoke('central:executar', acao, confirmado),
  lerGamerules: (): Promise<Resultado<Record<string, string>>> =>
    ipcRenderer.invoke('central:gamerules'),
  listarAtalhos: (): Promise<Resultado<Atalho[]>> => ipcRenderer.invoke('atalhos:listar'),
  salvarAtalho: (atalho: Atalho): Promise<Resultado<Atalho[]>> =>
    ipcRenderer.invoke('atalhos:salvar', atalho),
  apagarAtalho: (id: string): Promise<Resultado<Atalho[]>> =>
    ipcRenderer.invoke('atalhos:apagar', id),
  executarAtalho: (
    id: string,
    jogador: string | null,
    confirmado = false
  ): Promise<Resultado<RespostaComando[]>> =>
    ipcRenderer.invoke('atalhos:executar', id, jogador, confirmado),
  lerHistoricoConsole: (): Promise<Resultado<HistoricoConsole>> =>
    ipcRenderer.invoke('console:historico'),
  adicionarAoHistorico: (comando: string): Promise<Resultado<HistoricoConsole>> =>
    ipcRenderer.invoke('console:adicionar', comando),
  mudarFavorito: (comando: string, favorito: boolean): Promise<Resultado<HistoricoConsole>> =>
    ipcRenderer.invoke('console:favorito', comando, favorito),

  // Mods personalizáveis (Fase 25). Salvar/restaurar config devolve true com o servidor ligado.,
  buscarModpacks: (termo: string, offset: number): Promise<Resultado<ResultadoBuscaModpacks>> =>
    ipcRenderer.invoke('modpacks:buscar', termo, offset),
  analisarModpackModrinth: (projetoId: string): Promise<Resultado<AnaliseModpack>> =>
    ipcRenderer.invoke('modpacks:analisarModrinth', projetoId),
  analisarModpackArquivo: (): Promise<Resultado<AnaliseModpack | null>> =>
    ipcRenderer.invoke('modpacks:analisarArquivo'),
  criarDeModpack: (pedido: PedidoModpack): Promise<Resultado<InfoServidor>> =>
    ipcRenderer.invoke('modpacks:criar', pedido),
  // Para a análise ou a instalação de modpack em andamento (ServSquare e PlaySquare).
  cancelarModpack: (): Promise<Resultado<void>> => ipcRenderer.invoke('modpacks:cancelar'),
  descartarModpack: (token: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('modpacks:descartar', token),
  // Erro que escapou no processo principal (o app não fecha: a tela mostra).
  aoErroDoApp: (f: (erro: ErroTela) => void) => ouvir('app:erro', f),
  atualizacaoModpack: (): Promise<Resultado<AtualizacaoModpack | null>> =>
    ipcRenderer.invoke('modpacks:atualizacao'),
  planejarAtualizacaoModpack: (): Promise<Resultado<PlanoAtualizacaoModpack>> =>
    ipcRenderer.invoke('modpacks:planejar'),
  atualizarModpack: (
    token: string,
    escolhas: Record<string, EscolhaConflito>
  ): Promise<Resultado<void>> => ipcRenderer.invoke('modpacks:atualizar', token, escolhas),
  gerarPacoteAmigos: (): Promise<Resultado<PacoteAmigos | null>> =>
    ipcRenderer.invoke('modpacks:amigos'),

  // Desempenho (Fase 18). O diagnóstico leva uns 60 s para responder.,
  visaoDesempenho: (): Promise<Resultado<VisaoDesempenho>> =>
    ipcRenderer.invoke('desempenho:visao'),
  definirJavaOtimizado: (valor: boolean): Promise<Resultado<void>> =>
    ipcRenderer.invoke('desempenho:javaOtimizado', valor),
  estadoPregeracao: (): Promise<Resultado<EstadoPregeracao>> =>
    ipcRenderer.invoke('desempenho:pregeracao'),
  iniciarPregeracao: (raio: number): Promise<Resultado<void>> =>
    ipcRenderer.invoke('desempenho:iniciarPregeracao', raio),
  controlarPregeracao: (
    acao: 'pausar' | 'continuar' | 'cancelar' | 'confirmar'
  ): Promise<Resultado<void>> => ipcRenderer.invoke('desempenho:controlarPregeracao', acao),
  estadoDiagnostico: (): Promise<Resultado<EstadoDiagnostico>> =>
    ipcRenderer.invoke('desempenho:diagnostico'),
  diagnosticar: (): Promise<Resultado<ResultadoDiagnostico>> =>
    ipcRenderer.invoke('desempenho:diagnosticar'),
  estadoMapa: (): Promise<Resultado<EstadoMapa>> => ipcRenderer.invoke('desempenho:mapa'),
  aceitarTermosMapa: (): Promise<Resultado<void>> => ipcRenderer.invoke('desempenho:aceitarMapa'),
  abrirMapa: (): Promise<Resultado<void>> => ipcRenderer.invoke('desempenho:abrirMapa'),

  // Automação (Fase 19).,
  lerAutomacao: (): Promise<Resultado<EstadoAutomacao>> => ipcRenderer.invoke('automacao:ler'),
  salvarAutomacao: (config: Automacao): Promise<Resultado<EstadoAutomacao>> =>
    ipcRenderer.invoke('automacao:salvar', config),
  listarAcoes: (): Promise<Resultado<AcaoApp[]>> => ipcRenderer.invoke('acoes:listar'),

  // Painel pelo celular (Fase 20).,
  estadoCelular: (): Promise<Resultado<EstadoCelular>> => ipcRenderer.invoke('celular:estado'),
  definirPinCelular: (pin: string): Promise<Resultado<EstadoCelular>> =>
    ipcRenderer.invoke('celular:pin', pin),
  ativarCelular: (valor: boolean): Promise<Resultado<EstadoCelular>> =>
    ipcRenderer.invoke('celular:ativar', valor),
  definirPortaCelular: (porta: number): Promise<Resultado<EstadoCelular>> =>
    ipcRenderer.invoke('celular:porta', porta),
  desconectarCelulares: (): Promise<Resultado<EstadoCelular>> =>
    ipcRenderer.invoke('celular:desconectar'),

  // Ícone, MOTD e avisos de atualização (Fase 21).,
  lerIcone: (): Promise<Resultado<string | null>> => ipcRenderer.invoke('icone:ler'),
  salvarIcone: (dataUrl: string): Promise<Resultado<string>> =>
    ipcRenderer.invoke('icone:salvar', dataUrl),
  removerIcone: (): Promise<Resultado<void>> => ipcRenderer.invoke('icone:remover'),
  lerAtualizacoes: (): Promise<Resultado<AtualizacoesDisponiveis | null>> =>
    ipcRenderer.invoke('atualizacoes:ler'),
  verificarAtualizacoes: (): Promise<Resultado<AtualizacoesDisponiveis | null>> =>
    ipcRenderer.invoke('atualizacoes:verificar'),
  atualizarBuild: (): Promise<Resultado<void>> => ipcRenderer.invoke('atualizacoes:build'),
  aoMudarAtualizacoes: (f: (a: AtualizacoesDisponiveis) => void) => ouvir('atualizacoes:mudou', f),
  lerAjustes: (): Promise<Resultado<AjustesApp>> => ipcRenderer.invoke('ajustes:ler'),
  salvarAjustes: (ajustes: AjustesApp): Promise<Resultado<AjustesApp>> =>
    ipcRenderer.invoke('ajustes:salvar', ajustes),
  // Versão nova do HubSquare (Fase M2)
  avisoVersaoApp: (): Promise<Resultado<ReleaseApp | null>> =>
    ipcRenderer.invoke('appVersao:aviso'),
  baixarVersaoApp: (): Promise<Resultado<void>> => ipcRenderer.invoke('appVersao:baixar'),
  lembrarVersaoDepois: (): Promise<Resultado<void>> =>
    ipcRenderer.invoke('appVersao:lembrarDepois'),
  pularVersaoApp: (): Promise<Resultado<void>> => ipcRenderer.invoke('appVersao:pular'),
  avisoVersaoLigado: (): Promise<Resultado<boolean>> => ipcRenderer.invoke('appVersao:ligado'),
  ligarAvisoVersao: (ligado: boolean): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('appVersao:ligar', ligado),
  aoMudarVersaoApp: (f: (r: ReleaseApp | null) => void) => ouvir('appVersao:mudou', f),
  // Fundo animado (Fase V2): instalação de modpack em andamento (o fundo para).
  modpackInstalando: (): Promise<boolean> => ipcRenderer.invoke('fundo:modpackInstalando'),
  aoMudarJanelaVisivel: (f: (visivel: boolean) => void) => ouvir('janela:visivel', f),
  aoMudarModpackInstalando: (f: (instalando: boolean) => void) =>
    ouvir('fundo:modpackInstalando', f),
  aoMudarEstado: (f: (aviso: AvisoEstado) => void) => ouvir('servidor:estado', f),
  aoReceberConsole: (f: (linhas: LinhaConsole[]) => void) => ouvir('servidor:console', f),
  aoProgredir: (f: (p: Progresso) => void) => ouvir('download:progresso', f),
  lerJogadores: (): Promise<string[]> => ipcRenderer.invoke('jogadores:listar'),
  aoMudarJogadores: (f: (nomes: string[]) => void) => ouvir('jogadores:lista', f),
  aoAvisoJogador: (f: (aviso: AvisoJogador) => void) => ouvir('jogadores:aviso', f),
  lerConexao: (): Promise<Resultado<EstadoConexao>> => ipcRenderer.invoke('conexao:estado'),
  escolherModoConexao: (modo: ModoConexao): Promise<Resultado<void>> =>
    ipcRenderer.invoke('conexao:modo', modo),
  vincularPlayit: (): Promise<Resultado<void>> => ipcRenderer.invoke('conexao:vincularPlayit'),
  salvarEnderecoPlayit: (endereco: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('conexao:enderecoPlayit', endereco),
  testarConexao: (modo: ModoConexao): Promise<Resultado<ResultadoTeste>> =>
    ipcRenderer.invoke('conexao:testar', modo),
  liberarFirewall: (): Promise<Resultado<void>> => ipcRenderer.invoke('conexao:firewall'),
  tentarUpnp: (): Promise<Resultado<ResultadoUpnp>> => ipcRenderer.invoke('conexao:upnp'),
  lerIpPublico: (): Promise<Resultado<string | null>> => ipcRenderer.invoke('conexao:ipPublico'),
  copiar: (texto: string): Promise<void> => ipcRenderer.invoke('app:copiar', texto),
  limitesRam: (): Promise<LimitesRam> => ipcRenderer.invoke('config:limitesRam'),
  listarBackups: (): Promise<Resultado<Backup[]>> => ipcRenderer.invoke('backups:listar'),
  // Motivo do selo ⚠ em Cópias de segurança, ou null.,
  alertaBackups: (): Promise<Resultado<string | null>> => ipcRenderer.invoke('backups:alerta'),
  restaurarBackup: (arquivo: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('backups:restaurar', arquivo),
  aoMudarBackups: (f: () => void) => ouvir('backups:mudou', f),
  // Fase 23.2. Apagar todos exige o nome do servidor; protegidos nunca saem.,
  apagarBackups: (arquivos: string[], nomeDigitado?: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('backups:apagar', arquivos, nomeDigitado),
  protegerBackup: (arquivo: string, protegido: boolean): Promise<Resultado<void>> =>
    ipcRenderer.invoke('backups:proteger', arquivo, protegido),
  lerAparencia: (): Promise<Resultado<Aparencia>> => ipcRenderer.invoke('aparencia:ler'),
  salvarAparencia: (a: Omit<Aparencia, 'fundo'>): Promise<Resultado<Aparencia>> =>
    ipcRenderer.invoke('aparencia:salvar', a),
  // Imagem de fundo como data URL (ou null se não houver).,
  lerFundo: (): Promise<Resultado<string | null>> => ipcRenderer.invoke('aparencia:fundo'),
  escolherFundo: (): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('aparencia:escolherFundo'),
  removerFundo: (): Promise<Resultado<void>> => ipcRenderer.invoke('aparencia:removerFundo'),
  // Prints do Minecraft (os mais recentes primeiro), com miniatura.,
  listarScreenshots: (): Promise<Resultado<Screenshot[]>> =>
    ipcRenderer.invoke('aparencia:screenshots'),
  usarScreenshotComoFundo: (nome: string): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('aparencia:usarScreenshot', nome),

  // null quando o servidor desliga.,
  aoMedirUso: (f: (uso: UsoServidor | null) => void) => ouvir('servidor:uso', f),

  // PlaySquare (Fase P1): instalações e Jogar pelo Minecraft Launcher oficial.,
  listarInstalacoes: (): Promise<Resultado<Instalacao[]>> =>
    ipcRenderer.invoke('instalacoes:listar'),
  versoesDoLoader: (loader: LoaderCliente): Promise<Resultado<string[]>> =>
    ipcRenderer.invoke('instalacoes:versoes', loader),
  criarInstalacao: (pedido: PedidoInstalacao): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:criar', pedido),
  criarInstalacaoDeModpack: (projetoId: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:criarModpack', projetoId),
  editarInstalacao: (id: string, edicao: EdicaoInstalacao): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:editar', id, edicao),
  duplicarInstalacao: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:duplicar', id),
  abrirPastaInstalacao: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:pasta', id),
  apagarInstalacao: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:apagar', id),
  escolherImagemInstalacao: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:imagem', id),
  jogar: (
    id: string,
    opcoes?: { atualizar?: boolean; recusados?: string[] }
  ): Promise<Resultado<ResultadoJogar>> => ipcRenderer.invoke('instalacoes:jogar', id, opcoes),

  // Convites (Fase P2). Dono: servidor ativo; amigo: entra com código, link ou arquivo.,
  estadoConvite: (): Promise<Resultado<ConviteServidor>> => ipcRenderer.invoke('convites:estado'),
  novoConvite: (): Promise<Resultado<ConviteServidor>> => ipcRenderer.invoke('convites:novo'),
  revogarConvite: (): Promise<Resultado<ConviteServidor>> => ipcRenderer.invoke('convites:revogar'),
  salvarProibidos: (lista: string[]): Promise<Resultado<ConviteServidor>> =>
    ipcRenderer.invoke('convites:proibidos', lista),
  configurarConvites: (porta: number, enderecoPlayit: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('convites:configurar', porta, enderecoPlayit),
  // Nome do arquivo salvo, ou null se o usuário cancelar.,
  exportarConvite: (): Promise<Resultado<string | null>> => ipcRenderer.invoke('convites:exportar'),
  // Fase M4: com o nick (conferido na Mojang) e um recado, o app pede para entrar na whitelist.
  entrarComConvite: (texto: string, pedido: PedidoConvite): Promise<Resultado<void>> =>
    ipcRenderer.invoke('convites:entrar', texto, pedido),
  entrarComArquivoDeConvite: (pedido: PedidoConvite): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('convites:entrarArquivo', pedido),
  listarPedidos: (): Promise<Resultado<PedidoParaEntrar[]>> => ipcRenderer.invoke('pedidos:listar'),
  // Diagnóstico de conexão (Fase M5).
  diagnosticarDono: (): Promise<Resultado<LinhaDiagnostico[]>> =>
    ipcRenderer.invoke('diagnostico:dono'),
  diagnosticarInstalacao: (id: string): Promise<Resultado<LinhaDiagnostico[]>> =>
    ipcRenderer.invoke('diagnostico:amigo', id),
  consertarDono: (conserto: Conserto): Promise<Resultado<void>> =>
    ipcRenderer.invoke('diagnostico:consertar', conserto),
  decidirPedido: (uuid: string, aprovar: boolean): Promise<Resultado<PedidoParaEntrar[]>> =>
    ipcRenderer.invoke('pedidos:decidir', uuid, aprovar),
  aprovarAutomatico: (ligado: boolean): Promise<Resultado<ConviteServidor>> =>
    ipcRenderer.invoke('convites:aprovarAutomatico', ligado),
  aoMudarPedidos: (f: () => void) => ouvir('pedidos:mudou', f),
  aoNovoPedido: (f: (p: { servidor: string; nick: string }) => void) => ouvir('pedidos:novo', f),
  verificarConvites: (): Promise<Resultado<void>> => ipcRenderer.invoke('convites:verificar'),

  // PlaySquare (Fase P3): a instalação no formato das telas de mods, recomendados e avisos.
  instalacaoInfo: (id: string): Promise<Resultado<InfoServidor>> =>
    ipcRenderer.invoke('instalacoes:info', id),
  definirRecomendados: (id: string, recusados: string[]): Promise<Resultado<void>> =>
    ipcRenderer.invoke('instalacoes:recomendados', id, recusados),
  lerAjustesJogo: (): Promise<Resultado<AjustesJogo>> => ipcRenderer.invoke('ajustesJogo:ler'),
  ocultarAviso: (tipo: TipoAviso, ocultar: boolean): Promise<Resultado<AjustesJogo>> =>
    ipcRenderer.invoke('ajustesJogo:ocultar', tipo, ocultar),

  // Tela Jogar (Fase P4). O JOGAR nunca liga o servidor; só o "Ligar servidor e jogar" do dono.
  estadosDoJogo: (): Promise<Resultado<Record<string, EstadoJogo>>> =>
    ipcRenderer.invoke('jogo:estados'),
  aoMudarJogo: (f: (aviso: { id: string; estado: EstadoJogo | null }) => void) =>
    ouvir('jogo:estado', f),
  dispensarSessao: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('jogo:dispensar', id),
  statusDoServidorDoJogo: (id: string): Promise<Resultado<StatusServidorJogo | null>> =>
    ipcRenderer.invoke('jogo:status', id),
  memoriaDoJogo: (id: string): Promise<Resultado<MemoriaJogo>> =>
    ipcRenderer.invoke('jogo:memoria', id),
  definirMemoriaDoJogo: (id: string, ram: number): Promise<Resultado<MemoriaJogo>> =>
    ipcRenderer.invoke('jogo:definirMemoria', id, ram),
  ligarServidorEJogar: (
    id: string,
    opcoes?: { atualizar?: boolean; recusados?: string[]; copiarOpcoes?: boolean }
  ): Promise<Resultado<ResultadoJogar>> => ipcRenderer.invoke('jogo:ligarEJogar', id, opcoes),
  fundoDaInstalacao: (id: string): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('jogo:fundo', id),
  escolherFundoInstalacao: (id: string): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('jogo:escolherFundo', id),
  removerFundoInstalacao: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('jogo:removerFundo', id),
  definirBannerBioma: (id: string, bioma: Bioma | null): Promise<Resultado<void>> =>
    ipcRenderer.invoke('jogo:bannerBioma', id, bioma),
  lerFundoPadraoDoJogo: (): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('jogo:fundoPadrao'),
  escolherFundoPadraoDoJogo: (): Promise<Resultado<boolean>> =>
    ipcRenderer.invoke('jogo:escolherFundoPadrao'),
  removerFundoPadraoDoJogo: (): Promise<Resultado<void>> =>
    ipcRenderer.invoke('jogo:removerFundoPadrao'),
  // Correção P1: INSTALAR monta a pasta da instalação; o Jogar fica "Em breve" (opção interna).
  abrirLauncherLigado: (): Promise<boolean> => ipcRenderer.invoke('jogo:abrirLauncherLigado'),
  instalarInstalacao: (
    id: string,
    opcoes?: { atualizar?: boolean; recusados?: string[]; copiarOpcoes?: boolean }
  ): Promise<Resultado<ResultadoJogar>> => ipcRenderer.invoke('instalacoes:instalar', id, opcoes),
  // Nome do arquivo salvo, ou null se o usuário cancelar.
  exportarMrpack: (id: string): Promise<Resultado<string | null>> =>
    ipcRenderer.invoke('instalacoes:exportarMrpack', id),

  // Fase P5.
  pedidoInicial: (): Promise<string | null> => ipcRenderer.invoke('app:pedidoInicial'),
  aoAbrirJogar: (f: (id: string) => void) => ouvir('app:abrirJogar', f),
  // Modo do app (Fase M6): completo ou amigo (só o PlaySquare). Trocar não apaga nada.
  estadoModo: (): Promise<Resultado<EstadoModo>> => ipcRenderer.invoke('modo:estado'),
  escolherModoApp: (modo: ModoApp): Promise<Resultado<EstadoModo>> =>
    ipcRenderer.invoke('modo:escolher', modo),
  conviteUsado: (): Promise<void> => ipcRenderer.invoke('modo:conviteUsado'),
  aoConvite: (f: (texto: string) => void) => ouvir('app:convite', f),
  listarCapturas: (id: string | null): Promise<Resultado<Captura[]>> =>
    ipcRenderer.invoke('capturas:listar', id),
  capturaGrande: (id: string, nome: string): Promise<Resultado<string>> =>
    ipcRenderer.invoke('capturas:grande', id, nome),
  copiarCaptura: (id: string, nome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('capturas:copiar', id, nome),
  mostrarCaptura: (id: string, nome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('capturas:mostrar', id, nome),
  apagarCaptura: (id: string, nome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('capturas:apagar', id, nome),
  usarCapturaComoFundo: (id: string, nome: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('capturas:usarComoFundo', id, nome),
  salvarAjustesJogo: (
    v: Pick<AjustesJogo, 'memoriaPadrao' | 'resolucao'>
  ): Promise<Resultado<AjustesJogo>> => ipcRenderer.invoke('ajustesJogo:salvar', v),
  escolherPastaInstalacoes: (voltarAoPadrao: boolean): Promise<Resultado<AjustesJogo>> =>
    ipcRenderer.invoke('ajustesJogo:pasta', voltarAoPadrao),
  pastaDasInstalacoes: (): Promise<Resultado<string>> =>
    ipcRenderer.invoke('ajustesJogo:pastaAtual'),
  abrirPastaDasInstalacoes: (): Promise<Resultado<void>> =>
    ipcRenderer.invoke('ajustesJogo:abrirPasta'),
  // Fase D: downloads manuais.
  // remover: o caminho a tirar; sem ele, abre a escolha de uma pasta nova.
  mudarPastaDownloads: (remover?: string): Promise<Resultado<AjustesJogo>> =>
    ipcRenderer.invoke('ajustesJogo:pastaDownloads', remover),
  listarDownloads: (): Promise<Resultado<DownloadManual[]>> =>
    ipcRenderer.invoke('downloads:listar'),
  procurarDownloads: (): Promise<Resultado<void>> => ipcRenderer.invoke('downloads:procurar'),
  abrirPaginaDownload: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('downloads:abrirPagina', id),
  escolherDownload: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('downloads:escolher', id),
  soltarDownload: (id: string, arquivo: File): Promise<Resultado<void>> =>
    ipcRenderer.invoke('downloads:conferir', id, webUtils.getPathForFile(arquivo)),
  limparDownloadsProntos: (): Promise<Resultado<void>> =>
    ipcRenderer.invoke('downloads:limparProntos'),
  aoMudarDownloads: (f: (itens: DownloadManual[]) => void) => ouvir('downloads:mudou', f),
  aoPedirDownloads: (f: (alvo: string) => void) => ouvir('downloads:abrir', f),
  // Mod que faltou ao ligar e o app não achou no Modrinth: abre a busca com o id.
  buscarModFaltando: (id: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidor:buscarModFaltando', id),
  criarAtalhoInstalacao: (id: string): Promise<Resultado<string>> =>
    ipcRenderer.invoke('instalacoes:atalho', id),
  prepararTeste: (servidorId: string): Promise<Resultado<string>> =>
    ipcRenderer.invoke('instalacoes:prepararTeste', servidorId),
  mensagemDoServidor: (id: string): Promise<Resultado<string>> =>
    ipcRenderer.invoke('servidores:mensagem', id),
  salvarMensagemDoServidor: (id: string, texto: string): Promise<Resultado<void>> =>
    ipcRenderer.invoke('servidores:salvarMensagem', id, texto)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
