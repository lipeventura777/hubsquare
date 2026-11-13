import { app } from 'electron'
import { spawn } from 'child_process'
import { resolveSrv } from 'dns/promises'
import { connect } from 'net'
import { networkInterfaces } from 'os'
import { join } from 'path'
import type {
  EstadoConexao,
  InfoServidor,
  ModoConexao,
  ResultadoTeste,
  ResultadoUpnp
} from '../shared/tipos'
import { ehIpTailscale } from './celularRegras'
import { gravarComSeguranca, lerTexto } from './config'
import { ErroApp, detalhar } from './erros'
import { garantirJava } from './java'
import { urlDeVerdade } from './rede'
import * as playit from './playit'
import { eventos, javaDoServidor, lerEstado, PORTA, servidorAtual } from './servidor'
import { abrirPorta, ipNaoPublico } from './upnp'

// ---------- Escolha do usuário (modo e endereço do playit) ----------

interface Preferencias {
  modo: ModoConexao
  enderecoPlayit: string | null
}

const arquivoPreferencias = (): string => join(app.getPath('userData'), 'conexao.json')

export async function lerPreferencias(): Promise<Preferencias> {
  const texto = await lerTexto(arquivoPreferencias())
  const salvo = texto ? (JSON.parse(texto) as Partial<Preferencias>) : {}
  return { modo: salvo.modo ?? 'playit', enderecoPlayit: salvo.enderecoPlayit ?? null }
}

async function mudarPreferencias(mudancas: Partial<Preferencias>): Promise<void> {
  const nova = { ...(await lerPreferencias()), ...mudancas }
  await gravarComSeguranca(arquivoPreferencias(), JSON.stringify(nova, null, 2))
}

const MODOS: ModoConexao[] = ['playit', 'radmin', 'lan', 'porta']

export async function escolherModo(valor: unknown): Promise<void> {
  if (!MODOS.includes(valor as ModoConexao)) throw new ErroApp('Escolha uma das opções de conexão.')
  await mudarPreferencias({ modo: valor as ModoConexao })
  await acertarAgente()
}

export async function salvarEnderecoPlayit(valor: unknown): Promise<void> {
  const endereco = typeof valor === 'string' ? valor.trim().toLowerCase() : ''
  if (!/^[a-z0-9.-]{3,253}(:\d{1,5})?$/.test(endereco) || !endereco.includes('.')) {
    throw new ErroApp(
      'Endereço inválido. Copie do site do playit.gg o endereço do túnel, por exemplo "nome.joinmc.link".'
    )
  }
  await mudarPreferencias({ enderecoPlayit: endereco })
}

// ---------- Agente do playit liga e desliga junto com o servidor ----------

async function acertarAgente(): Promise<void> {
  const deveLigar = lerEstado() !== 'desligado' && (await lerPreferencias()).modo === 'playit'
  if (deveLigar) playit.ligarAgente()
  else playit.desligarAgente()
}

eventos.on('processo', () => void acertarAgente())
eventos.on('estado', (estado) => {
  if (estado === 'desligado') playit.desligarAgente()
})
app.on('will-quit', () => playit.desligarAgente())

// Fase M5: "Religar o túnel" do diagnóstico (só com o clique do usuário).
export async function religarTunel(): Promise<void> {
  playit.desligarAgente()
  await acertarAgente()
}

export async function vincularPlayit(
  aoProgredir: Parameters<typeof playit.vincular>[0]
): Promise<void> {
  await playit.vincular(aoProgredir)
  await acertarAgente()
}

// ---------- IPs deste PC ----------

function ipsV4(): { nome: string; ip: string }[] {
  return Object.entries(networkInterfaces()).flatMap(([nome, lista]) =>
    (lista ?? [])
      .filter((e) => e.family === 'IPv4' && !e.internal)
      .map((e) => ({ nome, ip: e.address }))
  )
}

