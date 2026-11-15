import { useEffect, useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Aviso, Botao, Campo, Dialogo, Secao } from '../componentes/ui'
import { t } from '../../../shared/i18n'

const COMO_PEDIR =
  'https://support.curseforge.com/en/support/solutions/articles/9000208346-about-the-curseforge-api-and-how-to-apply-for-a-key'
const TERMOS =
  'https://support.curseforge.com/en/support/solutions/articles/9000207405-curse-forge-3rd-party-api-terms-and-conditions'

// Opções › Integrações (Fase 24): a chave da API do CurseForge de cada usuário.
// A chave vai para o processo principal, que guarda criptografada; ela nunca volta para a tela.
export function IntegracaoCurseForge(): React.JSX.Element {
  const [tem, setTem] = useState<boolean | null>(null)
  const [chave, setChave] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvou, setSalvou] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    window.api.temChaveCurseForge().then((r) => setTem(r.ok && r.valor))
  }, [])

  async function salvar(): Promise<void> {
    setSalvando(true)
    setErro(null)
    setSalvou(false)
    const r = await window.api.salvarChaveCurseForge(chave)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    setChave('')
    setTem(true)
    setSalvou(true)
  }

  async function apagar(): Promise<void> {
    const r = await window.api.apagarChaveCurseForge()
    setApagando(false)
    setSalvou(false)
    if (!r.ok) return setErro(r.erro)
    setTem(false)
  }

  return (
    <Secao titulo={t('integracaoCurseForge.curseforge')}>
      <p className="text-[13px] text-muted">{t('integracaoCurseForge.opcionalComASuaChave')}</p>
      {tem && (
        <Aviso tipo="sucesso">
          <span className="flex-1">{t('integracaoCurseForge.chaveDoCurseforgeGuardada')}</span>
          <Botao variante="perigo" tamanho="pequeno" onClick={() => setApagando(true)}>
            {t('integracaoCurseForge.removerChave')}
          </Botao>
        </Aviso>
      )}
      {salvou && <p className="text-[13px]">{t('integracaoCurseForge.prontoJaDaParaEscolher')}</p>}

      <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px]">
        <li>
          {t('integracaoCurseForge.leia')}{' '}
          <a href={COMO_PEDIR} target="_blank" rel="noreferrer" className="text-accent underline">
            {t('integracaoCurseForge.comoPedirUmaChaveDa')}
          </a>{' '}
          {t('integracaoCurseForge.eAbraOFormularioDe')}
        </li>
        <li>
          {t('integracaoCurseForge.descrevaOUsoPorExemplo')}{' '}
          <a href={TERMOS} target="_blank" rel="noreferrer" className="text-accent underline">
            {t('integracaoCurseForge.termosDaApi')}
          </a>
          .
        </li>
        <li>{t('integracaoCurseForge.espereOEMailDe')}</li>
        <li>{t('integracaoCurseForge.coleAquiEmbaixoEClique')}</li>
      </ol>

      <form
        className="flex max-w-[560px] gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
      >
        <Campo
          type="password"
          aria-label={t('integracaoCurseForge.chaveDaApiDoCurseforge')}
          placeholder={
            tem
              ? t('integracaoCurseForge.colarUmaChaveNova')
              : t('integracaoCurseForge.coleAChaveDaApi')
          }
          autoComplete="off"
          value={chave}
          maxLength={200}
          onChange={(e) => setChave(e.target.value)}
          className="flex-1"
        />
        <Botao variante="primario" type="submit" disabled={salvando || !chave.trim()}>
          {salvando ? t('integracaoCurseForge.conferindo') : t('integracaoCurseForge.salvar')}
        </Botao>
      </form>
      {erro && <MensagemErro erro={erro} />}

      <Dialogo
        aberto={apagando}
        titulo={t('integracaoCurseForge.removerAChaveDoCurseforge')}
        aoCancelar={() => setApagando(false)}
        acao={{ rotulo: t('integracaoCurseForge.remover'), variante: 'perigo', aoClicar: apagar }}
      >
        <p>{t('integracaoCurseForge.oExplorarDeixaDeMostrar')}</p>
      </Dialogo>
    </Secao>
  )
}
