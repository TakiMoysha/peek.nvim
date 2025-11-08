import { Readable } from 'stream';

async function read(reader: NodeJS.ReadableStream, buffer: Uint8Array) {
  let read = 0;
  while (read < buffer.length) {
    const chunk = reader.read(buffer.length - read);
    if (!chunk) throw new Error('EOF');
    const chunkArray = new Uint8Array(chunk);
    buffer.set(chunkArray, read);
    read += chunkArray.length;
  }
}

export async function* readChunks(reader: NodeJS.ReadableStream) {
  while (true) {
    const len = new Uint8Array(4);
    await read(reader, len);
    const content = new Uint8Array(new DataView(len.buffer, 0).getUint32(0));
    await read(reader, content);
    yield content;
  }
}
