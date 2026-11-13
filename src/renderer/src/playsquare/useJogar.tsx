/* eslint-disable react-refresh/only-export-components -- módulo do hook; os diálogos são internos */
import { useEffect, useState } from 'react'
import type {
  ErroTela,
  EstadoConviteInstalacao,
  Instalacao,
  Progresso,
  ResultadoJogar
} from '../../../shared/tipos'
import { classesBotao } from '../componentes/estilos'
import { Aviso, Botao, CaixaSelecao, Dialogo } from '../componentes/ui'

// Fluxo do Jogar (Fases P1 a P4), usado pelas telas Instalações e Jogar: chama o processo
// principal, mostra o progresso e, conforme a situação, o diálogo certo (falta o launcher,
// launcher aberto, copiar configurações, atualizar, mods proibidos, tudo pronto). As respostas
// dos diálogos se somam a cada nova tentativa.

export type ModoJogar = 'jogar' | 'ligar' | 'instalar'

export type OpcoesJogar = { atualizar?: boolean; recusados?: string[]; copiarOpcoes?: boolean }

const LINK_LAUNCHER = 'https://www.minecraft.net/download'

// Convite com versão nova, ou instalação já montada que mudou desde então: "Atualizar e jogar".
export const desatualizada = (i: Instalacao): boolean =>
  (!!i.convite && i.convite.versaoDisponivel > i.convite.versaoAplicada) ||
  (i.instalada && i.atualizar)

export function useJogar(aoTerminar: () => Promise<void>): {
  // ligar: "Ligar servidor e jogar" (só o dono); o JOGAR normal nunca liga o servidor.
  // modo: "instalar" só monta a pasta (Correção P1); "ligar" é o Ligar servidor e jogar do dono.
  jogar: (i: Instalacao, opcoes?: OpcoesJogar, modo?: ModoJogar) => Promise<void>
  ocupado: string | null
  progresso: Progresso | null
  erro: ErroTela | null
  dialogo: React.ReactNode
} {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [aberto, setAberto] = useState<{
    i: Instalacao
    r: ResultadoJogar
    opcoes?: OpcoesJogar
    modo: ModoJogar
  } | null>(null)
  useEffect(() => window.api.aoProgredir(setProgresso), [])

  async function jogar(
    i: Instalacao,
    opcoes?: OpcoesJogar,
    modo: ModoJogar = 'jogar'
  ): Promise<void> {
    setOcupado(i.id)
    setProgresso(null)
    setErro(null)
    try {
      const r =
        modo === 'instalar'
          ? await window.api.instalarInstalacao(i.id, opcoes)
          : modo === 'ligar'
            ? await window.api.ligarServidorEJogar(i.id, opcoes)
            : await window.api.jogar(i.id, opcoes)
      if (!r.ok) setErro(r.erro)
      else setAberto({ i, r: r.valor, opcoes, modo })
    } finally {
      setOcupado(null)
      await aoTerminar()
    }
  }

  const dialogo = aberto && (
    <DialogoJogar
      i={aberto.i}
      r={aberto.r}
      aoFechar={() => setAberto(null)}
      aoTentar={(opcoes) => {
        const a = aberto
        setAberto(null)
        void jogar(a.i, { ...a.opcoes, ...opcoes }, a.modo)
      }}
      aoAbrirPasta={() => void window.api.abrirPastaInstalacao(aberto.i.id)}
    />
  )
  return { jogar, ocupado, progresso, erro, dialogo }
}

