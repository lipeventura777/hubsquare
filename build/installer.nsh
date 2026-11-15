; Fase I1: o instalador é em português ou inglês (escolha no começo) e deixa a escolha para o
; app em %APPDATA%\ServSquare\idioma-instalador.txt (1046 = português, 1033 = inglês). O app só
; usa esse arquivo como sugestão na primeira abertura; depois vale o que estiver em idioma.json.
!macro customInstall
  CreateDirectory "$APPDATA\ServSquare"
  FileOpen $0 "$APPDATA\ServSquare\idioma-instalador.txt" w
  FileWrite $0 "$LANGUAGE"
  FileClose $0
!macroend
