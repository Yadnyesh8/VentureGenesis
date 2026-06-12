"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Full-screen painted-ink fluid: simplex-noise FBM with domain warping, tinted by the
// current chapter hue. Pointer movement injects a soft ripple that decays over ~1.5s,
// like a finger dragged through wet paint. Replaces the old dot-matrix background.

const VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uColor;
uniform vec2 uMouse;
uniform float uStrength;
uniform vec2 uRes;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){
  float v=0.0; float a=0.5;
  for(int i=0;i<5;i++){ v+=a*snoise(p); p*=2.03; a*=0.5; }
  return v;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float aspect=uRes.x/uRes.y;
  vec2 p=uv; p.x*=aspect;
  vec2 mp=uMouse; mp.x*=aspect;
  float d=distance(p,mp);
  float ripple=uStrength*exp(-d*d*22.0)*0.6;
  vec2 dir=(d>0.0001)?(p-mp)/d:vec2(0.0);
  vec2 q=p*2.2;
  q+=ripple*dir*1.6;                      // displace the paint away from the finger
  vec2 w=vec2(fbm(q+uTime*0.06), fbm(q+vec2(5.2,1.3)-uTime*0.04));
  float f=fbm(q+1.8*w+ripple*2.0);
  float ink=smoothstep(-0.35,0.85,f);
  vec3 base=vec3(0.039,0.043,0.059);      // ink #0a0b0f
  vec3 col=mix(base,uColor,ink*0.32+ripple*0.55);
  float vig=smoothstep(1.25,0.35,distance(uv,vec2(0.5)));
  col*=mix(0.85,1.0,vig);
  gl_FragColor=vec4(col,1.0);
}`;

function FluidPlane({ colorRef }: { colorRef: React.MutableRefObject<string> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();
  const target = useRef(new THREE.Color(colorRef.current));
  const mouse = useRef({ x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, strength: 0 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorRef.current) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uStrength: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = e.clientX / window.innerWidth;
      mouse.current.y = 1 - e.clientY / window.innerHeight;
      mouse.current.strength = 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const d = Math.min(dt, 0.05);
    m.uniforms.uTime.value += d;
    const mc = mouse.current;
    mc.sx += (mc.x - mc.sx) * Math.min(1, d * 8);
    mc.sy += (mc.y - mc.sy) * Math.min(1, d * 8);
    mc.strength *= Math.exp(-d / 0.5); // ~1.5s perceptual decay
    m.uniforms.uMouse.value.set(mc.sx, mc.sy);
    m.uniforms.uStrength.value = mc.strength;
    m.uniforms.uRes.value.set(size.width * viewport.dpr, size.height * viewport.dpr);
    target.current.set(colorRef.current);
    (m.uniforms.uColor.value as THREE.Color).lerp(target.current, Math.min(1, d * 5));
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} depthWrite={false} />
    </mesh>
  );
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Props = {
  /** Live-updated hex color (scroll-synced). Takes precedence over `color`. */
  colorRef?: React.MutableRefObject<string>;
  /** Static hue when no scroll sync is needed (e.g. the launching screen). */
  color?: string;
  className?: string;
};

export default function FluidCanvas({ colorRef, color = "#7c6cff", className = "" }: Props) {
  const fallbackRef = useRef(color);
  const liveRef = colorRef ?? fallbackRef;
  const [mode, setMode] = useState<"loading" | "gl" | "css">("loading");

  useEffect(() => {
    fallbackRef.current = color;
  }, [color]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMode(!reduce && webglAvailable() ? "gl" : "css");
  }, []);

  if (mode !== "gl") {
    // Static gradient degrade: reduced motion, no WebGL, or first paint.
    return (
      <div
        aria-hidden
        className={`fixed inset-0 pointer-events-none ${className}`}
        style={{ background: `radial-gradient(120% 90% at 50% 10%, ${liveRef.current}22 0%, #0a0b0f 60%)` }}
      />
    );
  }

  return (
    <div aria-hidden className={`fixed inset-0 pointer-events-none ${className}`}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
        camera={{ position: [0, 0, 5], fov: 50 }}
      >
        <FluidPlane colorRef={liveRef} />
      </Canvas>
    </div>
  );
}