function DialogoJogar({
  i,
  r,
  aoFechar,
  aoTentar,
  aoAbrirPasta
}: {
  i: Instalacao
  r: ResultadoJogar
  aoFechar: () => void
  aoTentar: (opcoes?: OpcoesJogar) => void
  aoAbrirPasta: () => void
}): React.JSX.Element {
  if (r.situacao === 'desatualizada') {
    return <DialogoAtualizar i={i} c={r.convite} aoFechar={aoFechar} aoAtualizar={aoTentar} />
  }
  if (r.situacao === 'proibidos') {
    return (
      <Dialogo
        aberto
        titulo="Mods que o servidor não aceita"
        aoCancelar={aoFechar}
        acao={{ rotulo: 'Tirei, tentar de novo', aoClicar: () => aoTentar() }}
      >
        <p className="text-[13px]">
          O dono do servidor pediu para não usarem estes mods, que estão na pasta mods da instalação
          {i.nome}. É um combinado entre amigos, não um antitrapaça: o PlaySquare só não abre o
          servidor com eles ativos. Tire eles da pasta (ou desative em Conteúdo) e tente de novo:
        </p>
        <ul className="my-2 list-disc pl-5 font-mono text-[13px]">
          {r.arquivos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <Botao className="self-start" onClick={aoAbrirPasta}>
          Abrir pasta
        </Botao>
      </Dialogo>
    )
  }
  if (r.situacao === 'semLauncher') {
    return (
      <Dialogo
        aberto
        titulo="Falta o Minecraft Launcher"
        aoCancelar={aoFechar}
        acao={{ rotulo: 'Já instalei, tentar de novo', aoClicar: () => aoTentar() }}
      >
        <p className="text-[13px]">
          O PlaySquare abre o jogo pelo Minecraft Launcher oficial, com a sua conta. Instale o
          launcher pelo site oficial, entre na sua conta uma vez e volte aqui.
        </p>
        <a
          href={LINK_LAUNCHER}
          target="_blank"
          rel="noreferrer"
          className={`${classesBotao('destaque')} mt-3 self-start`}
        >
          Baixar o Minecraft Launcher
        </a>
      </Dialogo>
    )
  }
  if (r.situacao === 'copiarOpcoes') {
    return (
      <Dialogo
        aberto
        titulo="Copiar suas configurações do jogo?"
        aoCancelar={aoFechar}
        acao={{
          rotulo: 'Copiar e jogar',
          variante: 'primario',
          aoClicar: () => aoTentar({ copiarOpcoes: true })
        }}
      >
        <p className="text-[13px]">
          A instalação {i.nome} tem a própria pasta. Quer trazer as teclas, o vídeo e o som que você
          já usa no Minecraft normal (o arquivo options.txt da pasta .minecraft)? Seus mundos não
          são copiados.
        </p>
        <Botao className="mt-3 self-start" onClick={() => aoTentar({ copiarOpcoes: false })}>
          Não, começar do padrão
        </Botao>
      </Dialogo>
    )
  }
  if (r.situacao === 'launcherAberto') {
    return (
      <Dialogo
        aberto
        titulo="Feche o Minecraft Launcher"
        aoCancelar={aoFechar}
        acao={{ rotulo: 'Já fechei', aoClicar: () => aoTentar() }}
      >
        <p className="text-[13px]">
          Feche o Minecraft Launcher para o HubSquare preparar a instalação {i.nome}. Aberto, ele
          desfaria a mudança. Depois de preparar, o HubSquare abre o launcher de novo sozinho.
        </p>
      </Dialogo>
    )
  }
  return (
    <Dialogo
      aberto
      titulo="Tudo pronto"
      aoCancelar={aoFechar}
      acao={{ rotulo: 'OK', aoClicar: aoFechar }}
    >
      <p className="text-[13px]">{r.frase}</p>
      {r.avisos.map((a) => (
        <Aviso key={a} tipo="atencao">
          {a}
        </Aviso>
      ))}
    </Dialogo>
  )
}

// "Atualizar e jogar": mostra o que entra e o que sai antes de mexer na pasta. Mods "meus",
// mundos, prints e configurações ficam como estão.
function DialogoAtualizar({
  i,
  c,
  aoFechar,
  aoAtualizar
}: {
  i: Instalacao
  c: EstadoConviteInstalacao
  aoFechar: () => void
  aoAtualizar: (opcoes: OpcoesJogar) => void
}): React.JSX.Element {
  const [recusados, setRecusados] = useState(
    () => new Set(c.opcionais.filter((o) => o.recusado).map((o) => o.path))
  )
  const lista = (titulo: string, itens: string[]): React.JSX.Element | null =>
    itens.length ? (
      <div>
        <div className="text-xs font-bold text-muted">{titulo}</div>
        <ul className="max-h-32 list-disc overflow-y-auto pl-5 font-mono text-[13px]">
          {itens.map((n, k) => (
            <li key={`${n}-${k}`}>{n}</li>
          ))}
        </ul>
      </div>
    ) : null
  return (
    <Dialogo
      aberto
      titulo={c.versaoAplicada ? 'O servidor mudou os mods' : `Instalar ${i.nome}`}
      aoCancelar={aoFechar}
      acao={{
        rotulo: 'Atualizar e jogar',
        variante: 'primario',
        aoClicar: () => aoAtualizar({ atualizar: true, recusados: [...recusados] })
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p>
          {c.versaoAplicada
            ? `Versão ${c.versaoAplicada} → ${c.versaoDisponivel}. Para entrar, a instalação precisa ficar igual ao servidor.`
            : 'O app vai baixar o que o servidor pede, dos sites oficiais e com o hash conferido.'}
        </p>
        {lista('Entra', c.entra)}
        {lista('Sai', c.sai)}
        {!c.entra.length && !c.sai.length && <p className="text-muted">Nenhum arquivo muda.</p>}
        {c.opcionais.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-bold text-muted">Recomendados (opcionais)</div>
            {c.opcionais.map((o) => (
              <CaixaSelecao
                key={o.path}
                marcada={!recusados.has(o.path)}
                aoMudar={(marcada) =>
                  setRecusados((r) => {
                    const n = new Set(r)
                    if (marcada) n.delete(o.path)
                    else n.add(o.path)
                    return n
                  })
                }
              >
                {o.path.split('/').pop()}
              </CaixaSelecao>
            ))}
          </div>
        )}
        {c.semLink.length > 0 && (
          <Aviso tipo="atencao">
            Estes mods o app não pode baixar por você: {c.semLink.join(', ')}. Peça o link ao dono.
          </Aviso>
        )}
        <p className="text-xs text-muted">
          Seus mods, mundos, prints e configurações ficam como estão. Só muda o que veio do
          servidor.
        </p>
      </div>
    </Dialogo>
  )
}