// O Radmin VPN cria o adaptador "Radmin VPN" com IP 26.x.x.x; só aparece com o Radmin conectado.
export function ipRadmin(): string | null {
  const ips = ipsV4()
  return (
    (ips.find((e) => /radmin/i.test(e.nome)) ?? ips.find((e) => e.ip.startsWith('26.')))?.ip ?? null
  )
}

// O Tailscale cria o adaptador "Tailscale" com IP 100.64.x.x a 100.127.x.x; só aparece conectado.
export function ipTailscale(): string | null {
  const ips = ipsV4()
  return (
    (ips.find((e) => /tailscale/i.test(e.nome)) ?? ips.find((e) => ehIpTailscale(e.ip)))?.ip ?? null
  )
}

const VIRTUAIS =
  /radmin|vethernet|virtualbox|vmware|hyper-v|loopback|tailscale|zerotier|wsl|bluetooth/i

export function ipLocal(): string | null {
  const candidatos = ipsV4().filter((e) => !VIRTUAIS.test(e.nome) && ipNaoPublico(e.ip))
  return (candidatos.find((e) => e.ip.startsWith('192.168.')) ?? candidatos[0])?.ip ?? null
}

// ---------- Firewall ----------

const nomeRegra = (info: InfoServidor): string => `ServSquare Java ${javaDoServidor(info)}`

function rodar(
  programa: string,
  argumentos: string[]
): Promise<{ codigo: number | null; saida: string }> {
  return new Promise((resolver) => {
    const filho = spawn(programa, argumentos, { windowsHide: true })
    let saida = ''
    filho.stdout.on('data', (d) => (saida += d))
    filho.stderr.on('data', (d) => (saida += d))
    filho.on('error', (e) => resolver({ codigo: -1, saida: String(e) }))
    filho.on('close', (codigo) => resolver({ codigo, saida }))
  })
}

const SISTEMA = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
const NETSH = join(SISTEMA, 'netsh.exe')
const POWERSHELL = join(SISTEMA, 'WindowsPowerShell', 'v1.0', 'powershell.exe')

// Ver se a regra existe não precisa de administrador.
export async function regraExiste(info: InfoServidor): Promise<boolean> {
  const { codigo } = await rodar(NETSH, [
    'advfirewall',
    'firewall',
    'show',
    'rule',
    `name=${nomeRegra(info)}`
  ])
  return codigo === 0
}

// Cria a regra de entrada para o java.exe do app. O Windows mostra o aviso de administrador (UAC).
export async function liberarFirewall(): Promise<void> {
  const info = await servidorAtual()
  if (!info) throw new ErroApp('Crie um servidor primeiro, na tela "Servidor".')
  const java = await garantirJava(javaDoServidor(info), () => {})
  const regra = nomeRegra(info)
  // Script do PowerShell elevado: apaga a regra antiga com o mesmo nome e cria de novo.
  // Vai codificado em base64, então caminhos com espaço ou aspas não quebram o comando.
  const aspas = (s: string): string => `'${s.replace(/'/g, "''")}'`
  const interno = [
    `netsh advfirewall firewall delete rule name=${aspas(regra)} | Out-Null`,
    `netsh advfirewall firewall add rule name=${aspas(regra)} dir=in action=allow program=${aspas(java)} enable=yes profile=any`,
    'exit $LASTEXITCODE'
  ].join('; ')
  const codificado = Buffer.from(interno, 'utf16le').toString('base64')
  const externo =
    `$p = Start-Process -FilePath ${aspas(POWERSHELL)} -Verb RunAs -Wait -PassThru -WindowStyle Hidden ` +
    `-ArgumentList '-NoProfile','-EncodedCommand','${codificado}'; exit $p.ExitCode`
  const { codigo, saida } = await rodar(POWERSHELL, [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    externo
  ])
  if (codigo === 0) return
  if (/cancel/i.test(saida)) {
    throw new ErroApp(
      'A permissão de administrador foi recusada. Clique de novo e escolha "Sim" no aviso do Windows.'
    )
  }
  throw new ErroApp(
    'Não consegui criar a regra no Firewall do Windows.',
    `Código: ${codigo}\n${saida}`
  )
}

