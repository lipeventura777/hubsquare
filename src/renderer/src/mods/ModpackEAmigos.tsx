import { useEffect, useState } from 'react'
import type {
  AtualizacaoModpack,
  ErroTela,
  EscolhaConflito,
  InfoServidor,
  PacoteAmigos,
  PlanoAtualizacaoModpack,
  Progresso
} from '../../../shared/tipos'
import { useEnderecoAtivo } from '../conexao/useEnderecoAtivo'
import { MensagemErro } from '../componentes/MensagemErro'
import { BarraProgresso } from '../componentes/movimento'
import { CardPainel } from '../componentes/paineis'
import { Botao, Dialogo, OpcaoRadio } from '../componentes/ui'

// Tela Mods (Fase 17): "Pacote pros amigos" e a atualização do modpack de onde o servidor veio.

function BarraDoProgresso({
  progresso
}: {
  progresso: Progresso | null
}): React.JSX.Element | null {
  if (!progresso) return null
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      <span>{progresso.etapa}</span>
      <BarraProgresso
        rotulo={progresso.etapa}
        valor={progresso.recebido}
        maximo={progresso.total}
      />
    </div>
  )
}

// Texto curto, pronto para colar no Discord.
function textoDiscord(info: InfoServidor, pacote: PacoteAmigos, endereco: string | null): string {
  const linhas = [
    `**Como entrar no servidor ${info.nome}**`,
    `1. Baixe o arquivo "${pacote.arquivo}" que eu mandei aqui.`,
    '2. No app do Modrinth: clique em "+" › "Importar" e escolha o arquivo. No Prism Launcher: "Adicionar instância" › "Importar" e escolha o arquivo.',
    `3. Abra a instância criada, vá em Multijogador › Adicionar servidor e use o endereço: ${endereco ?? '(eu mando o endereço quando ligar o servidor)'}`
  ]
  if (pacote.manuais.length) {
    linhas.push(
      `Esses mods precisam ser baixados à mão e colocados na pasta "mods" da instância: ${pacote.manuais.join(', ')}`
    )
  }
  return linhas.join('\n')
}

export function BotaoPacoteAmigos({
  info,
  ligado
}: {
  info: InfoServidor
  ligado: boolean
}): React.JSX.Element {
  const [gerando, setGerando] = useState(false)
  const [pacote, setPacote] = useState<PacoteAmigos | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [copiado, setCopiado] = useState(false)
  const { endereco } = useEnderecoAtivo(ligado)

  async function gerar(): Promise<void> {
    setGerando(true)
    setErro(null)
    const r = await window.api.gerarPacoteAmigos()
    setGerando(false)
    if (!r.ok) return setErro(r.erro)
    if (r.valor) {
      setCopiado(false)
      setPacote(r.valor)
    }
  }

  const texto = pacote ? textoDiscord(info, pacote, endereco) : ''

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Botao variante="destaque" onClick={gerar} disabled={gerando}>
          {gerando ? 'Gerando...' : 'Pacote pros amigos'}
        </Botao>
        <span className="text-xs text-muted">
          Um arquivo .mrpack com o loader e os mods que seus amigos precisam para entrar.
        </span>
      </div>
      {erro && <MensagemErro erro={erro} />}

      <Dialogo
        aberto={!!pacote}
        titulo="Pacote pronto!"
        aoCancelar={() => setPacote(null)}
        acao={{
          rotulo: copiado ? 'Copiado!' : 'Copiar texto',
          variante: 'destaque',
          aoClicar: () => {
            navigator.clipboard.writeText(texto)
            setCopiado(true)
          }
        }}
      >
        {pacote && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>
              <b>{pacote.arquivo}</b> foi salvo com {pacote.mods}{' '}
              {pacote.mods === 1 ? 'mod' : 'mods'}. Os mods do Modrinth não vão dentro do arquivo: o
              app do amigo baixa direto de lá.
            </p>
            {pacote.extras > 0 && (
              <p>
                Também vão {pacote.extras}{' '}
                {pacote.extras === 1 ? 'item escolhido' : 'itens escolhidos'} no Explorar (shaders,
                resource packs ou mods só do jogador), cada um na sua pasta.
              </p>
            )}
            {pacote.semModrinth.length > 0 && (
              <p className="text-muted">
                Incluídos no arquivo (não estão no Modrinth, mas a licença deixa):{' '}
                {pacote.semModrinth.join(', ')}
              </p>
            )}
            {pacote.manuais.length > 0 && (
              <p className="text-warning">
                ⚠ Baixe manualmente (não estão no Modrinth e a licença não deixa incluir):{' '}
                {pacote.manuais.join(', ')}
              </p>
            )}
            <p>Mande o arquivo junto com este texto:</p>
            <pre className="font-mono max-h-48 overflow-auto bg-console p-3 text-xs whitespace-pre-wrap text-white">
              {texto}
            </pre>
          </div>
        )}
      </Dialogo>
    </div>
  )
}

