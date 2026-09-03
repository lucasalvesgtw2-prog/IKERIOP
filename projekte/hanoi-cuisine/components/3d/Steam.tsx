'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { range, scrollState } from '@/lib/scroll';

/** Weiche Partikel-Textur, im Browser erzeugt — kein externes Asset. */
function useSteamSprite() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.3)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.11)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

type Props = { count: number };

/**
 * Aufsteigender Dampf.
 *
 * Entscheidend für die Glaubwürdigkeit ist nicht die Menge, sondern der
 * Verlauf: Jedes Teilchen erscheint dicht über der Brühe, wird beim Aufsteigen
 * breiter und verliert dabei an Helligkeit. Die Helligkeit steckt in den
 * Vertex-Farben — bei additiver Mischung heißt dunkler schlicht unsichtbar.
 */
export function Steam({ count }: Props) {
  const points = useRef<THREE.Points>(null);
  const sprite = useSteamSprite();

  const { positions, colors, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = Math.random();                    // Lebensphase 0…1
      seeds[i * 4 + 1] = 0.5 + Math.random() * 0.55;   // Aufstiegstempo
      seeds[i * 4 + 2] = Math.random() * Math.PI * 2;  // Drift-Phase
      seeds[i * 4 + 3] = 0.25 + Math.random() * 0.75;  // Grundhelligkeit
    }
    return { positions, colors, seeds };
  }, [count]);

  useFrame((_, delta) => {
    const mesh = points.current;
    if (!mesh) return;

    const dt = Math.min(delta, 0.05);
    // Der Dampf legt sich, sobald die Zutaten auseinanderfliegen
    const strength = 1 - range(scrollState.progress, 0.6, 0.82) * 0.85;

    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const col = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const p = pos.array as Float32Array;
    const c = col.array as Float32Array;

    for (let i = 0; i < count; i++) {
      let life = seeds[i * 4] + dt * seeds[i * 4 + 1] * 0.13;
      if (life > 1) life -= 1;
      seeds[i * 4] = life;

      const phase = seeds[i * 4 + 2];
      const spread = 0.1 + life * life * 0.9;

      p[i * 3] = Math.sin(phase + life * 2.2) * spread;
      p[i * 3 + 1] = 0.7 + life * 1.5;
      p[i * 3 + 2] = Math.cos(phase * 1.4 + life * 1.7) * spread;

      // Erscheinen und Vergehen: unten aufblühen, oben auflösen
      const fade = Math.sin(Math.PI * life) ** 1.6;
      const v = fade * seeds[i * 4 + 3] * 0.035 * strength;
      c[i * 3] = v;
      c[i * 3 + 1] = v * 0.94;
      c[i * 3 + 2] = v * 0.84;
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false} renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        vertexColors
        transparent
        opacity={1}
        size={1.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
