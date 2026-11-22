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
import { javaDoServidor, lerEstado, ligar, servidorAtual } from './servidor'
import { portaDe } from '../shared/redeRegras'
import { t } from '../shared/i18n'

// Diagnóstico do dono (Fase M5), em Conexão e no Painel: confere em ordem o que os amigos
// precisam para entrar e para no primeiro problema (diagnosticoRegras.ts). Só lê: nada muda
// rede, firewall ou servidor; os consertos rodam só com o clique (consertarDono).

const NOMES_MODO = {
  playit: 'playit.gg',
  radmin: t('p.diagnostico.radminVpn'),
  lan: 'rede local',
  porta: 'porta aberta'
}

export async function diagnosticarDono(): Promise<LinhaDiagnostico[]> {
  const info = await servidorAtual()
  if (!info) throw new ErroApp(t('p.diagnostico.crieUmServidorPrimeiro'))
  const props = await lerArquivoPropriedades(info.pasta)
  const porta = portaDe(props.get('server-port'))
  const { modo, enderecoPlayit } = await lerPreferencias()
  let enderecoDeFora: string | null = null

  const checagens: Checagem[] = [
    {
      id: 'servidor',
      nome: t('p.diagnostico.servidorLigado'),
      essencial: true,
      async rodar() {
        const estado = lerEstado()
        if (estado === 'ligando') {
          return {
            resultado: 'falhou',
            frase: t('p.diagnostico.oServidorAindaEstaLigando')
          }
        }
        if (estado !== 'ligado') {
          return {
            resultado: 'falhou',
            frase: t('p.diagnostico.oServidorEstaDesligadoLigue'),
            conserto: 'ligarServidor'
          }
        }
        return (await pingMinecraft('127.0.0.1', porta))
          ? { resultado: 'ok', frase: t('p.diagnostico.ligadoERespondendoNaPorta', { porta }) }
          : {
              resultado: 'falhou',
              frase: t('p.diagnostico.oServidorEstaLigadoMas', { porta })
            }
      }
    },
    {
      id: 'metodo',
      nome: t('p.diagnostico.conexao', { v: NOMES_MODO[modo] }),
      essencial: true,
      async rodar() {
        if (modo === 'playit') {
          if (!playit.vinculado()) {
            return {
              resultado: 'falhou',
              frase: t('p.diagnostico.oPlayitGgAindaNao')
            }
          }
          if (!enderecoPlayit) {
            return {
              resultado: 'falhou',
              frase: t('p.diagnostico.faltaColarOEnderecoDo')
            }
          }
          if (!playit.agenteLigado()) {
            return {
              resultado: 'falhou',
              frase: t('p.diagnostico.oAgenteDoPlayitGg'),
              conserto: 'religarTunel'
            }
          }
          enderecoDeFora = enderecoPlayit
          return {
            resultado: 'ok',
            frase: t('p.diagnostico.agenteDoPlayitGgRodando', { enderecoPlayit })
          }
        }
        const ip =
          modo === 'radmin' ? ipRadmin() : modo === 'lan' ? ipLocal() : await lerIpPublico()
        if (!ip) {
          return {
            resultado: 'falhou',
            frase:
              modo === 'radmin'
                ? t('p.diagnostico.oRadminVpnEstaFechado')
                : modo === 'lan'
                  ? t('p.diagnostico.estePcNaoEstaEm')
                  : t('p.diagnostico.naoConseguiDescobrirOIp')
          }
        }
        if (!(await regraExiste(info))) {
          return {
            resultado: 'falhou',
            frase: t('p.diagnostico.oFirewallDoWindowsPode'),
            conserto: 'recriarFirewall'
          }
        }
        enderecoDeFora = `${ip}:${porta}`
        return {
          resultado: 'ok',
          frase:
            modo === 'radmin'
              ? t('p.diagnostico.radminVpnConectadoEJava', { ip })
              : modo === 'lan'
                ? t('p.diagnostico.redeLocalEJavaLiberado', { ip })
                : t('p.diagnostico.javaLiberadoNoFirewall')
        }
      }
    },
    {
      id: 'fora',
      nome: t('p.diagnostico.acessoDeFora'),
      essencial: true,
      async rodar() {
        const endereco = enderecoDeFora!
        const { host, porta: p } = await resolverEndereco(endereco)
        if (await pingMinecraft(host, p)) {
          return { resultado: 'ok', frase: t('p.diagnostico.oServidorRespondeEm', { endereco }) }
        }
        if (modo === 'playit') {
          return {
            resultado: 'falhou',
            frase: t('p.diagnostico.oTunelDoPlayitGg'),
            conserto: 'religarTunel'
          }
        }
        return {
          resultado: 'falhou',
          frase:
            modo === 'porta'
              ? t('p.diagnostico.naoRespondeuPeloIpPublico')
              : t('p.diagnostico.naoRespondeuEmDesligueE', { endereco })
        }
      }
    },
    {
      id: 'java',
      nome: t('p.diagnostico.java'),
      essencial: false,
      async rodar() {
        const usado = javaDoServidor(info)
        const exe = join(app.getPath('userData'), 'java', String(usado), 'bin', 'java.exe')
        if (!existsSync(exe)) {
          return {
            resultado: 'aviso',
            frase: t('p.diagnostico.oJavaNaoEstaInstalado', { usado })
          }
        }
        const pedido = await javaDaVersao(info.versao)
        return usado >= pedido
          ? {
              resultado: 'ok',
              frase: t('p.diagnostico.javaOMinecraftPedeO', { usado, versao: info.versao, pedido })
            }
          : {
              resultado: 'aviso',
              frase: t('p.diagnostico.oServidorUsaOJava', { usado, versao: info.versao, pedido })
            }
      }
    },
    {
      id: 'pedidos',
      nome: t('p.diagnostico.pedidosParaEntrar'),
      essencial: false,
      async rodar() {
        const n = (await listarPedidos(info)).length
        return n
          ? {
              resultado: 'aviso',
              frase: t('p.diagnostico.voceAprovarAEntradaNa', {
                v:
                  n === 1
                    ? t('p.diagnostico.n1AmigoEspera')
                    : t('p.diagnostico.amigosEsperam', { n })
              }),
              conserto: 'abrirPedidos'
            }
          : { resultado: 'ok', frase: t('p.diagnostico.nenhumAmigoEsperandoAprovacao') }
      }
    },
    {
      id: 'cheio',
      nome: t('p.diagnostico.vagasNoServidor'),
      essencial: false,
      async rodar() {
        const max = Number(props.get('max-players')) || 20
        const online = lerJogadores().length
        return online >= max
          ? {
              resultado: 'aviso',
              frase: t('p.diagnostico.oServidorEstaCheioAumente', { online, max })
            }
          : { resultado: 'ok', frase: t('p.diagnostico.deJogadoresOnline', { online, max }) }
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
  throw new ErroApp(t('p.diagnostico.esseConsertoNaoExiste'))
}
