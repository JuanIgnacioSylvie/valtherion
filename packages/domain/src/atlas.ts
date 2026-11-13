import type { PinDto } from "@valtherion/contracts";
import { LORE_LINK_RE } from "@valtherion/contracts";

export function visiblePinsForZoom(pins: PinDto[], zoom: number): PinDto[] {
  return pins.filter((p) => zoom >= p.minZoom && zoom <= p.maxZoom);
}

export interface LoreLinkRef {
  id: string;
  label: string;
  start: number;
  end: number;
}

export function parseLoreLinks(body: string): LoreLinkRef[] {
  const out: LoreLinkRef[] = [];
  const re = new RegExp(LORE_LINK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    out.push({
      id: m[1].trim(),
      label: (m[2] || m[1]).trim(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}
