import { useEffect, useState } from 'react'
import type { ErroTela, OpcoesRelatorio, RelatorioGerado } from '../../../shared/tipos'
import { MensagemErro } from './MensagemErro'
import { Esqueleto } from './movimento'
import { Aviso, Botao, CaixaSelecao, Dialogo, Selecao } from './ui'
import { t } from '../../../shared/i18n'

// Relatório de erro (Fase M8): um .zip sem segredos na Área de Trabalho, para quem for ajudar
// entender o problema. Antes de salvar, mostra o que vai e deixa tirar itens. Nada é enviado.

const NENHUM = ''

export function BotaoRelatorio({ pequeno = false }: { pequeno?: boolean }): React.JSX.Element {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Botao tamanho={pequeno ? 'pequeno' : undefined} onClick={() => setAberto(true)}>
        {t('relatorioErro.gerarRelatorioDeErro')}
      </Botao>
      {aberto && <DialogoRelatorio aoFechar={() => setAberto(false)} />}
    </>
  )
}

function DialogoRelatorio({ aoFechar }: { aoFechar: () => void }): React.JSX.Element {
  const [opcoes, setOpcoes] = useState<OpcoesRelatorio | null>(null)
  const [servidor, setServidor] = useState(NENHUM)
  const [instalacao, setInstalacao] = useState(NENHUM)
  const [tirar, setTirar] = useState<string[]>([])
  const [gerando, setGerando] = useState(false)
  const [pronto, setPronto] = useState<RelatorioGerado | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    let ativo = true
    window.api.opcoesRelatorio().then((r) => {
      if (!ativo) return
      if (!r.ok) return setErro(r.erro)
      setOpcoes(r.valor)
      setServidor(r.valor.servidorPadrao ?? NENHUM)
      setInstalacao(r.valor.instalacaoPadrao ?? NENHUM)
    })
    return () => {
      ativo = false
    }
  }, [])

  async function gerar(): Promise<void> {
    if (pronto) return aoFechar()
    setErro(null)
    setGerando(true)
    const r = await window.api.gerarRelatorio({
      servidorId: servidor || null,
      instalacaoId: instalacao || null,
      tirar
    })
    setGerando(false)
    if (!r.ok) return setErro(r.erro)
    setPronto(r.valor)
  }

  async function abrirPasta(): Promise<void> {
    const r = await window.api.abrirPastaDoRelatorio()
    if (!r.ok) setErro(r.erro)
  }

  const marcar = (id: string, vai: boolean): void =>
    setTirar((t) => (vai ? t.filter((x) => x !== id) : [...t, id]))

  return (
    <Dialogo
      aberto
      titulo={t('relatorioErro.relatorioDeErro')}
      aoCancelar={aoFechar}
      acao={{
        rotulo: pronto
          ? t('relatorioErro.fechar')
          : gerando
            ? t('relatorioErro.gerando')
            : t('relatorioErro.salvarNaAreaDeTrabalho'),
        ocupado: gerando,
        desabilitado: !opcoes,
        aoClicar: gerar
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        {pronto ? (
          <>
            <Aviso tipo="sucesso">
              <span>
                {t('relatorioErro.salvoNaAreaDeTrabalho')} <b>{pronto.arquivo}</b>
                {t('relatorioErro.mandeEsseArquivoParaQuem')}
              </span>
            </Aviso>
            <div>
              <Botao tamanho="pequeno" onClick={abrirPasta}>
                {t('relatorioErro.abrirPasta')}
              </Botao>
            </div>
          </>
        ) : (
          <>
            <p>{t('relatorioErro.juntaNumZipOQue')}</p>
            {!opcoes && !erro && <Esqueleto linhas={4} />}
            {opcoes && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    {t('relatorioErro.servidor')}
                    <Selecao value={servidor} onChange={(e) => setServidor(e.target.value)}>
                      <option value={NENHUM}>{t('relatorioErro.nenhum')}</option>
                      {opcoes.servidores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </Selecao>
                  </label>
                  <label className="flex flex-col gap-1">
                    {t('relatorioErro.instalacaoDoJogo')}
                    <Selecao value={instalacao} onChange={(e) => setInstalacao(e.target.value)}>
                      <option value={NENHUM}>{t('relatorioErro.nenhuma')}</option>
                      {opcoes.instalacoes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </Selecao>
                  </label>
                </div>
                <div>
                  <p className="font-bold">{t('relatorioErro.vaiNoRelatorio')}</p>
                  <ul className="mt-1 flex flex-col">
                    {opcoes.itens.map((i) => (
                      <li key={i.id}>
                        <CaixaSelecao
                          marcada={!tirar.includes(i.id)}
                          aoMudar={(vai) => marcar(i.id, vai)}
                          disabled={gerando}
                        >
                          {i.nome} <span className="text-muted">· {i.descricao}</span>
                        </CaixaSelecao>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted">{t('relatorioErro.sempreVaiUmLeiaMe')}</p>
                </div>
              </>
            )}
          </>
        )}
        {erro && <MensagemErro erro={erro} />}
      </div>
    </Dialogo>
  )
}
