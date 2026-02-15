#!/usr/bin/env node

import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';

const inputArgs = process.argv.slice(2);

let port = '4321';
const passthroughArgs = [];

for (let i = 0; i < inputArgs.length; i += 1) {
  const arg = inputArgs[i];

  if (arg === '--host') {
    i += 1;
    continue;
  }

  if (arg.startsWith('--host=')) {
    continue;
  }

  if (arg === '--port' || arg === '-p') {
    const next = inputArgs[i + 1];
    if (next && !next.startsWith('-')) {
      port = next;
      passthroughArgs.push(arg, next);
      i += 1;
      continue;
    }
    passthroughArgs.push(arg);
    continue;
  }

  if (arg.startsWith('--port=')) {
    const value = arg.slice('--port='.length);
    if (value) port = value;
    passthroughArgs.push(arg);
    continue;
  }

  passthroughArgs.push(arg);
}

function isIPv6Family(family) {
  return family === 'IPv6' || family === 6;
}

function stripZone(address) {
  const zoneIndex = address.indexOf('%');
  if (zoneIndex === -1) return address;
  return address.slice(0, zoneIndex);
}

function isGlobalUnicastIPv6(address) {
  const normalized = stripZone(address).toLowerCase();
  if (net.isIP(normalized) !== 6) return false;
  if (normalized === '::' || normalized === '::1') return false;
  if (normalized.startsWith('fe80:')) return false;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  if (normalized.startsWith('ff')) return false;

  const firstNibble = Number.parseInt(normalized[0], 16);
  return firstNibble >= 2 && firstNibble <= 3;
}

function interfaceScore(name) {
  let score = 0;
  if (/^(eth|en|wlan|wl|wwan)/.test(name)) score += 20;
  if (/^(docker|veth|br-|lo|tun|tap|wg)/.test(name)) score -= 20;
  return score;
}

function findGlobalIPv6() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, infos] of Object.entries(nets)) {
    if (!Array.isArray(infos)) continue;

    for (const info of infos) {
      if (!isIPv6Family(info.family) || info.internal) continue;
      if (!isGlobalUnicastIPv6(info.address)) continue;
      candidates.push({
        name,
        address: stripZone(info.address),
        score: interfaceScore(name),
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return candidates[0].address;
}

const globalIPv6 = findGlobalIPv6();

if (globalIPv6) {
  console.log(`\n[dev-ipv6] IPv6 URL (global): http://[${globalIPv6}]:${port}/\n`);
} else {
  console.log(`\n[dev-ipv6] IPv6 URL (fallback): http://[::1]:${port}/\n`);
}

const child = spawn('astro', ['dev', '--host', '::', ...passthroughArgs], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('[dev-ipv6] failed to start astro:', error.message);
  process.exit(1);
});
