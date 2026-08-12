# GenSource.Terminal — Nord 2-line powerline prompt (no oh-my-posh).
# Theme: $env:GENSOURCE_THEME (app settings theme id / alias).
# Requires a Nerd Font in the terminal (Terminus / Fira Code / Ubuntu bundled).

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$script:NordPL = @{
  Esc        = [char]27
  Sep        = [char]0xE0B0   # powerline solid right
  ThinSep    = [char]0xE0B1   # powerline thin right
  Branch     = [char]0xE0A0   # powerline branch
  PromptChar = [char]0x276F   # ❯
  FailMark   = [char]0x2717   # ✗
}

function script:Nord-Rgb([int]$r, [int]$g, [int]$b) {
  return @{ R = $r; G = $g; B = $b }
}

function script:Test-GensourceLightTheme {
  $t = if ($env:GENSOURCE_THEME) { $env:GENSOURCE_THEME.Trim().ToLowerInvariant() } else { '' }

  switch -Regex ($t) {
    '^(nord-)?snow-storm$' { return $true }
    '^(nord-)?frost-light$' { return $true }
    '^(nord-)?aurora-light$' { return $true }
    '^(nord-)?polar-night$' { return $false }
    '^(nord-)?frost-dark$' { return $false }
    '^(nord-)?aurora-dark$' { return $false }
  }

  if ($t -in @('system', 'frost', 'nord-frost', 'aurora', 'nord-aurora')) {
    try {
      $key = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name 'AppsUseLightTheme' -ErrorAction Stop
      return [bool]$key.AppsUseLightTheme
    } catch {
      return $false
    }
  }

  return $false
}

function script:Get-NordPalette {
  $light = Test-GensourceLightTheme

  # Shared Frost / Aurora accents
  $frostTeal = Nord-Rgb 136 192 208   # nord8
  $frostBlue = Nord-Rgb 129 161 193   # nord9
  $frostDeep = Nord-Rgb 94 129 172    # nord10
  $gitGreen  = Nord-Rgb 163 190 140   # nord14
  $warnRed   = Nord-Rgb 191 97 106    # nord11
  $warnOrange = Nord-Rgb 208 135 112  # nord12

  if ($light) {
    return @{
      Light      = $true
      UserBg     = Nord-Rgb 94 129 172     # nord10
      UserFg     = Nord-Rgb 236 239 244    # nord6
      PathBg     = Nord-Rgb 216 222 233    # nord4
      PathFg     = Nord-Rgb 46 52 64       # nord0
      GitBg      = Nord-Rgb 163 190 140    # nord14
      GitFg      = Nord-Rgb 46 52 64       # nord0
      ErrBg      = $warnRed
      ErrFg      = Nord-Rgb 236 239 244    # nord6
      ArrowFg    = $frostDeep
      ResetBg    = Nord-Rgb 236 239 244    # nord6 (terminal chrome)
      FrostTeal  = $frostTeal
      FrostBlue  = $frostBlue
      WarnOrange = $warnOrange
    }
  }

  return @{
    Light      = $false
    UserBg     = Nord-Rgb 94 129 172      # nord10
    UserFg     = Nord-Rgb 236 239 244     # nord6
    PathBg     = Nord-Rgb 59 66 82        # nord1
    PathFg     = Nord-Rgb 216 222 233     # nord4
    GitBg      = Nord-Rgb 67 76 94        # nord2
    GitFg      = Nord-Rgb 163 190 140     # nord14
    ErrBg      = $warnRed
    ErrFg      = Nord-Rgb 236 239 244     # nord6
    ArrowFg    = $frostTeal
    ResetBg    = Nord-Rgb 46 52 64        # nord0
    FrostTeal  = $frostTeal
    FrostBlue  = $frostBlue
    WarnOrange = $warnOrange
  }
}

function script:Ansi-Fg($c) {
  return "$($NordPL.Esc)[38;2;$($c.R);$($c.G);$($c.B)m"
}

function script:Ansi-Bg($c) {
  return "$($NordPL.Esc)[48;2;$($c.R);$($c.G);$($c.B)m"
}

function script:Ansi-Reset {
  return "$($NordPL.Esc)[0m"
}

