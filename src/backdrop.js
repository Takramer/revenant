// Mood-driven fog. One WebGL fragment shader; uniforms ease toward the entity's mood.
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uHue; uniform float uTurb; uniform float uBright;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + 11.7; a *= 0.5; }
  return v;
}
vec3 hsv(float h, float s, float v){
  vec3 k = abs(fract(vec3(h)+vec3(1.0, 2.0/3.0, 1.0/3.0))*6.0-3.0)-1.0;
  return v * mix(vec3(1.0), clamp(k,0.0,1.0), s);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x/uRes.y, 1.0) * 2.2;
  float t = uTime * (0.015 + uTurb * 0.06);
  vec2 warp = vec2(fbm(p + t), fbm(p - t*0.7 + 5.2));
  float f = fbm(p + warp * (1.2 + uTurb*2.0) + vec2(t*0.4, -t*0.25));
  float vign = smoothstep(1.25, 0.25, distance(uv, vec2(0.5)));
  float lum = f * f * vign * (0.35 + uBright*0.5);
  vec3 col = hsv(uHue, 0.45, 1.0) * lum;
  col += hsv(uHue + 0.08, 0.3, 1.0) * pow(f, 4.0) * vign * 0.25;
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

export function startBackdrop(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false });
  if (!gl) return { setMood() {} };

  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(prog, s);
  }
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  for (const n of ["uRes", "uTime", "uHue", "uTurb", "uBright"]) u[n] = gl.getUniformLocation(prog, n);

  // target mood → eased current values
  let target = { hue: 0.6, turb: 0.3, bright: 0.4 };
  let cur = { ...target };

  function resize() {
    const dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  addEventListener("resize", resize);

  const t0 = performance.now();
  (function frame() {
    for (const k in target) cur[k] += (target[k] - cur[k]) * 0.01; // slow drift, mood arrives like weather
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, (performance.now() - t0) / 1000);
    gl.uniform1f(u.uHue, cur.hue);
    gl.uniform1f(u.uTurb, cur.turb);
    gl.uniform1f(u.uBright, cur.bright);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  })();

  return {
    // valence -1..1 → hue cold(0.6 blue) to warm(0.06 ember); arousal 0..1 → turbulence
    setMood(v, a) {
      target.hue = 0.6 - (v + 1) * 0.27;
      target.turb = 0.15 + a * 0.85;
      target.bright = 0.3 + a * 0.35;
    },
  };
}
