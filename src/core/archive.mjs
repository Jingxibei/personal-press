import { deflateRawSync } from 'node:zlib';

const table = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(input) {
  let value = 0xffffffff;
  for (const byte of input) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Small deterministic ZIP writer; the first EPUB mimetype entry stays uncompressed. */
export function makeZip(entries) {
  const bodies = [], directory = [];
  let offset = 0;
  for (const entry of entries) {
    if (typeof entry.name !== 'string' || entry.name.startsWith('/') || entry.name.split('/').includes('..')) throw new Error('Unsafe archive path.');
    const name = Buffer.from(entry.name, 'utf8');
    const original = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const method = entry.store ? 0 : 8;
    const data = entry.store ? original : deflateRawSync(original);
    const crc = crc32(original);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(original.length, 22);
    local.writeUInt16LE(name.length, 26);
    bodies.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10); central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(original.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42); directory.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...bodies, central, end]);
}
