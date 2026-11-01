import { coefficients } from "../common/colorspace";
import type { P010Alignment } from "../common/bitdepth";
import type { ColorStandard, Spec } from "../common/types";
import { FRAGMENT_SHADER, VERTEX_SHADER, shaderMode } from "./shaders";

export interface ClipRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScissorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("无法创建着色器");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`着色器编译失败：${log ?? "unknown"}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("无法创建着色器程序");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`着色器链接失败：${log ?? "unknown"}`);
  }
  return program;
}

export class Renderer {
  readonly maxTextureSize: number;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buffer: WebGLBuffer;
  private textures: WebGLTexture[] = [];
  private spec: Spec | null = null;
  private mode = 0;
  private standard: ColorStandard = "bt601";

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      throw new Error("WebGL2 不可用");
    }
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    this.program = createProgram(gl);

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) {
      throw new Error("无法创建顶点缓冲");
    }
    this.vao = vao;
    this.buffer = buffer;

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const location = gl.getAttribLocation(this.program, "aPos");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  get loaded(): boolean {
    return this.spec !== null;
  }

  get currentSpec(): Spec | null {
    return this.spec;
  }

  setStandard(standard: ColorStandard) {
    this.standard = standard;
  }

  upload(spec: Spec, data: Uint8Array, alignment: P010Alignment): boolean {
    const gl = this.gl;
    const bps = spec.bytesPerSample;
    if (spec.stride > this.maxTextureSize || spec.scanline > this.maxTextureSize) {
      return false;
    }

    const yBytes = spec.stride * spec.scanline * bps;
    if (data.length < yBytes) {
      return false;
    }

    this.disposeTextures();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const yTex = this.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, yTex);
    if (bps === 2) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RG8,
        spec.stride,
        spec.scanline,
        0,
        gl.RG,
        gl.UNSIGNED_BYTE,
        data.subarray(0, yBytes)
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        spec.stride,
        spec.scanline,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        data.subarray(0, yBytes)
      );
    }
    this.applyTextureParams();

    const chromaWidth = Math.floor(spec.stride / 2);
    const chromaHeight = Math.floor(spec.scanline / 2);
    const chromaBase = yBytes;

    if (spec.format === "i420" || spec.format === "yv12") {
      const planeSize = chromaWidth * chromaHeight * bps;
      const uOffset =
        spec.format === "yv12" ? chromaBase + planeSize : chromaBase;
      const vOffset =
        spec.format === "yv12" ? chromaBase : chromaBase + planeSize;
      const uTex = this.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, uTex);
      this.texImageChroma(chromaWidth, chromaHeight, bps, data, uOffset, planeSize);
      const vTex = this.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, vTex);
      this.texImageChroma(chromaWidth, chromaHeight, bps, data, vOffset, planeSize);
      this.textures = [yTex, uTex, vTex];
    } else {
      const chromaTex = this.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, chromaTex);
      const chromaLen = chromaWidth * chromaHeight * 2 * bps;
      if (data.length >= chromaBase + chromaLen) {
        if (bps === 2) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA8,
            chromaWidth,
            chromaHeight,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data.subarray(chromaBase, chromaBase + chromaLen)
          );
        } else {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RG8,
            chromaWidth,
            chromaHeight,
            0,
            gl.RG,
            gl.UNSIGNED_BYTE,
            data.subarray(chromaBase, chromaBase + chromaLen)
          );
        }
        this.applyTextureParams();
      }
      this.textures = [yTex, chromaTex, chromaTex];
    }

    this.spec = spec;
    this.mode = shaderMode(spec.format, alignment);
    return true;
  }

  private createTexture(): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error("无法创建纹理");
    }
    return texture;
  }

  private texImageChroma(
    width: number,
    height: number,
    bps: 1 | 2,
    data: Uint8Array,
    offset: number,
    length: number
  ) {
    const gl = this.gl;
    if (data.length < offset + length) {
      return;
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      data.subarray(offset, offset + length)
    );
    this.applyTextureParams();
  }

  private applyTextureParams() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  draw(rect: ClipRect, scissor: ScissorRect) {
    const gl = this.gl;
    if (!this.spec) {
      return;
    }

    const spec = this.spec;
    const uvWidth = spec.width / spec.stride;
    const uvHeight = spec.height / spec.scanline;
    const c = coefficients(this.standard);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(scissor.x, scissor.y, Math.max(0, scissor.width), Math.max(0, scissor.height));
    gl.clearColor(0.05, 0.06, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform4f(gl.getUniformLocation(this.program, "uRect"), rect.x, rect.y, rect.w, rect.h);
    gl.uniform4f(
      gl.getUniformLocation(this.program, "uUV"),
      0,
      0,
      uvWidth,
      uvHeight
    );
    gl.uniform1i(gl.getUniformLocation(this.program, "uMode"), this.mode);
    gl.uniform3f(gl.getUniformLocation(this.program, "uCoeff"), c.rv, c.gu, c.gv);
    gl.uniform1f(gl.getUniformLocation(this.program, "uBu"), c.bu);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    gl.uniform1i(gl.getUniformLocation(this.program, "uY"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
    gl.uniform1i(gl.getUniformLocation(this.program, "uC0"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[2]);
    gl.uniform1i(gl.getUniformLocation(this.program, "uC1"), 2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
  }

  clear(scissor: ScissorRect) {
    const gl = this.gl;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(scissor.x, scissor.y, Math.max(0, scissor.width), Math.max(0, scissor.height));
    gl.clearColor(0.05, 0.06, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }

  readPixels(): Uint8Array {
    const gl = this.gl;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }

  disposeTextures() {
    const gl = this.gl;
    for (const texture of this.textures) {
      gl.deleteTexture(texture);
    }
    this.textures = [];
    this.spec = null;
  }

  dispose() {
    this.disposeTextures();
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.buffer);
  }
}
