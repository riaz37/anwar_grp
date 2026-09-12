"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import gsap from "gsap";

/**
 * Ambient WebGL backdrop for the PMO agent's empty state — an explicit,
 * user-approved exception to DESIGN.md §8 ("no animation library"), scoped
 * to this one surface only. Recolored from the source demo's blue palette to
 * the app's single ink-indigo accent (`--primary-med`/`--primary-high`) so it
 * reads as "this app's agent," not a stock effect. Sized to fill its parent
 * container (the chat panel), not the viewport — this is chrome inside a
 * fixed-height panel, not a page hero.
 *
 * Respects `prefers-reduced-motion`: renders nothing (parent supplies a
 * static gradient fallback) rather than merely slowing the animation, per
 * DESIGN.md's motion kill-switch rule.
 */
export function AgentWaveBackdrop({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;

    // Some environments (headless browsers, locked-down GPUs, certain remote
    // desktops) throw synchronously when WebGL context creation fails. Without
    // this guard that exception propagates up through the effect and crashes
    // the whole page — fall back to the static gradient instead.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    } catch {
      setWebglFailed(true);
      return;
    }

    const FilmGrainShader = {
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        time: { value: 0 },
        intensity: { value: 0.6 },
        grainScale: { value: 0.4 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        uniform float grainScale;
        varying vec2 vUv;
        float sparkleNoise(vec2 p) {
          vec2 jPos = p + vec2(37.0, 17.0) * fract(time * 0.07);
          vec3 p3 = fract(vec3(jPos.xyx) * vec3(.1031, .1030, .0973) + time * 0.1);
          p3 += dot(p3, p3.yxz + 19.19);
          return fract((p3.x + p3.y) * p3.z);
        }
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 pos = gl_FragCoord.xy * 0.5 * grainScale;
          float noise = sparkleNoise(pos) * 2.0 - 1.0;
          gl_FragColor = vec4(color.rgb + noise * intensity * 0.1, color.a);
        }
      `,
    };

    const wave1 = { gain: 40, len: 0.6, angle: 0, freq: 0.9 };
    const wave2 = { gain: 0, len: 0.6, angle: 0, freq: 0.35 };

    const MAX_BARS = 96;
    const BAR_WIDTH = 10;
    const BAR_GAP = 8;

    const dpr = Math.min(window.devicePixelRatio, 1.5) * 0.6;
    renderer.setPixelRatio(dpr);
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    let width = container.clientWidth;
    let height = container.clientHeight;
    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, -1000, 1000);
    camera.position.z = 10;

    // App accent: --primary-med #3f3d9e / --primary-high #2e2c79
    const baseColor = new THREE.Color("#1a1930");
    const emissiveColor = new THREE.Color("#3f3d9e");

    const material = new THREE.ShaderMaterial({
      uniforms: {
        w1Gain: { value: wave1.gain },
        w1Len: { value: wave1.len },
        w1Phase: { value: 0 },
        w2Gain: { value: wave2.gain },
        w2Len: { value: wave2.len },
        w2Phase: { value: 0 },
        uColor: { value: baseColor },
        uEmissive: { value: emissiveColor },
        uBaseEmissive: { value: 0.12 },
      },
      vertexShader: `
        attribute float aXPos, aPosNorm, aGroup;
        uniform float w1Gain, w1Len, w1Phase, w2Gain, w2Len, w2Phase;
        varying float vHeight;
        varying vec2 vUv;
        float sineH(float g, float len, float ph, float t){
          return max(14.0, (sin(ph + t * len * 6.0) * 0.5 + 0.6) * g);
        }
        void main(){
          vUv = uv;
          float h1 = sineH(w1Gain, w1Len, w1Phase, aPosNorm);
          float h2 = sineH(w2Gain, w2Len, w2Phase, aPosNorm);
          vHeight = mix(h1, h2, aGroup);
          vec3 pos = position;
          pos.x += aXPos;
          pos.y = uv.y * vHeight;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uColor, uEmissive;
        uniform float uBaseEmissive;
        varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
          float alpha = 0.28 * edge;
          vec3 col = uColor + uEmissive * (uBaseEmissive + vUv.y * 0.35);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    let barCount = 0;
    let bars: THREE.InstancedMesh | null = null;

    function buildBars() {
      if (bars) {
        scene.remove(bars);
        bars.geometry.dispose();
      }
      const span = width + 120;
      barCount = Math.min(MAX_BARS, Math.max(1, Math.floor(span / (BAR_WIDTH + BAR_GAP))));
      const startX = -width / 2 - 60;
      const aXPos = new Float32Array(barCount * 2);
      const aPosNorm = new Float32Array(barCount * 2);
      const aGroup = new Float32Array(barCount * 2);
      for (let i = 0; i < barCount; i++) {
        const x = startX + BAR_WIDTH / 2 + i * (BAR_WIDTH + BAR_GAP);
        const t = barCount > 1 ? i / (barCount - 1) : 0;
        aXPos[i] = aXPos[i + barCount] = x;
        aPosNorm[i] = aPosNorm[i + barCount] = t;
        aGroup[i] = 0;
        aGroup[i + barCount] = 1;
      }
      const geo = new THREE.PlaneGeometry(BAR_WIDTH, 1, 1, 1);
      geo.translate(0, 0, 0);
      geo.setAttribute("aXPos", new THREE.InstancedBufferAttribute(aXPos, 1));
      geo.setAttribute("aPosNorm", new THREE.InstancedBufferAttribute(aPosNorm, 1));
      geo.setAttribute("aGroup", new THREE.InstancedBufferAttribute(aGroup, 1));
      bars = new THREE.InstancedMesh(geo, material, barCount * 2);
      bars.frustumCulled = false;
      bars.position.y = -height / 2;
      scene.add(bars);
    }

    buildBars();

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.8, 0.6, 0.1);
    composer.addPass(bloom);
    const grain = new ShaderPass(FilmGrainShader as never);
    composer.addPass(grain);

    renderer.setSize(width, height);
    composer.setSize(width, height);

    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(wave1, { gain: 90, duration: 6, ease: "sine.inOut" }, 0);
    tl.to(wave2, { gain: 60, duration: 8, ease: "sine.inOut" }, 0);

    const ticker = () => {
      const dt = gsap.ticker.deltaRatio() * (1 / 60);
      wave1.angle += wave1.freq * dt;
      wave2.angle += wave2.freq * dt;
      material.uniforms.w1Gain.value = wave1.gain;
      material.uniforms.w1Phase.value = wave1.angle;
      material.uniforms.w2Gain.value = wave2.gain;
      material.uniforms.w2Phase.value = wave2.angle;
      grain.uniforms.time.value += dt * 0.2;
      composer.render();
    };
    gsap.ticker.add(ticker);

    const ro = new ResizeObserver(() => {
      width = container.clientWidth;
      height = container.clientHeight;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      if (bars) bars.position.y = -height / 2;
      buildBars();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    });
    ro.observe(container);

    const onVisibility = () => {
      if (document.hidden) {
        gsap.globalTimeline.pause();
      } else {
        gsap.globalTimeline.resume();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      gsap.ticker.remove(ticker);
      tl.kill();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
      material.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={className}
      ref={containerRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      {(reducedMotion || webglFailed) && (
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_100%,var(--primary-wash),transparent)]" />
      )}
    </div>
  );
}
