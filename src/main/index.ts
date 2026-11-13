import { app, clipboard, nativeTheme, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import type { InfoServidor, Resultado } from '../shared/tipos'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  aplicarTema,
  escolherFundo,
  lerAparencia,
  lerFundo,
  listarScreenshots,
  removerFundo,
  salvarAparencia,
  usarScreenshotComoFundo
} from './aparencia'
import { lerConfiguracoes, limitesRam, salvarConfiguracoes } from './config'
import {
  escolherModo,
  estadoConexao,
  lerIpPublico,
  liberarFirewall,
  salvarEnderecoPlayit,
  testarConexao,
  tentarUpnp,
  vincularPlayit
} from './conexao'
import { ErroApp, detalhar, paraTela, tentar } from './erros'
import { appendFile, mkdir } from 'fs/promises'
import {
  acaoJogador,
  cabecaJogador,
  detalhesJogador,
  estatisticasJogador,
  excluirDadosJogador,
  inventarioJogador,
  lerJogadores,
  listarTodos
} from './jogadores'
import { baixarIcones, estadoIcones } from './itensDoJogo'
import {
  apagarArquivo,
  baixarArquivo,
  criarPasta,
  enviarArquivos,
  lerArquivoTexto,
  listarArquivos,
  renomearArquivo,
  salvarArquivoTexto
} from './arquivos'
import { baixarLog, lerLog, lerTravamento, listarLogs, listarTravamentos } from './logs'
import {
  alternarMod,
  atualizarMods,
  instalarPlano,
  listarAtualizacoes,
  listarInstalados,
  apagarPerfil,
  aplicarPerfil,
  listarPerfis,
  planejarInstalacao,
  planejarPorModId,
  salvarPerfil,
  trocarParaCompativel,
  trocarVersao,
  versoesDoMod,
  voltarVersao
} from './mods'
import {
  adicionarAosAmigos,
  buscarExplorar,
  detalhesProjeto,
  instalarDatapack,
  opcoesExplorar,
  pararResourcePack,
  removerDatapack,
  removerDosAmigos,
  usarResourcePack
} from './explorar'
import { apagarChave, salvarChave, temChave } from './chaveCurseForge'
import {
  adicionarAoHistorico,
  apagarAtalho,
  dadosCentral,
  executarAcao,
  executarAtalho,
  iconesDosItens,
  lerGamerules,
  lerHistoricoConsole,
  listarAtalhos,
  mudarFavorito,
  salvarAtalho
} from './central'
import { estadoDadosComandos, prepararDadosComandos } from './dadosComandos'
import { configsDoMod, lerConfigMod, restaurarConfigPadrao, salvarConfigMod } from './configMods'
import {
  desativarETentar,
  dispensarTravamento,
  exportarLista,
  importarLista,
  travamentoRecente
} from './listaMods'
import { mudarEtiqueta, travarVersao } from './organizacao'
import { chaveFunciona } from './curseforge'
import {
  desfazerRemocao,
  listarRemovidos,
  listarTudo,
  removerInstalados,
  restaurarRemovido
} from './instalados'
import {
  analisarDeArquivo,
  cancelarModpack,
  descartarAnalise,
  analisarDoModrinth,
  analisarDoCurseForge,
  atualizarModpack,
  buscarModpacks,
  criarDeModpack,
  gerarPacoteAmigos,
  planejarAtualizacaoModpack,
  verificarAtualizacaoModpack
} from './modpacks'
import {
  abrirMapa,
  aceitarTermosDoMapa,
  controlarPregeracao,
  definirJavaOtimizado,
  diagnosticar,
  estadoDiagnostico,
  estadoMapa,
  estadoPregeracao,
  iniciarPregeracao,
  visaoGeral
} from './desempenho'
import { lerAutomacao, salvarAutomacao } from './automacao'
import { lerAcoes } from './acoes'
import {
  ativarCelular,
  definirPin,
  definirPortaCelular,
  desconectarTodos,
  estadoCelular,
  iniciarCelular,
  suspenderCelular
} from './celular'
import { lerIcone, removerIcone, salvarIcone } from './icone'
import {
  atualizarBuild,
  iniciarVerificacao,
  lerAjustes,
  lerAtualizacoes,
  salvarAjustes,
  verificar
} from './atualizacoes'
import {
  apagarMundo,
  ativarMundo,
  exportarMundo,
  gerarMundo,
  importarMundoDePasta,
  importarMundoDeZip,
  listarMundos
} from './mundos'
import {
  aoAvisar,
  atualizarInfo,
  criarServidor,
  desligar,
  enviarComando,
  exigirServidor,
  lerConsole,
  lerEstado,
  ligar,
  ligarMesmoEmprestado,
  listarVersoes,
  esperarTarefas,
  impedirLigar,
  reiniciar,
  servidorAtual
} from './servidor'
import {
  alertaBackups,
  apagarBackups,
  listarBackups,
  protegerBackup,
  restaurarBackup
} from './backup'
import { criarBandeja } from './bandeja'
import { abrirPastaDoServidor, renomearServidor } from './renomear'
import { analisarZip, criarDeZip } from './importarZip'
import {
  analisarHubserver,
  infoPorId,
  passarServidor,
  previaPassar,
  receberHubserver
} from './passarServidor'
import { apagarServidor, ativarServidor, listarServidores, trocarServidor } from './listaServidores'
import { trocarSoftware } from './software'
import { adicionar, listar, remover } from './whitelist'
import {
  alvoJogador,
  escolherPastaInstalacoes,
  lerAjustesJogo,
  mudarPastaDownloads,
  ocultarAviso,
  salvarAjustesJogo
} from './ajustesJogo'
import {
  abrirPagina,
  conferirArquivo,
  escolherArquivo,
  iniciarDownloadsManuais,
  limparProntos,
  listarPendencias,
  pastasMudaram,
  procurar
} from './downloadsManuais'
import { buscarModFaltando } from './modsQueFaltam'
import {
  apagarCaptura,
  capturaGrande,
  copiarCaptura,
  listarCapturas,
  mostrarCapturaNaPasta
} from './capturas'
import {
  retomarConvites,
  suspenderConvites,
  configurarConvites,
  estadoConvite,
  exportarConvite,
  novoConvite,
  revogarConvite,
  listarPedidos,
  decidirPedido,
  definirAprovarAutomatico,
  lerMensagem,
  salvarMensagem,
  salvarProibidos
} from './convites'
import { aoMudarJogo, dispensarSessao, estadosDoJogo } from './jogo'
import { ABRIR_LAUNCHER_LIGADO } from './launcherOficial'
import {
  conviteDosArgumentos,
  convitePegou,
  decidirAoAbrir,
  escolherModo as escolherModoDoApp,
  estadoModo,
  guardarConvite,
  modoAtual
} from './modo'
import { fecharDeVerdade } from '../shared/modoRegras'
import { consertarDono, diagnosticarDono } from './diagnostico'
import {
  abrirPastaDoRelatorio,
  gerarRelatorio,
  lembrarDiagnostico,
  opcoesRelatorio
} from './relatorio'
import {
  abrirPaginaVersaoApp,
  avisoVersaoApp,
  avisoVersaoLigado,
  iniciarAvisoVersaoApp,
  lembrarVersaoDepois,
  ligarAvisoVersao,
  pularVersaoApp
} from './atualizacaoApp'
import {
  abrirPastaInstalacao,
  apagarInstalacao,
  criarDeModpack as criarInstalacaoDeModpack,
  criarDoZero,
  duplicarInstalacao,
  criarAtalho,
  exportarMrpack,
  instalar,
  definirMemoria,
  instalacaoDoAtalho,
  pastaDePrints,
  pastaJogo,
  pastasDePrints,
  prepararTeste,
  usarCapturaComoFundo,
  definirRecomendados,
  escolherFundoInstalacao,
  escolherFundoPadrao,
  fundoDaInstalacao,
  lerFundoPadrao,
  ligarServidorEJogar,
  memoriaDoJogo,
  removerFundoInstalacao,
  definirBannerBioma,
  diagnosticarInstalacao,
  removerFundoPadrao,
  statusDoServidor,
  editarInstalacao,
  infoDaInstalacao,
  entrarComArquivoDeConvite,
  entrarComConvite,
  verificarConvites,
  escolherImagemInstalacao,
  jogar,
  listarInstalacoes,
  versoesDoLoader
} from './instalacoes'
import './uso' // começa a medir CPU e RAM sempre que o servidor liga

