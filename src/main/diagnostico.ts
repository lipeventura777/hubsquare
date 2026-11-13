import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { rodarChecagens, type Checagem, type LinhaDiagnostico } from '../shared/diagnosticoRegras'
import { lerArquivoPropriedades } from './config'
import {
  ipLocal,
  ipRadmin,
  lerIpPublico,
  lerPreferencias,
  liberarFirewall,
  pingMinecraft,
  regraExiste,
  religarTunel,
  resolverEndereco
} from './conexao'
import { listarPedidos } from './convites'
import { ErroApp } from './erros'
import { lerJogadores } from './jogadores'
import { javaDaVersao } from './mojang'
import * as playit from './playit'
import { javaDoServidor, lerEstado, ligar, PORTA, servidorAtual } from './servidor'

// Diagnóstico do dono (Fase M5), em Conexão e no Painel: confere em ordem o que os amigos
// precisam para entrar e para no primeiro problema (diagnosticoRegras.ts). Só lê: nada muda
// rede, firewall ou servidor; os consertos rodam só com o clique (consertarDono).

const NOMES_MODO = {
  playit: 'playit.gg',
  radmin: 'Radmin VPN',
  lan: 'rede local',
  porta: 'porta aberta'
}

export async function diagnosticarDono(): Promise<LinhaDiagnostico[]> {
  const info = await servidorAtual()
  if (!info) throw new ErroApp('Crie um servidor primeiro.')
  const props = await lerArquivoPropriedades(info.pasta)
  const porta = Number(props.get('server-port')) || PORTA
  const { modo, enderecoPlayit } = await lerPreferencias()
  let enderecoDeFora: string | null = null

  const checagens: Checagem[] = [
    {
      id: 'servidor',
      nome: 'Servidor ligado',
      essencial: true,
      async rodar() {
        const estado = lerEstado()
        if (estado === 'ligando') {
          return {
            resultado: 'falhou',
            frase: 'O servidor ainda está ligando. Espere e teste de novo.'
          }
        }
        if (estado !== 'ligado') {
          return {
            resultado: 'falhou',
            frase: 'O servidor está desligado. Ligue-o para os amigos entrarem.',
            conserto: 'ligarServidor'
          }
        }
        return (await pingMinecraft('127.0.0.1', porta))
          ? { resultado: 'ok', frase: `Ligado e respondendo na porta ${porta}.` }
          : {
              resultado: 'falhou',
              frase: `O servidor está ligado, mas não responde na porta ${porta}. Desligue e ligue de novo.`
            }
      }
    },
    {
      id: 'metodo',
      nome: `Conexão (${NOMES_MODO[modo]})`,
      essencial: true,
      async rodar() {
        if (modo === 'playit') {
          if (!playit.vinculado()) {
            return {
              resultado: 'falhou',
              frase: 'O playit.gg ainda não foi vinculado. Vincule em Conexão › playit.gg.'
            }
          }
          if (!enderecoPlayit) {
            return {
              resultado: 'falhou',
              frase: 'Falta colar o endereço do túnel em Conexão › playit.gg.'
            }
          }
          if (!playit.agenteLigado()) {
            return {
              resultado: 'falhou',
              frase: 'O agente do playit.gg não está rodando, então o túnel está caído.',
              conserto: 'religarTunel'
            }
          }
          enderecoDeFora = enderecoPlayit
          return { resultado: 'ok', frase: `Agente do playit.gg rodando, túnel ${enderecoPlayit}.` }
        }
        const ip =
          modo === 'radmin' ? ipRadmin() : modo === 'lan' ? ipLocal() : await lerIpPublico()
        if (!ip) {
          return {
            resultado: 'falhou',
            frase:
              modo === 'radmin'
                ? 'O Radmin VPN está fechado ou desconectado. Abra o Radmin VPN e entre na rede dos seus amigos.'
                : modo === 'lan'
                  ? 'Este PC não está em nenhuma rede local. Confira o Wi-Fi ou o cabo.'
                  : 'Não consegui descobrir o IP público. Confira a internet.'
          }
        }
        if (!(await regraExiste(info))) {
          return {
            resultado: 'falhou',
            frase:
              'O Firewall do Windows pode bloquear seus amigos: o Java do servidor não está liberado.',
            conserto: 'recriarFirewall'
          }
        }
        enderecoDeFora = `${ip}:${porta}`
        return {
          resultado: 'ok',
          frase:
            modo === 'radmin'
              ? `Radmin VPN conectado (${ip}) e Java liberado no Firewall.`
              : modo === 'lan'
                ? `Rede local ${ip} e Java liberado no Firewall.`
                : 'Java liberado no Firewall.'
        }
      }
    },
    {
      id: 'fora',
      nome: 'Acesso de fora',
      essencial: true,
      async rodar() {
        const endereco = enderecoDeFora!
        const { host, porta: p } = await resolverEndereco(endereco)
        if (await pingMinecraft(host, p)) {
          return { resultado: 'ok', frase: `O servidor responde em ${endereco}.` }
        }
        if (modo === 'playit') {
          return {
            resultado: 'falhou',
            frase:
              'O túnel do playit.gg não respondeu. No site do playit.gg, confira se o túnel é "Minecraft Java" e aponta para a porta do servidor; logo depois de ligar, espere uns 30 segundos.',
            conserto: 'religarTunel'
          }
        }
        return {
          resultado: 'falhou',
          frase:
            modo === 'porta'
              ? 'Não respondeu pelo IP público: confira o redirecionamento da porta no roteador (ou a operadora usa CGNAT). Alguns roteadores não deixam testar de dentro de casa.'
              : `Não respondeu em ${endereco}. Desligue e ligue o servidor de novo.`
        }
      }
    },
    {
      id: 'java',
      nome: 'Java',
      essencial: false,
      async rodar() {
        const usado = javaDoServidor(info)
        const exe = join(app.getPath('userData'), 'java', String(usado), 'bin', 'java.exe')
        if (!existsSync(exe)) {
          return {
            resultado: 'aviso',
            frase: `O Java ${usado} não está instalado. Ele é baixado ao ligar o servidor.`
          }
        }
        const pedido = await javaDaVersao(info.versao)
        return usado >= pedido
          ? {
              resultado: 'ok',
              frase: `Java ${usado} (o Minecraft ${info.versao} pede o ${pedido}).`
            }
          : {
              resultado: 'aviso',
              frase: `O servidor usa o Java ${usado}, mas o Minecraft ${info.versao} pede o ${pedido}.`
            }
      }
    },
    {
      id: 'pedidos',
      nome: 'Pedidos para entrar',
      essencial: false,
      async rodar() {
        const n = (await listarPedidos(info)).length
        return n
          ? {
              resultado: 'aviso',
              frase: `${n === 1 ? '1 amigo espera' : `${n} amigos esperam`} você aprovar a entrada na whitelist.`,
              conserto: 'abrirPedidos'
            }
          : { resultado: 'ok', frase: 'Nenhum amigo esperando aprovação.' }
      }
    },
    {
      id: 'cheio',
      nome: 'Vagas no servidor',
      essencial: false,
      async rodar() {
        const max = Number(props.get('max-players')) || 20
        const online = lerJogadores().length
        return online >= max
          ? {
              resultado: 'aviso',
              frase: `O servidor está cheio (${online}/${max}). Aumente o máximo de jogadores em Opções.`
            }
          : { resultado: 'ok', frase: `${online} de ${max} jogadores online.` }
      }
    }
  ]
  return rodarChecagens(checagens)
}

// Consertos do dono: só com o clique (os do amigo e "Ver os pedidos" são da tela).
export async function consertarDono(conserto: unknown): Promise<void> {
  if (conserto === 'ligarServidor') return ligar()
  if (conserto === 'religarTunel') return religarTunel()
  if (conserto === 'recriarFirewall') return liberarFirewall()
  throw new ErroApp('Esse conserto não existe.')
}
