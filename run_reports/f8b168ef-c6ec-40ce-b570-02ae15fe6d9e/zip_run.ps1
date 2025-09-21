$ErrorActionPreference = 'Stop'
$run = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = @('enriched.csv','report.json','qa_cache_hit_offline.json','README.md','guardrails_snapshot.json','guardrails_snapshot.note') |
  ForEach-Object { Join-Path $run $_ } |
  Where-Object { Test-Path $_ }
$dest = Join-Path $run 'qa_bundle.zip'
if (Test-Path $dest) { Remove-Item $dest -Force }
Compress-Archive -Force -DestinationPath $dest -Path $files
(Get-Item $dest).FullName
(Get-Item $dest).Length
