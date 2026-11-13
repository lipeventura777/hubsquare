import { useEffect, useState } from 'react'
import type { ConviteServidor, ErroTela } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import {
  Aviso,
  Botao,
  Campo,
  Dialogo,
  LinhaControle,
  PaginaAjustes,
  Secao
} from '../componentes/ui'
import { IconeCopiar } from '../componentes/icones'

// Conexão › Convites (Fase P2, DESIGN.md seção 6.22.7): o dono gera o convite do servidor ativo.
// O amigo cola o código ou o link no PlaySquare (ou abre o arquivo) e a instalação se monta sozinha.

function Copiavel({ rotulo, texto }: { rotulo: string; texto: string }): React.JSX.Element {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{rotulo}</span>
      <div className="flex items-center gap-3 border border-linha bg-panel-2 p-3">
        <code className="max-h-20 flex-1 overflow-y-auto font-mono text-[13px] font-bold break-all">
          {texto}
        </code>
        <Botao
          variante="destaque"
          onClick={async () => {
            await window.api.copiar(texto)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
          }}
        >
          <IconeCopiar className="h-4 w-4" />
          {copiado ? 'Copiado!' : 'Copiar'}
        </Botao>
      </div>
    </div>
  )
}

export function TelaConvites(): React.JSX.Element {
  const [estado, setEstado] = useState<ConviteServidor | null>(null)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarRevogar, setConfirmarRevogar] = useState(false)
  const [salvo, setSalvo] = useState<string | null>(null)
  const [porta, setPorta] = useState('')
  const [playit, setPlayit] = useState('')

  function receber(r: { ok: true; valor: ConviteServidor } | { ok: false; erro: ErroTela }): void {
    if (!r.ok) return setErro(r.erro)
    setErro(null)
    setEstado(r.valor)
    setPorta(String(r.valor.porta))
    setPlayit(r.valor.enderecoPlayitManifesto ?? '')
  }

  useEffect(() => {
    window.api.estadoConvite().then(receber)
  }, [])

  async function executar(
    acao: () => Promise<{ ok: true; valor: ConviteServidor } | { ok: false; erro: ErroTela }>
  ): Promise<void> {
    setOcupado(true)
    try {
      receber(await acao())
    } finally {
      setOcupado(false)
    }
  }

  if (!estado) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }

  return (
    <PaginaAjustes>
      <div className="flex items-center gap-4 border border-linha bg-panel p-4">
        <p className="flex-1 text-[13px]">
          O convite manda para os amigos a lista do que instalar (só links oficiais, nunca os
          arquivos) e o endereço do servidor. No PlaySquare, eles clicam em Entrar com convite e o
          app monta tudo. Quando você muda os mods, eles veem “Atualizar e jogar”.
        </p>
        {!estado.ativo && (
          <Botao
            variante="primario"
            disabled={ocupado}
            onClick={() => executar(window.api.novoConvite)}
          >
            {ocupado ? 'Preparando...' : 'Convidar amigos'}
          </Botao>
        )}
      </div>

      {erro && <MensagemErro erro={erro} />}
      {estado.erroEscuta && <Aviso tipo="atencao">{estado.erroEscuta}</Aviso>}

      {estado.ativo && (
        <Secao titulo={`Convite (versão ${estado.versao} da lista de mods)`}>
          {estado.codigo ? (
            <>
              <Copiavel rotulo="Código (para ditar ou colar)" texto={estado.codigo} />
              {estado.link && (
                <Copiavel rotulo="Link (para colar no PlaySquare)" texto={estado.link} />
              )}
            </>
          ) : (
            <Aviso tipo="atencao">
              O PC não está em nenhuma rede agora (nem Wi-Fi/cabo, Radmin ou Tailscale). Exporte o
              arquivo de convite para mandar por mensagem.
            </Aviso>
          )}
          <p className="text-xs text-muted">
            O amigo precisa alcançar um destes endereços para receber as mudanças:{' '}
            {estado.enderecosManifesto.join(', ') || 'nenhum'}. O convite não expira. Quem tiver o
            código vê a lista de mods e os seus endereços de conexão.
          </p>
          {/* Fase M4: desligado por padrão; com ele, quem usar o convite entra sem pedir. */}
          <LinhaControle
            rotulo="Aprovar automaticamente quem usar este convite"
            ligado={estado.aprovarAutomatico}
            disabled={ocupado}
            aoMudar={(v) => executar(() => window.api.aprovarAutomatico(v))}
          >
            Desligado, cada amigo que aceitar o convite manda um pedido, e você aprova em Jogadores.
            Ligado, quem tiver o código entra na whitelist sem você aprovar.
          </LinhaControle>
          <div className="flex flex-wrap gap-2">
            <Botao
              disabled={ocupado}
              onClick={async () => {
                const r = await window.api.exportarConvite()
                if (!r.ok) setErro(r.erro)
                else if (r.valor) setSalvo(r.valor)
              }}
            >
              Exportar arquivo de convite
            </Botao>
            <Botao variante="perigo" disabled={ocupado} onClick={() => setConfirmarRevogar(true)}>
              Revogar…
            </Botao>
          </div>
          {salvo && <Aviso tipo="sucesso">Convite salvo em Downloads como {salvo}.</Aviso>}
        </Secao>
      )}

      {/* A lista de mods proibidos fica em Mods › Proibidos para jogadores (Fase P3). */}

      <Secao titulo="Avançado">
        <label className="flex flex-col gap-1 text-[13px]">
          Porta do convite (só leitura)
          <Campo
            inputMode="numeric"
            value={porta}
            onChange={(e) => setPorta(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Túnel do playit.gg para o convite (opcional)
          <Campo
            placeholder="nome.at.ply.gg:12345"
            value={playit}
            onChange={(e) => setPlayit(e.target.value.trim())}
          />
        </label>
        <p className="text-xs text-muted">
          Para amigos fora do Radmin e da sua rede: crie no site do playit.gg um túnel TCP apontando
          para a porta acima e cole o endereço aqui. Pelo túnel o convite passa sem criptografia; os
          mods continuam conferidos pelo hash.
        </p>
        <Botao
          className="self-start"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            const r = await window.api.configurarConvites(Number(porta), playit)
            setOcupado(false)
            if (!r.ok) return setErro(r.erro)
            receber(await window.api.estadoConvite())
          }}
        >
          Salvar
        </Botao>
      </Secao>

      <Dialogo
        aberto={confirmarRevogar}
        titulo="Revogar o convite?"
        aoCancelar={() => setConfirmarRevogar(false)}
        acao={{
          rotulo: 'Revogar e gerar outro',
          variante: 'perigo',
          aoClicar: () => {
            setConfirmarRevogar(false)
            void executar(window.api.novoConvite)
          }
        }}
      >
        <p className="text-[13px]">
          O código, o link e os arquivos de convite de agora param de funcionar. Quem já entrou
          continua com a instalação, mas só recebe as próximas mudanças se você mandar o convite
          novo.
        </p>
        <Botao
          variante="secundario"
          className="mt-3 self-start"
          onClick={() => {
            setConfirmarRevogar(false)
            void executar(window.api.revogarConvite)
          }}
        >
          Só revogar (sem gerar outro)
        </Botao>
      </Dialogo>
    </PaginaAjustes>
  )
}
