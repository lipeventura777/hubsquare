import {
  test as base,
  expect,
  _electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { iniciarSimulado, type Simulado } from './simulado'

// Abre o HubSquare compilado (out/) numa pasta de teste nova em .teste/e2e/, que some no fim.
// Nunca usa as pastas reais (HUBSQUARE_DADOS), nunca vai à internet no modo rápido
// (HUBSQUARE_DOWNLOADS + bloqueio de rede) e nunca abre o launcher nem a Microsoft Store: a
// abertura é interceptada e só anotada.

const RAIZ = join(__dirname, '..', '..')
const PASTAS = join(RAIZ, '.teste', 'e2e')

export interface AppDeTeste {
  app: ElectronApplication
  janela: Page
  pasta: string
  // O que o app tentou abrir como launcher (MinecraftLauncher.exe, explorer.exe, ms-windows-store).
  aberturas: () => Promise<string[]>
  // Pedidos do processo principal para fora da máquina/rede local.
  redeExterna: () => Promise<string[]>
  // Troca o diálogo "Abrir arquivo" do Windows por uma resposta pronta.
  escolherArquivo: (caminho: string) => Promise<void>
}

// Um MinecraftLauncher.exe falso (arquivo vazio) e o launcher_profiles.json com perfis antigos.
export function prepararLauncherFalso(pasta: string): Record<string, unknown> {
  const exe = join(pasta, 'pf86', 'Minecraft Launcher', 'MinecraftLauncher.exe')
  mkdirSync(join(exe, '..'), { recursive: true })
  writeFileSync(exe, '')
  const perfis = {
    profiles: {
      antigo1: { name: 'Meu 1.20', type: 'custom', lastVersionId: '1.20.4', icon: 'Grass' },
      antigo2: { name: '', type: 'latest-release', lastVersionId: 'latest-release' }
    },
    settings: { locale: 'pt-BR' },
    version: 3
  }
  const minecraft = join(pasta, 'appData', '.minecraft')
  mkdirSync(minecraft, { recursive: true })
  writeFileSync(join(minecraft, 'launcher_profiles.json'), JSON.stringify(perfis, null, 2))
  return perfis
}

async function abrirApp(
  pasta: string,
  simulado: Simulado | null,
  log: string[],
  argumentos: string[] = []
): Promise<AppDeTeste> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  delete env.ELECTRON_RUN_AS_NODE
  Object.assign(env, {
    HUBSQUARE_DADOS: pasta,
    'ProgramFiles(x86)': join(pasta, 'pf86'),
    ProgramFiles: join(pasta, 'pf'),
    TEMP: join(pasta, 'temp'),
    TMP: join(pasta, 'temp')
  })
  if (simulado) env.HUBSQUARE_DOWNLOADS = simulado.url
  mkdirSync(join(pasta, 'temp'), { recursive: true })

  const app = await _electron.launch({ args: [RAIZ, ...argumentos], cwd: RAIZ, env })
  app.process().stdout?.on('data', (d) => log.push(`[principal] ${d}`))
  app.process().stderr?.on('data', (d) => log.push(`[principal:erro] ${d}`))

  await app.evaluate(({ shell }, bloquear) => {
    const g = globalThis as unknown as Record<string, unknown>
    const req = (process as unknown as { mainModule: NodeJS.Module }).mainModule.require
    const cp = req('child_process')
    const { EventEmitter } = req('events')
    const aberturas: string[] = []
    const rede: string[] = []
    g.__aberturas = aberturas
    g.__rede = rede
    // Links e "Abrir pasta" só ficam anotados: nada abre navegador ou Explorer no teste.
    shell.openExternal = async (url: string) => void aberturas.push(`openExternal ${url}`)
    shell.openPath = async (p: string) => (aberturas.push(`openPath ${p}`), '')
    const spawnOriginal = cp.spawn
    cp.spawn = function (cmd: string, args: string[] = [], ...resto: unknown[]) {
      const texto = [cmd, ...args].join(' ')
      if (/MinecraftLauncher\.exe$|explorer\.exe$|ms-windows-store/i.test(texto)) {
        aberturas.push(texto)
        const falso = new EventEmitter()
        Object.assign(falso, { unref: () => {} })
        setImmediate(() => falso.emit('spawn'))
        return falso
      }
      return spawnOriginal.call(this, cmd, args, ...resto)
    }
    const fetchOriginal = globalThis.fetch
    globalThis.fetch = (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada instanceof Request ? entrada.url : entrada)
      const local =
        /^https?:\/\/(127\.|localhost|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|26\.|100\.)/.test(
          url
        )
      if (!local) {
        rede.push(url)
        if (bloquear) return Promise.reject(new Error(`rede externa bloqueada no teste: ${url}`))
      }
      return fetchOriginal(entrada, init)
    }
  }, !!simulado)

  const janela = await app.firstWindow()
  janela.on('console', (m) => log.push(`[tela:${m.type()}] ${m.text()}`))
  janela.on('pageerror', (e) => log.push(`[tela:exceção] ${e.message}`))
  // A tela só carrega o que é do próprio app; imagens de CDNs etc. ficam de fora no teste.
  await app.context().route('**/*', (rota) => {
    const url = rota.request().url()
    if (
      /^(file|data|blob|devtools|chrome-extension):|^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)
    ) {
      return rota.continue()
    }
    log.push(`[tela:bloqueado] ${url}`)
    return rota.abort()
  })
  await janela.waitForLoadState('domcontentloaded')

  return {
    app,
    janela,
    pasta,
    aberturas: () =>
      app.evaluate(() => (globalThis as unknown as { __aberturas: string[] }).__aberturas),
    redeExterna: () => app.evaluate(() => (globalThis as unknown as { __rede: string[] }).__rede),
    escolherArquivo: (caminho) =>
      app.evaluate(({ dialog }, c) => {
        dialog.showOpenDialog = (async () => ({
          canceled: false,
          filePaths: [c]
        })) as typeof dialog.showOpenDialog
      }, caminho)
  }
}

