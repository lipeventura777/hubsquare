import { useEffect, useState } from 'react'
import type { ErroTela, RelatoEnviado, TipoRelato } from '../../../shared/tipos'
import { MensagemErro } from './MensagemErro'
import { Aviso, Botao, CaixaSelecao, Dialogo, Selecao } from './ui'
import { t } from '../../../shared/i18n'

// Relatar problema (Fase R1): tipo, descrição e "Incluir relatório de erro". Com um clique abre o
// programa de e-mail ou a issue nova do GitHub já preenchidos; o app não envia nada sozinho.
// Abre pelo Sobre, pelos erros (Ver detalhes) e pelo item da bandeja.

const EVENTO = 'servsquare:relatar'
const LIMITE = 5000 // o mesmo de LIMITE_DESCRICAO em relatarRegras.ts

export function BotaoRelatar({ pequeno = false }: { pequeno?: boolean }): React.JSX.Element {
  return (
    <Botao
      tamanho={pequeno ? 'pequeno' : undefined}
      onClick={() => window.dispatchEvent(new Event(EVENTO))}
    >
      {t('relatar.relatarProblema')}
    </Botao>
  )
}

// Fica montado uma vez (main.tsx) e abre o diálogo quando alguém pede.
export function RelatarGlobal(): React.JSX.Element | null {
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    const abrir = (): void => setAberto(true)
    window.addEventListener(EVENTO, abrir)
    const parar = window.api.aoRelatar(abrir)
    return () => {
      window.removeEventListener(EVENTO, abrir)
      parar()
    }
  }, [])
  return aberto ? <DialogoRelatar aoFechar={() => setAberto(false)} /> : null
}

function DialogoRelatar({ aoFechar }: { aoFechar: () => void }): React.JSX.Element {
  const [tipo, setTipo] = useState<TipoRelato>('bug')
  const [descricao, setDescricao] = useState('')
  // null: segue o tipo (marcada para bug e problema) até a pessoa mexer na caixa.
  const [incluirEscolhido, setIncluir] = useState<boolean | null>(null)
  const incluir = incluirEscolhido ?? (tipo === 'bug' || tipo === 'problema')
  const [enviando, setEnviando] = useState<'email' | 'github' | null>(null)
  const [enviado, setEnviado] = useState<(RelatoEnviado & { via: 'email' | 'github' }) | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  async function enviar(via: 'email' | 'github'): Promise<void> {
    setErro(null)
    setEnviando(via)
    const r = await window.api.enviarRelato({ tipo, descricao, incluirRelatorio: incluir, via })
    setEnviando(null)
    if (!r.ok) return setErro(r.erro)
    setEnviado({ ...r.valor, via })
  }

  async function copiarEmail(email: string): Promise<void> {
    await navigator.clipboard.writeText(email)
    setCopiado(true)
  }

  async function mostrarArquivo(): Promise<void> {
    const r = await window.api.mostrarRelatorio()
    if (!r.ok) setErro(r.erro)
  }

  const semTexto = !descricao.trim()
  const ocupado = enviando !== null

  return (
    <Dialogo
      aberto
      titulo={t('relatar.relatarProblema')}
      aoCancelar={aoFechar}
      extra={
        <Botao onClick={() => void enviar('github')} disabled={ocupado || semTexto}>
          {enviando === 'github' ? t('relatar.preparando') : t('relatar.abrirNoGithub')}
        </Botao>
      }
      acao={{
        rotulo: enviando === 'email' ? t('relatar.preparando') : t('relatar.enviarPorEmail'),
        ocupado,
        desabilitado: semTexto,
        aoClicar: () => void enviar('email')
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p>{t('relatar.explicacao')}</p>
        <label className="flex flex-col gap-1">
          {t('relatar.tipo')}
          <Selecao
            value={tipo}
            disabled={ocupado}
            onChange={(e) => setTipo(e.target.value as TipoRelato)}
          >
            <option value="bug">{t('relatar.tipoBug')}</option>
            <option value="problema">{t('relatar.tipoProblema')}</option>
            <option value="sugestao">{t('relatar.tipoSugestao')}</option>
            <option value="outro">{t('relatar.tipoOutro')}</option>
          </Selecao>
        </label>
        <label className="flex flex-col gap-1">
          {t('relatar.descricao')}
          <textarea
            value={descricao}
            maxLength={LIMITE}
            disabled={ocupado}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={t('relatar.descricaoDica')}
            className="h-32 resize-y border border-linha bg-panel-2 px-3 py-2 text-[13px] text-texto outline-none focus:border-accent"
          />
        </label>
        <div>
          <CaixaSelecao marcada={incluir} aoMudar={setIncluir} disabled={ocupado}>
            {t('relatar.incluirRelatorio')}
          </CaixaSelecao>
          <p className="text-xs text-muted">{t('relatar.incluirRelatorioDica')}</p>
        </div>

        {enviado?.via === 'email' && enviado.abriu && (
          <Aviso tipo="sucesso">
            <span>
              {enviado.arquivo
                ? t('relatar.anexeOArquivo', { arquivo: enviado.arquivo })
                : t('relatar.emailAberto')}
            </span>
          </Aviso>
        )}
        {enviado?.via === 'email' && !enviado.abriu && (
          <Aviso tipo="atencao">
            <span className="flex flex-col gap-2">
              <span>{t('relatar.semProgramaDeEmail')}</span>
              <span className="flex flex-wrap items-center gap-2">
                <code className="font-mono">{enviado.email}</code>
                <Botao
                  tamanho="pequeno"
                  variante="destaque"
                  onClick={() => void copiarEmail(enviado.email)}
                >
                  {copiado ? t('relatar.copiado') : t('relatar.copiar')}
                </Botao>
              </span>
            </span>
          </Aviso>
        )}
        {enviado?.via === 'github' && (
          <Aviso tipo="sucesso">
            <span>
              {enviado.arquivo
                ? t('relatar.arrasteParaAIssue', { arquivo: enviado.arquivo })
                : t('relatar.issueAberta')}
            </span>
          </Aviso>
        )}
        {enviado?.arquivo && (enviado.via === 'github' || !enviado.abriu) && (
          <div>
            <Botao tamanho="pequeno" onClick={() => void mostrarArquivo()}>
              {t('relatar.mostrarOArquivo')}
            </Botao>
          </div>
        )}
        {erro && <MensagemErro erro={erro} />}
      </div>
    </Dialogo>
  )
}
