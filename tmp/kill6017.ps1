$ErrorActionPreference = 'SilentlyContinue'
$cons = Get-NetTCPConnection -LocalPort 6017 -State Listen
if ($cons) {
  $pids = $cons | Select-Object -ExpandProperty OwningProcess -Unique
  Write-Output ("PIDs: " + ($pids -join ', '))
  foreach ($p in $pids) {
    try {
      Stop-Process -Id $p -Force -ErrorAction Stop
      Write-Output ("Killed PID " + $p)
    } catch {
      Write-Output ("Could not kill PID " + $p)
    }
  }
} else {
  Write-Output 'No listener on 6017'
}
