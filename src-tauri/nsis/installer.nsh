; Custom NSIS hooks for GenSource.Template.
; Install scope (current user vs system-wide) is chosen at runtime via
; tauri.windows.conf.json installMode "both". Portable builds are separate
; zip artifacts produced by `npm run package`, not this installer.

!macro NSIS_HOOK_PREINSTALL
  ; Runs before files, registry keys, and shortcuts are written.
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Runs after install completes (files, registry, shortcuts).
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Runs before files, registry keys, and shortcuts are removed.
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Runs after uninstall completes.
!macroend
