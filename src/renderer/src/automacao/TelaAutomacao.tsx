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

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function daquiA(ms: number, agora: number): string {
  const min = Math.max(0, Math.round((ms - agora) / 60000))
  if (min < 1) return 'menos de 1 minuto'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`
}

function quando(ms: number): string {
  const d = new Date(ms)
  return `${DIAS_LONGOS[d.getDay()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
      <p className="text-xs text-muted">
        As automações só funcionam com o HubSquare aberto. Ele pode ficar minimizado na bandeja,
        perto do relógio. Tudo o que elas fazem aparece em Registro de eventos › Ações do app.
      </p>

      {aba === 'Desligar quando vazio' && (
        <Secao titulo="Desligar quando vazio">
          <LinhaControle
            rotulo="Desligar quando ninguém estiver jogando"
            ligado={rascunho.vazio.ligado}
            aoMudar={(v) => mudar('vazio', { ligado: v })}
          />
          <Slider
            rotulo="Depois de quanto tempo vazio"
            valor={rascunho.vazio.minutos}
            min={5}
            max={120}
            passo={5}
            aoMudar={(v) => mudar('vazio', { minutos: v })}
            formatar={(v) => `${v} min`}
          />
          <p className="text-[13px] text-muted">
            O tempo só conta com o servidor ligado e ninguém conectado, e recomeça quando alguém
            entra. Ele desliga do jeito normal, com backup.
          </p>
          {dados.config.vazio.ligado && ligado && (
            <p className="text-[13px]">
              {dados.vazioDesligaEm
                ? `Desliga em ${daquiA(dados.vazioDesligaEm, agora)} se ninguém entrar.`
                : 'Tem gente online: a contagem começa quando todos saírem.'}
            </p>
          )}
        </Secao>
      )}

      {aba === 'Reinício' && (
        <Secao titulo="Reinício agendado">
          <LinhaControle
            rotulo="Reiniciar em dias e horário fixos"
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
            Horário
            <Campo
              type="time"
              value={rascunho.reinicio.hora}
              onChange={(e) => e.target.value && mudar('reinicio', { hora: e.target.value })}
              className="w-32"
            />
          </label>
          <p className="text-[13px] text-muted">
            Os jogadores recebem um aviso no chat 5 minutos e 1 minuto antes. O reinício é do jeito
            normal, com backup.
          </p>
          {rascunho.reinicio.ligado && !rascunho.reinicio.dias.length && (
            <Aviso tipo="atencao">Escolha pelo menos um dia.</Aviso>
          )}
          {dados.proximoReinicio && (
            <p className="text-[13px]">
              Próximo reinício: {quando(dados.proximoReinicio)}
              {!ligado && ' (só acontece se o servidor estiver ligado)'}.
            </p>
          )}
        </Secao>
      )}

      {aba === 'Backup agendado' && (
        <Secao titulo="Backup agendado">
          <LinhaControle
            rotulo="Fazer backup com o servidor ligado"
            ligado={rascunho.backup.ligado}
            aoMudar={(v) => mudar('backup', { ligado: v })}
          />
          <Slider
            rotulo="A cada"
            valor={rascunho.backup.horas}
            min={1}
            max={48}
            aoMudar={(v) => mudar('backup', { horas: v })}
            formatar={(v) => `${v} ${v === 1 ? 'hora' : 'horas'}`}
          />
          <Slider
            rotulo="Manter os últimos"
            valor={rascunho.backup.manter}
            min={1}
            max={50}
            aoMudar={(v) => mudar('backup', { manter: v })}
            formatar={(v) => `${v} backups`}
          />
          <p className="text-[13px] text-muted">
            Sem desligar: o app pausa o salvamento do mundo, manda salvar tudo, copia e volta a
            salvar. Os jogadores podem sentir um travadinha de poucos segundos. O &quot;manter os
            últimos&quot; vale para todos os backups, inclusive os de quando o servidor desliga.
          </p>
          {dados.config.backup.ligado && (
            <p className="text-[13px]">
              {dados.backupRodando
                ? 'Fazendo o backup agora...'
                : dados.proximoBackup
                  ? `Próximo backup em ${daquiA(dados.proximoBackup, agora)}.`
                  : 'O primeiro backup acontece depois que o servidor ficar ligado por esse tempo.'}
            </p>
          )}
        </Secao>
      )}

      <div className="flex items-center gap-3">
        <Botao variante="primario" disabled={!mudou || salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : salvo ? 'Salvo!' : 'Salvar'}
        </Botao>
        {mudou && (
          <Botao onClick={() => setRascunho(dados.config)} disabled={salvando}>
            Desfazer
          </Botao>
        )}
      </div>
      {erro && <MensagemErro erro={erro} />}
    </PaginaAjustes>
  )
}
