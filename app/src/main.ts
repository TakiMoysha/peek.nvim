import { dirname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { readFileSync, createReadStream } from 'fs';
import open from 'open';
import { readBunStdin, readNodeStdin } from './read.js';
import log from './log.js';
import { render } from './markdownit.js';

// Simple argument parser
function parseSimpleArgs(args: string[]) {
  const result: Record<string, any> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (value !== undefined) {
        result[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

const __args = parseSimpleArgs(process.argv.slice(2));
const __dirname = dirname(fileURLToPath(import.meta.url));

const NODE_ENV = process.env.NODE_ENV;

const logger = log.setupLogger();
const version = process.version;

logger.info(`NODE_ENV: ${NODE_ENV}`, ...process.argv.slice(2));
logger.info(`node: ${version}`);

// HELPER
function getStdinGenerator() {
  const isBunRuntime = typeof Bun !== 'undefined';
  if (isBunRuntime) {
    return readBunStdin();
  } else {
    return readNodeStdin();
  }
}

async function init(socket: any) {
  if (NODE_ENV === 'development') {
    console.error('ipc_dev.ts wip, may not working');
    return void (await import(join(__dirname, 'ipc_dev.ts'))).default(socket);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const generator = getStdinGenerator();

  try {
      for await (const chunk of generator) {
        const action = decoder.decode(chunk.buffer);

        switch (action) {
          case 'show': {
            const content = decoder.decode((await generator.next()).value!);

            socket.send(
              encoder.encode(
                JSON.stringify({
                  action: 'show',
                  html: render(content),
                  lcount: (content.match(/(?:\r?\n)/g) || []).length + 1,
                }),
              ),
            );

            break;
          }
          case 'scroll': {
            socket.send(
              encoder.encode(
                JSON.stringify({
                  action,
                  line: decoder.decode((await generator.next()).value!),
                }),
              ),
            );
            break;
          }
          case 'base': {
            socket.send(
              encoder.encode(
                JSON.stringify({
                  action,
                  base: normalize(decoder.decode((await generator.next()).value!) + '/'),
                }),
              ),
            );
            break;
          }
          default: {
            break;
          }
        }
      }
  } catch (e: any) {
    if (e.name !== 'InvalidStateError') throw e;
  }
}

(() => {
  const app = __args['app'] ? __args?.app : 'webview';

  if (app === 'webview') {
    const server = createServer();
    const wss = new WebSocketServer({ server });

    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const serverUrl = `localhost:${address.port}`;
        logger.info(`listening on ${serverUrl}`);

        const webview = spawn(
          'bun',
          [
            'run',
            join(__dirname, '../', 'public', 'webview.js'),
            `--url=${new URL('index.html', import.meta.url).href}`,
            `--theme=${__args?.theme || 'dark'}`,
            `--serverUrl=${serverUrl}`,
          ],
          {
            cwd: dirname(fileURLToPath(import.meta.url)),
            stdio: 'inherit',
          },
        );

        webview.on('close', (code) => {
          logger.info(`webview closed, code: ${code}`);
          process.exit();
        });
      }
    });

    wss.on('connection', (socket) => {
      init(socket);
    });

    return;
  }

  async function findFile(url: string): Promise<NodeJS.ReadableStream | null> {
    const _url = new URL(`http://${process.env.HOST ?? 'localhost'}${url}`);
    const path = _url.pathname.replace(/^\/+/, '') || 'index.html';
    // const search = _url.search;

    try {
      return createReadStream(join(__dirname, '../', 'public', path));
    } catch (_) {
      return null;
    }
  }

  const server = createServer();
  const wss = new WebSocketServer({ server });

  server.on('request', async (req, res) => {
    const file = await findFile(req.url || '');
    logger.info('file', JSON.stringify(file));
    if (file) {
      res.writeHead(200);
      file.pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(0, () => {
    const address = server.address();
    if (address && typeof address === 'object') {
      const serverUrl = `localhost:${address.port}`;
      logger.info(`listening on ${serverUrl}`);
      const url = new URL(`http://${serverUrl}`);
      const searchParams = new URLSearchParams({ theme: __args.theme });
      url.search = searchParams.toString();

      open(url.href, { app: app !== 'browser' ? app : undefined }).catch((e: any) => {
        process.stderr.write(`${[app].flat().join(' ')}: ${e.message}`);
        process.exit();
      });
    }
  });

  let timeout: NodeJS.Timeout;

  wss.on('connection', (socket) => {
    clearTimeout(timeout);

    init(socket);

    socket.on('close', () => {
      timeout = setTimeout(() => {
        process.exit();
      }, 2000);
    });
  });
})();

const win_signals = ['SIGINT', 'SIGBREAK'] as const;
const unix_signals = ['SIGINT', 'SIGUSR2', 'SIGTERM', 'SIGPIPE', 'SIGHUP'] as const;
const signals = process.platform === 'win32' ? win_signals : unix_signals;

for (const signal of signals) {
  process.on(signal, () => {
    logger.info('SIGNAL:', signal);
    process.exit();
  });
}
