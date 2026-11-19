
  /** El plano en un punto del mundo: 0 tinta, 1 papel. De cerca, los bordes de la tinta se afilan en vez de borronearse. */
  float tinta(vec2 xz) {
    vec2 px = xz / uMetro + uPlaza, uv = px / uHoja, dx = dFdx(px), dy = dFdy(px);
    // cuántos píxeles del escaneo entran en un píxel de pantalla
    float t = max(length(dx), length(dy));
    float g = textureGrad(tMedio, uv, dx / uHoja, dy / uHoja).r, res = uMedioRes;
    // de cerca, la tesela fina que toque (hay cuatro cargadas: las que rodean lo que se mira)
    if (t < uMedioRes) {
      float gf = g, hay = 0.0;
      #define FINO(i) { vec2 f = (uv - uFino[i].xy) / uFino[i].zw; if (uFinoOn[i] > 0.5 && f.x >= 0.0 && f.y >= 0.0 && f.x < 1.0 && f.y < 1.0) { gf = textureGrad(tFino[i], f, dx / (uHoja * uFino[i].zw), dy / (uHoja * uFino[i].zw)).r; hay = 1.0; } }
      FINO(0) FINO(1) FINO(2) FINO(3)
      hay *= 1.0 - smoothstep(0.7, 1.0, t / uMedioRes);
      g = mix(g, gf, hay); res = mix(uMedioRes, 1.0, hay);
    }
    t /= res;
    float a = clamp(t, 0.16, 1.0) * 0.5, s = smoothstep(0.52 - a, 0.52 + a, g);
    return mix(g, s, 0.8 * (1.0 - smoothstep(0.5, 1.1, t)));
  }
  // --- lo de hoy: el mapa actual, estampado en rojo sobre el plano ---
  uniform sampler2D tHoyCerca; uniform sampler2D tHoyLejos; uniform float uHoy; uniform float uHoyRes; uniform vec3 uRojo;
  float rayas(float v, float w) { return 1.0 - smoothstep(0.26 - w, 0.26 + w, abs(fract(v + 0.5) - 0.5) * 2.0); }
  /** Las calles, las vías y la costa de hoy en línea, y rayada la tierra que se le ganó al río. */
  vec3 hoy(vec3 col, vec2 xz) {
    vec2 px = xz / uMetro + uPlaza, uv = px / uHoja;
    if (uHoy <= 0.0 || uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return col;
    vec2 dx = dFdx(px), dy = dFdy(px);
    float t = max(length(dx), length(dy)) / uHoyRes; // cuántos píxeles de la lámina de cerca entran en uno de pantalla
    // De lejos quedan las avenidas, las vías y la costa. Al acercarse entran todas las calles, con el borde afilado.
    // Y bien de cerca, cuando la línea ya sería una franja, queda solo su contorno: la calle de hoy, a dos trazos.
    float c = textureGrad(tHoyCerca, uv, dx / uHoja, dy / uHoja).r, a = clamp(t, 0.12, 1.0) * 0.5;
    float fina = mix(smoothstep(0.5 - a, 0.5 + a, c), c, smoothstep(0.7, 1.3, t));
    float orilla = 1.0 - smoothstep(0.7, 1.5, abs(c - 0.5) / max(length(vec2(dFdx(c), dFdy(c))), 1.0e-4));
    fina = mix(fina, max(orilla, fina * 0.16), 1.0 - smoothstep(0.2, 0.5, t));
    vec3 L = textureGrad(tHoyLejos, uv, dx / uHoja, dy / uHoja).rgb;
    float lejos = smoothstep(1.7, 3.2, t), linea = mix(fina, max(L.r, fina * 0.3), lejos);
    // la tierra ganada al río: un rayado que guarda su paso en la pantalla (cada nivel dobla el anterior)
    float g = smoothstep(0.35, 0.65, L.g);
    if (g > 0.0) {
      float m = t * uHoyRes * uMetro, n = log2(max(m, 0.01) * 13.0), n0 = floor(n), p = exp2(n0), d = (xz.x + xz.y) * 0.7071;
      float w = clamp(m / p * 1.5, 0.02, 0.5);
      float r = mix(rayas(d / p, w), rayas(d / (p * 2.0), w * 0.5), smoothstep(0.35, 1.0, n - n0));
      col = mix(col, uRojo, uHoy * g * (0.08 + 0.34 * r));
    }
    return mix(col, uRojo, uHoy * linea * 0.9);
  }
  float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
  float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
  // --- en color ---
  uniform sampler2D tSuelo; uniform sampler2D tCalles; uniform vec4 uMarco; uniform float uMatas;
  /** Lo mismo que llego(), para la lámina de las calles (tools/crece.mjs), que cuenta desde 1867: la etapa e vale (7 − e)/7. */
  float llego7(float v, float k) { float u = (6.5 - k) / 7.0; return smoothstep(u - 0.02, u + 0.02, v); }
  /** Cuánto color lleva un punto: todo adentro de la guarda del plano, nada afuera (ahí sigue el papel). */
  float enColor(vec2 xz) {
    if (uColor <= 0.0) return 0.0;
    vec2 uv = (xz / uMetro + uPlaza) / uHoja, a = smoothstep(uMarco.xy - 0.0015, uMarco.xy + 0.0015, uv) * (1.0 - smoothstep(uMarco.zw - 0.0015, uMarco.zw + 0.0015, uv));
    return uColor * a.x * a.y;
  }
  /** La luz, en color: tibia al sol, azulada a la sombra. */
  vec3 luzColor(float luz) { return mix(vec3(0.5, 0.53, 0.64), vec3(1.07, 1.01, 0.9), smoothstep(0.3, 0.95, luz)); }
  /** El suelo pintado. papel: el plano en ese punto (su tinta queda como un dibujo tenue debajo del color). */
  vec3 sueloColor(vec2 xz, float papel) {
    vec2 uv = (xz / uMetro + uPlaza) / uHoja;
    vec3 s = texture(tSuelo, uv).rgb, lejos = textureLod(tSuelo, uv, 5.0).rgb, zona = textureLod(tSuelo, uv, 7.0).rgb; // R río · G patio · B edificado
    // con los años: el río retrocede donde se le ganó tierra, y aparecen las manzanas nuevas con sus calles
    float urb = 0.0, verde = 0.0, calz = 0.0, vereda = 0.0;
    if (uEpocaK > 0.0) {
      float d = length(xz); vec3 c = crecido(uv, d); vec2 des = despejado(uv, d);
      urb = llego(textureLod(tCrece, uv, 3.0).r, epocaEn(d)); s.r *= 1.0 - c.x; lejos.r *= 1.0 - llego(textureLod(tCrece, uv, 4.0).r, epocaEn(d));
      // (y donde se abrió una avenida o una plaza, ni casas ni fondos: la calle)
      s.g = max(s.g, c.y) * (1.0 - des.x); s.b = max(s.b, c.z) * (1.0 - des.x); verde = des.y;
      // la calzada de las avenidas nuevas y, a cada lado (lo despejado a menos de unos metros de ella), la vereda
      float ke = epocaEn(d); calz = calzadaEn(uv, ke);
      // (hasta unos 8 m de la calzada, haya o no casas atrás: lo que quede debajo de un edificio no se ve)
      { vec2 o = vec2(5.0 / uMetro) / uHoja, p = o * 1.3; vereda = max(max(max(calzadaEn(uv + vec2(o.x, 0.0), ke), calzadaEn(uv - vec2(o.x, 0.0), ke)), max(calzadaEn(uv + vec2(0.0, o.y), ke), calzadaEn(uv - vec2(0.0, o.y), ke))), max(max(calzadaEn(uv + p, ke), calzadaEn(uv - p, ke)), max(calzadaEn(uv + vec2(p.x, -p.y), ke), calzadaEn(uv + vec2(-p.x, p.y), ke)))) * (1.0 - calz) * (1.0 - verde); }
    }
    float n = n3(vec3(xz * 0.045, 1.0)) * 0.6 + n3(vec3(xz * 0.3, 2.0)) * 0.4, nf = n3(vec3(xz * 1.9, 3.0));
    // en la ciudad, tierra apisonada; en las afueras (donde casi no hay nada edificado alrededor), pasto
    vec3 tierra = mix(vec3(0.6, 0.5, 0.375), vec3(0.75, 0.655, 0.5), n) * (0.94 + 0.12 * nf);
    vec3 pasto = mix(vec3(0.36, 0.43, 0.2), vec3(0.6, 0.57, 0.31), n) * (0.9 + 0.2 * nf);
    vec3 col = mix(pasto, tierra, max(urb, max(smoothstep(0.03, 0.2, zona.g + zona.b), smoothstep(0.02, 0.25, zona.r))));
    // los patios y los fondos: tierra más oscura con manchones de pasto ralo. Los árboles son de verdad (src/patios.js)
    // hasta uMatas metros de la cámara; más lejos, y donde la ciudad todavía no se levantó, van pintados: unas matas
    float mata = smoothstep(0.5, 0.62, n3(vec3(xz * 0.15, 5.0)) * 0.6 + n3(vec3(xz * 0.42, 6.0)) * 0.4);
    if (uMatas > 0.0) mata *= max(smoothstep(uMatas - 900.0, uMatas + 100.0, distance(cameraPosition, vec3(xz.x, 0.0, xz.y))), 1.0 - clamp((uFront - length(xz)) / 300.0, 0.0, 1.0));
    vec3 fondo = mix(vec3(0.55, 0.46, 0.32), vec3(0.63, 0.54, 0.38), n3(vec3(xz * 0.07, 4.0))) * (0.88 + 0.2 * nf);
    fondo = mix(fondo, mix(vec3(0.4, 0.44, 0.2), vec3(0.5, 0.52, 0.26), nf), 0.5 * smoothstep(0.5, 0.78, n3(vec3(xz * 0.11, 8.0)) * 0.65 + n3(vec3(xz * 0.5, 9.0)) * 0.35));
    fondo = mix(fondo, mix(vec3(0.17, 0.25, 0.11), vec3(0.3, 0.38, 0.16), nf), mata);
    float patio = smoothstep(0.3, 0.7, s.g);
    col = mix(col, fondo, patio);
    // lo edificado, mientras está acostado: el color de las azoteas
    col = mix(col, vec3(0.66, 0.43, 0.33) * (0.9 + 0.2 * n), smoothstep(0.4, 0.7, s.b));
    // las calles (tCalles: R desde cuándo tienen piedra, G desde cuándo son lisas, B cuánto del punto es calle). En
    // 1867, el empedrado bruto del centro —piedra despareja, con barro en las juntas—; después el adoquín de granito;
    // las lisas, de madera hasta el Centenario y de asfalto después. Lo que todavía no se pavimentó sigue de tierra.
    // Pegado a las casas (donde B baja) va la vereda: de ladrillo y piedra primero, de baldosa clara después.
    vec3 cs = texture(tCalles, uv).rgb;
    float k7 = uEpocaK > 0.0 ? epocaEn(length(xz)) : 0.0, lejosC = clamp(length(fwidth(xz)) / 7.0 - 0.35, 0.0, 1.0);
    float sup = mix(smoothstep(0.28, 0.58, cs.b), cs.b, lejosC), lisoC = llego7(cs.g, k7), pav = max(llego7(cs.r, k7), lisoC) * sup;
    float nb = n3(vec3(xz * 1.25, 11.0));
    vec3 bruto = mix(vec3(0.47, 0.42, 0.35), vec3(0.67, 0.62, 0.53), nb) * (0.92 + 0.16 * n);
    vec3 adoquin = mix(vec3(0.47, 0.45, 0.42), vec3(0.58, 0.55, 0.5), n) * (0.9 + 0.2 * nf);
    vec3 lisoCol = mix(vec3(0.4, 0.34, 0.28), vec3(0.33, 0.33, 0.34), smoothstep(3.6, 5.0, k7)) * (0.92 + 0.14 * n) * (0.97 + 0.06 * nf);
    vec3 calzCol = mix(mix(bruto, adoquin, smoothstep(0.25, 1.0, k7)), lisoCol, lisoC);
    vec3 veredaCol = mix(vec3(0.71, 0.61, 0.5), vec3(0.8, 0.775, 0.71), smoothstep(0.25, 1.0, k7)) * (0.94 + 0.1 * nf);
    float cordon = (1.0 - smoothstep(0.6, 0.86, cs.b)) * (1.0 - lejosC);
    col = mix(col, mix(calzCol, veredaCol, cordon * 0.9), pav * 0.94 * (1.0 - smoothstep(0.4, 0.7, s.b)) * (1.0 - patio * 0.8));
    // las veredas anchas de las avenidas nuevas
    col = mix(col, veredaCol, vereda * (1.0 - pav) * 0.95);
    // el césped de las plazas y los parques nuevos
    col = mix(col, mix(mix(vec3(0.34, 0.41, 0.19), vec3(0.5, 0.52, 0.27), n), vec3(0.22, 0.3, 0.13), mata * 0.55) * (0.92 + 0.16 * nf), verde * 0.92);
    col *= mix(mix(0.74, 0.93, patio), 1.0, papel);
    // el río: barro en suspensión, con el oleaje apenas; y la playa mojada en la orilla
    float ola = n3(vec3(xz.x * 0.018, xz.y * 0.07, 7.0)) * 0.65 + n3(vec3(xz.x * 0.09, xz.y * 0.33, 9.0)) * 0.35;
    // mar/bahía: verde-gris profundo (no celeste ni barro BA)
    vec3 agua = mix(vec3(0.22, 0.3, 0.3), vec3(0.34, 0.42, 0.4), ola) * mix(0.93, 1.0, papel);
    agua = mix(agua, vec3(0.4, 0.48, 0.46), 0.22 * smoothstep(0.5, 0.95, n3(vec3(xz.x * 0.05, xz.y * 0.21, 13.0)) * 0.6 + n3(vec3(xz.x * 0.17, xz.y * 0.6, 14.0)) * 0.4) * smoothstep(0.35, 0.8, ola));
    // (la playa es de la costa natural: donde la tierra se le ganó al río hay murallón, no playa)
    col = mix(col, vec3(0.52, 0.45, 0.35), smoothstep(0.1, 0.5, lejos.r) * (1.0 - smoothstep(0.4, 0.6, s.r)) * 0.55 * (1.0 - urb));
    col = mix(col, agua, smoothstep(0.35, 0.65, s.r));
    // el murallón de los diques y de la costa nueva: el borde de piedra, oscuro, entre el muelle y el agua
    float muralla = smoothstep(0.1, 0.38, s.r) * (1.0 - smoothstep(0.62, 0.9, s.r)) * smoothstep(0.2, 0.55, urb);
    return mix(col, vec3(0.31, 0.29, 0.26), muralla * 0.8);
  }