// O app virou HubSquare, mas a pasta de dados continua a do ServSquare (%APPDATA%\ServSquare):
// preferências, PIN do celular, cache e a chave do safeStorage (no "Local State") ficam onde estão.
// Precisa vir antes de qualquer uso da pasta de dados, inclusive a trava de instância única.
// Testes (Fase M3): HUBSQUARE_DADOS troca TODAS as pastas do usuário (dados, Documentos,
// Downloads, Área de Trabalho e a pasta da .minecraft) por subpastas de uma pasta de teste.
const pastaDeTeste = process.env.HUBSQUARE_DADOS
if (pastaDeTeste) {
  for (const nome of ['appData', 'documents', 'downloads', 'desktop'] as const) {
    mkdirSync(join(pastaDeTeste, nome), { recursive: true })
    app.setPath(nome, join(pastaDeTeste, nome))
  }
  process.env.APPDATA = app.getPath('appData')
}
app.setPath('userData', join(app.getPath('appData'), 'ServSquare'))

// Instalações de modpack em andamento (Fase V2): o fundo animado para enquanto houver alguma.
let modpacksInstalando = 0
async function instalandoModpack<T>(tarefa: () => Promise<T>): Promise<T> {
  modpacksInstalando++
  avisarJanelas('fundo:modpackInstalando', true)
  try {
    return await tarefa()
  } finally {
    modpacksInstalando--
    avisarJanelas('fundo:modpackInstalando', modpacksInstalando > 0)
  }
}

// Nenhum erro derruba o app: o que escapar vai para o log (pasta de dados › logs › erros.log) e
// aparece na tela no padrão de erro, em vez de fechar a janela ou deixá-la travada.
function erroSemTratamento(e: unknown): void {
  const linha = `[${new Date().toISOString()}] ${detalhar(e)}
`
  void mkdir(join(app.getPath('userData'), 'logs'), { recursive: true })
    .then(() => appendFile(join(app.getPath('userData'), 'logs', 'erros.log'), linha))
    .catch(() => {})
  for (const j of BrowserWindow.getAllWindows()) j.webContents.send('app:erro', paraTela(e))
}
process.on('uncaughtException', erroSemTratamento)
process.on('unhandledRejection', erroSemTratamento)

// Só um HubSquare por vez: abrir de novo mostra a janela que já existe.
if (!app.requestSingleInstanceLock()) app.exit(0)

// Atalho da área de trabalho (Fase P5): "--jogar=<id>" abre o HubSquare no Jogar da instalação.
let jogarPendente: string | null = instalacaoDoAtalho(process.argv)
app.on('second-instance', (_e, argv) => {
  abrirJanela()
  // Convite aberto com o app já aberto (Fase M6): vai para a janela, já colado.
  void conviteDosArgumentos(argv).then((texto) => {
    if (!texto) return
    guardarConvite(texto)
    avisarJanelas('app:convite', texto)
  })
  const id = instalacaoDoAtalho(argv)
  if (id) {
    jogarPendente = id
    avisarJanelas('app:abrirJogar', id)
  }
})

let janela: BrowserWindow | null = null
let saindo = false

// Modo do app (Fase M6): decidido antes da janela pedir (escolha salva, servidores e convite).
const modoPronto = app.whenReady().then(() => decidirAoAbrir(process.argv))

let verificacaoIniciada = false
async function ligarServicosDoServ(): Promise<void> {
  // Painel pelo celular: só liga se o usuário ativou em Integrações › Celular.
  iniciarCelular().catch(() => {})
  // Avisos de atualização: só verifica (ao abrir e a cada 6 h), se o usuário deixou ligado.
  if (!verificacaoIniciada) iniciarVerificacao()
  verificacaoIniciada = true
  // Só de leitura: liga se algum servidor tiver convite ativo.
  retomarConvites().catch(() => {})
}

async function suspenderServicosDoServ(): Promise<void> {
  await Promise.all([suspenderCelular(), suspenderConvites()])
}

