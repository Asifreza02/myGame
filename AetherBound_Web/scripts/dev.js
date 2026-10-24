import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const gameServerPort = process.env.GAME_SERVER_PORT || '3001';
const children = new Set();
let stopping = false;

function stopChildren(signal = 'SIGTERM', exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

function start(name, args, env = process.env) {
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`Could not start ${name}:`, error);
    stopChildren('SIGTERM', 1);
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} exited${signal ? ` after ${signal}` : ` with code ${code}`}.`);
      stopChildren('SIGTERM', code || 1);
    }
  });
  return child;
}

async function isGameServerHealthy(port) {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch (error) {
    if (error.name === 'TypeError' || error.name === 'TimeoutError') return false;
    throw error;
  }
}

async function waitForGameServer(port) {
  const deadline = Date.now() + 5000;
  while (!stopping && Date.now() < deadline) {
    if (await isGameServerHealthy(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

process.on('SIGINT', () => stopChildren('SIGINT'));
process.on('SIGTERM', () => stopChildren('SIGTERM'));

async function main() {
  if (!process.env.NEXT_PUBLIC_GAME_SERVER_URL) {
    if (!(await isGameServerHealthy(gameServerPort))) {
      start('Game server', ['server/server.js'], {
        ...process.env,
        GAME_SERVER_PORT: gameServerPort,
      });
      if (!(await waitForGameServer(gameServerPort))) {
        throw new Error(`Game server did not become healthy on port ${gameServerPort}.`);
      }
    }
  }

  if (!stopping) {
    start('Next.js', ['node_modules/next/dist/bin/next', 'dev'], {
      ...process.env,
      NEXT_PUBLIC_GAME_SERVER_URL:
        process.env.NEXT_PUBLIC_GAME_SERVER_URL || `ws://localhost:${gameServerPort}`,
    });
  }
}

main().catch((error) => {
  console.error('Could not start the development environment:', error);
  stopChildren('SIGTERM', 1);
});
