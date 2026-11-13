/**
 * Mundi procedural (GPU). Idea tomada de Project Zomboid Map: el mapa se RENDERIZA desde datos
 * a la resolución que pida el zoom (ellos con tiles DZI pre-horneados; nosotros por pixel en GPU).
 * Geografía = lore Valtherion: Korthaven (O), Aurion (S), Lexmara (E) + islas Nimrael/Drakonys/Selvareth
 * en triángulo equilátero dentro del Mar Interior. Coordenadas en "unidades de mundo" (1920 x 911).
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

uniform vec2 uRes;      // canvas en px de dispositivo
uniform vec2 uOffset;   // posicion del mundo (0,0) en px de dispositivo
uniform float uZoom;    // px de dispositivo por unidad de mundo
out vec4 fragColor;

const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);

// Anclas del lore (unidades de mundo). Islas: triangulo equilatero de lado ~340.
const vec2 C_KOR = vec2(290.0, 440.0);  const vec2 R_KOR = vec2(220.0, 340.0);
const vec2 C_AUR = vec2(960.0, 790.0);  const vec2 R_AUR = vec2(290.0, 90.0);
const vec2 C_LEX = vec2(1630.0, 440.0); const vec2 R_LEX = vec2(220.0, 340.0);
const vec2 C_NIM = vec2(960.0, 215.0);  const vec2 R_NIM = vec2(90.0, 72.0);
const vec2 C_DRA = vec2(790.0, 509.0);  const vec2 R_DRA = vec2(90.0, 72.0);
const vec2 C_SEL = vec2(1130.0, 509.0); const vec2 R_SEL = vec2(90.0, 72.0);
// Lobulos extra (forma menos eliptica)
const vec2 C_KOR2 = vec2(380.0, 190.0); const vec2 R_KOR2 = vec2(130.0, 120.0);
const vec2 C_KOR3 = vec2(190.0, 700.0); const vec2 R_KOR3 = vec2(110.0, 100.0);
const vec2 C_LEX2 = vec2(1540.0, 200.0); const vec2 R_LEX2 = vec2(130.0, 110.0);
const vec2 C_LEX3 = vec2(1740.0, 710.0); const vec2 R_LEX3 = vec2(100.0, 90.0);
const vec2 C_AUR2 = vec2(740.0, 810.0); const vec2 R_AUR2 = vec2(130.0, 60.0);
const vec2 C_AUR3 = vec2(1160.0, 800.0); const vec2 R_AUR3 = vec2(110.0, 55.0);

// Paletas por region: Korthaven, Aurion, Lexmara, Nimrael, Drakonys, Selvareth
const vec3 PLAIN[6] = vec3[6](
  vec3(0.42, 0.42, 0.28), vec3(0.66, 0.60, 0.38), vec3(0.55, 0.70, 0.34),
  vec3(0.48, 0.42, 0.63), vec3(0.60, 0.35, 0.24), vec3(0.31, 0.60, 0.30));
const vec3 FOREST[6] = vec3[6](
  vec3(0.16, 0.23, 0.15), vec3(0.30, 0.36, 0.22), vec3(0.22, 0.46, 0.22),
  vec3(0.28, 0.22, 0.47), vec3(0.36, 0.22, 0.16), vec3(0.10, 0.40, 0.22));
const vec3 ROCK[6] = vec3[6](
  vec3(0.30, 0.25, 0.24), vec3(0.54, 0.48, 0.38), vec3(0.55, 0.55, 0.52),
  vec3(0.48, 0.45, 0.58), vec3(0.43, 0.23, 0.20), vec3(0.42, 0.48, 0.38));

float hash1(vec2 ip) {
  uvec2 u = uvec2(ivec2(ip));
  uint h = u.x * 374761393u + u.y * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return float(h & 0xFFFFFFu) * (1.0 / 16777216.0);
}

// value noise centrado en [-0.5, 0.5]
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

// fbm con LOD por tamano de pixel: las octavas subpixel se apagan (sin aliasing),
// las nuevas aparecen al hacer zoom -> detalle infinito.
// wlpx = longitud de onda de la octava 0 en px de pantalla.
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

float blob(vec2 p, vec2 c, vec2 r) {
  return 1.0 - length((p - c) / r);
}

// x = F (campo de tierra: >0 tierra), y = altura, z = mascara de montana
vec3 shape(vec2 p) {
  vec2 pn = p * 0.001;
  vec2 w = vec2(
    fbm(pn * 1.3 + vec2(3.1, 1.7), uZoom * 770.0, 4),
    fbm(pn * 1.3 + vec2(8.3, 2.8), uZoom * 770.0, 4));
  vec2 q = p + 130.0 * w;

  float F = max(
    max(max(blob(q, C_KOR, R_KOR), blob(q, C_AUR, R_AUR)), max(blob(q, C_LEX, R_LEX), blob(q, C_NIM, R_NIM))),
    max(blob(q, C_DRA, R_DRA), blob(q, C_SEL, R_SEL)));
  F = max(F, max(max(blob(q, C_KOR2, R_KOR2), blob(q, C_KOR3, R_KOR3)), max(blob(q, C_LEX2, R_LEX2), blob(q, C_LEX3, R_LEX3))));
  F = max(F, max(blob(q, C_AUR2, R_AUR2), blob(q, C_AUR3, R_AUR3)));

  vec2 qn = q * 0.001;
  F += 0.5 * fbm(qn * 2.0 + vec2(1.3, 7.7), uZoom * 500.0, 13);

  float mn = fbm(qn * 3.0 + vec2(5.5, 2.2), uZoom * 333.0, 7);
  float Fl = clamp(F, 0.0, 1.0);
  float mask = smoothstep(0.30, 0.55, mn + 0.25 * Fl - 0.05) * step(0.0, F);

  float rd = fbm(qn * 6.0 + vec2(9.0, 4.0), uZoom * 167.0, 8);
  float ridge = 1.0 - clamp(abs(rd) * 2.8, 0.0, 1.0);
  float h = Fl * 0.30 + mask * (0.22 + 0.5 * ridge);
  return vec3(F, h, mask);
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (sp - uOffset) / uZoom;

  float e = 1.5 / uZoom;
  vec3 s0 = shape(p);
  vec3 sx = shape(p + vec2(e, 0.0));
  vec3 sy = shape(p + vec2(0.0, e));

  float F = s0.x;
  vec2 gF = vec2(sx.x - F, sy.x - F) / e;
  float gmag = max(length(gF), 1e-5);
  float distW = F / gmag;           // distancia aprox. a la costa en unidades de mundo (+ tierra)
  float distPx = distW * uZoom;

  vec3 col;

  if (F < 0.0) {
    // ---------- OCEANO ----------
    float depth = clamp(-F / 0.55, 0.0, 1.0);
    col = mix(vec3(0.21, 0.52, 0.60), vec3(0.04, 0.15, 0.26), smoothstep(0.0, 1.0, depth));

    // isolineas suaves del campo F (curvas batimetricas), ancho ~1.2px
    float fw = max(fwidth(F), 1e-6);
    float tt = fract(-F / 0.07);
    float lw = 1.2 * fw / 0.07;
    float ln = smoothstep(lw, 0.0, min(tt, 1.0 - tt));
    ln *= 1.0 - smoothstep(0.15, 0.4, lw);
    ln *= 1.0 - smoothstep(0.0, 0.45, -F);
    col = mix(col, vec3(0.62, 0.82, 0.86), ln * 0.30);
    float foam = 1.0 - smoothstep(0.0, 2.0, -distPx);
    col = mix(col, vec3(0.86, 0.93, 0.92), foam * 0.85);
  } else {
    // ---------- TIERRA ----------
    vec2 pn = p * 0.001;
    float m = fbm(pn * 2.5 + vec2(4.0, 9.0), uZoom * 400.0, 7);
    float mask = s0.z;

    float b[6] = float[6](
      blob(p, C_KOR, R_KOR), blob(p, C_AUR, R_AUR), blob(p, C_LEX, R_LEX),
      blob(p, C_NIM, R_NIM), blob(p, C_DRA, R_DRA), blob(p, C_SEL, R_SEL));
    vec3 plain = vec3(0.0);
    vec3 forest = vec3(0.0);
    vec3 rock = vec3(0.0);
    float wsum = 0.0;
    for (int k = 0; k < 6; k++) {
      float wk = exp(5.0 * b[k]);
      plain += PLAIN[k] * wk;
      forest += FOREST[k] * wk;
      rock += ROCK[k] * wk;
      wsum += wk;
    }
    plain /= wsum;
    forest /= wsum;
    rock /= wsum;

    float forestness = smoothstep(-0.08, 0.14, m);
    vec3 ground = mix(plain, forest, forestness * 0.85);
    ground = mix(ground, rock, mask);

    vec3 sand = vec3(0.80, 0.74, 0.52);
    ground = mix(ground, sand, (1.0 - smoothstep(1.0, 5.0, distW)) * (1.0 - mask));

    // textura fina (aparece al hacer zoom, nunca se estira)
    float grain = fbm(pn * 333.0, uZoom * 3.0, 6);
    ground *= 1.0 + 0.30 * grain;

    // relieve (hillshade)
    vec2 gh = vec2(sx.y - s0.y, sy.y - s0.y) / e;
    vec3 nrm = normalize(vec3(-gh * 120.0, 1.0));
    float lit = dot(nrm, normalize(vec3(-0.55, -0.6, 0.6)));
    ground *= 0.62 + 0.55 * clamp(lit, 0.0, 1.2);

    // ---------- ARBOLES (estampas) ----------
    float tcell = 2.2;
    float tVis = smoothstep(5.0, 11.0, tcell * uZoom);
    float dens = clamp(forestness * 1.1 - 0.15, 0.0, 1.0) * (1.0 - mask) * smoothstep(2.0, 6.0, distW);
    if (tVis > 0.0 && dens > 0.0) {
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
          vec2 c = id + 0.5 + (vec2(r1, r2) - 0.5) * 0.55;
          float rad = 0.30 + 0.16 * r3;
          vec2 d = (g - c) / rad;
          if (length(d) < 1.0 && c.y > bestY) {
            bestY = c.y;
            bestD = vec3(d, r3);
            hit = true;
          }
        }
      }
      if (hit) {
        float r = length(bestD.xy);
        float l = clamp(dot(bestD.xy, normalize(vec2(-0.6, -0.7))) * 0.5 + 0.55, 0.0, 1.0);
        vec3 tc = mix(forest * 0.55, forest * 1.25 + vec3(0.04, 0.06, 0.0), l * (1.0 - r * 0.35));
        tc *= 1.0 - smoothstep(0.80, 1.0, r) * 0.55;
        tc *= 0.9 + 0.2 * bestD.z;
        ground = mix(ground, tc, tVis);
      } else {
        ground *= 1.0 - 0.14 * tVis;
      }
    }

    // ---------- MONTANAS (estampas) ----------
    float mcell = 11.0;
    float mVis = smoothstep(7.0, 14.0, mcell * uZoom);
    if (mVis > 0.0 && mask > 0.12) {
      vec2 g = p / mcell;
      vec2 gi = floor(g);
      float bestY = -1e9;
      vec4 bestM = vec4(0.0);
      bool hit = false;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 id = gi + vec2(float(i), float(j));
          float r0 = hash1(id + vec2(3.0, 77.0));
          if (r0 > mask * 1.15) continue;
          float r1 = hash1(id + vec2(13.0, 29.0));
          float r2 = hash1(id + vec2(61.0, 11.0));
          float r3 = hash1(id + vec2(5.0, 97.0));
          vec2 base = id + 0.5 + (vec2(r1, r2) - 0.5) * 0.6;
          float hw = 0.28 + 0.16 * r3;
          float hgt = 0.55 + 0.35 * r2;
          vec2 d = g - base;
          float ty = (d.y + hgt) / (hgt + 0.08);
          if (ty < 0.0 || ty > 1.0) continue;
          float w2 = hw * ty;
          if (abs(d.x) > w2 && true) continue;
          if (base.y > bestY) {
            bestY = base.y;
            bestM = vec4(d.x, ty, w2, r3);
            hit = true;
          }
        }
      }
      if (hit) {
        float side = bestM.x < 0.0 ? 1.0 : 0.0;
        vec3 face = side > 0.5 ? rock * 1.30 + vec3(0.06) : rock * 0.62;
        float snowLine = 0.26 + 0.12 * bestM.w;
        if (bestM.y < snowLine) {
          face = mix(face, vec3(0.94, 0.96, 0.99) * (side > 0.5 ? 1.0 : 0.76), 0.92);
        }
        float edgePx = (bestM.z - abs(bestM.x)) * mcell * uZoom;
        float basePx = (1.0 - bestM.y) * mcell * uZoom * 0.8;
        float edge = 1.0 - smoothstep(0.6, 1.6, min(edgePx, basePx));
        face = mix(face, vec3(0.10, 0.08, 0.07), edge * 0.8);
        ground = mix(ground, face, mVis);
      }
    }

    // linea de costa (tinta)
    float rim = 1.0 - smoothstep(0.6, 1.8, distPx);
    ground = mix(ground, ground * 0.35, rim * 0.8);

    col = ground;
  }

  col += (hash1(floor(gl_FragCoord.xy)) - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}
`;
