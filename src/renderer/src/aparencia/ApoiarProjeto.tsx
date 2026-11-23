import { useEffect, useState } from 'react'
import { encode } from 'uqr'
import { idiomaAtual, t } from '../../../shared/i18n'
import type { DadosApoio } from '../../../shared/tipos'
import { CardPainel } from '../componentes/paineis'
import { Botao, Dialogo } from '../componentes/ui'
import { IconeApoio } from '../icones'

// Engrenagem › Sobre › "Apoiar o projeto". Doação é opcional e nunca libera nada: aqui só há um
// cartão discreto e, ao clicar, um diálogo com o QR do Pix (feito no próprio app, sem internet) e o
// botão de copiar. Nunca abre sozinho. Pix só funciona em banco brasileiro: em português o Pix
// sempre aparece; em inglês o item só existe com o GitHub Sponsors ativo (o Pix fica recolhido).

// QR preto puro sobre branco com margem de 4 módulos (o padrão manda); cada módulo mede 4 px
// inteiros, então as bordas ficam nítidas e o leitor do banco lê bem nos dois temas.
const MODULO = 4
const MARGEM = 4
function QrPix({ texto }: { texto: string }): React.JSX.Element {
  const { data, size } = encode(texto, { ecc: 'M' })
  const total = size + MARGEM * 2
  let tracado = ''
  data.forEach((linha, y) => {
    for (let x = 0; x < size;) {
      if (!linha[x]) {
        x++
        continue
      }
      let fim = x
      while (fim < size && linha[fim]) fim++
      tracado += `M${x + MARGEM} ${y + MARGEM}h${fim - x}v1h${x - fim}z`
      x = fim
    }
  })
  const lado = total * MODULO
  // O SVG é montado aqui mesmo, só com números e o nosso texto fixo (como na tela do celular).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${lado}" height="${lado}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${tracado}" fill="#000000"/></svg>`
  return (
    <div
      role="img"
      aria-label={t('apoio.qr')}
      data-qr-pix=""
      className="shrink-0 overflow-hidden rounded-(--raio-pequeno)"
      style={{ width: lado, height: lado }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function BlocoPix({
  dados,
  copiado,
  aoCopiar
}: {
  dados: DadosApoio
  copiado: boolean
  aoCopiar?: () => void // só quando o diálogo não tem o botão de copiar como ação principal
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3">
      <QrPix texto={dados.pix} />
      <p className="max-w-[40ch] text-center text-xs text-muted">{t('apoio.escanear')}</p>
      <div className="w-full text-center text-xs">
        <p>{t('apoio.titular', { nome: dados.titular, cidade: dados.cidade })}</p>
        <p className="text-muted">
          {t('apoio.chave')}: <span className="font-mono select-all">{dados.chave}</span>
        </p>
      </div>
      {aoCopiar && (
        <Botao onClick={aoCopiar}>{copiado ? t('apoio.copiado') : t('apoio.copiar')}</Botao>
      )}
    </div>
  )
}

export function ApoiarProjeto(): React.JSX.Element | null {
  const [dados, setDados] = useState<DadosApoio | null>(null)
  const [aberto, setAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const portugues = idiomaAtual() === 'pt-BR'

  useEffect(() => {
    void window.api.dadosApoio().then((r) => r.ok && setDados(r.valor))
  }, [])
  useEffect(() => {
    if (!copiado) return
    const id = setTimeout(() => setCopiado(false), 2500)
    return () => clearTimeout(id)
  }, [copiado])

  // Em inglês, sem Sponsors não há nada para mostrar (nada de seção vazia nem link quebrado).
  if (!dados || (!portugues && !dados.sponsorsAtivo)) return null

  const copiar = async (): Promise<void> => {
    await window.api.copiar(dados.pix)
    setCopiado(true)
  }
  const sponsors = (
    <Botao onClick={() => void window.api.abrirSponsors()}>{t('apoio.sponsors')}</Botao>
  )

  return (
    <>
      <CardPainel titulo={t('apoio.titulo')}>
        <div className="flex flex-col items-start gap-3 text-[13px]">
          <p className="max-w-[65ch]">{t('apoio.frase')}</p>
          <Botao onClick={() => setAberto(true)}>
            <IconeApoio className="h-4 w-4" />
            {t('apoio.abrir')}
          </Botao>
        </div>
      </CardPainel>
      <Dialogo
        aberto={aberto}
        titulo={t('apoio.titulo')}
        aoCancelar={() => setAberto(false)}
        rotuloCancelar={t('apoio.fechar')}
        // Português: o Pix é a ação principal e o Sponsors (se ativo) é a alternativa. Inglês: o
        // Sponsors é a ação principal e o Pix fica recolhido para quem tem banco no Brasil.
        acao={
          portugues
            ? {
                rotulo: copiado ? t('apoio.copiado') : t('apoio.copiar'),
                aoClicar: () => void copiar()
              }
            : { rotulo: t('apoio.sponsors'), aoClicar: () => void window.api.abrirSponsors() }
        }
        extra={portugues && dados.sponsorsAtivo ? sponsors : undefined}
      >
        <div className="placa-vidro flex max-h-[70vh] flex-col gap-4 overflow-auto p-4">
          <p className="font-bold">{t('apoio.frase')}</p>
          {portugues ? (
            <BlocoPix dados={dados} copiado={copiado} />
          ) : (
            <details className="rounded-(--raio-pequeno) bg-panel-2 p-3">
              <summary className="cursor-pointer font-bold">{t('apoio.brasileiro')}</summary>
              <div className="mt-3">
                <BlocoPix dados={dados} copiado={copiado} aoCopiar={() => void copiar()} />
              </div>
            </details>
          )}
          <p aria-live="polite" className="sr-only">
            {copiado ? t('apoio.copiado') : ''}
          </p>
        </div>
      </Dialogo>
    </>
  )
}
