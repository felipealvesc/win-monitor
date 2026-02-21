import { spawn } from 'node:child_process';

const children = [];
let shuttingDown = false;

function run(name, command, args, env = process.env) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[${name}] exited with ${reason}`);
    shutdown(code ?? 1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('server', 'npx', ['tsx', 'server/index.ts'], {
  ...process.env,
  PORT: process.env.PORT || '3001',
});

run('client', 'npx', ['vite', '--host', '--port', process.env.CLIENT_PORT || '3000']);
