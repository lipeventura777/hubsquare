import type { PlanoMods, Progresso } from '../../../shared/tipos'
import { BarraProgresso } from '../componentes/movimento'
import { Dialogo } from '../componentes/ui'
import { ListaManuais, separarManuais } from './ListaManuais'

function tamanho(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Confirmação de instalação de mods/plugins (Fase 16): arquivos, dependências, avisos e o que
// é "Baixe pelo site". Usada nos detalhes do Explorar e na aba Instalados.
export function DialogoPlano({
  plano,
  titulo,
  extras,
  ocupado,
  progresso,
  aoCancelar,
  aoConfirmar
}: {
  plano: PlanoMods | null
  titulo: string
  extras: string
  ocupado: boolean
  progresso: Progresso | null
  aoCancelar: () => void
  aoConfirmar: () => void
}): React.JSX.Element {
  const { comAssistente, soLink } = separarManuais(plano?.manuais ?? [])
  return (
    <Dialogo
      aberto={!!plano}
      titulo={titulo}
      aoCancelar={() => !ocupado && aoCancelar()}
      acao={{
        rotulo: ocupado ? 'Instalando...' : 'Instalar',
        variante: 'primario',
        ocupado,
        desabilitado: (!plano?.itens.length && !comAssistente.length) || !!plano?.problemas.length,
        aoClicar: aoConfirmar
      }}
    >
      {plano && (
        <div className="flex flex-col gap-3 text-[13px]">
          {plano.itens.length > 0 && (
            <>
              <p>Estes arquivos vão para a pasta {extras}:</p>
              <ul className="flex max-h-56 flex-col gap-1 overflow-auto">
                {plano.itens.map((i) => (
                  <li key={i.arquivo} className="flex items-baseline gap-2">
                    <b className="truncate" title={i.titulo}>
                      {i.titulo}
                    </b>
                    <span className="text-muted">{i.versao}</span>
                    {i.dependencia && <span className="bg-panel-2 px-1.5 text-xs">necessário</span>}
                    <span className="ml-auto shrink-0 text-xs text-muted">
                      {tamanho(i.tamanho)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!plano.itens.length && !comAssistente.length && !plano.problemas.length && (
            <p className="text-muted">Nada novo para instalar: já está tudo no servidor.</p>
          )}
          {plano.avisos.map((a) => (
            <p key={a} className="text-warning">
              ⚠ {a}
            </p>
          ))}
          {plano.problemas.map((p) => (
            <p key={p} className="text-danger">
              {p} Por isso, nada vai ser instalado.
            </p>
          ))}
          <ListaManuais
            itens={comAssistente}
            texto={`O autor não deixa outros apps baixarem estes arquivos. Ao instalar, a janela Downloads necessários abre a página de cada um; baixe pelo navegador e o app põe na pasta ${extras} sozinho:`}
          />
          <ListaManuais
            itens={soLink}
            texto={`O autor não deixa outros apps baixarem estes arquivos. Baixe pelo site e coloque na pasta ${extras}:`}
          />
          {ocupado && progresso && (
            <BarraProgresso
              rotulo={progresso.etapa}
              valor={progresso.recebido}
              maximo={progresso.total}
            />
          )}
        </div>
      )}
    </Dialogo>
  )
}
