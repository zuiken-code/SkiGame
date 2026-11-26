import * as THREE from 'three'

export function createProtectionBarrier() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      violet: { value: new THREE.Color('#6838e8') },
      cyan: { value: new THREE.Color('#3ae3ff') },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 shellPoint;
      varying vec3 viewNormal;
      varying vec3 viewPosition;

      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        shellPoint = position;
        viewNormal = normalMatrix * normal;
        viewPosition = view.xyz;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 violet;
      uniform vec3 cyan;
      varying vec3 shellPoint;
      varying vec3 viewNormal;
      varying vec3 viewPosition;

      float hexLines(vec2 point) {
        vec2 spacing = vec2(1.0, 1.73205);
        vec2 first = mod(point, spacing) - spacing * 0.5;
        vec2 second = mod(point - spacing * 0.5, spacing) - spacing * 0.5;
        vec2 cell = abs(dot(first, first) < dot(second, second) ? first : second);
        float edge = 0.5 - max(cell.x, dot(cell, vec2(0.5, 0.866025)));
        return 1.0 - smoothstep(0.025, 0.071, edge);
      }

      void main() {
        vec3 point = normalize(shellPoint);
        float facing = clamp(dot(normalize(viewNormal), normalize(-viewPosition)), 0.0, 1.0);
        float rim = pow(1.0 - facing, 1.4);
        float angle = atan(point.x, point.z);
        float grid = hexLines(vec2(angle, asin(clamp(point.y, -1.0, 1.0))) * 5.0);
        grid *= smoothstep(0.05, 0.5, facing) * (1.0 - smoothstep(0.82, 1.0, abs(point.y)));

        float shimmer = 0.5 + 0.5 * sin(angle * 2.0 + point.y * 4.0 - time * 3.0);
        float sweepHeight = dot(point, vec3(0.31, 0.88, 0.36));
        float sweep = 1.0 - smoothstep(0.025, 0.11, abs(sweepHeight - 0.74 * sin(time * 3.1)));
        float glow = max(rim * (0.32 + 0.68 * shimmer), sweep * 0.85);
        vec3 color = mix(violet, cyan, glow);
        float opacity = 0.08 + rim * 0.62 + grid * 0.17 + sweep * 0.19;
        gl_FragColor = vec4(color, min(opacity, 0.92));
        #include <colorspace_fragment>
      }
    `,
  })
  const barrier = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), material)
  barrier.scale.set(1.34, 1.34, 1.43)
  barrier.visible = false
  return barrier
}
