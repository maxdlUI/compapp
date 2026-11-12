; Repline installer texts (included by electron-builder's NSIS script).
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Repline"
  !define MUI_WELCOMEPAGE_TEXT "Your daily pro routine for Fortnite.$\r$\n$\r$\nThis installs Repline on your PC. After that it updates itself in the background, so you only do this once.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Last page of the installer (not the uninstaller).
!ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_TITLE "Repline is ready"
  !define MUI_FINISHPAGE_TEXT "Repline is installed and updates itself from now on.$\r$\n$\r$\nSign in with Discord and start your first routine."
  !define MUI_FINISHPAGE_RUN_TEXT "Open Repline now"
!endif

; Always install for the current user only: no admin prompt, and updates install silently.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
