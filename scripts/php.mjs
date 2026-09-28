import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const localPhp = fileURLToPath(new URL('../tmp/php-runtime/php.exe', import.meta.url));
const executable = process.env.PHP_BINARY ||
  (process.platform === 'win32' && existsSync(localPhp) ? localPhp : 'php');

const child = spawn(executable, process.argv.slice(2), {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error(error.code === 'ENOENT'
    ? 'PHP не найден. Установите PHP и добавьте его в PATH либо задайте PHP_BINARY — полный путь к php.exe.'
    : `Не удалось запустить PHP: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
