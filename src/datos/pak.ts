/** Lee un .pak gzip del original (header JSON + partes deinterleaved). */

export type PakTypes = Record<
  string,
  Float32ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor
>;

export async function loadPakGzip(
  url: string,
  types: PakTypes,
): Promise<Record<string, Float32Array | Uint16Array | Uint32Array>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  const gz = await res.arrayBuffer();
  const raw = await decompressGzip(gz);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const hdrLen = dv.getUint32(0, true);
  const hdr = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + hdrLen))) as {
    partes: { nombre: string; bytes: number; registro: number }[];
  };
  const out: Record<string, Float32Array | Uint16Array | Uint32Array> = {};
  let s = 4 + hdrLen;
  for (const { nombre, bytes, registro } of hdr.partes) {
    const a = raw.subarray(s, s + bytes);
    const c = new Uint8Array(bytes);
    const l = bytes / registro;
    for (let e = 0; e < registro; e++) {
      const t = e * l;
      for (let n = 0; n < l; n++) c[n * registro + e] = a[t + n]!;
    }
    const Ctor = types[nombre];
    if (!Ctor) throw new Error(`tipo desconocido ${nombre}`);
    out[nombre] = new Ctor(c.buffer);
    s += bytes;
  }
  return out;
}

async function decompressGzip(buf: ArrayBuffer): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const stream = new Response(buf).body!.pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  // fallback: dynamic import of fflate not available — assume browser has DecompressionStream
  throw new Error("DecompressionStream no disponible");
}
