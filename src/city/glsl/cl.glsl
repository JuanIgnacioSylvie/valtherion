
  uniform sampler2D tMedio; uniform sampler2D tFino[4]; uniform vec4 uFino[4]; uniform float uFinoOn[4]; uniform float uMedioRes;
  uniform vec2 uHoja; uniform vec2 uPlaza; uniform float uMetro; uniform float uFront; uniform float uFlat;
  uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uSombra; uniform float uColor;
  // --- la línea de tiempo: la ciudad que crece y cambia (tools/crece.mjs). uEpocaK va de 0 (1867) a uEtapas (el último
  // plano), pasando por cada uno; tCrece dice de cada punto «desde cuándo»: R lo urbanizado y la tierra ganada al río,
  // G los fondos de las manzanas nuevas, B lo edificado (1 = la primera etapa, 1/uEtapas = la última, 0 = nunca).
  // tDespeje, con la misma cuenta, lo que se abrió: R lo demolido para una avenida o una plaza, G el verde nuevo y B
  // la calzada empedrada de las avenidas nuevas. ---
  uniform sampler2D tCrece; uniform sampler2D tDespeje; uniform float uEpocaK; uniform float uEtapas;
  /** El año que «ya llegó» a esa distancia de la plaza: cada etapa avanza como una ola que sale del centro. */
  float epocaEn(float dist) { float k = min(uEpocaK, uEtapas - 0.0001), e = floor(k); return e + clamp((k - e) * 1.5 - 0.5 * clamp(dist / 7000.0, 0.0, 1.0), 0.0, 1.0); }
  /** Cuánto se levantó una casa de la etapa et (cada una a su tiempo, según su semilla). */
  float nacido(float et, float seed, float dist) { return smoothstep(0.1 + 0.45 * seed, 0.45 + 0.45 * seed, epocaEn(dist) - (et - 1.0)); }
  float llego(float v, float k) { float u = (uEtapas + 0.5 - k) / uEtapas, m = 0.15 / uEtapas; return smoothstep(u - m, u + m, v); }
  /** Lo que se despejó hasta el año que se mira: x demolido (calle o plaza donde había manzana) · y verde nuevo. */
  vec2 despejado(vec2 uv, float dist) {
    if (uEpocaK <= 0.0) return vec2(0.0);
    float k = epocaEn(dist); vec2 c = texture(tDespeje, uv).rg;
    return vec2(llego(c.r, k), llego(c.g, k));
  }
  /** La calzada de las avenidas nuevas, hasta el año que se mira. */
  float calzadaEn(vec2 uv, float k) { return llego(texture(tDespeje, uv).b, k); }
  /** Lo que creció hasta el año que se mira, en un punto de la hoja: x urbanizado o ganado al río · y fondo · z edificado. */
  vec3 crecido(vec2 uv, float dist) {
    if (uEpocaK <= 0.0) return vec3(0.0);
    float k = epocaEn(dist); vec3 c = texture(tCrece, uv).rgb;
    return vec3(llego(c.r, k), llego(c.g, k), llego(c.b, k));
  }
  /** Cuánto se levantó lo que está a "dist" metros de la plaza: la ciudad sube como una ola que sale del centro. */
  float alzado(float dist, float seed) {
    // (con la distancia en negativo: lo que solo existe en color —los árboles y aljibes de los patios, src/patios.js—.
    // Crece al prenderse el color, cada uno a su tiempo, y con el color apagado no está.)
    if (dist < -9.0e4) return 1.0; // (el avión, src/modos.js: nunca se acuesta ni depende del color)
    // (con 20 000 por etapa sumados a la distancia: lo que nace o se va con los años —la línea de tiempo, src/epocas.js—.
    // El número es nace + 8 · muere: la etapa en que se levanta (0: está desde 1867) y la etapa en que se va (0: nunca).)
    float nace = 0.0, muere = 0.0;
    if (seed > 1.5) seed = fract(seed); // (los edificios con nombre llevan su tono en la parte entera, src/hitos.js)
    if (dist > 15000.0) { float et = floor(dist / 20000.0 + 0.01); dist -= et * 20000.0; muere = floor(et / 8.0 + 0.01); nace = et - 8.0 * muere; }
    float c = (nace > 0.5 ? nacido(nace, seed, dist) : 1.0) * (muere > 0.5 ? 1.0 - nacido(muere, seed, dist) : 1.0);
    if (dist < 0.0) { dist = -dist - 1.0; c = smoothstep(0.0, 1.0, uColor * 1.6 - seed * 0.6); }
    float t = clamp((uFront - dist - seed * 140.0) / 300.0, 0.0, 1.0), s = t - 1.0;
    return t <= 0.0 ? 0.0 : (1.0 + 2.2 * s * s * s + 1.2 * s * s) * c;
  }
  // --- el relieve: la barranca y las lomas (src/relieve.js). Acostado, el plano es una hoja lisa; el terreno se
  // hincha con la misma ola que levanta la ciudad. ---
  uniform sampler2D tRelieve; uniform float uRelieve;
  /** La altura del terreno en un punto del mundo, en metros. */
  float altura(vec2 xz) {
    if (uRelieve <= 0.0) return 0.0;
    float k = clamp((uFront - length(xz)) / 300.0, 0.0, 1.0);
    return texture(tRelieve, (xz / uMetro + uPlaza) / uHoja).r * uRelieve * k * k * (3.0 - 2.0 * k);
  }