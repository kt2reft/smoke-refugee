import * as THREE from 'three';

// 画面全体の仕上げ：ブルーム → トーンマップ → 色調補正 → ビネット → 粒状感
// three.js のアドオンを使わず、フルスクリーンの板1枚で処理する

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const BRIGHT = `uniform sampler2D tDiffuse; uniform float uThreshold; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.8, l), 1.0);
}`;

const BLUR = `uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227027;
  s += texture2D(tDiffuse, vUv + uDir * 1.3846).rgb * 0.3162162;
  s += texture2D(tDiffuse, vUv - uDir * 1.3846).rgb * 0.3162162;
  s += texture2D(tDiffuse, vUv + uDir * 3.2308).rgb * 0.0702703;
  s += texture2D(tDiffuse, vUv - uDir * 3.2308).rgb * 0.0702703;
  gl_FragColor = vec4(s, 1.0);
}`;

const FINAL = `uniform sampler2D tDiffuse; uniform sampler2D tBloom;
uniform vec2 uRes; uniform float uTime;
uniform float uBloom, uSat, uContrast, uVig, uGrain, uScan, uAberr, uAlert, uCaution, uWobble, uFade;
uniform vec3 uShadow, uHigh;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 uv = vUv;
  // ニコチン切れの揺らぎ
  uv += vec2(sin(uv.y * 18.0 + uTime * 3.1), cos(uv.x * 14.0 + uTime * 2.3)) * 0.0028 * uWobble;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  float ab = uAberr * r2;
  vec3 c;
  c.r = texture2D(tDiffuse, uv - d * ab).r;
  c.g = texture2D(tDiffuse, uv).g;
  c.b = texture2D(tDiffuse, uv + d * ab).b;
  c += texture2D(tBloom, uv).rgb * uBloom;

  #ifdef TONE_MAPPING
  c = toneMapping(c);
  #endif

  // 彩度を落として影を寒色、ハイライトをわずかに暖色に寄せる（スプリットトーン）
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c *= mix(uShadow, uHigh, smoothstep(0.02, 0.55, l));

  vec4 o = linearToOutputTexel(vec4(c, 1.0));
  vec3 s = clamp(o.rgb, 0.0, 1.0);
  o.rgb = mix(s, s * s * (3.0 - 2.0 * s), uContrast);

  // ビネット
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  float v = smoothstep(0.95, 0.28, length(q));
  o.rgb *= mix(1.0 - uVig, 1.0, v);
  // 警戒時の赤／注意時の黄色
  float edge = 1.0 - v;
  o.rgb = mix(o.rgb, vec3(0.85, 0.06, 0.03), clamp(edge * 1.25, 0.0, 1.0) * uAlert);
  o.rgb = mix(o.rgb, vec3(0.9, 0.62, 0.08), clamp(edge * 0.9, 0.0, 1.0) * uCaution);
  // 走査線と粒子
  o.rgb *= 1.0 - uScan * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  o.rgb += (hash(gl_FragCoord.xy + fract(uTime * 13.7) * 91.0) - 0.5) * uGrain;
  o.rgb *= uFade;
  gl_FragColor = vec4(o.rgb, 1.0);
}`;

export const GRADES = {
  street:  { sat: 0.72, contrast: 0.32, shadow: [0.84, 0.98, 1.02], high: [1.05, 1.0, 0.93], vig: 0.5, grain: 0.045, bloom: 0.55, threshold: 0.95 },
  rain:    { sat: 0.55, contrast: 0.38, shadow: [0.78, 0.94, 1.08], high: [0.98, 1.0, 1.04], vig: 0.6, grain: 0.055, bloom: 0.6, threshold: 0.95 },
  station: { sat: 0.62, contrast: 0.34, shadow: [0.84, 1.02, 0.94], high: [1.0, 1.03, 0.95], vig: 0.5, grain: 0.045, bloom: 0.7, threshold: 0.9 },
  garden:  { sat: 0.82, contrast: 0.28, shadow: [0.9, 0.96, 1.02], high: [1.08, 1.0, 0.88], vig: 0.45, grain: 0.04, bloom: 0.6, threshold: 0.95 },
};

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { ...opts, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    this.bA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bB = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs = new THREE.Scene();
    this.qs.add(this.quad);
    const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.bright = mat(BRIGHT, { tDiffuse: { value: null }, uThreshold: { value: 0.9 } });
    this.bright.toneMapped = false;
    this.blur = mat(BLUR, { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.blur.toneMapped = false;
    this.final = mat(FINAL, {
      tDiffuse: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
      uBloom: { value: 0.6 }, uSat: { value: 0.75 }, uContrast: { value: 0.3 }, uVig: { value: 0.5 }, uGrain: { value: 0.045 },
      uScan: { value: 0.025 }, uAberr: { value: 0.012 }, uAlert: { value: 0 }, uCaution: { value: 0 }, uWobble: { value: 0 }, uFade: { value: 1 },
      uShadow: { value: new THREE.Vector3(1, 1, 1) }, uHigh: { value: new THREE.Vector3(1, 1, 1) },
    });
    this.final.toneMapped = true;
    this.size = new THREE.Vector2();
    this.fx = { alert: 0, caution: 0, wobble: 0, aberr: 0, vigExtra: 0, fade: 1 };
    this.setGrade('street');
  }

  setGrade(name) {
    const g = GRADES[name] || GRADES.street;
    const u = this.final.uniforms;
    u.uSat.value = g.sat; u.uContrast.value = g.contrast; u.uVig.value = g.vig; u.uGrain.value = g.grain; u.uBloom.value = g.bloom;
    u.uShadow.value.set(...g.shadow); u.uHigh.value.set(...g.high);
    this.bright.uniforms.uThreshold.value = g.threshold;
    this.grade = g;
  }

  setSize() {
    this.renderer.getDrawingBufferSize(this.size);
    const w = Math.max(4, this.size.x), h = Math.max(4, this.size.y);
    this.rt.setSize(w, h);
    const bw = Math.max(2, Math.floor(w / 4)), bh = Math.max(2, Math.floor(h / 4));
    this.bA.setSize(bw, bh);
    this.bB.setSize(bw, bh);
    this.final.uniforms.uRes.value.set(w, h);
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qs, this.cam);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    if (this.rt.width < 8) this.setSize();
    r.setRenderTarget(this.rt);
    r.render(scene, camera);

    // ブルーム（1/4解像度でぼかす）
    this.bright.uniforms.tDiffuse.value = this.rt.texture;
    this.pass(this.bright, this.bA);
    const px = 1 / this.bA.width, py = 1 / this.bA.height;
    for (const k of [1, 2.2]) {
      this.blur.uniforms.tDiffuse.value = this.bA.texture;
      this.blur.uniforms.uDir.value.set(px * k, 0);
      this.pass(this.blur, this.bB);
      this.blur.uniforms.tDiffuse.value = this.bB.texture;
      this.blur.uniforms.uDir.value.set(0, py * k);
      this.pass(this.blur, this.bA);
    }

    const u = this.final.uniforms;
    const fx = this.fx;
    u.tDiffuse.value = this.rt.texture;
    u.tBloom.value = this.bA.texture;
    u.uTime.value = time;
    u.uAlert.value = fx.alert;
    u.uCaution.value = fx.caution;
    u.uWobble.value = fx.wobble;
    u.uAberr.value = 0.012 + fx.aberr;
    u.uVig.value = this.grade.vig + fx.vigExtra;
    u.uFade.value = fx.fade;
    this.pass(this.final, null);
  }
}
