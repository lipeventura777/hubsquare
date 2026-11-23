import { FORMAS, type NomeIcone } from './formas'

// Fase P7: todo ícone do app sai daqui (DESIGN.md 6.11). Traço de 2 px em currentColor, pontas
// quadradas e cantos vivos, numa grade de 24 px. Decorativo por padrão (aria-hidden): quem usa
// um ícone sozinho num botão dá o nome ao botão (aria-label).

type Props = { className?: string; cheio?: boolean }

export function Icone({
  nome,
  className = 'h-4 w-4',
  cheio = false
}: Props & { nome: NomeIcone }): React.JSX.Element {
  const f = FORMAS[nome] as { traco: string; detalhe?: string }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {/* "Cheio" (coração, comida, favorito marcado): a forma inteira preenchida. */}
      {cheio ? (
        <path d={f.traco} fill="currentColor" stroke="none" />
      ) : (
        f.detalhe && <path d={f.detalhe} fill="currentColor" stroke="none" opacity={0.25} />
      )}
      <path d={f.traco} />
    </svg>
  )
}

export const IconeLogo = (p: Props): React.JSX.Element => <Icone nome="logo" {...p} />
export const IconeServidor = (p: Props): React.JSX.Element => <Icone nome="servidor" {...p} />
export const IconeConfiguracoes = (p: Props): React.JSX.Element => (
  <Icone nome="configuracoes" {...p} />
)
export const IconeConsole = (p: Props): React.JSX.Element => <Icone nome="console" {...p} />
export const IconeComandos = (p: Props): React.JSX.Element => <Icone nome="comandos" {...p} />
export const IconeRegistro = (p: Props): React.JSX.Element => <Icone nome="registro" {...p} />
export const IconeJogadores = (p: Props): React.JSX.Element => <Icone nome="jogadores" {...p} />
export const IconeSoftware = (p: Props): React.JSX.Element => <Icone nome="software" {...p} />
export const IconeMods = (p: Props): React.JSX.Element => <Icone nome="mods" {...p} />
export const IconeArquivos = (p: Props): React.JSX.Element => <Icone nome="arquivos" {...p} />
export const IconeMundos = (p: Props): React.JSX.Element => <Icone nome="mundos" {...p} />
export const IconeBackups = (p: Props): React.JSX.Element => <Icone nome="backups" {...p} />
export const IconeDesempenho = (p: Props): React.JSX.Element => <Icone nome="desempenho" {...p} />
export const IconeAutomacao = (p: Props): React.JSX.Element => <Icone nome="automacao" {...p} />
export const IconeIntegracoes = (p: Props): React.JSX.Element => <Icone nome="integracoes" {...p} />
export const IconeConexao = (p: Props): React.JSX.Element => <Icone nome="conexao" {...p} />
export const IconeEngrenagem = (p: Props): React.JSX.Element => <Icone nome="engrenagem" {...p} />
export const IconeInstalacoes = (p: Props): React.JSX.Element => <Icone nome="instalacoes" {...p} />
export const IconeExplorar = (p: Props): React.JSX.Element => <Icone nome="explorar" {...p} />
export const IconeConteudo = (p: Props): React.JSX.Element => <Icone nome="conteudo" {...p} />
export const IconeCaptura = (p: Props): React.JSX.Element => <Icone nome="captura" {...p} />
export const IconeLigar = (p: Props): React.JSX.Element => <Icone nome="ligar" {...p} />
export const IconeParar = (p: Props): React.JSX.Element => <Icone nome="parar" {...p} />
export const IconeCopiar = (p: Props): React.JSX.Element => <Icone nome="copiar" {...p} />
export const IconeEditar = (p: Props): React.JSX.Element => <Icone nome="editar" {...p} />
export const IconeRecarregar = (p: Props): React.JSX.Element => <Icone nome="recarregar" {...p} />
export const IconeOlho = (p: Props): React.JSX.Element => <Icone nome="olho" {...p} />
export const IconeOlhoRiscado = (p: Props): React.JSX.Element => <Icone nome="olhoRiscado" {...p} />
export const IconeCadeado = (p: Props): React.JSX.Element => <Icone nome="cadeado" {...p} />
export const IconeFavorito = (p: Props): React.JSX.Element => <Icone nome="favorito" {...p} />
export const IconeMaisAcoes = (p: Props): React.JSX.Element => <Icone nome="maisAcoes" {...p} />
export const IconeMenu = (p: Props): React.JSX.Element => <Icone nome="menu" {...p} />
export const IconeFechar = (p: Props): React.JSX.Element => <Icone nome="fechar" {...p} />
export const IconeSeta = (p: Props): React.JSX.Element => <Icone nome="seta" {...p} />
export const IconeSubmenu = (p: Props): React.JSX.Element => <Icone nome="submenu" {...p} />
export const IconeVoltar = (p: Props): React.JSX.Element => <Icone nome="voltar" {...p} />
export const IconeRecolher = (p: Props): React.JSX.Element => <Icone nome="recolher" {...p} />
export const IconeOk = (p: Props): React.JSX.Element => <Icone nome="ok" {...p} />
export const IconeErro = (p: Props): React.JSX.Element => <Icone nome="erro" {...p} />
export const IconeAtencao = (p: Props): React.JSX.Element => <Icone nome="atencao" {...p} />
export const IconeCoracao = (p: Props): React.JSX.Element => <Icone nome="coracao" {...p} />
export const IconeApoio = (p: Props): React.JSX.Element => <Icone nome="apoio" {...p} />
export const IconeComida = (p: Props): React.JSX.Element => <Icone nome="comida" {...p} />
export const IconePocao = (p: Props): React.JSX.Element => <Icone nome="pocao" {...p} />
