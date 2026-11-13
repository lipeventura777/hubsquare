import { useEffect, useState } from 'react'
import {
  NOMES_TIPOS,
  type AnaliseHubserver,
  type ErroTela,
  type ItemServidor,
  type PreviaPassar,
  type Progresso
} from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso, Esqueleto } from '../componentes/movimento'
import { Aviso, Botao, CaixaSelecao, Campo, Dialogo, OpcaoRadio } from '../componentes/ui'

// Passar o servidor (Fase M7): gerar o .hubserver para um amigo hospedar, e receber um de volta.

const tamanho = (bytes: number): string =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
    : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`

// "Passar para outro amigo…" (menu do servidor, servidor desligado).
export function DialogoPassar({
  servidor,
  aoFechar
}: {
  servidor: ItemServidor
  aoFechar: (gerou: boolean) => void
}): React.JSX.Element {
  const [previa, setPrevia] = useState<PreviaPassar | null>(null)
  const [para, setPara] = useState('')
  const [gerando, setGerando] = useState(false)
  const [pronto, setPronto] = useState<string | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)

  useEffect(() => {
    let ativo = true
    window.api.previaPassar(servidor.id).then((r) => {
      if (!ativo) return
      if (r.ok) setPrevia(r.valor)
      else setErro(r.erro)
    })
    return () => {
      ativo = false
    }
  }, [servidor.id])

  async function gerar(): Promise<void> {
    if (pronto) return aoFechar(true)
    setErro(null)
    setGerando(true)
    const r = await window.api.passarServidor(servidor.id, para)
    setGerando(false)
    if (!r.ok) return setErro(r.erro)
    if (r.valor) setPronto(`${r.valor.arquivo} (${tamanho(r.valor.tamanho)})`)
  }

  return (
    <Dialogo
      aberto
      titulo={`Passar ${servidor.nome} para outro amigo`}
      aoCancelar={() => aoFechar(!!pronto)}
      acao={{
        rotulo: pronto ? 'Fechar' : gerando ? 'Gerando...' : 'Gerar arquivo .hubserver',
        ocupado: gerando,
        desabilitado: !pronto && (!previa || !para.trim()),
        aoClicar: gerar
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        {pronto ? (
          <Aviso tipo="sucesso">
            <span>
              Pronto: <b>{pronto}</b>. Mande o arquivo para o seu amigo. Ele abre em ServSquare ›
              Servidores › Receber servidor (.hubserver). Quando ele mandar de volta, abra do mesmo
              jeito e escolha &quot;Atualizar o meu servidor com este mundo&quot;.
            </span>
          </Aviso>
        ) : (
          <>
            <Aviso tipo="atencao">
              <span>
                Enquanto seu amigo hospeda, não ligue este servidor aqui, ou os dois mundos vão se
                separar.
              </span>
            </Aviso>
            <label className="flex flex-col gap-1">
              Quem vai hospedar?
              <Campo
                value={para}
                maxLength={32}
                placeholder="Nome do amigo"
                onChange={(e) => setPara(e.target.value)}
                autoFocus
              />
            </label>
            {!previa && !erro && <Esqueleto linhas={3} />}
            {previa && (
              <>
                <p>
                  Tamanho: cerca de <b>{tamanho(previa.tamanho)}</b> antes de compactar.
                </p>
                <div>
                  <p className="font-bold">Vai no arquivo</p>
                  <ul className="mt-1 list-disc pl-5">
                    {previa.vai.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                    {previa.mods > 0 && (
                      <li>{previa.mods} mods/plugins como link oficial (o amigo baixa)</li>
                    )}
                    {previa.manuais > 0 && (
                      <li>
                        {previa.manuais} mods baixados à mão: só a página oficial (o amigo baixa
                        pelo assistente)
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-bold">Fica neste PC</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {previa.fica.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
                {previa.semLink.length > 0 && (
                  <p className="text-muted">
                    Sem link oficial (o amigo precisa pôr à mão): {previa.semLink.join(', ')}
                  </p>
                )}
              </>
            )}
          </>
        )}
        {erro && <MensagemErro erro={erro} />}
      </div>
    </Dialogo>
  )
}

// "Receber servidor (.hubserver)": novo servidor, ou o meu atualizado (mesmo id) ou uma cópia.
export function ReceberServidor({ bloqueado }: { bloqueado: boolean }): React.JSX.Element {
  const [analise, setAnalise] = useState<AnaliseHubserver | null>(null)
  const [modo, setModo] = useState<'novo' | 'copia' | 'atualizar'>('novo')
  const [nome, setNome] = useState('')
  const [eula, setEula] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [recebendo, setRecebendo] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [erroDialogo, setErroDialogo] = useState<ErroTela | null>(null)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  async function escolher(): Promise<void> {
    setErro(null)
    setAbrindo(true)
    const r = await window.api.analisarHubserver()
    setAbrindo(false)
    if (!r.ok) return setErro(r.erro)
    if (!r.valor) return
    const a = r.valor
    setAnalise(a)
    setModo(a.mesmo ? (a.mesmo.motivoSemAtualizar ? 'copia' : 'atualizar') : 'novo')
    setNome(a.mesmo ? `${a.nome} (cópia)`.slice(0, 32) : a.nome)
    setEula(false)
    setErroDialogo(null)
  }

  async function receber(): Promise<void> {
    if (!analise) return
    setErroDialogo(null)
    setRecebendo(true)
    const r = await window.api.receberHubserver({
      token: analise.token,
      modo,
      nome,
      aceitouEula: eula
    })
    setRecebendo(false)
    setProgresso(null)
    if (!r.ok) return setErroDialogo(r.erro)
    location.reload() // todas as telas leem o servidor de novo
  }

  const criaNovo = modo !== 'atualizar'
  return (
    <>
      <Botao onClick={escolher} disabled={bloqueado || abrindo} className="w-full">
        {abrindo ? 'Abrindo...' : 'Receber servidor (.hubserver)'}
      </Botao>
      {erro && (
        <div className="mt-3">
          <MensagemErro erro={erro} />
        </div>
      )}
      <Dialogo
        aberto={analise !== null}
        titulo="Receber servidor"
        aoCancelar={() => !recebendo && setAnalise(null)}
        acao={{
          rotulo: recebendo
            ? 'Recebendo...'
            : modo === 'atualizar'
              ? 'Fazer backup e atualizar'
              : 'Criar servidor',
          variante: modo === 'atualizar' ? 'perigo' : undefined,
          ocupado: recebendo,
          desabilitado: criaNovo && (!eula || !nome.trim()),
          aoClicar: receber
        }}
      >
        {analise && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>
              Em <b>{analise.arquivo}</b>: o servidor <b>{analise.nome}</b> (
              {NOMES_TIPOS[analise.tipo]} {analise.versao}), com {analise.mods} mods/plugins para
              baixar pelos links oficiais.
              {analise.manuais > 0 &&
                ` ${analise.manuais} arquivos precisam ser baixados à mão (o app abre a janela Downloads necessários).`}
            </p>
            {analise.semLink.length > 0 && (
              <p className="text-muted">
                Sem link oficial (ponha à mão depois): {analise.semLink.join(', ')}
              </p>
            )}
            {analise.mesmo && (
              <div className="flex flex-col gap-1">
                <p>
                  Esse é o seu servidor <b>{analise.mesmo.nome}</b>, que voltou.
                </p>
                <OpcaoRadio
                  nome="modo-receber"
                  marcada={modo === 'atualizar'}
                  aoEscolher={() => !analise.mesmo?.motivoSemAtualizar && setModo('atualizar')}
                >
                  Atualizar o meu servidor com este mundo (backup protegido antes)
                </OpcaoRadio>
                {analise.mesmo.motivoSemAtualizar && (
                  <p className="pl-6 text-xs text-muted">{analise.mesmo.motivoSemAtualizar}</p>
                )}
                <OpcaoRadio
                  nome="modo-receber"
                  marcada={modo === 'copia'}
                  aoEscolher={() => setModo('copia')}
                >
                  Criar uma cópia (outro servidor, separado do meu)
                </OpcaoRadio>
              </div>
            )}
            {modo === 'atualizar' && (
              <p>
                O mundo, as configurações e as listas de jogadores de <b>{analise.mesmo?.nome}</b>{' '}
                vão ser trocados pelos do arquivo. Antes, o app faz um backup protegido (com
                cadeado) em Cópias de segurança.
              </p>
            )}
            {criaNovo && (
              <>
                <label className="flex flex-col gap-1">
                  Nome do servidor
                  <Campo value={nome} maxLength={32} onChange={(e) => setNome(e.target.value)} />
                </label>
                <p className="text-xs text-muted">
                  Você vira o dono: os convites são seus (gere em Conexão › Convites).
                </p>
                <CaixaSelecao marcada={eula} aoMudar={setEula} disabled={recebendo}>
                  Li e aceito o{' '}
                  <a
                    href="https://aka.ms/MinecraftEULA"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    EULA do Minecraft
                  </a>
                </CaixaSelecao>
              </>
            )}
            {recebendo && progresso && (
              <div className="flex flex-col gap-1">
                <span>{progresso.etapa}</span>
                <BarraProgresso
                  rotulo={progresso.etapa}
                  valor={progresso.recebido}
                  maximo={progresso.total}
                />
              </div>
            )}
            {erroDialogo && <MensagemErro erro={erroDialogo} />}
          </div>
        )}
      </Dialogo>
    </>
  )
}
