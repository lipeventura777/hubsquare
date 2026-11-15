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
import { t } from '../../../shared/i18n'

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
        titulo={t('useJogar.modsQueOServidorNao')}
        aoCancelar={aoFechar}
        acao={{ rotulo: t('useJogar.tireiTentarDeNovo'), aoClicar: () => aoTentar() }}
      >
        <p className="text-[13px]">{t('useJogar.oDonoDoServidorPediu', { nome: i.nome })}</p>
        <ul className="my-2 list-disc pl-5 font-mono text-[13px]">
          {r.arquivos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <Botao className="self-start" onClick={aoAbrirPasta}>
          {t('useJogar.abrirPasta')}
        </Botao>
      </Dialogo>
    )
  }
  if (r.situacao === 'semLauncher') {
    return (
      <Dialogo
        aberto
        titulo={t('useJogar.faltaOMinecraftLauncher')}
        aoCancelar={aoFechar}
        acao={{ rotulo: t('useJogar.jaInstaleiTentarDeNovo'), aoClicar: () => aoTentar() }}
      >
        <p className="text-[13px]">{t('useJogar.oPlaysquareAbreOJogo')}</p>
        <a
          href={LINK_LAUNCHER}
          target="_blank"
          rel="noreferrer"
          className={`${classesBotao('destaque')} mt-3 self-start`}
        >
          {t('useJogar.baixarOMinecraftLauncher')}
        </a>
      </Dialogo>
    )
  }
  if (r.situacao === 'copiarOpcoes') {
    return (
      <Dialogo
        aberto
        titulo={t('useJogar.copiarSuasConfiguracoesDoJogo')}
        aoCancelar={aoFechar}
        acao={{
          rotulo: t('useJogar.copiarEJogar'),
          variante: 'primario',
          aoClicar: () => aoTentar({ copiarOpcoes: true })
        }}
      >
        <p className="text-[13px]">{t('useJogar.aInstalacaoTemAPropria', { nome: i.nome })}</p>
        <Botao className="mt-3 self-start" onClick={() => aoTentar({ copiarOpcoes: false })}>
          {t('useJogar.naoComecarDoPadrao')}
        </Botao>
      </Dialogo>
    )
  }
  if (r.situacao === 'launcherAberto') {
    return (
      <Dialogo
        aberto
        titulo={t('useJogar.fecheOMinecraftLauncher')}
        aoCancelar={aoFechar}
        acao={{ rotulo: t('useJogar.jaFechei'), aoClicar: () => aoTentar() }}
      >
        <p className="text-[13px]">{t('useJogar.fecheOMinecraftLauncherPara', { nome: i.nome })}</p>
      </Dialogo>
    )
  }
  return (
    <Dialogo
      aberto
      titulo={t('useJogar.tudoPronto')}
      aoCancelar={aoFechar}
      acao={{ rotulo: t('useJogar.ok'), aoClicar: aoFechar }}
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
      titulo={
        c.versaoAplicada
          ? t('useJogar.oServidorMudouOsMods')
          : t('useJogar.instalar', { nome: i.nome })
      }
      aoCancelar={aoFechar}
      acao={{
        rotulo: t('useJogar.atualizarEJogar'),
        variante: 'primario',
        aoClicar: () => aoAtualizar({ atualizar: true, recusados: [...recusados] })
      }}
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p>
          {c.versaoAplicada
            ? t('useJogar.versaoParaEntrarAInstalacao', {
                versaoAplicada: c.versaoAplicada,
                versaoDisponivel: c.versaoDisponivel
              })
            : t('useJogar.oAppVaiBaixarO')}
        </p>
        {lista(t('useJogar.entra'), c.entra)}
        {lista(t('useJogar.sai'), c.sai)}
        {!c.entra.length && !c.sai.length && (
          <p className="text-muted">{t('useJogar.nenhumArquivoMuda')}</p>
        )}
        {c.opcionais.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-bold text-muted">
              {t('useJogar.recomendadosOpcionais')}
            </div>
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
            {t('useJogar.estesModsOAppNao')} {c.semLink.join(', ')}
            {t('useJogar.pecaOLinkAoDono')}
          </Aviso>
        )}
        <p className="text-xs text-muted">{t('useJogar.seusModsMundosPrintsE')}</p>
      </div>
    </Dialogo>
  )
}
