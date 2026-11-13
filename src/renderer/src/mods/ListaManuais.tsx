import type { ArquivoManual } from '../../../shared/tipos'

// Fase D: com nome e hash, o assistente Downloads necessários reconhece o arquivo baixado;
// sem eles (ex.: link externo do Hangar), fica só o link.
// eslint-disable-next-line react-refresh/only-export-components
export function separarManuais(itens: ArquivoManual[]): {
  comAssistente: ArquivoManual[]
  soLink: ArquivoManual[]
} {
  const tem = (i: ArquivoManual): boolean => !!i.arquivo && !!(i.sha1 || i.md5)
  return { comAssistente: itens.filter(tem), soLink: itens.filter((i) => !tem(i)) }
}

// "Baixe pelo site" (Fase 24): arquivos que o autor não deixa outros apps baixarem.
// O app só mostra o link da página oficial; nunca baixa por outro caminho.
export function ListaManuais({
  itens,
  texto
}: {
  itens: ArquivoManual[]
  texto: string
}): React.JSX.Element | null {
  if (!itens.length) return null
  return (
    <div className="flex flex-col gap-1 text-[13px] text-warning">
      <p>⚠ {texto}</p>
      <ul className="flex max-h-40 flex-col gap-1 overflow-auto">
        {itens.map((i) => (
          <li key={i.url + i.titulo}>
            <a href={i.url} target="_blank" rel="noreferrer" className="underline">
              {i.titulo} — baixe pelo site
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
