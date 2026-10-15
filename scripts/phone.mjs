#!/usr/bin/env node

// Runs the app on a real phone in Expo Go: starts the API on the local network and Expo pointed at it.
// The phone's API URL goes in a temporary .env.development.local (gitignored), the env file Expo reads
// first in development: a plain environment variable is not enough, since a .env or .env.local value
// still won and inlined localhost into the bundle. The other env files stay untouched, and this one
// is deleted on exit.
//   npm run phone

import { spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const ENV_LOCAL = new URL('../.env.development.local', import.meta.url);

function lanAddress() {
  const interfaces = networkInterfaces();
  // en0 is the Wi-Fi on a Mac; otherwise the first external IPv4 that isn't a VM bridge or VPN.
  const names = ['en0', ...Object.keys(interfaces).filter((name) => name !== 'en0' && !/^(bridge|utun|docker|veth|vmnet|lo)/.test(name))];
  for (const name of names) {
    const found = interfaces[name]?.find((entry) => entry.family === 'IPv4' && !entry.internal);
    if (found) return found.address;
  }
  return null;
}

async function portInUse(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

const ip = lanAddress();
if (!ip) {
  console.error('No encontré la IP de esta computadora en la red. Conéctate a una red Wi-Fi e inténtalo de nuevo.');
  process.exit(1);
}
if (await portInUse(3000)) {
  console.error('El puerto 3000 ya está en uso (¿otra API corriendo?). Ciérrala y vuelve a correr npm run phone.');
  process.exit(1);
}

if (existsSync(ENV_LOCAL)) {
  console.error('Ya existe .env.development.local (¿quedó de una ejecución anterior?). Revísalo, bórralo y vuelve a correr npm run phone.');
  process.exit(1);
}

const apiUrl = `http://${ip}:3000`;
writeFileSync(ENV_LOCAL, `# Written by npm run phone; deleted when it stops.\nEXPO_PUBLIC_API_URL=${apiUrl}\n`);
console.log(`\nIP de esta computadora: ${ip}`);
console.log(`La app en el teléfono usará la API en ${apiUrl}`);
console.log('El teléfono debe estar en la misma red Wi-Fi. Escanea el QR con la cámara (iPhone) o con Expo Go (Android).\n');

const api = spawn('npm', ['run', 'server:dev'], {
  env: { ...process.env, HOST: '0.0.0.0', PORT: '3000' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
for (const stream of [api.stdout, api.stderr]) {
  stream.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n')) if (line.trim()) console.log(`[api] ${line}`);
  });
}

// -c clears Metro's cache: EXPO_PUBLIC_API_URL is inlined into the bundle, so a cached bundle could
// still point at an old IP.
const expo = spawn('npx', ['expo', 'start', '--go', '-c'], {
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl, REACT_NATIVE_PACKAGER_HOSTNAME: ip },
  stdio: 'inherit',
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  rmSync(ENV_LOCAL, { force: true });
  api.kill('SIGTERM');
  expo.kill('SIGTERM');
  process.exitCode = code;
}
api.on('exit', (code) => {
  if (!stopping) console.error('La API se detuvo. Revisa el mensaje de arriba.');
  stop(code ?? 1);
});
expo.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
