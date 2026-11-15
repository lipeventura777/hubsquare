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
import { t } from '../../../shared/i18n'

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
          {copiado ? t('telaConvites.copiado') : t('telaConvites.copiar')}
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
        <p className="flex-1 text-[13px]">{t('telaConvites.oConviteMandaParaOs')}</p>
        {!estado.ativo && (
          <Botao
            variante="primario"
            disabled={ocupado}
            onClick={() => executar(window.api.novoConvite)}
          >
            {ocupado ? t('telaConvites.preparando') : t('telaConvites.convidarAmigos')}
          </Botao>
        )}
      </div>

      {erro && <MensagemErro erro={erro} />}
      {estado.erroEscuta && <Aviso tipo="atencao">{estado.erroEscuta}</Aviso>}

      {estado.ativo && (
        <Secao titulo={t('telaConvites.conviteVersaoDaListaDe', { versao: estado.versao })}>
          {estado.codigo ? (
            <>
              <Copiavel rotulo={t('telaConvites.codigoParaDitarOuColar')} texto={estado.codigo} />
              {estado.link && (
                <Copiavel
                  rotulo={t('telaConvites.linkParaColarNoPlaysquare')}
                  texto={estado.link}
                />
              )}
            </>
          ) : (
            <Aviso tipo="atencao">{t('telaConvites.oPcNaoEstaEm')}</Aviso>
          )}
          <p className="text-xs text-muted">
            {t('telaConvites.oAmigoPrecisaAlcancarUm')}{' '}
            {estado.enderecosManifesto.join(', ') || 'nenhum'}
            {t('telaConvites.oConviteNaoExpiraQuem')}
          </p>
          {/* Fase M4: desligado por padrão; com ele, quem usar o convite entra sem pedir. */}
          <LinhaControle
            rotulo={t('telaConvites.aprovarAutomaticamenteQuemUsarEste')}
            ligado={estado.aprovarAutomatico}
            disabled={ocupado}
            aoMudar={(v) => executar(() => window.api.aprovarAutomatico(v))}
          >
            {t('telaConvites.desligadoCadaAmigoQueAceitar')}
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
              {t('telaConvites.exportarArquivoDeConvite')}
            </Botao>
            <Botao variante="perigo" disabled={ocupado} onClick={() => setConfirmarRevogar(true)}>
              {t('telaConvites.revogar')}
            </Botao>
          </div>
          {salvo && (
            <Aviso tipo="sucesso">{t('telaConvites.conviteSalvoEmDownloadsComo', { salvo })}</Aviso>
          )}
        </Secao>
      )}

      {/* A lista de mods proibidos fica em Mods › Proibidos para jogadores (Fase P3). */}

      <Secao titulo={t('telaConvites.avancado')}>
        <label className="flex flex-col gap-1 text-[13px]">
          {t('telaConvites.portaDoConviteSoLeitura')}
          <Campo
            inputMode="numeric"
            value={porta}
            onChange={(e) => setPorta(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          {t('telaConvites.tunelDoPlayitGgPara')}
          <Campo
            placeholder={t('telaConvites.exNomeAtPlyGg')}
            value={playit}
            onChange={(e) => setPlayit(e.target.value.trim())}
          />
        </label>
        <p className="text-xs text-muted">{t('telaConvites.paraAmigosForaDoRadmin')}</p>
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
          {t('telaConvites.salvar')}
        </Botao>
      </Secao>

      <Dialogo
        aberto={confirmarRevogar}
        titulo={t('telaConvites.revogarOConvite')}
        aoCancelar={() => setConfirmarRevogar(false)}
        acao={{
          rotulo: t('telaConvites.revogarEGerarOutro'),
          variante: 'perigo',
          aoClicar: () => {
            setConfirmarRevogar(false)
            void executar(window.api.novoConvite)
          }
        }}
      >
        <p className="text-[13px]">{t('telaConvites.oCodigoOLinkE')}</p>
        <Botao
          variante="secundario"
          className="mt-3 self-start"
          onClick={() => {
            setConfirmarRevogar(false)
            void executar(window.api.revogarConvite)
          }}
        >
          {t('telaConvites.soRevogarSemGerarOutro')}
        </Botao>
      </Dialogo>
    </PaginaAjustes>
  )
}
