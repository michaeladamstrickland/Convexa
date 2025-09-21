#!/usr/bin/env node
// Kill processes listening on a given TCP port (Windows-friendly)
const { spawnSync } = require('child_process');
const os = require('os');

const port = process.argv[2];
if (!port || isNaN(Number(port))) {
  console.error('Usage: node scripts/killPort.cjs <port>');
  process.exit(1);
}

function psListWindows(port) {
  // Try PowerShell first
  const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command', `$ErrorActionPreference='SilentlyContinue'; $c=Get-NetTCPConnection -LocalPort ${port} -State Listen; if($c){$c | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique}`], { encoding: 'utf8' });
  if (ps.status === 0 && ps.stdout) {
    const pids = ps.stdout.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>parseInt(s,10)).filter(n=>n>0);
    if (pids.length) return pids;
  }
  // Fallback to netstat parsing
  const ns = spawnSync('cmd.exe', ['/c', `netstat -ano | findstr :${port}`], { encoding: 'utf8' });
  if (ns.stdout) {
    const lines = ns.stdout.split(/\r?\n/).filter(Boolean);
    const pids = new Set();
    for (const line of lines) {
      // Example:  TCP    0.0.0.0:6027           0.0.0.0:0              LISTENING       12345
      const parts = line.trim().split(/\s+/);
      const state = parts[3] || parts[4] || '';
      const pidStr = parts[4] || parts[5] || '';
      if (/LISTENING/i.test(state) && /^\d+$/.test(pidStr)) pids.add(parseInt(pidStr, 10));
    }
    return Array.from(pids);
  }
  return [];
}

function killWindows(pids) {
  for (const pid of pids) {
    const r = spawnSync('taskkill', ['/PID', String(pid), '/F'], { encoding: 'utf8' });
    if (r.status === 0) console.log(`Killed PID ${pid} on port ${port}`);
    else console.warn(`Failed to kill PID ${pid}: ${r.stderr || r.stdout}`);
  }
}

function psListUnix(port) {
  const lsof = spawnSync('bash', ['-lc', `lsof -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true`], { encoding: 'utf8' });
  return (lsof.stdout || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>parseInt(s,10)).filter(n=>n>0);
}

function killUnix(pids) {
  for (const pid of pids) {
    const r = spawnSync('bash', ['-lc', `kill -9 ${pid} 2>/dev/null || true`], { encoding: 'utf8' });
    if (r.status === 0) console.log(`Killed PID ${pid} on port ${port}`);
  }
}

const isWin = os.platform().startsWith('win');
const pids = isWin ? psListWindows(port) : psListUnix(port);
if (!pids.length) {
  console.log(`No LISTENING process found on port ${port}`);
  process.exit(0);
}

if (isWin) killWindows(pids); else killUnix(pids);

// Verify
const verify = isWin
  ? spawnSync('cmd.exe', ['/c', `netstat -ano | findstr :${port}`], { encoding: 'utf8' })
  : spawnSync('bash', ['-lc', `lsof -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true`], { encoding: 'utf8' });
const residual = (verify.stdout || '').trim();
if (!residual) console.log(`Port ${port} now free.`);
else console.log(`Residual entries for port ${port}:\n${residual}`);
