export async function unpack(response) {
  const data = await response.arrayBuffer(),
    bytes = new Uint8Array(data, 0, Math.min(2, data.byteLength));
  if (bytes[0] !== 31 || bytes[1] !== 139) return data;
  return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
