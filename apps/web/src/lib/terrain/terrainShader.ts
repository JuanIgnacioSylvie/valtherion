/**
 * Mundi Valtherion — estilo atlas D&D (acuarela + tinta sobre pergamino).
 * Geografía lore: Korthaven O, Aurion S, Lexmara E + islas Nimrael/Drakonys/Selvareth
 * en triángulo equilátero en el Mar Interior. Unidades de mundo: 1920 × 911.
 *
 * Si hay textura pintada (uPaint), se usa en zoom bajo; al acercar cruza a procedural
 * nítido (mismo layout) para no pixelar.
 */

export const TERRAIN_VERT = /* glsl */ `#version 300 es
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const TERRAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform vec2 uOffset;
uniform float uZoom;
uniform vec2 uWorld;     // tamaño del mundo en unidades
uniform sampler2D uPaint;
uniform float uHasPaint; // 1 = hay mapa pintado
out vec4 fragColor;

const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);

// Anclas lore
const vec2 C_KOR = vec2(290.0, 440.0);  const vec2 R_KOR = vec2(210.0, 320.0);
const vec2 C_AUR = vec2(960.0, 790.0);  const vec2 R_AUR = vec2(280.0, 85.0);
const vec2 C_LEX = vec2(1630.0, 440.0); const vec2 R_LEX = vec2(210.0, 320.0);
const vec2 C_NIM = vec2(960.0, 215.0);  const vec2 R_NIM = vec2(88.0, 70.0);
const vec2 C_DRA = vec2(790.0, 509.0);  const vec2 R_DRA = vec2(88.0, 70.0);
const vec2 C_SEL = vec2(1130.0, 509.0); const vec2 R_SEL = vec2(88.0, 70.0);
const vec2 C_KOR2 = vec2(400.0, 175.0); const vec2 R_KOR2 = vec2(125.0, 115.0);
const vec2 C_KOR3 = vec2(175.0, 720.0); const vec2 R_KOR3 = vec2(105.0, 95.0);
const vec2 C_LEX2 = vec2(1525.0, 185.0); const vec2 R_LEX2 = vec2(125.0, 105.0);
const vec2 C_LEX3 = vec2(1745.0, 720.0); const vec2 R_LEX3 = vec2(100.0, 90.0);
const vec2 C_AUR2 = vec2(730.0, 815.0); const vec2 R_AUR2 = vec2(125.0, 55.0);
const vec2 C_AUR3 = vec2(1180.0, 805.0); const vec2 R_AUR3 = vec2(115.0, 50.0);

// Paleta D&D / pergamino (Korthaven, Aurion, Lexmara, Nimrael, Drakonys, Selvareth)
const vec3 PLAIN[6] = vec3[6](
  vec3(0.52, 0.48, 0.32), vec3(0.72, 0.64, 0.42), vec3(0.58, 0.68, 0.40),
  vec3(0.55, 0.48, 0.62), vec3(0.62, 0.40, 0.30), vec3(0.42, 0.58, 0.34));
const vec3 FOREST[6] = vec3[6](
  vec3(0.22, 0.30, 0.18), vec3(0.34, 0.42, 0.24), vec3(0.24, 0.48, 0.26),
  vec3(0.32, 0.26, 0.48), vec3(0.40, 0.24, 0.18), vec3(0.14, 0.42, 0.24));
const vec3 ROCK[6] = vec3[6](
  vec3(0.42, 0.38, 0.34), vec3(0.58, 0.52, 0.44), vec3(0.58, 0.56, 0.52),
  vec3(0.52, 0.48, 0.58), vec3(0.48, 0.32, 0.28), vec3(0.46, 0.50, 0.40));
const vec3 SAND = vec3(0.82, 0.74, 0.54);
const vec3 PARCH = vec3(0.90, 0.84, 0.70);
const vec3 INK = vec3(0.18, 0.12, 0.08);
const vec3 OCEAN_SHALLOW = vec3(0.42, 0.62, 0.62);
const vec3 OCEAN_DEEP = vec3(0.18, 0.32, 0.42);

float hash1(vec2 ip) {
  uvec2 u = uvec2(ivec2(ip));
  uint h = u.x * 374761393u + u.y * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return float(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash1(i);
  float b = hash1(i + vec2(1.0, 0.0));
  float c = hash1(i + vec2(0.0, 1.0));
  float d = hash1(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y) - 0.5;
}

float fbm(vec2 p, float wlpx, int octs) {
  float s = 0.0;
  float a = 1.0;
  for (int i = 0; i < 14; i++) {
    if (i >= octs) break;
    float fade = clamp((wlpx - 2.0) / 3.0, 0.0, 1.0);
    if (fade <= 0.0) break;
    s += a * fade * vnoise(p);
    p = ROT * p * 2.0 + vec2(17.3, 9.1);
    wlpx *= 0.5;
    a *= 0.5;
  }
  return s;
}

// ridged noise para cadenas montañosas tipo tinta
float ridge(vec2 p, float wlpx, int octs) {
  float s = 0.0;
  float a = 1.0;
  for (int i = 0; i < 10; i++) {
    if (i >= octs) break;
    float fade = clamp((wlpx - 2.0) / 3.0, 0.0, 1.0);
    if (fade <= 0.0) break;
    s += a * fade * (1.0 - abs(vnoise(p)) * 2.0);
    p = ROT * p * 2.05 + vec2(3.7, 11.1);
    wlpx *= 0.5;
    a *= 0.5;
  }
  return clamp(s, 0.0, 1.0);
}

float blob(vec2 p, vec2 c, vec2 r) {
  return 1.0 - length((p - c) / r);
}

float landField(vec2 p) {
  // Warp fuerte → costas orgánicas (fiordos, bahías), no óvalos.
  vec2 pn = p * 0.001;
  vec2 w1 = vec2(
    fbm(pn * 1.1 + vec2(2.1, 5.7), uZoom * 900.0, 5),
    fbm(pn * 1.1 + vec2(9.4, 1.2), uZoom * 900.0, 5));
  vec2 w2 = vec2(
    fbm(pn * 3.2 + vec2(4.0, 8.0), uZoom * 310.0, 6),
    fbm(pn * 3.2 + vec2(1.0, 6.0), uZoom * 310.0, 6));
  vec2 q = p + 155.0 * w1 + 48.0 * w2;

  float F = max(
    max(max(blob(q, C_KOR, R_KOR), blob(q, C_AUR, R_AUR)), max(blob(q, C_LEX, R_LEX), blob(q, C_NIM, R_NIM))),
    max(blob(q, C_DRA, R_DRA), blob(q, C_SEL, R_SEL)));
  F = max(F, max(max(blob(q, C_KOR2, R_KOR2), blob(q, C_KOR3, R_KOR3)),
                 max(blob(q, C_LEX2, R_LEX2), blob(q, C_LEX3, R_LEX3))));
  F = max(F, max(blob(q, C_AUR2, R_AUR2), blob(q, C_AUR3, R_AUR3)));

  // detalle de costa fractal
  F += 0.42 * fbm(q * 0.0022 + vec2(1.3, 7.7), uZoom * 450.0, 12);
  F += 0.12 * fbm(q * 0.007 + vec2(8.0, 2.0), uZoom * 140.0, 8);
  return F;
}

vec3 regionPalette(vec2 p, out vec3 forest, out vec3 rock) {
  float b[6] = float[6](
    blob(p, C_KOR, R_KOR * 1.15), blob(p, C_AUR, R_AUR * 1.2), blob(p, C_LEX, R_LEX * 1.15),
    blob(p, C_NIM, R_NIM * 1.4), blob(p, C_DRA, R_DRA * 1.4), blob(p, C_SEL, R_SEL * 1.4));
  vec3 plain = vec3(0.0);
  forest = vec3(0.0);
  rock = vec3(0.0);
  float wsum = 0.0;
  for (int k = 0; k < 6; k++) {
    float wk = exp(4.5 * b[k]);
    plain += PLAIN[k] * wk;
    forest += FOREST[k] * wk;
    rock += ROCK[k] * wk;
    wsum += wk;
  }
  plain /= wsum;
  forest /= wsum;
  rock /= wsum;
  return plain;
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (sp - uOffset) / uZoom;

  float e = 1.2 / uZoom;
  float F = landField(p);
  float Fx = landField(p + vec2(e, 0.0));
  float Fy = landField(p + vec2(0.0, e));
  vec2 gF = vec2(Fx - F, Fy - F) / e;
  float gmag = max(length(gF), 1e-5);
  float distW = F / gmag;
  float distPx = distW * uZoom;

  vec2 pn = p * 0.001;
  float elev = 0.0;
  float mtn = 0.0;
  if (F > -0.05) {
    elev = clamp(F, 0.0, 1.0) * 0.35
         + 0.55 * ridge(pn * 2.8 + vec2(5.5, 2.2), uZoom * 360.0, 7)
         + 0.18 * fbm(pn * 5.0 + vec2(2.0, 9.0), uZoom * 200.0, 6);
    mtn = smoothstep(0.42, 0.62, elev) * step(0.0, F);
  }

  vec3 col;

  if (F < 0.0) {
    // —— OCÉANO acuarela (sin anillos cian) ——
    float depth = clamp(-F / 0.7, 0.0, 1.0);
    col = mix(OCEAN_SHALLOW, OCEAN_DEEP, smoothstep(0.0, 1.0, depth));
    // wash suave
    float wash = fbm(pn * 2.0 + vec2(0.5, 3.0), uZoom * 500.0, 5);
    col += wash * 0.04;
    // pergamino asoma en aguas profundas lejanas
    col = mix(col, mix(OCEAN_DEEP, PARCH * 0.55, 0.35), smoothstep(0.55, 1.0, depth) * 0.25);
    // espuma fina en la costa
    float foam = 1.0 - smoothstep(0.0, 2.5, -distPx);
    col = mix(col, vec3(0.78, 0.86, 0.84), foam * 0.55);
  } else {
    // —— TIERRA pintada ——
    vec3 forestC;
    vec3 rockC;
    vec3 plain = regionPalette(p, forestC, rockC);

    float bio = fbm(pn * 2.2 + vec2(4.0, 9.0), uZoom * 450.0, 7);
    float forestness = smoothstep(-0.05, 0.18, bio);
    vec3 ground = mix(plain, forestC, forestness * 0.9);
    ground = mix(ground, rockC, mtn * 0.85);
    ground = mix(ground, SAND, (1.0 - smoothstep(0.8, 6.0, distW)) * (1.0 - mtn));

    // textura de pincel / grano de papel (aparece al zoomear)
    float grain = fbm(pn * 40.0 + vec2(1.0, 2.0), uZoom * 25.0, 5);
    float paper = fbm(pn * 220.0, uZoom * 4.5, 4);
    ground *= 1.0 + 0.12 * grain + 0.08 * paper;

    // hillshade suave (mapa pintado, no 3D duro)
    float hx = landField(p + vec2(e * 2.0, 0.0));
    float hy = landField(p + vec2(0.0, e * 2.0));
    // altura aproximada
    float h0 = elev;
    float h1 = clamp(hx, 0.0, 1.0) * 0.35 + 0.55 * ridge((p + vec2(e * 2.0, 0.0)) * 0.001 * 2.8 + vec2(5.5, 2.2), uZoom * 360.0, 5);
    float h2 = clamp(hy, 0.0, 1.0) * 0.35 + 0.55 * ridge((p + vec2(0.0, e * 2.0)) * 0.001 * 2.8 + vec2(5.5, 2.2), uZoom * 360.0, 5);
    vec2 gh = vec2(h1 - h0, h2 - h0) / (e * 2.0);
    float lit = 0.78 + 0.28 * clamp(dot(normalize(vec3(-gh * 80.0, 1.0)), normalize(vec3(-0.4, -0.55, 0.7))), -0.2, 1.0);
    ground *= lit;

    // nieve en cumbres
    float snow = smoothstep(0.72, 0.88, elev) * mtn;
    ground = mix(ground, vec3(0.93, 0.94, 0.96), snow * 0.9);

    // —— árboles (copa acuarela, no bolitas planas) ——
    float tcell = 2.6;
    float tVis = smoothstep(4.5, 10.0, tcell * uZoom);
    float dens = clamp(forestness * 1.05 - 0.08, 0.0, 1.0) * (1.0 - mtn) * smoothstep(1.5, 5.0, distW);
    if (tVis > 0.0 && dens > 0.05) {
      vec2 g = p / tcell;
      vec2 gi = floor(g);
      float bestY = -1e9;
      vec3 bestD = vec3(0.0);
      bool hit = false;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 id = gi + vec2(float(i), float(j));
          float r0 = hash1(id);
          if (r0 > dens) continue;
          float r1 = hash1(id + vec2(31.0, 17.0));
          float r2 = hash1(id + vec2(7.0, 53.0));
          float r3 = hash1(id + vec2(91.0, 5.0));
          vec2 c = id + 0.5 + (vec2(r1, r2) - 0.5) * 0.6;
          float rad = 0.32 + 0.18 * r3;
          // elipse vertical (copa)
          vec2 d = (g - c) / vec2(rad, rad * 0.85);
          float rr = length(d);
          if (rr < 1.0 && c.y > bestY) {
            bestY = c.y;
            bestD = vec3(d, r3);
            hit = true;
          }
        }
      }
      if (hit) {
        float r = length(bestD.xy);
        float l = clamp(dot(bestD.xy, normalize(vec2(-0.55, -0.7))) * 0.45 + 0.55, 0.0, 1.0);
        vec3 tc = mix(forestC * 0.65, forestC * 1.15 + vec3(0.05, 0.07, 0.0), l);
        // borde tinta suave
        float edge = smoothstep(0.72, 1.0, r);
        tc = mix(tc, INK * 0.55 + forestC * 0.3, edge * 0.55);
        tc *= 0.92 + 0.16 * bestD.z;
        ground = mix(ground, tc, tVis * (1.0 - edge * 0.15));
      }
    }

    // —— montañas: crestas de tinta (estilo atlas) ——
    float ridgeLine = ridge(pn * 6.5 + vec2(9.0, 4.0), uZoom * 155.0, 6);
    if (mtn > 0.15) {
      float stroke = smoothstep(0.55, 0.85, ridgeLine) * mtn;
      float strokeVis = smoothstep(2.0, 6.0, uZoom);
      ground = mix(ground, mix(rockC * 0.7, INK, 0.55), stroke * strokeVis * 0.7);
      // hatch diagonal al zoomear
      float hatchVis = smoothstep(8.0, 16.0, uZoom) * mtn;
      float hatch = abs(fract((p.x + p.y) * 0.35) - 0.5);
      hatch = 1.0 - smoothstep(0.0, 0.12, hatch);
      ground = mix(ground, INK * 0.85, hatch * hatchVis * 0.25);
    }

    // costa: tinta marrón oscura (firma D&D)
    float rim = 1.0 - smoothstep(0.5, 2.2, distPx);
    ground = mix(ground, INK, rim * 0.72);

    col = ground;
  }

  // Viñeta pergamino suave en el océano lejano del mundi
  float parchWash = fbm(pn * 0.8 + vec2(0.2, 0.7), uZoom * 1200.0, 3);
  if (F < -0.15) {
    col = mix(col, mix(col, PARCH * 0.7, 0.5), clamp((-F - 0.15) * 0.35 + parchWash * 0.08, 0.0, 0.35));
  }

  // —— Arte D&D pintado como base; procedural = detalle/borde al zoomear ——
  if (uHasPaint > 0.5) {
    vec2 uv = p / uWorld;
    float inWorld = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    if (inWorld < 0.5) {
      // Fuera del mundi: pergamino (no azul vacío)
      float wash = fbm(pn * 1.2 + vec2(0.3, 0.9), uZoom * 900.0, 3);
      col = mix(PARCH * 0.72, OCEAN_DEEP * 0.55, 0.35 + wash * 0.1);
    } else {
      vec2 uvc = clamp(uv, 0.0, 1.0);
      vec3 paint = texture(uPaint, uvc).rgb;

      // Silueta tierra/agua desde el cuadro (no desde blobs)
      float landHint = clamp((paint.r + paint.g) * 0.55 - paint.b * 0.7 + 0.18, 0.0, 1.0);
      landHint = smoothstep(0.28, 0.55, landHint);

      // Borde de costa nítido (sobel sobre el paint)
      float px = 1.0 / 1400.0;
      float l1 = texture(uPaint, uvc + vec2(px, 0.0)).g + texture(uPaint, uvc + vec2(px, 0.0)).r;
      float l2 = texture(uPaint, uvc - vec2(px, 0.0)).g + texture(uPaint, uvc - vec2(px, 0.0)).r;
      float l3 = texture(uPaint, uvc + vec2(0.0, px)).g + texture(uPaint, uvc + vec2(0.0, px)).r;
      float l4 = texture(uPaint, uvc - vec2(0.0, px)).g + texture(uPaint, uvc - vec2(0.0, px)).r;
      float edge = length(vec2(l1 - l2, l3 - l4));
      float inkCoast = smoothstep(0.08, 0.35, edge);

      // Microdetalle que NO se estira: grano + bosque/crestas encima del paint
      float detailAmt = smoothstep(1.6, 4.5, uZoom);
      vec3 detailed = paint;

      // grano de pergamino / pincel
      float paper = fbm(pn * 180.0, uZoom * 5.5, 5);
      detailed *= 1.0 + detailAmt * paper * 0.14;

      // árboles donde el paint es verde (bosque)
      float greenness = paint.g - max(paint.r, paint.b) * 0.65;
      float forestMask = smoothstep(0.02, 0.12, greenness) * landHint;
      float tcell = 2.4;
      float tVis = smoothstep(5.0, 11.0, tcell * uZoom) * forestMask;
      if (tVis > 0.05) {
        vec2 g = p / tcell;
        vec2 gi = floor(g);
        float bestY = -1e9;
        vec3 bestD = vec3(0.0);
        bool hit = false;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 id = gi + vec2(float(i), float(j));
            float r0 = hash1(id + vec2(2.0, 9.0));
            if (r0 > 0.55 + 0.35 * forestMask) continue;
            float r1 = hash1(id + vec2(31.0, 17.0));
            float r2 = hash1(id + vec2(7.0, 53.0));
            float r3 = hash1(id + vec2(91.0, 5.0));
            vec2 c = id + 0.5 + (vec2(r1, r2) - 0.5) * 0.55;
            float rad = 0.30 + 0.16 * r3;
            vec2 d = (g - c) / vec2(rad, rad * 0.88);
            if (length(d) < 1.0 && c.y > bestY) {
              bestY = c.y;
              bestD = vec3(d, r3);
              hit = true;
            }
          }
        }
        if (hit) {
          float r = length(bestD.xy);
          float l = clamp(dot(bestD.xy, normalize(vec2(-0.55, -0.7))) * 0.45 + 0.55, 0.0, 1.0);
          vec3 canopy = mix(paint * 0.55, paint * 1.25 + vec3(0.04, 0.08, 0.0), l);
          canopy = mix(canopy, INK * 0.5 + paint * 0.3, smoothstep(0.75, 1.0, r) * 0.6);
          detailed = mix(detailed, canopy, tVis * (1.0 - smoothstep(0.85, 1.0, r)));
        }
      }

      // crestas en zonas grises/marrones (montaña)
      float rocky = smoothstep(0.08, 0.0, abs(paint.r - paint.g)) * (1.0 - paint.b) * landHint;
      float ridgeVis = smoothstep(6.0, 14.0, uZoom) * rocky;
      float rid = ridge(pn * 7.0 + vec2(3.0, 8.0), uZoom * 140.0, 5);
      detailed = mix(detailed, mix(paint * 0.75, INK, 0.45), ridgeVis * smoothstep(0.5, 0.85, rid) * 0.55);

      // tinta de costa siempre nítida (1–2 px de pantalla)
      detailed = mix(detailed, INK, inkCoast * (0.35 + 0.4 * detailAmt) * landHint);
      // espuma en agua junto a costa
      detailed = mix(detailed, mix(paint, vec3(0.78, 0.86, 0.84), 0.5), inkCoast * (1.0 - landHint) * 0.35);

      // Zoom bajo → paint D&D. Zoom alto → procedural nítido (tiles), tintado con el paint.
      // Nunca se queda mostrando el JPG estirado (eso es lo que pixelaba).
      float paintAmt = smoothstep(5.5, 1.4, uZoom);
      vec3 paintLook = mix(paint, detailed, detailAmt);
      // Procedural ya esta en col; lo tine levemente con el paint para no romper el estilo.
      vec3 crisp = mix(col, paintLook, 0.22);
      // En tierra del paint, preferir silueta del cuadro a zoom medio.
      crisp = mix(crisp, mix(col, paintLook, 0.55), landHint * (1.0 - paintAmt) * 0.35);
      col = mix(crisp, paintLook, paintAmt);
    }
    }
  }

  col += (hash1(floor(gl_FragCoord.xy)) - 0.5) / 255.0;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
