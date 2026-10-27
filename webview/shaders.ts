export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
uniform vec4 uRect;
uniform vec4 uUV;
out vec2 vUV;
void main() {
  vec4 pos = vec4(uRect.x + aPos.x * uRect.z, uRect.y + aPos.y * uRect.w, 0.0, 1.0);
  gl_Position = pos;
  vUV = uUV.xy + aPos * uUV.zw;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uY;
uniform sampler2D uC0;
uniform sampler2D uC1;
uniform int uMode;
uniform vec3 uCoeff;
uniform float uBu;

float sample8(float value) {
  return floor(value * 255.0 + 0.5);
}

float low10(float lo, float hi) {
  return floor(lo * 255.0 + 0.5) + mod(floor(hi * 255.0 + 0.5), 4.0) * 256.0;
}

void main() {
  float y;
  float u;
  float v;

  if (uMode == 0) {
    y = sample8(texture(uY, vUV).r);
    vec2 c = texture(uC0, vUV).rg;
    u = sample8(c.r);
    v = sample8(c.g);
  } else if (uMode == 1) {
    y = sample8(texture(uY, vUV).r);
    vec2 c = texture(uC0, vUV).rg;
    v = sample8(c.r);
    u = sample8(c.g);
  } else if (uMode == 2) {
    y = sample8(texture(uY, vUV).r);
    u = sample8(texture(uC0, vUV).r);
    v = sample8(texture(uC1, vUV).r);
  } else if (uMode == 3) {
    y = sample8(texture(uY, vUV).g);
    vec4 c = texture(uC0, vUV);
    u = sample8(c.g);
    v = sample8(c.a);
  } else {
    y = low10(texture(uY, vUV).r, texture(uY, vUV).g) / 4.0;
    vec4 c = texture(uC0, vUV);
    u = low10(c.r, c.g) / 4.0;
    v = low10(c.b, c.a) / 4.0;
  }

  float uc = u - 128.0;
  float vc = v - 128.0;
  vec3 rgb = vec3(
    y + uCoeff.x * vc,
    y - uCoeff.y * uc - uCoeff.z * vc,
    y + uBu * uc
  );

  fragColor = vec4(clamp(rgb / 255.0, 0.0, 1.0), 1.0);
}
`;

export function shaderMode(format: string, alignment: "high" | "low" | "unknown"): number {
  switch (format) {
    case "nv21":
      return 1;
    case "i420":
    case "yv12":
      return 2;
    case "p010":
      return alignment === "low" ? 4 : 3;
    default:
      return 0;
  }
}