export const test = base.extend<{
  simulado: Simulado | null
  abrir: (
    nome?: string,
    preparar?: (pasta: string) => void,
    argumentos?: string[]
  ) => Promise<AppDeTeste>
}>({
  // Rápido: internet simulada. Lento (@lento): proxy para a internet de verdade com cache.
  // eslint-disable-next-line no-empty-pattern -- o Playwright exige o objeto de fixtures aqui
  simulado: async ({}, usar, info) => {
    const s = await iniciarSimulado(info.project.name === 'lento' ? 'proxy' : 'falso')
    await usar(s)
    await s.fechar()
    if (info.project.name !== 'lento') {
      expect(s.desconhecidos, 'pedidos que o servidor simulado não conhece').toEqual([])
    }
  },

  abrir: async ({ simulado }, usar, info) => {
    const abertos: { a: AppDeTeste; log: string[]; nome: string }[] = []
    await usar(async (nome = 'app', preparar, argumentos) => {
      const pasta = join(
        PASTAS,
        `${info.title.replace(/[^\w]+/g, '-').slice(0, 40)}-${nome}-${randomUUID().slice(0, 8)}`
      )
      mkdirSync(pasta, { recursive: true })
      preparar?.(pasta)
      const log: string[] = []
      const a = await abrirApp(pasta, simulado, log, argumentos)
      abertos.push({ a, log, nome })
      return a
    })
    const falhou = info.status !== info.expectedStatus
    for (const { a, log, nome } of abertos) {
      if (falhou) {
        await a.janela.screenshot({ path: info.outputPath(`falha-${nome}.png`) }).catch(() => {})
        const erros = join(a.pasta, 'appData', 'ServSquare', 'logs', 'erros.log')
        if (existsSync(erros)) copyFileSync(erros, info.outputPath(`erros-${nome}.log`))
      }
      const externos = info.project.name === 'lento' ? [] : await a.redeExterna().catch(() => [])
      const aberturas = await a.aberturas().catch(() => [])
      await a.app.close().catch(() => {})
      if (falhou) writeFileSync(info.outputPath(`log-${nome}.txt`), log.join('\n'))
      rmSync(a.pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
      expect(externos, 'o app foi à internet no modo rápido').toEqual([])
      expect(
        aberturas.filter((t) => /explorer\.exe|ms-windows-store/i.test(t)),
        'tentativa de abrir a Microsoft Store ou um app da Store'
      ).toEqual([])
    }
  }
})

export { expect }

// Atalhos de tela.
export const area = (j: Page, nome: 'ServSquare' | 'PlaySquare'): Promise<void> =>
  j.getByRole('tab', { name: nome }).click()
export const pagina = (j: Page, nome: string): Promise<void> =>
  j.locator(`[data-indicador="${nome}"]`).click()

export const pastaServidor = (raiz: string, nome: string): string =>
  join(raiz, 'documents', 'ServSquare', 'servidores', nome)

// Assistente de primeira vez: Paper (recomendado), versão mais nova, nome, EULA e criar.
// ramMinima: o servidor vai ligar de verdade (teste lento); a RAM mínima cabe em qualquer PC.
export async function criarPeloAssistente(
  j: Page,
  nome: string,
  versao?: string,
  ramMinima = false
): Promise<void> {
  // Fase M6: na primeira abertura, as boas-vindas; quem cria servidor escolhe o completo.
  const hospedar = j.getByRole('button', { name: /Vou hospedar servidores/ })
  await expect(j.getByText('Que tipo de servidor?').or(hospedar)).toBeVisible()
  if (await hospedar.isVisible()) await hospedar.click()
  await expect(j.getByText('Que tipo de servidor?')).toBeVisible()
  await j.getByRole('button', { name: 'Próximo' }).click()
  if (versao) await expect(j.getByLabel('Versão do jogo')).toContainText(versao)
  await j.getByRole('button', { name: 'Próximo' }).click()
  await j.getByLabel('Nome do servidor').fill(nome)
  await j.getByRole('button', { name: 'Próximo' }).click()
  if (ramMinima) await j.getByRole('slider', { name: /RAM do servidor/ }).press('Home')
  await j.getByRole('button', { name: 'Próximo' }).click()
  await j.getByRole('checkbox', { name: /Li e aceito o/ }).check({ force: true })
  await j.getByRole('button', { name: 'Criar servidor' }).click()
  await expect(j.getByText('Tudo pronto!')).toBeVisible({ timeout: 10 * 60_000 })
  await j.getByRole('button', { name: 'Ir para o painel' }).click()
  await expect(j.getByRole('tab', { name: 'ServSquare' })).toBeVisible()
}

// Dono com servidor e convite numa porta própria do teste (nunca a 8788 de um HubSquare de
// verdade aberto no PC). Devolve o código e, para chamar a rota direto, o endereço e o token.
export async function donoComConvite(
  abrir: (nome?: string) => Promise<AppDeTeste>,
  versao: string,
  portaJogo?: number // Fase M5: o jogo numa porta do teste (o endereço do manifesto aponta para ela)
): Promise<{ dono: AppDeTeste; texto: string; endereco: string; token: string }> {
  const dono = await abrir('dono')
  await criarPeloAssistente(dono.janela, 'Servidor Amigos', versao)
  if (portaJogo) {
    const props = join(pastaServidor(dono.pasta, 'Servidor Amigos'), 'server.properties')
    const linhas = readFileSync(props, 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.startsWith('server-port='))
    writeFileSync(props, [...linhas, `server-port=${portaJogo}`].join('\n'))
  }
  await pagina(dono.janela, 'Conexão')
  await dono.janela.getByRole('tab', { name: 'Convites' }).click()
  const porta = String(20000 + Math.floor(Math.random() * 20000))
  const campoPorta = dono.janela.getByLabel('Porta do convite (só leitura)')
  await expect(campoPorta).toHaveValue('8788')
  await campoPorta.fill(porta)
  await dono.janela.getByRole('button', { name: 'Salvar' }).click()
  await expect(campoPorta).toHaveValue(porta)
  await dono.janela.getByRole('button', { name: 'Convidar amigos' }).click()
  const codigo = dono.janela.getByText('Código (para ditar ou colar)').locator('..').locator('code')
  await expect(codigo).toContainText(`:${porta}#`)
  const texto = (await codigo.textContent())!.trim()
  const [endereco, token] = texto.split('#')
  return { dono, texto, endereco, token: token.replace(/-/g, '').toUpperCase() }
}

// O amigo (outra instância, outra pasta) escolhe o modo amigo (Fase M6) e aceita o convite com
// o nick. Não precisa de servidor nenhum.
export async function amigoAceita(
  abrir: (nome?: string) => Promise<AppDeTeste>,
  texto: string,
  nick: string,
  _versao: string,
  recado = ''
): Promise<AppDeTeste> {
  const amigo = await abrir('amigo')
  await amigo.janela.getByRole('button', { name: /Só vou jogar com amigos/ }).click()
  await pagina(amigo.janela, 'Instalações')
  await amigo.janela.getByRole('button', { name: 'Entrar com convite' }).click()
  await amigo.janela.getByLabel('Código ou link do convite').fill(texto)
  await amigo.janela.getByLabel('Seu nick no Minecraft').fill(nick)
  if (recado) await amigo.janela.getByLabel('Recado para o dono').fill(recado)
  await amigo.janela.getByRole('dialog').getByRole('button', { name: 'Entrar' }).click()
  return amigo
}

// Portas TCP em que o processo principal do app está escutando (Fase M6: modo amigo sem nenhuma).
// O processo que o Playwright abre é um intermediário: o PID certo é o de dentro do app.
export async function portasEscutando(a: AppDeTeste): Promise<number[]> {
  const pid = await a.app.evaluate(() => process.pid)
  const saida = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      // Sem nenhuma porta o cmdlet sai com erro; "exit 0" devolve a lista vazia.
      `Get-NetTCPConnection -State Listen -OwningProcess ${pid} -ErrorAction SilentlyContinue | ForEach-Object { $_.LocalPort }; exit 0`
    ],
    { encoding: 'utf8' }
  )
  return saida.split(/\s+/).filter(Boolean).map(Number)
}
