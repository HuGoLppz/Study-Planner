// Arranca la API y el frontend en paralelo con la salida etiquetada. Sin dependencias.
// Uso: npm run dev (desde la raíz del proyecto)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const services = [
  { name: 'api', dir: 'server', color: '\x1b[34m' },
  { name: 'web', dir: 'client', color: '\x1b[33m' },
];

const children = services.map(({ name, dir, color }) => {
  const prefix = `${color}[${name}]\x1b[0m `;
  const child = spawn('npm run dev', {
    cwd: fileURLToPath(new URL(`../${dir}/`, import.meta.url)),
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      chunk
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => console.log(prefix + line));
    });
  }
  child.on('exit', (code) => {
    console.log(`${prefix}se ha detenido (código ${code ?? 0})`);
    shutdown(code ?? 0);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.exitCode === null && child.kill());
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
