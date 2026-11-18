import * as THREE from "three";
import type { CityUniforms } from "./CityUniforms";
import clGlsl from "./glsl/cl.glsl?raw";
import llGlsl from "./glsl/ll.glsl?raw";
import opaqueGlsl from "./glsl/opaque.glsl?raw";

/** Vertex: atributos del original + soporte InstancedMesh. */
const BEGIN_VERTEX = /* glsl */ `
  vAncla = aAncla;
  vEstilo = aEstilo;
  vInfo = aInfo;
  vWall = aWall;
  #ifdef USE_INSTANCING
    // caja unitaria escalada: reconstruir UV de fachada/azotea
    vec3 sc = vec3(
      length(instanceMatrix[0].xyz),
      length(instanceMatrix[1].xyz),
      length(instanceMatrix[2].xyz)
    );
    float along = (position.z + 0.5) * max(sc.z, 0.001);
    float up = (position.y + 0.5) * max(sc.y, 0.001);
    float span = max(aWall.z, sc.z);
    float tall = max(aWall.w, sc.y);
    vWall = vec4(along, up, span, tall);
  #endif
  vRise = alzado(aInfo.w, aInfo.x);
  #ifdef USE_INSTANCING
    if (uEpocaK > 0.0 && ((aInfo.y > 49.5 && aInfo.y < 50.5) || (aInfo.w < -0.5 && aInfo.w > -9.0e4))) {
      vec2 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
      vec2 ouv = (o / uMetro + uPlaza) / uHoja;
      vec3 c = crecido(ouv, length(o));
      vRise *= 1.0 - max(max(c.z, c.x * (1.0 - c.y)), despejado(ouv, length(o)).x);
    }
  #endif
  transformed.y *= max(vRise, 0.0);
  if (vRise <= 0.001 && (aInfo.y < 39.5 || aInfo.y > 49.5)) {
    transformed = vec3(0.0, -1.0e4, 0.0);
  }
  {
    vec4 wp = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
    #endif
    vWorld = (modelMatrix * wp).xyz;
    #ifndef SIN_RELIEVE
      float suelo = altura(vWorld.xz), sy = 1.0;
      if (aAncla.z > 0.5) {
        float sa = altura(aAncla.xy);
        suelo = position.y < 0.05 ? min(suelo, sa) : sa;
      }
      #ifdef USE_INSTANCING
        sy = length(instanceMatrix[1].xyz);
      #endif
      transformed.y += suelo / max(sy, 1.0e-4);
      vWorld.y += suelo;
    #endif
  }
`;

const ATTR_COMMON = /* glsl */ `
attribute vec4 aInfo;
attribute vec4 aWall;
attribute vec3 aAncla;
attribute float aEstilo;
varying vec4 vInfo;
varying vec3 vWorld;
varying vec4 vWall;
varying float vRise;
varying vec3 vAncla;
varying float vEstilo;
`;

function patchShader(
  shader: THREE.WebGLProgramParametersWithUniforms,
  shared: CityUniforms,
  manto: number,
) {
  Object.assign(shader.uniforms, shared.U);
  shader.uniforms.uManto = { value: manto };
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>\n${ATTR_COMMON}\n${clGlsl}`,
    )
    .replace("#include <begin_vertex>", `#include <begin_vertex>\n${BEGIN_VERTEX}`);

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec4 vInfo; varying vec3 vWorld; varying vec4 vWall; varying float vRise; varying vec3 vAncla; varying float vEstilo;
uniform vec4 uSobre; uniform vec4 uSobreQue; uniform float uManto;
${clGlsl}
${llGlsl}`,
    )
    .replace(
      "#include <opaque_fragment>",
      opaqueGlsl,
    )
    .replace("#include <tonemapping_fragment>", "")
    .replace("#include <colorspace_fragment>", "");
}

/**
 * Material de ciudad / hitos (MeshStandard + shader del original).
 * manto: 0 plano · 1 hitos · 2 patios · 3 ciudad tipologías
 */
export function makeCityMaterial(
  shared: CityUniforms,
  opts: { manto?: number; polygonOffset?: boolean; polygonOffsetFactor?: number; polygonOffsetUnits?: number } = {},
): THREE.MeshStandardMaterial {
  const manto = opts.manto ?? 3;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
    polygonOffset: opts.polygonOffset ?? false,
    polygonOffsetFactor: opts.polygonOffsetFactor ?? 0,
    polygonOffsetUnits: opts.polygonOffsetUnits ?? 0,
  });
  mat.onBeforeCompile = (shader) => patchShader(shader, shared, manto);
  mat.customProgramCacheKey = () => `baires-city-m${manto}`;
  return mat;
}

export function makeCityDepthMaterial(shared: CityUniforms): THREE.MeshDepthMaterial {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared.U);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${ATTR_COMMON}\n${clGlsl}`,
      )
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${BEGIN_VERTEX}`);
  };
  mat.customProgramCacheKey = () => "baires-city-depth";
  return mat;
}

/** Tonos de hitos (parte entera de la semilla, como el original). */
export const Tono = {
  BLANCO: 0,
  CREMA: 1,
  ROSA: 2,
  GRIS: 3,
  LADRILLO: 4,
  SILLAR: 5,
} as const;

/** Semilla con tono embebido (seed > 1.5 → usa paleta de hito). */
export function seedConTono(tono: number, fract = 0.37): number {
  return 2 + tono + Math.min(0.99, Math.max(0.01, fract));
}
