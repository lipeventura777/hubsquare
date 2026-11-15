import { useCallback, useEffect, useState } from 'react'
import type { Automacao, ErroTela, EstadoAutomacao } from '../../../shared/tipos'
import { MensagemErro } from '../componentes/MensagemErro'
import { Esqueleto } from '../componentes/movimento'
import {
  Aviso,
  Botao,
  CaixaSelecao,
  Campo,
  LinhaControle,
  PaginaAjustes,
  Secao,
  Slider
} from '../componentes/ui'
import { useEstadoServidor } from '../servidor/comandos'
import { hora, t } from '../../../shared/i18n'

const DIAS = [
  t('telaAutomacao.dom'),
  t('telaAutomacao.seg'),
  t('telaAutomacao.ter'),
  t('telaAutomacao.qua'),
  t('telaAutomacao.qui'),
  t('telaAutomacao.sex'),
  t('telaAutomacao.sab')
]
const DIAS_LONGOS = [
  t('telaAutomacao.domingo'),
  t('telaAutomacao.segunda'),
  t('telaAutomacao.terca'),
  t('telaAutomacao.quarta'),
  t('telaAutomacao.quinta'),
  t('telaAutomacao.sexta'),
  t('telaAutomacao.sabado')
]

function daquiA(ms: number, agora: number): string {
  const min = Math.max(0, Math.round((ms - agora) / 60000))
  if (min < 1) return t('telaAutomacao.menosDe1Minuto')
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h${min % 60 ? t('telaAutomacao.min', { v: min % 60 }) : ''}`
}

function quando(ms: number): string {
  const d = new Date(ms)
  return `${DIAS_LONGOS[d.getDay()]}, ${hora(d)}`
}

// Tela Automação (Fase 19). Cada aba salva só a parte dela.
export function TelaAutomacao({ aba }: { aba: string }): React.JSX.Element {
  const { estado } = useEstadoServidor()
  const [dados, setDados] = useState<EstadoAutomacao | null>(null)
  const [rascunho, setRascunho] = useState<Automacao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<ErroTela | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  const ler = useCallback(async (): Promise<void> => {
    const r = await window.api.lerAutomacao()
    if (!r.ok) return setErro(r.erro)
    setDados(r.valor)
    setRascunho((atual) => atual ?? r.valor.config)
    setAgora(Date.now())
  }, [])

  // Os contadores ("desliga em 12 min") se atualizam sozinhos.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura
    void ler()
    const id = setInterval(() => void ler(), 10_000)
    return () => clearInterval(id)
  }, [ler])

  if (!dados || !rascunho) {
    return (
      <PaginaAjustes>
        {erro ? <MensagemErro erro={erro} /> : <Esqueleto linhas={4} />}
      </PaginaAjustes>
    )
  }

  const mudou = JSON.stringify(rascunho) !== JSON.stringify(dados.config)
  const ligado = estado === 'ligado'

  async function salvar(): Promise<void> {
    if (!rascunho) return
    setSalvando(true)
    setErro(null)
    const r = await window.api.salvarAutomacao(rascunho)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    setDados(r.valor)
    setRascunho(r.valor.config)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const mudar = <K extends keyof Automacao>(parte: K, valor: Partial<Automacao[K]>): void =>
    setRascunho((r) => (r ? { ...r, [parte]: { ...r[parte], ...valor } } : r))

  return (
    <PaginaAjustes>
      <p className="text-xs text-muted">{t('telaAutomacao.asAutomacoesSoFuncionamCom')}</p>

      {aba === 'Desligar quando vazio' && (
        <Secao titulo={t('telaAutomacao.desligarQuandoVazio')}>
          <LinhaControle
            rotulo={t('telaAutomacao.desligarQuandoNinguemEstiverJogando')}
            ligado={rascunho.vazio.ligado}
            aoMudar={(v) => mudar('vazio', { ligado: v })}
          />
          <Slider
            rotulo={t('telaAutomacao.depoisDeQuantoTempoVazio')}
            valor={rascunho.vazio.minutos}
            min={5}
            max={120}
            passo={5}
            aoMudar={(v) => mudar('vazio', { minutos: v })}
            formatar={(v) => `${v} min`}
          />
          <p className="text-[13px] text-muted">{t('telaAutomacao.oTempoSoContaCom')}</p>
          {dados.config.vazio.ligado && ligado && (
            <p className="text-[13px]">
              {dados.vazioDesligaEm
                ? t('telaAutomacao.desligaEmSeNinguemEntrar', {
                    daquiA: daquiA(dados.vazioDesligaEm, agora)
                  })
                : t('telaAutomacao.temGenteOnlineAContagem')}
            </p>
          )}
        </Secao>
      )}

      {aba === 'Reinício' && (
        <Secao titulo={t('telaAutomacao.reinicioAgendado')}>
          <LinhaControle
            rotulo={t('telaAutomacao.reiniciarEmDiasEHorario')}
            ligado={rascunho.reinicio.ligado}
            aoMudar={(v) => mudar('reinicio', { ligado: v })}
          />
          <div className="flex flex-wrap gap-3">
            {DIAS.map((d, i) => (
              <CaixaSelecao
                key={d}
                marcada={rascunho.reinicio.dias.includes(i)}
                aoMudar={(m) =>
                  mudar('reinicio', {
                    dias: m
                      ? [...rascunho.reinicio.dias, i].sort()
                      : rascunho.reinicio.dias.filter((x) => x !== i)
                  })
                }
              >
                {d}
              </CaixaSelecao>
            ))}
          </div>
          <label className="flex items-center gap-3 text-[13px]">
            {t('telaAutomacao.horario')}
            <Campo
              type="time"
              value={rascunho.reinicio.hora}
              onChange={(e) => e.target.value && mudar('reinicio', { hora: e.target.value })}
              className="w-32"
            />
          </label>
          <p className="text-[13px] text-muted">{t('telaAutomacao.osJogadoresRecebemUmAviso')}</p>
          {rascunho.reinicio.ligado && !rascunho.reinicio.dias.length && (
            <Aviso tipo="atencao">{t('telaAutomacao.escolhaPeloMenosUmDia')}</Aviso>
          )}
          {dados.proximoReinicio && (
            <p className="text-[13px]">
              {t('telaAutomacao.proximoReinicio', { quando: quando(dados.proximoReinicio) })}
              {!ligado && t('telaAutomacao.soAconteceSeOServidor')}.
            </p>
          )}
        </Secao>
      )}

      {aba === 'Backup agendado' && (
        <Secao titulo={t('telaAutomacao.backupAgendado')}>
          <LinhaControle
            rotulo={t('telaAutomacao.fazerBackupComOServidor')}
            ligado={rascunho.backup.ligado}
            aoMudar={(v) => mudar('backup', { ligado: v })}
          />
          <Slider
            rotulo={t('telaAutomacao.aCada')}
            valor={rascunho.backup.horas}
            min={1}
            max={48}
            aoMudar={(v) => mudar('backup', { horas: v })}
            formatar={(v) => `${v} ${v === 1 ? t('telaAutomacao.hora') : t('telaAutomacao.horas')}`}
          />
          <Slider
            rotulo={t('telaAutomacao.manterOsUltimos')}
            valor={rascunho.backup.manter}
            min={1}
            max={50}
            aoMudar={(v) => mudar('backup', { manter: v })}
            formatar={(v) => `${v} backups`}
          />
          <p className="text-[13px] text-muted">{t('telaAutomacao.semDesligarOAppPausa')}</p>
          {dados.config.backup.ligado && (
            <p className="text-[13px]">
              {dados.backupRodando
                ? t('telaAutomacao.fazendoOBackupAgora')
                : dados.proximoBackup
                  ? t('telaAutomacao.proximoBackupEm', {
                      daquiA: daquiA(dados.proximoBackup, agora)
                    })
                  : t('telaAutomacao.oPrimeiroBackupAconteceDepois')}
            </p>
          )}
        </Secao>
      )}

      <div className="flex items-center gap-3">
        <Botao variante="primario" disabled={!mudou || salvando} onClick={salvar}>
          {salvando
            ? t('telaAutomacao.salvando')
            : salvo
              ? t('telaAutomacao.salvo')
              : t('telaAutomacao.salvar')}
        </Botao>
        {mudou && (
          <Botao onClick={() => setRascunho(dados.config)} disabled={salvando}>
            {t('telaAutomacao.desfazer')}
          </Botao>
        )}
      </div>
      {erro && <MensagemErro erro={erro} />}
    </PaginaAjustes>
  )
}
