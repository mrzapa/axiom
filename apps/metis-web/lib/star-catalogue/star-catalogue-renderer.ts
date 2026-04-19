import type { CatalogueStar } from "./types";

const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;

// Per-instance attributes (divisor = 1)
in vec2  a_screenPos;    // projected screen position [0, width] x [0, height]
in float a_pointSize;    // point size in pixels
in vec3  a_color;        // linear RGB
in float a_brightness;   // 0..1

uniform vec2 u_resolution;  // canvas width, height

out vec3  v_color;
out float v_brightness;

void main() {
  // Convert screen px to clip space
  vec2 clip = (a_screenPos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = clamp(a_pointSize, 1.0, 64.0);
  v_color = a_color;
  v_brightness = a_brightness;
}
`;

const FRAG_SRC = /* glsl */ `#version 300 es
precision mediump float;

in vec3  v_color;
in float v_brightness;

out vec4 fragColor;

void main() {
  // Soft circular disc
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = dot(uv, uv);
  if (r > 1.0) discard;

  // Gaussian core + faint halo
  float core = exp(-r * 4.0);
  float halo = exp(-r * 1.5) * 0.3;
  float intensity = (core + halo) * v_brightness;

  fragColor = vec4(v_color * intensity, intensity);
}
`;

// Instance buffer stride: 8 floats = screen_x, screen_y, point_size, pad, r, g, b, brightness
const FLOATS_PER_STAR = 8;
const MAX_VISIBLE_STARS = 15_000;

/**
 * Frustum-cull margin in pixels. Point sprites can extend beyond their
 * projected centre by up to `gl_PointSize / 2`, and the vertex shader
 * clamps point size to 64px — so any sprite whose centre is within 64px
 * of the viewport edge may still contribute pixels and must not be culled.
 * Keep this coupled to the shader's `clamp(a_pointSize, 1.0, 64.0)` above.
 */
const FRUSTUM_CULL_MARGIN_PX = 64;

export class StarCatalogueRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private instanceBuffer: WebGLBuffer;
  private instanceData: Float32Array;

  // Attribute locations
  private aScreenPos: number;
  private aPointSize: number;
  private aColor: number;
  private aBrightness: number;
  private uResolution: WebGLUniformLocation;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    this.program = this.compileProgram(VERT_SRC, FRAG_SRC);
    gl.useProgram(this.program);

    this.aScreenPos = gl.getAttribLocation(this.program, "a_screenPos");
    this.aPointSize = gl.getAttribLocation(this.program, "a_pointSize");
    this.aColor = gl.getAttribLocation(this.program, "a_color");
    this.aBrightness = gl.getAttribLocation(this.program, "a_brightness");

    // `getUniformLocation` can legitimately return null if the driver
    // optimized the uniform out (e.g. if a shader tree-shook u_resolution
    // because it wasn't reachable). Fail loudly — the renderer cannot draw
    // correctly without a viewport-space projection.
    const uResolution = gl.getUniformLocation(this.program, "u_resolution");
    if (uResolution === null) {
      throw new Error("Failed to locate u_resolution uniform");
    }
    this.uResolution = uResolution;

    // Allocate instance buffer (pre-allocated, updated each frame)
    this.instanceData = new Float32Array(MAX_VISIBLE_STARS * FLOATS_PER_STAR);
    this.instanceBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);

    const STRIDE = FLOATS_PER_STAR * 4; // bytes

    // a_screenPos: offset 0, 2 floats
    gl.enableVertexAttribArray(this.aScreenPos);
    gl.vertexAttribPointer(this.aScreenPos, 2, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribDivisor(this.aScreenPos, 1);

    // a_pointSize: offset 8 (2 floats * 4 bytes), 1 float
    gl.enableVertexAttribArray(this.aPointSize);
    gl.vertexAttribPointer(this.aPointSize, 1, gl.FLOAT, false, STRIDE, 8);
    gl.vertexAttribDivisor(this.aPointSize, 1);

    // pad float at offset 12 (unused, maintains 4-float alignment)

    // a_color: offset 16 (4 floats * 4 bytes), 3 floats
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, STRIDE, 16);
    gl.vertexAttribDivisor(this.aColor, 1);

    // a_brightness: offset 28 (7 floats * 4 bytes), 1 float
    gl.enableVertexAttribArray(this.aBrightness);
    gl.vertexAttribPointer(this.aBrightness, 1, gl.FLOAT, false, STRIDE, 28);
    gl.vertexAttribDivisor(this.aBrightness, 1);

    gl.bindVertexArray(null);

    // Enable blending for transparent point sprites
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
  }

  /**
   * Draw all visible catalogue stars for the current frame.
   */
  draw(
    visibleStars: CatalogueStar[],
    projectFn: (wx: number, wy: number) => { sx: number; sy: number },
    zoomFactor: number,
    canvasW: number,
    canvasH: number,
  ): void {
    const { gl, instanceData } = this;

    gl.viewport(0, 0, canvasW, canvasH);
    gl.clearColor(0, 0, 0, 0); // transparent — the page background shows through
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, canvasW, canvasH);

    let count = 0;
    const maxStars = Math.min(visibleStars.length, MAX_VISIBLE_STARS);

    for (let i = 0; i < maxStars; i++) {
      const star = visibleStars[i];
      const { sx, sy } = projectFn(star.wx, star.wy);

      // Frustum cull: skip if off-screen (with margin for sprite extent)
      if (
        sx < -FRUSTUM_CULL_MARGIN_PX
        || sx > canvasW + FRUSTUM_CULL_MARGIN_PX
        || sy < -FRUSTUM_CULL_MARGIN_PX
        || sy > canvasH + FRUSTUM_CULL_MARGIN_PX
      ) continue;

      // LOD point size: apparent magnitude + zoom
      // At zoom 1, a magnitude-0 star is 6px; mag-6 is 1px
      const basePx = Math.pow(10, (-star.apparentMagnitude + 6) / 2.5) * 2.5;
      const zoomScale = Math.sqrt(zoomFactor);
      const pointSize = Math.max(1.0, Math.min(basePx * zoomScale, 32.0));

      // Brightness: map magnitude to 0..1 intensity
      const brightness = Math.pow(10, -star.apparentMagnitude / 2.5) * 0.8 + 0.2;

      const palette = star.profile.palette;
      const base = count * FLOATS_PER_STAR;
      instanceData[base + 0] = sx;
      instanceData[base + 1] = sy;
      instanceData[base + 2] = pointSize;
      instanceData[base + 3] = 0; // pad
      instanceData[base + 4] = palette.core[0] / 255;
      instanceData[base + 5] = palette.core[1] / 255;
      instanceData[base + 6] = palette.core[2] / 255;
      instanceData[base + 7] = brightness;

      count++;
    }

    if (count === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData, 0, count * FLOATS_PER_STAR);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.POINTS, 0, 1, count);
    gl.bindVertexArray(null);
  }

  resize(width: number, height: number): void {
    // `gl.canvas` is typed as `HTMLCanvasElement | OffscreenCanvas`. Both
    // have writable `width`/`height` so the cast is only needed when TS
    // can't prove which side of the union we're on — the constructor
    // accepts HTMLCanvasElement so that's what we always have here.
    (this.gl.canvas as HTMLCanvasElement).width = width;
    (this.gl.canvas as HTMLCanvasElement).height = height;
  }

  dispose(): void {
    const { gl } = this;
    gl.deleteBuffer(this.instanceBuffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }

  private compileProgram(vert: string, frag: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vert);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
    }
    return sh;
  }
}
