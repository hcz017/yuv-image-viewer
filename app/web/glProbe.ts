export interface GlCapabilities {
  webgl2: boolean;
  maxTextureSize: number;
  fragmentHighp: boolean;
  renderer: string;
  error?: string;
}

export function probeGl(): GlCapabilities {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;

  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  } catch (error) {
    return {
      webgl2: false,
      maxTextureSize: 0,
      fragmentHighp: false,
      renderer: "unknown",
      error: String(error),
    };
  }

  if (!gl) {
    return {
      webgl2: false,
      maxTextureSize: 0,
      fragmentHighp: false,
      renderer: "unknown",
      error: "WebGL2 上下文创建失败",
    };
  }

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const fragmentHighp = Boolean(precision && precision.precision > 0);

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    : "unknown";

  let error: string | undefined;
  const texture = gl.createTexture();
  if (texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      1,
      1,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      new Uint8Array([128])
    );
    if (gl.getError() !== gl.NO_ERROR) {
      error = "R8 纹理上传失败";
    }
  }

  gl.viewport(0, 0, 2, 2);
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixel = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  if (!error && pixel[0] < 200) {
    error = "实际渲染输出异常（可能是软件渲染或合成器问题）";
  }

  return {
    webgl2: true,
    maxTextureSize,
    fragmentHighp,
    renderer,
    error,
  };
}