// ---------- Estado para a tela ----------

export async function estadoConexao(): Promise<EstadoConexao> {
  const [preferencias, info] = await Promise.all([lerPreferencias(), servidorAtual()])
  return {
    modo: preferencias.modo,
    porta: PORTA,
    playit: {
      vinculado: playit.vinculado(),
      vinculando: playit.estaVinculando(),
      endereco: preferencias.enderecoPlayit,
      agenteLigado: playit.agenteLigado()
    },
    radminIp: ipRadmin(),
    lanIp: ipLocal(),
    firewallLiberado: info ? await regraExiste(info) : null
  }
}

// ---------- Teste de conexão ----------

function varint(n: number): number[] {
  const bytes: number[] = []
  do {
    let byte = n & 0x7f
    n >>>= 7
    if (n) byte |= 0x80
    bytes.push(byte)
  } while (n)
  return bytes
}

const pacote = (dados: number[]): Buffer => Buffer.from([...varint(dados.length), ...dados])

// Faz o mesmo "ping" que a lista de servidores do Minecraft: conecta e pede o status.
// Responder com qualquer dado já mostra que é o servidor de Minecraft do outro lado.
export function pingMinecraft(host: string, porta: number): Promise<boolean> {
  return new Promise((resolver) => {
    const socket = connect({ host, port: porta, timeout: 5000 })
    const fim = (ok: boolean): void => {
      socket.destroy()
      resolver(ok)
    }
    socket.on('connect', () => {
      const nome = [...Buffer.from(host)]
      socket.write(
        pacote([0x00, ...varint(0), ...varint(nome.length), ...nome, porta >> 8, porta & 0xff, 1])
      )
      socket.write(pacote([0x00]))
    })
    socket.on('data', () => fim(true))
    socket.on('timeout', () => fim(false))
    socket.on('error', () => fim(false))
    socket.on('close', () => fim(false))
  })
}

// Endereços como "nome.joinmc.link" escondem a porta num registro SRV do DNS.
export async function resolverEndereco(endereco: string): Promise<{ host: string; porta: number }> {
  const [host, porta] = endereco.split(':')
  if (porta) return { host, porta: Number(porta) }
  try {
    const [srv] = await resolveSrv(`_minecraft._tcp.${host}`)
    if (srv) return { host: srv.name, porta: srv.port }
  } catch {
    // Sem SRV: usa a porta padrão do Minecraft.
  }
  return { host, porta: 25565 }
}

const OK = 'Seus amigos já conseguem entrar.'

