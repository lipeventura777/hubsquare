import { createSocket } from 'dgram'

// Pede ao roteador, por UPnP, para redirecionar uma porta para este PC.
// Feito à mão com o que vem no Node (dgram + fetch), sem biblioteca.
// Os erros aqui são simples; quem chama transforma em mensagem para o usuário.

const SERVICOS = [
  'urn:schemas-upnp-org:service:WANIPConnection:2',
  'urn:schemas-upnp-org:service:WANIPConnection:1',
  'urn:schemas-upnp-org:service:WANPPPConnection:1'
]

// ---------- Partes puras (testadas em tests/upnp.test.ts) ----------

export function lerLocation(resposta: string): string | null {
  return resposta.match(/^location:\s*(\S+)/im)?.[1] ?? null
}

// Acha no XML do roteador o endereço de controle do serviço de portas.
export function acharControle(
  xml: string,
  location: string
): { url: string; servico: string } | null {
  const base = xml.match(/<URLBase>\s*([^<\s]+)\s*<\/URLBase>/i)?.[1] ?? location
  for (const servico of SERVICOS) {
    for (const bloco of xml.match(/<service>[\s\S]*?<\/service>/gi) ?? []) {
      if (!bloco.includes(`<serviceType>${servico}</serviceType>`)) continue
      const caminho = bloco.match(/<controlURL>\s*([^<\s]+)\s*<\/controlURL>/i)?.[1]
      if (caminho) return { url: new URL(caminho, base).href, servico }
    }
  }
  return null
}

// IP que a internet não alcança direto: rede privada ou CGNAT da operadora (100.64.0.0/10).
export function ipNaoPublico(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

// ---------- Rede ----------

function procurarRoteador(): Promise<string> {
  return new Promise((resolver, falhar) => {
    const socket = createSocket('udp4')
    const fim = setTimeout(() => {
      socket.close()
      falhar(new Error('Nenhum roteador respondeu ao UPnP em 3 s.'))
    }, 3000)
    socket.on('message', (msg) => {
      const location = lerLocation(msg.toString())
      if (!location) return
      clearTimeout(fim)
      socket.close()
      resolver(location)
    })
    socket.on('error', (e) => {
      clearTimeout(fim)
      socket.close()
      falhar(e)
    })
    const pedido = [
      'M-SEARCH * HTTP/1.1',
      'HOST: 239.255.255.250:1900',
      'MAN: "ssdp:discover"',
      'MX: 2',
      'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      '',
      ''
    ].join('\r\n')
    socket.send(pedido, 1900, '239.255.255.250')
  })
}

async function soap(
  controle: { url: string; servico: string },
  acao: string,
  argumentos: Record<string, string | number>
): Promise<string> {
  const corpo = Object.entries(argumentos)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('')
  const resposta = await fetch(controle.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"${controle.servico}#${acao}"`
    },
    body:
      '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
      `<s:Body><u:${acao} xmlns:u="${controle.servico}">${corpo}</u:${acao}></s:Body></s:Envelope>`,
    signal: AbortSignal.timeout(5000)
  })
  const texto = await resposta.text()
  if (!resposta.ok)
    throw new Error(`O roteador recusou ${acao} (HTTP ${resposta.status}):\n${texto}`)
  return texto
}

// Redireciona a porta TCP para o IP local; devolve o IP que o roteador vê na internet.
export async function abrirPorta(porta: number, ipLocal: string): Promise<string | null> {
  const location = await procurarRoteador()
  const xml = await (await fetch(location, { signal: AbortSignal.timeout(5000) })).text()
  const controle = acharControle(xml, location)
  if (!controle) throw new Error(`O roteador não tem o serviço de portas do UPnP.\n${location}`)
  await soap(controle, 'AddPortMapping', {
    NewRemoteHost: '',
    NewExternalPort: porta,
    NewProtocol: 'TCP',
    NewInternalPort: porta,
    NewInternalClient: ipLocal,
    NewEnabled: 1,
    NewPortMappingDescription: 'HubSquare',
    NewLeaseDuration: 0
  })
  const resposta = await soap(controle, 'GetExternalIPAddress', {}).catch(() => '')
  return resposta.match(/<NewExternalIPAddress>\s*([\d.]+)\s*</)?.[1] ?? null
}
