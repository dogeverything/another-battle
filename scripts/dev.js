import { spawn } from 'child_process';

const serverProc = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: true
});

const clientProc = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

