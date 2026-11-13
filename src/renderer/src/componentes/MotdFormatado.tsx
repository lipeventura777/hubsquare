import { lerMotd } from '../../../shared/motd'

// MOTD com as cores e estilos dos códigos §, em até duas linhas. Usa a fonte do app.
export function MotdFormatado({
  motd,
  corPadrao,
  className = ''
}: {
  motd: string
  corPadrao?: string // cor do texto sem código (null nos trechos)
  className?: string
}): React.JSX.Element {
  return (
    <span className={className}>
      {motd
        .split('\n')
        .slice(0, 2)
        .map((linha, i) => (
          <span key={i} className="block truncate">
            {lerMotd(linha).map((t, j) => (
              <span
                key={j}
                style={{
                  color: t.cor ?? corPadrao,
                  fontWeight: t.negrito ? 700 : undefined,
                  fontStyle: t.italico ? 'italic' : undefined,
                  textDecoration:
                    [t.sublinhado && 'underline', t.riscado && 'line-through']
                      .filter(Boolean)
                      .join(' ') || undefined
                }}
              >
                {t.texto}
              </span>
            ))}
            {/* linha vazia ainda ocupa espaço */}
            {!linha && ' '}
          </span>
        ))}
    </span>
  )
}
