import { Readable } from 'stream';
import log from './log.js';

const logger = log.setupLogger();

function read(reader: NodeJS.ReadableStream, buffer: Uint8Array) {
  let read = 0;
  logger.info('buffer: ', buffer);

  while (read < buffer.length) {
    const chunk = reader.read(buffer.length - read);
    logger.info('chunk: ', chunk);
    if (!chunk) throw new Error('EOF');
    const chunkArray = new Uint8Array(chunk);
    buffer.set(chunkArray, read);
    read += chunkArray.length;
  }
}

export async function* readNodeStdin() {
  const reader = process.stdin;
  const len = new Uint8Array(4);

  while (true) {
    read(reader, len);
    const content = new Uint8Array(new DataView(len.buffer, 0).getUint32(0));
    read(reader, content);
    yield content;
  }
}


export async function* readBunStdin() {
  let pending = new Uint8Array(0);
  for await (const chunk of Bun.stdin.stream()) {
    const newPending = new Uint8Array(pending.length + chunk.length);
    newPending.set(pending, 0);
    newPending.set(chunk, pending.length);
    pending = newPending;

    while (pending.length >= 4) {
      // const length = new DataView(pending.buffer, 0, 4).getUint32(0);
      const length = new DataView(pending.buffer, pending.byteOffset, 4).getUint32(0);
      if (pending.length < 4 + length) break;
      yield pending.subarray(4, 4 + length);
      pending = pending.subarray(4 + length);
    }
  }
}