function script:Write-PowerlineSegment {
  param(
    [hashtable]$TextFg,
    [hashtable]$TextBg,
    [hashtable]$PrevBg,
    [string]$Text,
    [switch]$First
  )

  $out = ''
  if (-not $First -and $null -ne $PrevBg) {
    $out += "$(Ansi-Fg $PrevBg)$(Ansi-Bg $TextBg)$($NordPL.Sep)"
  }
  $out += "$(Ansi-Fg $TextFg)$(Ansi-Bg $TextBg) $Text "
  return @{ Out = $out; Bg = $TextBg }
}

function script:Get-ShortPath([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return '~' }

  # Do not assign to $HOME — it is a read-only automatic variable.
  $userHome = $env:USERPROFILE
  if ($userHome -and $path.StartsWith($userHome, [System.StringComparison]::OrdinalIgnoreCase)) {
    $rest = $path.Substring($userHome.Length).TrimStart('\', '/')
    $path = if ($rest) { "~\$rest" } else { '~' }
  }

  $parts = @($path -split '[\\/]' | Where-Object { $_ -ne '' })
  if ($parts.Count -le 4) { return ($parts -join '\') }

  $ellipsis = [string][char]0x2026
  $tail = $parts[($parts.Count - 2)..($parts.Count - 1)]
  return (@($parts[0], $ellipsis) + @($tail)) -join '\'
}

function script:Get-GitBranch {
  try {
    $inside = & git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0 -or "$inside".Trim() -ne 'true') { return $null }

    $branch = & git symbolic-ref --short -q HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $branch) { return "$($NordPL.Branch) $($branch.Trim())" }

    $hash = & git rev-parse --short HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $hash) { return "$($NordPL.Branch) $($hash.Trim())" }
  } catch {
    return $null
  }
  return $null
}

function global:prompt {
  # Capture status before anything else mutates $? / $LASTEXITCODE.
  # Under Set-StrictMode, $LASTEXITCODE is unset until an external command runs.
  $ok = $?
  $code = if (Test-Path Variable:\LASTEXITCODE) { $LASTEXITCODE } else { 0 }

  $p = Get-NordPalette
  $line1 = ''
  $prevBg = $null

  $user = if ($env:USERNAME) { $env:USERNAME } else { 'user' }
  $hostName = if ($env:COMPUTERNAME) { $env:COMPUTERNAME.ToLowerInvariant() } else { 'localhost' }
  $seg = Write-PowerlineSegment -TextFg $p.UserFg -TextBg $p.UserBg -PrevBg $prevBg -Text "$user@$hostName" -First
  $line1 += $seg.Out
  $prevBg = $seg.Bg

  $cwd = Get-ShortPath (Get-Location).Path
  $seg = Write-PowerlineSegment -TextFg $p.PathFg -TextBg $p.PathBg -PrevBg $prevBg -Text $cwd
  $line1 += $seg.Out
  $prevBg = $seg.Bg

  $git = Get-GitBranch
  if ($git) {
    $seg = Write-PowerlineSegment -TextFg $p.GitFg -TextBg $p.GitBg -PrevBg $prevBg -Text $git
    $line1 += $seg.Out
    $prevBg = $seg.Bg
  }

  # Prefer $? — $LASTEXITCODE can linger after successful cmdlets.
  if (-not $ok) {
    $exitLabel = if ($null -ne $code -and $code -ne 0) { "$($NordPL.FailMark) $code" } else { "$($NordPL.FailMark)" }
    $seg = Write-PowerlineSegment -TextFg $p.ErrFg -TextBg $p.ErrBg -PrevBg $prevBg -Text $exitLabel
    $line1 += $seg.Out
    $prevBg = $seg.Bg
  }

  # Close powerline into default background.
  $line1 += "$(Ansi-Fg $prevBg)$(Ansi-Reset)$($NordPL.Sep)$(Ansi-Reset)"

  $arrowColor = if ($ok) { $p.ArrowFg } else { $p.WarnOrange }
  $line2 = "$(Ansi-Fg $arrowColor)$($NordPL.PromptChar)$(Ansi-Reset) "

  # Reset native exit code so a failed external command does not stick forever.
  $global:LASTEXITCODE = 0

  return "$line1`n$line2"
}
