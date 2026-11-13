import { useEffect, useState } from 'react'
import type { ErroTela } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Aviso, Botao, Campo, Dialogo, Secao } from '../componentes/ui'

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
    <Secao titulo="CurseForge">
      <p className="text-[13px] text-muted">
        Opcional. Com a sua chave da API do CurseForge, a aba Mods › Explorar também procura e
        instala mods, plugins, modpacks e datapacks do CurseForge. A chave é sua: fica só neste PC,
        criptografada pelo Windows, e nunca é mostrada de novo.
      </p>
      {tem && (
        <Aviso tipo="sucesso">
          <span className="flex-1">Chave do CurseForge guardada.</span>
          <Botao variante="perigo" tamanho="pequeno" onClick={() => setApagando(true)}>
            Remover chave
          </Botao>
        </Aviso>
      )}
      {salvou && (
        <p className="text-[13px]">Pronto! Já dá para escolher o CurseForge no Explorar.</p>
      )}

      <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px]">
        <li>
          Leia{' '}
          <a href={COMO_PEDIR} target="_blank" rel="noreferrer" className="text-accent underline">
            como pedir uma chave da API
          </a>{' '}
          e abra o formulário de pedido que está lá (precisa de uma conta no CurseForge).
        </li>
        <li>
          Descreva o uso, por exemplo: &quot;app pessoal que baixa mods para o meu próprio servidor
          e respeita a permissão de distribuição de cada autor&quot;. Aceite os{' '}
          <a href={TERMOS} target="_blank" rel="noreferrer" className="text-accent underline">
            termos da API
          </a>
          .
        </li>
        <li>Espere o e-mail de aprovação (pode levar alguns dias) e copie a chave.</li>
        <li>Cole aqui embaixo e clique em Salvar. O app confere a chave antes de guardar.</li>
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
          aria-label="Chave da API do CurseForge"
          placeholder={tem ? 'Colar uma chave nova' : 'Cole a chave da API aqui'}
          autoComplete="off"
          value={chave}
          maxLength={200}
          onChange={(e) => setChave(e.target.value)}
          className="flex-1"
        />
        <Botao variante="primario" type="submit" disabled={salvando || !chave.trim()}>
          {salvando ? 'Conferindo...' : 'Salvar'}
        </Botao>
      </form>
      {erro && <MensagemErro erro={erro} />}

      <Dialogo
        aberto={apagando}
        titulo="Remover a chave do CurseForge?"
        aoCancelar={() => setApagando(false)}
        acao={{ rotulo: 'Remover', variante: 'perigo', aoClicar: apagar }}
      >
        <p>
          O Explorar deixa de mostrar o CurseForge até você colar a chave de novo. O que já foi
          instalado continua no servidor.
        </p>
      </Dialogo>
    </Secao>
  )
}