export function AtualizacaoDoModpack({
  ligado,
  aoAtualizar
}: {
  ligado: boolean
  aoAtualizar: () => Promise<void>
}): React.JSX.Element | null {
  const [nova, setNova] = useState<AtualizacaoModpack | null | undefined>(undefined)
  const [plano, setPlano] = useState<PlanoAtualizacaoModpack | null>(null)
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaConflito>>({})
  const [ocupado, setOcupado] = useState<'planejando' | 'atualizando' | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [feito, setFeito] = useState(false)

  useEffect(() => window.api.aoProgredir(setProgresso), [])

  useEffect(() => {
    let ativo = true
    window.api.atualizacaoModpack().then((r) => {
      if (!ativo) return
      if (r.ok) setNova(r.valor)
      else {
        setNova(null)
        setErro(r.erro)
      }
    })
    return () => {
      ativo = false
    }
  }, [feito])

  async function planejar(): Promise<void> {
    setOcupado('planejando')
    setErro(null)
    const r = await window.api.planejarAtualizacaoModpack()
    setOcupado(null)
    setProgresso(null)
    if (!r.ok) return setErro(r.erro)
    // Na dúvida, o arquivo do usuário fica.
    setEscolhas(Object.fromEntries(r.valor.conflitos.map((c) => [c.caminho, 'meu' as const])))
    setPlano(r.valor)
  }

  async function atualizar(): Promise<void> {
    if (!plano) return
    setOcupado('atualizando')
    setErro(null)
    const r = await window.api.atualizarModpack(plano.token, escolhas)
    setOcupado(null)
    setProgresso(null)
    setPlano(null)
    if (!r.ok) return setErro(r.erro)
    setFeito((f) => !f)
    await aoAtualizar()
  }

  if (nova === undefined) return null
  if (!nova) return erro ? <MensagemErro erro={erro} /> : null

  return (
    <>
      <CardPainel
        titulo={`Modpack ${nova.nome}`}
        acoes={
          <Botao
            variante="primario"
            tamanho="pequeno"
            disabled={!!ocupado || ligado}
            title={ligado ? 'Desligue o servidor para atualizar o modpack' : undefined}
            onClick={planejar}
          >
            {ocupado === 'planejando' ? 'Verificando...' : 'Atualizar o modpack'}
          </Botao>
        }
      >
        <p className="text-[13px]">
          {nova.versaoAtual} → <b>{nova.versaoNova}</b>
        </p>
        <p className="mt-1 text-xs text-muted">
          {ligado
            ? 'Desligue o servidor para atualizar.'
            : 'O app faz backup antes. O mundo, as configurações que você mudou e os mods que você pôs à parte ficam como estão.'}
        </p>
        {ocupado === 'planejando' && <BarraDoProgresso progresso={progresso} />}
        {erro && (
          <div className="mt-3">
            <MensagemErro erro={erro} />
          </div>
        )}
      </CardPainel>

      <Dialogo
        aberto={!!plano}
        titulo={`Atualizar para ${plano?.versaoNova ?? ''}?`}
        aoCancelar={() => !ocupado && setPlano(null)}
        acao={{
          rotulo: ocupado === 'atualizando' ? 'Atualizando...' : 'Atualizar',
          variante: 'primario',
          ocupado: ocupado === 'atualizando',
          aoClicar: atualizar
        }}
      >
        {plano && (
          <div className="flex flex-col gap-3 text-[13px]">
            <p>
              {plano.escrever}{' '}
              {plano.escrever === 1
                ? 'arquivo novo ou atualizado'
                : 'arquivos novos ou atualizados'}
              {plano.apagar > 0 && `, ${plano.apagar} que o pack não usa mais (saem)`}.
              {plano.trocaLoader && ` O loader muda para a versão ${plano.trocaLoader}.`} Antes, o
              app faz backup do mundo e do resto do servidor.
            </p>
            {plano.conflitos.length > 0 && (
              <>
                <p className="font-bold">
                  {plano.conflitos.length === 1
                    ? 'Um arquivo seu bate com o pack. O que fazer?'
                    : `${plano.conflitos.length} arquivos seus batem com o pack. O que fazer com cada um?`}
                </p>
                <ul className="flex max-h-64 flex-col gap-2 overflow-auto">
                  {plano.conflitos.map((c) => (
                    <li key={c.caminho} className="border border-linha p-2">
                      <p className="font-mono truncate text-xs" title={c.caminho}>
                        {c.caminho}
                      </p>
                      <p className="text-xs text-muted">{c.motivo}</p>
                      <div className="flex gap-4">
                        {(['meu', 'pack'] as const).map((e) => (
                          <OpcaoRadio
                            key={e}
                            nome={c.caminho}
                            marcada={escolhas[c.caminho] === e}
                            aoEscolher={() => setEscolhas((a) => ({ ...a, [c.caminho]: e }))}
                          >
                            {e === 'meu' ? 'Manter o meu' : 'Usar o do pack'}
                          </OpcaoRadio>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ocupado === 'atualizando' && <BarraDoProgresso progresso={progresso} />}
          </div>
        )}
      </Dialogo>
    </>
  )
}
