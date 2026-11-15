import { useCallback, useEffect, useState } from 'react'
import type { ErroTela, MundoServidor, Resultado } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { dataHora, tamanho } from '../componentes/formato'
import { IconeMundos } from '../componentes/icones'
import { Esqueleto } from '../componentes/movimento'
import {
  Aviso,
  Botao,
  Campo,
  CardImagem,
  Dialogo,
  EstadoVazio,
  PaginaAjustes,
  Secao
} from '../componentes/ui'
import { useEstadoServidor } from '../servidor/comandos'
import { t } from '../../../shared/i18n'

type Pedido = { tipo: 'apagar'; mundo: MundoServidor } | { tipo: 'gerar' }

// Tela Mundos: um card por mundo (DESIGN.md, 6.6). Toda ação pede o servidor desligado;
// apagar e gerar novo fazem backup antes (no processo principal).
export function TelaMundos(): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [mundos, setMundos] = useState<MundoServidor[] | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [nome, setNome] = useState('')
  const [seed, setSeed] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const desligado = estado === 'desligado'

  const carregar = useCallback(async (): Promise<void> => {
    const r = await window.api.listarMundos()
    if (r.ok) setMundos(r.valor)
    else setErro(r.erro)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura da lista
    void carregar()
  }, [carregar])

  async function executar<T>(
    acao: () => Promise<Resultado<T>>,
    sucesso: (valor: T) => string | null
  ): Promise<void> {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(false)
    setPedido(null)
    if (!r.ok) setErro(r.erro)
    else setAviso(sucesso(r.valor))
    await carregar()
  }

  function confirmar(): void {
    if (pedido?.tipo === 'apagar') {
      const alvo = pedido.mundo.nome
      void executar(
        () => window.api.apagarMundo(alvo),
        () => t('telaMundos.mundoApagadoOBackupDele', { alvo })
      )
    } else if (pedido?.tipo === 'gerar') {
      const novo = nome.trim()
      void executar(
        () => window.api.gerarMundo(novo, seed),
        () => t('telaMundos.mundoEscolhidoEleECriado', { novo })
      )
    }
  }

  const importado = (n: string | null): string | null =>
    n && t('telaMundos.mundoImportadoUseTornarAtivo', { n })

  return (
    <PaginaAjustes largo>
      <Secao titulo={t('telaMundos.mundos')}>
        <p className="text-[13px] text-muted">
          {t('telaMundos.oMundoAtivoEO')}
          {!desligado && t('telaMundos.desligueOServidorParaMexer')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="primario"
            disabled={!desligado || ocupado}
            onClick={() => {
              setNome('')
              setSeed('')
              setPedido({ tipo: 'gerar' })
            }}
          >
            {t('telaMundos.gerarMundoNovo')}
          </Botao>
          <Botao
            disabled={!desligado || ocupado}
            onClick={() => void executar(() => window.api.importarMundoDePasta(), importado)}
          >
            {t('telaMundos.importarPasta')}
          </Botao>
          <Botao
            disabled={!desligado || ocupado}
            onClick={() => void executar(() => window.api.importarMundoDeZip(), importado)}
          >
            {t('telaMundos.importarZip')}
          </Botao>
        </div>
        {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}
        {erro && <MensagemErro erro={erro} />}

        {!mundos ? (
          !erro && <Esqueleto linhas={3} />
        ) : mundos.length === 0 ? (
          <EstadoVazio
            icone={<IconeMundos />}
            titulo={t('telaMundos.nenhumMundoAinda')}
            texto={t('telaMundos.oServidorCriaOPrimeiro')}
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {mundos.map((m, i) => (
              <CardImagem
                key={m.nome}
                ordem={i}
                etiqueta={m.ativo ? t('telaMundos.mundoAtual') : t('telaMundos.mundo')}
                titulo={m.nome}
                info={`${dataHora(m.data)} · ${tamanho(m.tamanho)}`}
              >
                {m.versao && (
                  <p className="text-xs text-muted">
                    {t('telaMundos.versao', { versao: m.versao })}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {!m.ativo && (
                    <Botao
                      tamanho="pequeno"
                      variante="primario"
                      disabled={!desligado || ocupado}
                      onClick={() =>
                        void executar(
                          () => window.api.ativarMundo(m.nome),
                          () => t('telaMundos.agoraEOMundoAtivo', { nome: m.nome })
                        )
                      }
                    >
                      {t('telaMundos.tornarAtivo')}
                    </Botao>
                  )}
                  <Botao
                    tamanho="pequeno"
                    disabled={!desligado || ocupado}
                    onClick={() =>
                      void executar(
                        () => window.api.exportarMundo(m.nome),
                        (salvo) => (salvo ? t('telaMundos.mundoExportado', { nome: m.nome }) : null)
                      )
                    }
                  >
                    {t('telaMundos.exportarZip')}
                  </Botao>
                  {!m.ativo && (
                    <Botao
                      tamanho="pequeno"
                      variante="perigo"
                      disabled={!desligado || ocupado}
                      onClick={() => setPedido({ tipo: 'apagar', mundo: m })}
                    >
                      {t('telaMundos.apagar')}
                    </Botao>
                  )}
                </div>
              </CardImagem>
            ))}
          </div>
        )}
      </Secao>

      <Dialogo
        aberto={!!pedido}
        titulo={
          pedido?.tipo === 'apagar'
            ? t('telaMundos.apagar2', { nome: pedido.mundo.nome })
            : t('telaMundos.gerarMundoNovo')
        }
        aoCancelar={() => setPedido(null)}
        acao={{
          rotulo: pedido?.tipo === 'apagar' ? t('telaMundos.apagar') : t('telaMundos.gerar'),
          variante: pedido?.tipo === 'apagar' ? 'perigo' : 'primario',
          aoClicar: confirmar,
          ocupado,
          desabilitado: pedido?.tipo === 'gerar' && !nome.trim()
        }}
      >
        {pedido?.tipo === 'apagar' ? (
          <p>{t('telaMundos.oMundoEONether')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[13px]">
              {t('telaMundos.nomeDaPastaDoMundo')}
              <Campo autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              {t('telaMundos.seedOpcional')}
              <Campo
                value={seed}
                placeholder={t('telaMundos.deixeVazioParaUmaSeed')}
                onChange={(e) => setSeed(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted">{t('telaMundos.antesOAppFazUm')}</p>
          </div>
        )}
      </Dialogo>
    </PaginaAjustes>
  )
}
