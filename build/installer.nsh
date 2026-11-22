; Fase E2: o appId mudou de com.servsquare.app para com.hubsquare.app, e o electron-builder dá a cada
; appId um GUID fixo (UUID v5 do appId). O do app antigo é sempre este:
!define GUID_SERVSQUARE "25d213bb-a111-5e44-928a-57493112e8f2"

; Instalar por cima da 1.4.0: quando o app novo ainda não tem a própria entrada de desinstalação,
; o uninstallOldVersion do electron-builder usa esta segunda chave. Ele roda o desinstalador antigo
; do mesmo jeito que numa atualização normal (/S /KEEP_APP_DATA --updated): tira os arquivos do
; programa, os atalhos e a entrada em Aplicativos instalados, e nunca apaga os dados do usuário
; (pastas de dados e Documentos). Roda depois de fechar o app aberto e antes de copiar os arquivos.
!ifndef UNINSTALL_REGISTRY_KEY_2
  !define UNINSTALL_REGISTRY_KEY_2 "Software\Microsoft\Windows\CurrentVersion\Uninstall\${GUID_SERVSQUARE}"
!endif

; Sugere a pasta onde a 1.4.0 estava instalada (os atalhos "Jogar" que o usuário criou apontam para
; o .exe de lá). A página de modo de instalação lê a pasta desta chave do app novo.
!macro customInit
  ReadRegStr $R0 HKCU "Software\${GUID_SERVSQUARE}" InstallLocation
  ReadRegStr $R1 HKCU "Software\${APP_GUID}" InstallLocation
  ${If} $R0 != ""
  ${AndIf} $R1 == ""
    WriteRegStr HKCU "Software\${APP_GUID}" InstallLocation "$R0"
    StrCpy $INSTDIR "$R0"
  ${EndIf}
!macroend

; Fase I1: o instalador é em português ou inglês (escolha no começo) e deixa a escolha para o
; app em idioma-instalador.txt na pasta de dados (1046 = português, 1033 = inglês). O app só usa
; esse arquivo como sugestão na primeira abertura; depois vale o que estiver em idioma.json.
; Fase E2: vai para %APPDATA%\HubSquare, ou para %APPDATA%\ServSquare enquanto só ela existe (criar
; a pasta nova antes da hora impediria a migração, que só move quando a nova ainda não existe).
!macro customInstall
  StrCpy $R2 "$APPDATA\HubSquare"
  ${IfNot} ${FileExists} "$APPDATA\HubSquare\*.*"
  ${AndIf} ${FileExists} "$APPDATA\ServSquare\*.*"
    StrCpy $R2 "$APPDATA\ServSquare"
  ${EndIf}
  CreateDirectory "$R2"
  FileOpen $0 "$R2\idioma-instalador.txt" w
  FileWrite $0 "$LANGUAGE"
  FileClose $0
!macroend
