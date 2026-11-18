          vAncla = aAncla; vEstilo = aEstilo;
        vRise = alzado(aInfo.w, aInfo.x);
        #ifdef USE_INSTANCING
          // (los árboles de 1867 que quedan bajo una casa nueva o en medio de una calle nueva se van; los de los fondos, no.
          // Y con ellos lo de los patios, que lleva la distancia en negativo: los aljibes también)
          if (uEpocaK > 0.0 && ((aInfo.y > 49.5 && aInfo.y < 50.5) || (aInfo.w < -0.5 && aInfo.w > -9.0e4))) { vec2 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz; vec2 ouv = (o / uMetro + uPlaza) / uHoja; vec3 c = crecido(ouv, length(o)); vRise *= 1.0 - max(max(c.z, c.x * (1.0 - c.y)), despejado(ouv, length(o)).x); }
        #endif
        transformed.y *= vRise; vInfo = aInfo;
        // (lo que todavía no se levantó no existe: acostado, el plano es solo el plano)
        if (vRise <= 0.0 && (aInfo.y < 39.5 || aInfo.y > 49.5)) transformed = vec3(0.0, -1.0e4, 0.0);
        vWall = aWall;
        { vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWorld = (modelMatrix * wp).xyz;
          // todo se apoya en el terreno (salvo lo que vuela: SIN_RELIEVE)
          #ifndef SIN_RELIEVE
            // (los edificios hechos a mano suben enteros, a la altura de su ancla —src/hitos.js—: si cada punto se apoyara
            // por su cuenta, en la cuesta quedarían con el techo inclinado. Sin ancla el atributo vale cero.)
            // (y su pie baja hasta el suelo donde el terreno queda más abajo que el ancla, para que no floten)
            float suelo = altura(vWorld.xz), sy = 1.0;
            if (aAncla.z > 0.5) { float sa = altura(aAncla.xy); suelo = position.y < 0.05 ? min(suelo, sa) : sa; }
            #ifdef USE_INSTANCING
              sy = length(instanceMatrix[1].xyz);
            #endif
            transformed.y += suelo / max(sy, 1.0e-4); vWorld.y += suelo;
          #endif
        }