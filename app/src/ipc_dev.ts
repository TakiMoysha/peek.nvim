import { readLines } from 'jsr:@std/io/buffer';
import { normalize } from 'jsr:@std/path';
import { render } from './markdownit.ts';

export default async function (socket: WebSocket) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  for await (const line of readLines(Deno.stdin)) {
    const [action, ...args] = line.split(':');

    switch (action) {
      case 'show':
        try {
          const content = decoder.decode(Deno.readFileSync(args[0]));
          socket.send(encoder.encode(JSON.stringify({
            action,
            html: render(content),
            lcount: (content.match(/(?:\r?\n)/g) || []).length + 1,
          })));
        } catch (e) {
          console.error(e);
        }
        break;
      case 'scroll': {
        socket.send(encoder.encode(JSON.stringify({
          action,
          line: args[0],
        })));
        break;
      }
      case 'base': {
        socket.send(encoder.encode(JSON.stringify({
          action,
          base: normalize(args[0] + '/'),
        })));
        break;
      }
      default:
        break;
    }
  }
}