export async function testarConexao(modo: unknown): Promise<ResultadoTeste> {
  if (lerEstado() !== 'ligado') return { ok: false, mensagem: 'Ligue o servidor antes de testar.' }
  const info = await servidorAtual()
  const firewall = info ? await regraExiste(info) : false
  const avisoFirewall =
    'O servidor responde neste PC, mas o Firewall do Windows pode bloquear seus amigos. Clique em "Liberar o Java no Firewall".'

  if (modo === 'playit') {
    const { enderecoPlayit } = await lerPreferencias()
    if (!playit.vinculado()) return { ok: false, mensagem: 'Vincule o playit.gg primeiro.' }
    if (!enderecoPlayit)
      return { ok: false, mensagem: 'Cole o endereço do túnel do playit.gg primeiro.' }
    if (!playit.agenteLigado()) {
      return {
        ok: false,
        mensagem: 'O agente do playit.gg não está rodando. Desligue e ligue o servidor de novo.'
      }
    }
    const { host, porta } = await resolverEndereco(enderecoPlayit)
    return (await pingMinecraft(host, porta))
      ? { ok: true, mensagem: `${OK} Endereço: ${enderecoPlayit}` }
      : {
          ok: false,
          mensagem:
            'O túnel do playit.gg não respondeu. No site do playit.gg, confira se o túnel é "Minecraft Java", aponta para 127.0.0.1 porta 25565 e se o agente aparece online. Logo depois de ligar, espere uns 30 segundos e teste de novo.'
        }
  }

  if (modo === 'radmin' || modo === 'lan') {
    const ip = modo === 'radmin' ? ipRadmin() : ipLocal()
    if (!ip) {
      return {
        ok: false,
        mensagem:
          modo === 'radmin'
            ? 'Radmin VPN fechado ou desconectado. Abra o Radmin VPN e entre na mesma rede que seus amigos.'
            : 'Não achei a rede local deste PC. Confira se o Wi-Fi ou o cabo está conectado.'
      }
    }
    if (!(await pingMinecraft(ip, PORTA))) {
      return {
        ok: false,
        mensagem: `O servidor não respondeu em ${ip}:${PORTA}. Desligue e ligue o servidor de novo.`
      }
    }
    if (!firewall) return { ok: false, mensagem: avisoFirewall }
    return {
      ok: true,
      mensagem:
        modo === 'radmin'
          ? `${OK} Eles precisam estar na mesma rede do Radmin VPN e usar ${ip}:${PORTA}.`
          : `${OK} Eles precisam estar no mesmo Wi-Fi ou rede e usar ${ip}:${PORTA}.`
    }
  }

  if (modo === 'porta') {
    const ip = await ipPublico()
    if (!ip)
      return { ok: false, mensagem: 'Não consegui descobrir o IP público. Confira sua internet.' }
    if (await pingMinecraft(ip, PORTA)) {
      return firewall
        ? { ok: true, mensagem: `${OK} Endereço: ${ip}:${PORTA}` }
        : { ok: false, mensagem: avisoFirewall }
    }
    return {
      ok: false,
      mensagem:
        'O servidor não respondeu pelo IP público. Pode ser a porta que não foi redirecionada no roteador, o firewall ou CGNAT da operadora. Alguns roteadores também não deixam testar de dentro de casa: peça para um amigo tentar.'
    }
  }

  throw new ErroApp('Escolha uma das opções de conexão.')
}

// ---------- Abrir porta ----------

// shortcut: usa o serviço público api.ipify.org para saber o IP público; troque se ele sair do ar.
async function ipPublico(): Promise<string | null> {
  try {
    const resposta = await fetch(urlDeVerdade('https://api.ipify.org'), {
      signal: AbortSignal.timeout(5000)
    })
    const ip = (await resposta.text()).trim()
    return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : null
  } catch {
    return null
  }
}

export async function tentarUpnp(): Promise<ResultadoUpnp> {
  const local = ipLocal()
  if (!local)
    throw new ErroApp(
      'Não achei a rede local deste PC. Confira se o Wi-Fi ou o cabo está conectado.'
    )
  const publico = await ipPublico()
  let ipDoRoteador: string | null
  try {
    ipDoRoteador = await abrirPorta(PORTA, local)
  } catch (e) {
    throw new ErroApp(
      'O roteador não aceitou abrir a porta sozinho (UPnP desligado ou não suportado). Siga o passo a passo abaixo.',
      detalhar(e)
    )
  }
  if (ipDoRoteador && (ipNaoPublico(ipDoRoteador) || (publico && ipDoRoteador !== publico))) {
    return {
      ok: false,
      ipPublico: publico,
      mensagem: `A porta foi aberta no roteador, mas sua internet parece usar CGNAT (o roteador recebe o IP ${ipDoRoteador}, que não é o seu IP público). Nesse caso, use o playit.gg ou o Radmin VPN.`
    }
  }
  return {
    ok: true,
    ipPublico: publico,
    mensagem: `Porta ${PORTA} aberta no roteador para ${local}.`
  }
}

export async function lerIpPublico(): Promise<string | null> {
  return ipPublico()
}