function abrirJanela(): void {
  if (!janela || janela.isDestroyed()) return createWindow()
  if (janela.isMinimized()) janela.restore()
  janela.show()
  janela.focus()
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: 'HubSquare',
    // Mesma cor do --bg-app dos tokens, para não piscar outra cor ao abrir.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f2f2f2',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  janela = mainWindow
  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Fundo animado (Fase V2): minimizada ou na bandeja, o fundo para. Avisa a tela pelos eventos
  // da janela (o document.hidden do Chromium nem sempre muda ao minimizar).
  const visivel = (v: boolean) => (): void => mainWindow.webContents.send('janela:visivel', v)
  mainWindow.on('minimize', visivel(false))
  mainWindow.on('hide', visivel(false))
  mainWindow.on('restore', visivel(true))
  mainWindow.on('show', visivel(true))

  // Fechar a janela só esconde o app na bandeja; o servidor continua ligado.
  mainWindow.on('close', (evento) => {
    if (saindo) return
    // Modo amigo sem nada rodando (Fase M6): fecha o app de verdade, sem ir para a bandeja.
    if (fecharDeVerdade(modoAtual(), lerEstado())) {
      saindo = true
      app.quit()
      return
    }
    evento.preventDefault()
    mainWindow.hide()
  })

  // Links externos abrem no navegador, nunca dentro do app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function avisarJanelas(canal: string, dado: unknown): void {
  for (const janela of BrowserWindow.getAllWindows()) janela.webContents.send(canal, dado)
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.servsquare.app')
  // Aplica o tema salvo antes de abrir a janela. Se o arquivo estiver estragado, segue o padrão.
  aplicarTema((await lerAparencia().catch(() => null))?.bioma ?? 'dia')
  // Modo do app (Fase M6): os serviços do ServSquare (painel do celular, convites e avisos de
  // atualização de servidor) só ligam no modo completo. No amigo e nas boas-vindas, nada escuta.
  if ((await modoPronto) === 'completo') await ligarServicosDoServ()
  iniciarAvisoVersaoApp()

  // F12 abre o DevTools em desenvolvimento; Ctrl+R é ignorado na versão final.
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  aoAvisar(avisarJanelas)
  const progresso = (p: unknown): void => avisarJanelas('download:progresso', p)

  ipcMain.handle('app:versao', () => app.getVersion())
  ipcMain.handle('servidor:atual', () => tentar(servidorAtual))
  ipcMain.handle('servidor:versoes', (_e, tipo: unknown) => tentar(() => listarVersoes(tipo)))
  ipcMain.handle('servidor:criar', (_e, pedido: unknown) =>
    tentar(() => criarServidor(pedido, progresso))
  )
  ipcMain.handle('servidor:ligar', () => tentar(ligar))
  ipcMain.handle('servidor:ligarEmprestado', () => tentar(ligarMesmoEmprestado))
  ipcMain.handle('servidor:desligar', () => tentar(desligar))
  ipcMain.handle('servidor:comando', (_e, comando: unknown) => tentar(() => enviarComando(comando)))
  ipcMain.handle('servidor:console', () => lerConsole())
  ipcMain.handle('servidor:reiniciar', () => tentar(reiniciar))
  ipcMain.handle('servidor:abrirPasta', () => tentar(abrirPastaDoServidor))
  // Sem id, renomeia o servidor ativo.
  ipcMain.handle('servidor:renomear', (_e, nome: unknown, id: unknown) =>
    tentar(() => renomearServidor(nome, id))
  )

  // Vários servidores (Fase 11). Só o ativo pode estar ligado.
  ipcMain.handle('servidores:listar', () => tentar(listarServidores))
  ipcMain.handle('servidores:ativar', (_e, id: unknown) => tentar(() => ativarServidor(id)))
  ipcMain.handle('servidores:trocar', (_e, id: unknown, ligarDepois: unknown) =>
    tentar(() => trocarServidor(id, ligarDepois))
  )
  ipcMain.handle('servidores:apagar', (_e, id: unknown, confirmacao: unknown) =>
    tentar(() => apagarServidor(id, confirmacao))
  )
  ipcMain.handle('importar:analisar', (e) =>
    tentar(() => analisarZip(BrowserWindow.fromWebContents(e.sender)))
  )
  // Passar o servidor (Fase M7).
  ipcMain.handle('passar:previa', (_e, id: unknown) =>
    tentar(async () => previaPassar(await infoPorId(id)))
  )
  ipcMain.handle('passar:gerar', (e, id: unknown, para: unknown) =>
    tentar(async () =>
      passarServidor(await infoPorId(id), para, BrowserWindow.fromWebContents(e.sender))
    )
  )
  ipcMain.handle('passar:analisar', (e) =>
    tentar(() => analisarHubserver(BrowserWindow.fromWebContents(e.sender)))
  )
  ipcMain.handle('passar:receber', (_e, pedido: unknown) =>
    tentar(() => receberHubserver(pedido, progresso))
  )
  ipcMain.handle('importar:criar', (_e, pedido: unknown) =>
    tentar(() => criarDeZip(pedido, progresso))
  )
  ipcMain.handle('software:trocar', (_e, pedido: unknown) =>
    tentar(() => trocarSoftware(pedido, progresso))
  )
  ipcMain.handle('jogadores:listar', () => lerJogadores())

  ipcMain.handle('config:ler', () => tentar(async () => lerConfiguracoes(await exigirServidor())))
  ipcMain.handle('config:salvar', (_e, configuracoes: unknown) =>
    tentar(async () => {
      const info = await exigirServidor()
      await atualizarInfo(info, await salvarConfiguracoes(info, configuracoes))
      return { precisaReiniciar: lerEstado() !== 'desligado' }
    })
  )

  ipcMain.handle('listas:listar', (_e, lista: unknown) =>
    tentar(async () => listar(await exigirServidor(), lista))
  )
  ipcMain.handle('listas:adicionar', (_e, lista: unknown, valor: unknown) =>
    tentar(async () => adicionar(await exigirServidor(), lista, valor))
  )
  ipcMain.handle('listas:remover', (_e, lista: unknown, valor: unknown) =>
    tentar(async () => remover(await exigirServidor(), lista, valor))
  )
  ipcMain.handle('jogadores:todos', () => tentar(async () => listarTodos(await exigirServidor())))
  ipcMain.handle('jogadores:detalhes', (_e, nome: unknown) =>
    tentar(async () => detalhesJogador(await exigirServidor(), nome))
  )
  ipcMain.handle('jogadores:cabeca', (_e, uuid: unknown) =>
    tentar(async () =>
      cabecaJogador(
        // Sem servidor neste PC (amigo na tela Jogar): a pasta de dados não tem server.properties.
        (await servidorAtual()) ?? ({ pasta: app.getPath('userData') } as InfoServidor),
        uuid
      )
    )
  )
  ipcMain.handle('jogadores:acao', (_e, nome: unknown, acao: unknown) =>
    tentar(() => acaoJogador(nome, acao))
  )
  ipcMain.handle('jogadores:inventario', (_e, nome: unknown) =>
    tentar(async () => inventarioJogador(await exigirServidor(), nome))
  )
  ipcMain.handle('jogadores:estatisticas', (_e, nome: unknown) =>
    tentar(async () => estatisticasJogador(await exigirServidor(), nome))
  )
  ipcMain.handle('jogadores:excluir', (_e, nome: unknown, opcoes: unknown) =>
    tentar(async () => excluirDadosJogador(await exigirServidor(), nome, opcoes))
  )
  ipcMain.handle('icones:estado', () => tentar(async () => estadoIcones(await exigirServidor())))
  ipcMain.handle('icones:baixar', () =>
    tentar(async () => baixarIcones(await exigirServidor(), progresso))
  )

  // Arquivos, Mundos e Registro de eventos (Fase 14). A janela é usada pelos diálogos de salvar/abrir.
  // Dentro de um canal "play:..." o alvo é a instalação do PlaySquare (Fase P3).
  const comServidor = <T>(fn: (info: InfoServidor) => Promise<T> | T): Promise<Resultado<T>> =>
    tentar(async () => fn(alvoJogador.getStore() ?? (await exigirServidor())))
  // Canal que serve ao servidor e, com "play:" na frente e o id da instalação primeiro, a ela.
  const ambos = (canal: string, tratar: Parameters<typeof ipcMain.handle>[1]): void => {
    ipcMain.handle(canal, tratar)
    ipcMain.handle(`play:${canal}`, async (e, id: unknown, ...a: unknown[]) => {
      const r = await tentar(() => infoDaInstalacao(id))
      return r.ok ? alvoJogador.run(r.valor, () => tratar(e, ...a)) : r
    })
  }
  const janelaDe = (e: Electron.IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(e.sender)
  ipcMain.handle('arquivos:listar', (_e, c: unknown) => comServidor((i) => listarArquivos(i, c)))
  ipcMain.handle('arquivos:ler', (_e, c: unknown) => comServidor((i) => lerArquivoTexto(i, c)))
  ipcMain.handle('arquivos:salvar', (_e, c: unknown, t: unknown) =>
    comServidor((i) => salvarArquivoTexto(i, c, t))
  )
  ipcMain.handle('arquivos:renomear', (_e, c: unknown, n: unknown) =>
    comServidor((i) => renomearArquivo(i, c, n))
  )
  ipcMain.handle('arquivos:novaPasta', (_e, c: unknown, n: unknown) =>
    comServidor((i) => criarPasta(i, c, n))
  )
  ipcMain.handle('arquivos:apagar', (_e, c: unknown) => comServidor((i) => apagarArquivo(i, c)))
  ipcMain.handle('arquivos:baixar', (e, c: unknown) =>
    comServidor((i) => baixarArquivo(i, c, janelaDe(e)))
  )
  ipcMain.handle('arquivos:enviar', (_e, c: unknown, origens: unknown) =>
    comServidor((i) => enviarArquivos(i, c, origens))
  )

  ipcMain.handle('mundos:listar', () => comServidor(listarMundos))
  ipcMain.handle('mundos:ativar', (_e, n: unknown) => comServidor((i) => ativarMundo(i, n)))
  ipcMain.handle('mundos:gerar', (_e, n: unknown, seed: unknown) =>
    comServidor((i) => gerarMundo(i, n, seed))
  )
  ipcMain.handle('mundos:apagar', (_e, n: unknown) => comServidor((i) => apagarMundo(i, n)))
  ipcMain.handle('mundos:exportar', (e, n: unknown) =>
    comServidor((i) => exportarMundo(i, n, janelaDe(e)))
  )
  ipcMain.handle('mundos:importarPasta', (e) =>
    comServidor((i) => importarMundoDePasta(i, janelaDe(e)))
  )
  ipcMain.handle('mundos:importarZip', (e) =>
    comServidor((i) => importarMundoDeZip(i, janelaDe(e)))
  )

  ipcMain.handle('logs:listar', () => comServidor(listarLogs))
  ipcMain.handle('logs:ler', (_e, n: unknown) => comServidor((i) => lerLog(i, n)))
  ipcMain.handle('logs:travamentos', () => comServidor(listarTravamentos))
  ipcMain.handle('logs:travamento', (_e, n: unknown) => comServidor((i) => lerTravamento(i, n)))
  ipcMain.handle('logs:baixar', (e, tipo: unknown, n: unknown) =>
    comServidor((i) => baixarLog(i, tipo, n, janelaDe(e)))
  )

  // Mods e plugins pelo Modrinth (Fase 16).
  ambos('mods:instalados', () => comServidor(listarInstalados))
  ambos('mods:planejar', (_e, id: unknown, fonte: unknown) =>
    comServidor((i) => planejarInstalacao(i, id, fonte))
  )
  ambos('mods:instalar', (_e, token: unknown) =>
    comServidor((i) => instalarPlano(i, token, progresso))
  )
  ambos('mods:alternar', (_e, arquivo: unknown, ativo: unknown) =>
    comServidor((i) => alternarMod(i, arquivo, ativo))
  )
  ambos('mods:atualizacoes', () => comServidor(listarAtualizacoes))
  ambos('mods:atualizar', (_e, arquivos: unknown) =>
    comServidor((i) => atualizarMods(i, arquivos, progresso))
  )

  // Explorar (Fase 23; fontes CurseForge e Hangar na Fase 24).
  ambos('explorar:opcoes', (_e, tipo: unknown, fonte: unknown) =>
    tentar(() => opcoesExplorar(tipo, fonte))
  )
  ambos('explorar:buscar', (_e, filtros: unknown) => comServidor((i) => buscarExplorar(i, filtros)))
  ambos('explorar:detalhes', (_e, id: unknown, tipo: unknown, fonte: unknown) =>
    comServidor((i) => detalhesProjeto(i, id, tipo, fonte))
  )
  ambos('explorar:datapack', (_e, id: unknown, fonte: unknown) =>
    comServidor((i) => instalarDatapack(i, id, fonte, progresso))
  )

  // Chave da API do CurseForge (Fase 24): só entra, nunca volta para a tela.
  ipcMain.handle('curseforge:temChave', () => tentar(temChave))
  ipcMain.handle('curseforge:salvarChave', (_e, chave: unknown) =>
    tentar(() => salvarChave(chave, chaveFunciona))
  )
  ipcMain.handle('curseforge:apagarChave', () => tentar(apagarChave))
  ipcMain.handle('modpacks:analisarCurseForge', (_e, id: unknown) =>
    tentar(() => analisarDoCurseForge(id, progresso))
  )
  ambos('explorar:removerDatapack', (_e, id: unknown) => comServidor((i) => removerDatapack(i, id)))
  ambos('explorar:resourcePack', (_e, id: unknown, obrigatorio: unknown) =>
    comServidor((i) => usarResourcePack(i, id, obrigatorio))
  )
  ambos('explorar:pararResourcePack', () => comServidor(pararResourcePack))
  ambos('explorar:amigos', (_e, id: unknown, tipo: unknown) =>
    comServidor((i) => adicionarAosAmigos(i, id, tipo))
  )
  ambos('explorar:removerAmigos', (_e, id: unknown) => comServidor((i) => removerDosAmigos(i, id)))

  // Central de comandos (Fase 26). As ações são validadas e montadas no processo principal.
  ipcMain.handle('central:estado', () => comServidor(estadoDadosComandos))
  ipcMain.handle('central:preparar', () => comServidor((i) => prepararDadosComandos(i, progresso)))
  ipcMain.handle('central:dados', () => comServidor(dadosCentral))
  ipcMain.handle('central:icones', (_e, ids: unknown) => comServidor((i) => iconesDosItens(i, ids)))
  ipcMain.handle('central:executar', (_e, acao: unknown, confirmado: unknown) =>
    comServidor((i) => executarAcao(i, acao, confirmado))
  )
  ipcMain.handle('central:gamerules', () => comServidor(lerGamerules))
  ipcMain.handle('atalhos:listar', () => tentar(listarAtalhos))
  ipcMain.handle('atalhos:salvar', (_e, atalho: unknown) => tentar(() => salvarAtalho(atalho)))
  ipcMain.handle('atalhos:apagar', (_e, id: unknown) => tentar(() => apagarAtalho(id)))
  ipcMain.handle('atalhos:executar', (_e, id: unknown, jogador: unknown, confirmado: unknown) =>
    comServidor((i) => executarAtalho(i, id, jogador, confirmado))
  )
  ipcMain.handle('console:historico', () => tentar(lerHistoricoConsole))
  ipcMain.handle('console:adicionar', (_e, comando: unknown) =>
    tentar(() => adicionarAoHistorico(comando))
  )
  ipcMain.handle('console:favorito', (_e, comando: unknown, favorito: unknown) =>
    tentar(() => mudarFavorito(comando, favorito))
  )

  // Mods personalizáveis (Fase 25): configs, versões, perfis, etiquetas, travamento e lista.
  ambos('mods:configs', (_e, arquivo: unknown) => comServidor((i) => configsDoMod(i, arquivo)))
  ambos('mods:lerConfig', (_e, caminho: unknown) => comServidor((i) => lerConfigMod(i, caminho)))
  ambos('mods:salvarConfig', (_e, caminho: unknown, hash: unknown, mudancas: unknown) =>
    comServidor((i) => salvarConfigMod(i, caminho, hash, mudancas))
  )
  ambos('mods:restaurarConfig', (_e, caminho: unknown) =>
    comServidor((i) => restaurarConfigPadrao(i, caminho))
  )
  ambos('mods:versoes', (_e, arquivo: unknown) => comServidor((i) => versoesDoMod(i, arquivo)))
  ambos('mods:trocarVersao', (_e, arquivo: unknown, versaoId: unknown) =>
    comServidor((i) => trocarVersao(i, arquivo, versaoId, progresso))
  )
  ambos('mods:trocarCompativel', (_e, arquivo: unknown) =>
    comServidor((i) => trocarParaCompativel(i, arquivo, progresso))
  )
  ambos('mods:voltarVersao', (_e, arquivo: unknown) => comServidor((i) => voltarVersao(i, arquivo)))
  ambos('mods:travar', (_e, idMod: unknown, travar: unknown) =>
    comServidor((i) => travarVersao(i, idMod, travar))
  )
  ambos('mods:etiqueta', (_e, idMod: unknown, cor: unknown, nota: unknown) =>
    comServidor((i) => mudarEtiqueta(i, idMod, cor, nota))
  )
  ambos('mods:perfis', () => comServidor(listarPerfis))
  ambos('mods:salvarPerfil', (_e, nome: unknown) => comServidor((i) => salvarPerfil(i, nome)))
  ambos('mods:aplicarPerfil', (_e, nome: unknown) => comServidor((i) => aplicarPerfil(i, nome)))
  ambos('mods:apagarPerfil', (_e, nome: unknown) => comServidor((i) => apagarPerfil(i, nome)))
  ambos('mods:planejarPorId', (_e, modId: unknown) =>
    comServidor((i) => planejarPorModId(i, modId))
  )
  ambos('mods:travamento', () => comServidor(travamentoRecente))
  ambos('mods:dispensarTravamento', (_e, nome: unknown) =>
    comServidor((i) => dispensarTravamento(i, nome))
  )
  ambos('mods:desativarETentar', (_e, chaves: unknown, nome: unknown) =>
    comServidor((i) => desativarETentar(i, chaves, nome))
  )
  ambos('mods:exportar', (e) => comServidor((i) => exportarLista(i, janelaDe(e))))
  ambos('mods:importar', (e) => comServidor((i) => importarLista(i, janelaDe(e))))

  // Aba Instalados (Fase 23.2): tudo o que o servidor tem, remover e desfazer.
  ambos('instalados:listar', () => comServidor(listarTudo))
  ambos('instalados:remover', (_e, itens: unknown) =>
    comServidor((i) => removerInstalados(i, itens))
  )
  ambos('instalados:desfazer', (_e, lote: unknown) => comServidor((i) => desfazerRemocao(i, lote)))
  ambos('instalados:removidos', () => comServidor(listarRemovidos))
  ambos('instalados:restaurar', (_e, id: unknown) => comServidor((i) => restaurarRemovido(i, id)))

  // Modpacks e Pacote pros amigos (Fase 17).
  ipcMain.handle('modpacks:buscar', (_e, termo: unknown, offset: unknown) =>
    tentar(() => buscarModpacks(termo, offset))
  )
  ipcMain.handle('modpacks:analisarModrinth', (_e, id: unknown) =>
    tentar(() => analisarDoModrinth(id, progresso))
  )
  ipcMain.handle('modpacks:analisarArquivo', (e) => tentar(() => analisarDeArquivo(janelaDe(e))))
  ipcMain.handle('modpacks:criar', (_e, pedido: unknown) =>
    tentar(() => instalandoModpack(() => criarDeModpack(pedido, progresso)))
  )
  // Fase V2: o fundo animado fica parado enquanto um modpack instala.
  ipcMain.handle('fundo:modpackInstalando', () => modpacksInstalando > 0)
  // Correção: instalação de modpacks. Cancelar vale para análise e criação (ServSquare e PlaySquare).
  ipcMain.handle('modpacks:cancelar', () => tentar(cancelarModpack))
  ipcMain.handle('modpacks:descartar', (_e, token: unknown) =>
    tentar(() => descartarAnalise(token))
  )
  ipcMain.handle('modpacks:atualizacao', () => comServidor(verificarAtualizacaoModpack))
  ipcMain.handle('modpacks:planejar', () =>
    comServidor((i) => planejarAtualizacaoModpack(i, progresso))
  )
  ipcMain.handle('modpacks:atualizar', (_e, token: unknown, escolhas: unknown) =>
    comServidor((i) => atualizarModpack(i, token, escolhas, progresso))
  )
  ipcMain.handle('modpacks:amigos', (e) => comServidor((i) => gerarPacoteAmigos(i, janelaDe(e))))

  // Desempenho (Fase 18).
  ipcMain.handle('desempenho:visao', () => comServidor(visaoGeral))
  ipcMain.handle('desempenho:javaOtimizado', (_e, valor: unknown) =>
    comServidor((i) => definirJavaOtimizado(i, valor))
  )
  ipcMain.handle('desempenho:pregeracao', () => comServidor(estadoPregeracao))
  ipcMain.handle('desempenho:iniciarPregeracao', (_e, raio: unknown) =>
    comServidor((i) => iniciarPregeracao(i, raio))
  )
  ipcMain.handle('desempenho:controlarPregeracao', (_e, acao: unknown) =>
    tentar(() => controlarPregeracao(acao))
  )
  ipcMain.handle('desempenho:diagnostico', () => comServidor(estadoDiagnostico))
  ipcMain.handle('desempenho:diagnosticar', () => comServidor(diagnosticar))
  ipcMain.handle('desempenho:mapa', () => comServidor(estadoMapa))
  ipcMain.handle('desempenho:aceitarMapa', () => comServidor(aceitarTermosDoMapa))
  ipcMain.handle('desempenho:abrirMapa', () => comServidor(abrirMapa))

  // Automação e ações do app (Fase 19).
  ipcMain.handle('automacao:ler', () => comServidor(lerAutomacao))
  ipcMain.handle('automacao:salvar', (_e, valor: unknown) =>
    comServidor((i) => salvarAutomacao(i, valor))
  )
  ipcMain.handle('acoes:listar', () => comServidor(lerAcoes))

  // Painel pelo celular (Fase 20).
  ipcMain.handle('celular:estado', () => tentar(async () => estadoCelular()))
  ipcMain.handle('celular:pin', (_e, pin: unknown) => tentar(() => definirPin(pin)))
  ipcMain.handle('celular:ativar', (_e, valor: unknown) => tentar(() => ativarCelular(valor)))
  ipcMain.handle('celular:porta', (_e, porta: unknown) => tentar(() => definirPortaCelular(porta)))
  ipcMain.handle('celular:desconectar', () => tentar(desconectarTodos))

  // Ícone, MOTD e avisos de atualização (Fase 21). Nada é atualizado sem o clique do usuário.
  ipcMain.handle('icone:ler', () => comServidor((i) => lerIcone(i.pasta)))
  ipcMain.handle('icone:salvar', (_e, dataUrl: unknown) =>
    comServidor((i) => salvarIcone(i, dataUrl))
  )
  ipcMain.handle('icone:remover', () => comServidor(removerIcone))
  ipcMain.handle('atualizacoes:ler', () => tentar(lerAtualizacoes))
  ipcMain.handle('atualizacoes:verificar', () => tentar(verificar))
  ipcMain.handle('atualizacoes:build', () => comServidor((i) => atualizarBuild(i, progresso)))
  ipcMain.handle('ajustes:ler', () => tentar(lerAjustes))
  ipcMain.handle('ajustes:salvar', (_e, valor: unknown) => tentar(() => salvarAjustes(valor)))
  // Versão nova do HubSquare (Fase M2): só avisa; "Baixar" abre a página do release.
  ipcMain.handle('appVersao:aviso', () => tentar(avisoVersaoApp))
  ipcMain.handle('appVersao:baixar', () => tentar(abrirPaginaVersaoApp))
  ipcMain.handle('appVersao:lembrarDepois', () => tentar(lembrarVersaoDepois))
  ipcMain.handle('appVersao:pular', () => tentar(pularVersaoApp))
  ipcMain.handle('appVersao:ligado', () => tentar(avisoVersaoLigado))
  ipcMain.handle('appVersao:ligar', (_e, v: unknown) => tentar(() => ligarAvisoVersao(v)))

  ipcMain.handle('conexao:estado', () => tentar(estadoConexao))
  ipcMain.handle('conexao:modo', (_e, modo: unknown) => tentar(() => escolherModo(modo)))
  ipcMain.handle('conexao:vincularPlayit', () => tentar(() => vincularPlayit(progresso)))
  ipcMain.handle('conexao:enderecoPlayit', (_e, endereco: unknown) =>
    tentar(() => salvarEnderecoPlayit(endereco))
  )
  ipcMain.handle('conexao:testar', (_e, modo: unknown) => tentar(() => testarConexao(modo)))
  // Só roda quando o usuário clica; o Windows pede a permissão de administrador.
  ipcMain.handle('conexao:firewall', () => tentar(liberarFirewall))
  ipcMain.handle('conexao:upnp', () => tentar(tentarUpnp))
  ipcMain.handle('conexao:ipPublico', () => tentar(lerIpPublico))
  ipcMain.handle('config:limitesRam', () => limitesRam())

  ipcMain.handle('aparencia:ler', () => tentar(lerAparencia))
  ipcMain.handle('aparencia:salvar', (_e, valor: unknown) => tentar(() => salvarAparencia(valor)))
  ipcMain.handle('aparencia:fundo', () => tentar(lerFundo))
  ipcMain.handle('aparencia:escolherFundo', (e) =>
    tentar(() => escolherFundo(BrowserWindow.fromWebContents(e.sender)))
  )
  ipcMain.handle('aparencia:removerFundo', () => tentar(removerFundo))

  // PlaySquare: instalações e Jogar pelo launcher oficial (Fase P1).
  ipcMain.handle('instalacoes:listar', () => tentar(listarInstalacoes))
  ipcMain.handle('instalacoes:versoes', (_e, loader: unknown) =>
    tentar(() => versoesDoLoader(loader))
  )
  ipcMain.handle('instalacoes:criar', (_e, pedido: unknown) => tentar(() => criarDoZero(pedido)))
  ipcMain.handle('instalacoes:criarModpack', (_e, id: unknown) =>
    tentar(() => instalandoModpack(() => criarInstalacaoDeModpack(id, progresso)))
  )
  ipcMain.handle('instalacoes:editar', (_e, id: unknown, edicao: unknown) =>
    tentar(() => editarInstalacao(id, edicao))
  )
  ipcMain.handle('instalacoes:duplicar', (_e, id: unknown) =>
    tentar(() => duplicarInstalacao(id, progresso))
  )
  ipcMain.handle('instalacoes:pasta', (_e, id: unknown) => tentar(() => abrirPastaInstalacao(id)))
  ipcMain.handle('instalacoes:apagar', (_e, id: unknown) => tentar(() => apagarInstalacao(id)))
  ipcMain.handle('instalacoes:imagem', (e, id: unknown) =>
    tentar(() => escolherImagemInstalacao(id, BrowserWindow.fromWebContents(e.sender)))
  )
  ipcMain.handle('instalacoes:jogar', (_e, id: unknown, opcoes: unknown) =>
    tentar(() => jogar(id, opcoes, progresso))
  )

  // Convites (Fase P2). Dono: do servidor ativo. Amigo: código, link ou arquivo.
  ipcMain.handle('convites:estado', () => comServidor(estadoConvite))
  ipcMain.handle('convites:novo', () => comServidor(novoConvite))
  ipcMain.handle('convites:revogar', () => comServidor(revogarConvite))
  ipcMain.handle('convites:proibidos', (_e, lista: unknown) =>
    comServidor((i) => salvarProibidos(i, lista))
  )
  ipcMain.handle('convites:configurar', (_e, porta: unknown, playit: unknown) =>
    tentar(() => configurarConvites(porta, playit))
  )
  ipcMain.handle('convites:exportar', (e) =>
    comServidor((i) => exportarConvite(i, BrowserWindow.fromWebContents(e.sender)))
  )
  ipcMain.handle('convites:entrar', (_e, texto: unknown, pedido: unknown) =>
    tentar(() => entrarComConvite(texto, pedido))
  )
  ipcMain.handle('convites:entrarArquivo', (e, pedido: unknown) =>
    tentar(() => entrarComArquivoDeConvite(BrowserWindow.fromWebContents(e.sender), pedido))
  )
  // Pedidos para entrar na whitelist pelo convite (Fase M4), do servidor ativo.
  ipcMain.handle('pedidos:listar', () => comServidor(listarPedidos))
  // Diagnóstico de conexão (Fase M5): só lê; os consertos rodam só com o clique.
  // Fase M8: o último diagnóstico fica guardado (só em memória) para o relatório de erro.
  ipcMain.handle('diagnostico:dono', () =>
    tentar(async () => {
      const linhas = await diagnosticarDono()
      lembrarDiagnostico('Testar tudo (dono)', linhas)
      return linhas
    })
  )
  ipcMain.handle('diagnostico:amigo', (_e, id: unknown) =>
    tentar(async () => {
      const linhas = await diagnosticarInstalacao(id)
      lembrarDiagnostico('Não consigo entrar (amigo)', linhas)
      return linhas
    })
  )
  // Relatório de erro (Fase M8): só grava na Área de Trabalho; nunca envia nada.
  ipcMain.handle('relatorio:opcoes', () => tentar(opcoesRelatorio))
  ipcMain.handle('relatorio:gerar', (_e, pedido: unknown) => tentar(() => gerarRelatorio(pedido)))
  ipcMain.handle('relatorio:abrirPasta', () => tentar(abrirPastaDoRelatorio))
  ipcMain.handle('diagnostico:consertar', (_e, conserto: unknown) =>
    tentar(() => consertarDono(conserto))
  )
  ipcMain.handle('pedidos:decidir', (_e, uuid: unknown, aprovar: unknown) =>
    comServidor((i) => decidirPedido(i, uuid, aprovar))
  )
  ipcMain.handle('convites:aprovarAutomatico', (_e, ligado: unknown) =>
    comServidor((i) => definirAprovarAutomatico(i, ligado))
  )
  ipcMain.handle('convites:verificar', () => tentar(verificarConvites))
  ipcMain.handle('instalacoes:info', (_e, id: unknown) => tentar(() => infoDaInstalacao(id)))
  ipcMain.handle('instalacoes:recomendados', (_e, id: unknown, recusados: unknown) =>
    tentar(() => definirRecomendados(id, recusados, progresso))
  )
  ipcMain.handle('ajustesJogo:ler', () => tentar(lerAjustesJogo))
  // Tela Jogar (Fase P4).
  aoMudarJogo((id, estado) => avisarJanelas('jogo:estado', { id, estado }))
  ipcMain.handle('jogo:estados', () => tentar(estadosDoJogo))
  // Correção P1: INSTALAR monta a pasta; abrir o launcher fica desligado (opção interna).
  ipcMain.handle('jogo:abrirLauncherLigado', () => ABRIR_LAUNCHER_LIGADO)
  ipcMain.handle('instalacoes:instalar', (_e, id: unknown, opcoes: unknown) =>
    tentar(() => instalar(id, opcoes, progresso))
  )
  ipcMain.handle('instalacoes:exportarMrpack', (e, id: unknown) =>
    tentar(() => exportarMrpack(id, BrowserWindow.fromWebContents(e.sender)))
  )
  // Fase P5: capturas, ajustes do jogo, atalho e "Testar no meu jogo".
  ipcMain.handle('app:pedidoInicial', () => {
    const id = jogarPendente
    jogarPendente = null
    return id
  })
  ipcMain.handle('capturas:listar', (_e, id: unknown) =>
    tentar(async () => listarCapturas(await pastasDePrints(id)))
  )
  ipcMain.handle('capturas:grande', (_e, id: unknown, nome: unknown) =>
    tentar(async () => capturaGrande(await pastaDePrints(id), nome))
  )
  ipcMain.handle('capturas:copiar', (_e, id: unknown, nome: unknown) =>
    tentar(async () => copiarCaptura(await pastaDePrints(id), nome))
  )
  ipcMain.handle('capturas:mostrar', (_e, id: unknown, nome: unknown) =>
    tentar(async () => mostrarCapturaNaPasta(await pastaDePrints(id), nome))
  )
  ipcMain.handle('capturas:apagar', (_e, id: unknown, nome: unknown) =>
    tentar(async () => apagarCaptura(await pastaDePrints(id), nome))
  )
  ipcMain.handle('capturas:usarComoFundo', (_e, id: unknown, nome: unknown) =>
    tentar(() => usarCapturaComoFundo(id, nome))
  )
  ipcMain.handle('ajustesJogo:salvar', (_e, v: unknown) => tentar(() => salvarAjustesJogo(v)))
  ipcMain.handle('ajustesJogo:pasta', (e, voltar: unknown) =>
    tentar(() => escolherPastaInstalacoes(BrowserWindow.fromWebContents(e.sender), voltar))
  )
  ipcMain.handle('ajustesJogo:pastaAtual', () => tentar(pastaJogo))
  ipcMain.handle('ajustesJogo:abrirPasta', () =>
    tentar(async () => {
      const pasta = await pastaJogo()
      await mkdir(pasta, { recursive: true })
      const erro = await shell.openPath(pasta)
      if (erro) throw new ErroApp('Não consegui abrir a pasta das instalações.', erro)
    })
  )
  ipcMain.handle('instalacoes:atalho', (_e, id: unknown) => tentar(() => criarAtalho(id)))
  ipcMain.handle('instalacoes:prepararTeste', (_e, servidorId: unknown) =>
    tentar(() => prepararTeste(servidorId, progresso))
  )
  ipcMain.handle('jogo:dispensar', (_e, id: unknown) => tentar(() => dispensarSessao(id)))
  ipcMain.handle('jogo:status', (_e, id: unknown) => tentar(() => statusDoServidor(id)))
  ipcMain.handle('jogo:memoria', (_e, id: unknown) => tentar(() => memoriaDoJogo(id)))
  ipcMain.handle('jogo:definirMemoria', (_e, id: unknown, ram: unknown) =>
    tentar(() => definirMemoria(id, ram))
  )
  ipcMain.handle('jogo:ligarEJogar', (_e, id: unknown, opcoes: unknown) =>
    tentar(() => ligarServidorEJogar(id, opcoes, progresso))
  )
  ipcMain.handle('jogo:fundo', (_e, id: unknown) => tentar(() => fundoDaInstalacao(id)))
  ipcMain.handle('jogo:escolherFundo', (e, id: unknown) =>
    tentar(() => escolherFundoInstalacao(id, BrowserWindow.fromWebContents(e.sender)))
  )
  ipcMain.handle('jogo:removerFundo', (_e, id: unknown) => tentar(() => removerFundoInstalacao(id)))
  ipcMain.handle('jogo:bannerBioma', (_e, id: unknown, bioma: unknown) =>
    tentar(() => definirBannerBioma(id, bioma))
  )
  ipcMain.handle('jogo:fundoPadrao', () => tentar(lerFundoPadrao))
  ipcMain.handle('jogo:escolherFundoPadrao', (e) =>
    tentar(() => escolherFundoPadrao(BrowserWindow.fromWebContents(e.sender)))
  )
  ipcMain.handle('jogo:removerFundoPadrao', () => tentar(removerFundoPadrao))
  ipcMain.handle('servidores:mensagem', (_e, id: unknown) => tentar(() => lerMensagem(id)))
  ipcMain.handle('servidores:salvarMensagem', (_e, id: unknown, texto: unknown) =>
    tentar(() => salvarMensagem(id, texto))
  )
  ipcMain.handle('ajustesJogo:ocultar', (_e, tipo: unknown, ocultar: unknown) =>
    tentar(() => ocultarAviso(tipo, ocultar))
  )
  // Fase D: downloads manuais (a página oficial abre no navegador; o app só reconhece pelo hash).
  ipcMain.handle('downloads:listar', () => tentar(listarPendencias))
  ipcMain.handle('downloads:procurar', () => tentar(procurar))
  ipcMain.handle('downloads:abrirPagina', (_e, id: unknown) => tentar(() => abrirPagina(id)))
  ipcMain.handle('downloads:escolher', (e, id: unknown) =>
    tentar(() => escolherArquivo(id, BrowserWindow.fromWebContents(e.sender)))
  )
  ipcMain.handle('downloads:conferir', (_e, id: unknown, caminho: unknown) =>
    tentar(() => conferirArquivo(id, caminho))
  )
  ipcMain.handle('downloads:limparProntos', () => tentar(limparProntos))
  ipcMain.handle('servidor:buscarModFaltando', (_e, id: unknown) =>
    tentar(() => buscarModFaltando(id))
  )
  ipcMain.handle('ajustesJogo:pastaDownloads', (e, remover: unknown) =>
    tentar(async () => {
      const r = await mudarPastaDownloads(BrowserWindow.fromWebContents(e.sender), remover)
      await pastasMudaram()
      return r
    })
  )
  iniciarDownloadsManuais().catch(() => {})
  // Modo do app (Fase M6). Trocar só muda a tela e os serviços: nenhum dado é apagado.
  ipcMain.handle('modo:estado', () => tentar(async () => (await modoPronto, estadoModo())))
  ipcMain.handle('modo:escolher', (_e, valor: unknown) =>
    tentar(async () => {
      const novo = await escolherModoDoApp(valor, lerEstado())
      if (novo === 'completo') await ligarServicosDoServ()
      else await suspenderServicosDoServ()
      return estadoModo()
    })
  )
  ipcMain.handle('modo:conviteUsado', () => convitePegou())
  ipcMain.handle('aparencia:screenshots', () => tentar(listarScreenshots))
  ipcMain.handle('aparencia:usarScreenshot', (_e, nome: unknown) =>
    tentar(() => usarScreenshotComoFundo(nome))
  )

  ipcMain.handle('backups:alerta', () => comServidor(alertaBackups))
  ipcMain.handle('backups:listar', () => tentar(async () => listarBackups(await exigirServidor())))
  ipcMain.handle('backups:apagar', (_e, arquivos: unknown, nome: unknown) =>
    comServidor((i) => apagarBackups(i, arquivos, nome))
  )
  ipcMain.handle('backups:proteger', (_e, arquivo: unknown, protegido: unknown) =>
    comServidor((i) => protegerBackup(i, arquivo, protegido))
  )
  ipcMain.handle('backups:restaurar', (_e, arquivo: unknown) =>
    tentar(async () => restaurarBackup(await exigirServidor(), arquivo))
  )

  ipcMain.handle('app:copiar', (_e, texto: unknown) => {
    if (typeof texto === 'string' && texto.length <= 300) clipboard.writeText(texto)
  })

  createWindow()
  criarBandeja({ abrir: abrirJanela, sair: () => app.quit() })
})

// Sair (pela bandeja ou pelo Windows): impede o servidor de ligar, desliga do jeito certo,
// espera o backup terminar e só então fecha. Assim o Java nunca fica rodando sozinho.
let pronto = false
app.on('before-quit', (evento) => {
  saindo = true
  if (pronto) return
  evento.preventDefault()
  impedirLigar()
  desligar()
    .then(esperarTarefas)
    .finally(() => {
      pronto = true
      app.quit()
    })
})

// Com a bandeja, a janela só fecha de verdade quando o app está saindo.
app.on('window-all-closed', () => {
  if (saindo) app.quit()
})
