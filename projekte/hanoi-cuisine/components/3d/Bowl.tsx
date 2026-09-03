'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { dishes } from '@/lib/restaurant';
import { damp, range, scrollState } from '@/lib/scroll';
import { Steam } from './Steam';

/** Profil einer vietnamesischen Reisschale, von der Standfläche zum Rand. */
const PROFILE = [
  [0.0, 0.0], [0.2, 0.0], [0.26, 0.05], [0.23, 0.13],
  [0.36, 0.28], [0.54, 0.46], [0.71, 0.63], [0.84, 0.76],
].map(([x, y]) => new THREE.Vector2(x, y));

/** Grundton der Brühe, bevor die drei Gerichte übernehmen: Phở. */
const BASE_TONE = '#3a2312';

/** Garnitur: Kräuterblätter, Chili, Limette, Erdnüsse. */
const GARNISH = [
  { kind: 'leaf', angle: 0.4, radius: 0.42, color: '#7c8f5b', scale: 1.0 },
  { kind: 'leaf', angle: 2.1, radius: 0.5, color: '#63783f', scale: 0.85 },
  { kind: 'leaf', angle: 4.0, radius: 0.36, color: '#8ba368', scale: 0.9 },
  { kind: 'leaf', angle: 5.3, radius: 0.52, color: '#6d8250', scale: 0.8 },
  { kind: 'chili', angle: 1.2, radius: 0.46, color: '#b23a2c', scale: 1.0 },
  { kind: 'chili', angle: 3.4, radius: 0.4, color: '#9c2f24', scale: 0.9 },
  { kind: 'lime', angle: 5.9, radius: 0.44, color: '#a9bd52', scale: 1.0 },
  { kind: 'peanut', angle: 0.9, radius: 0.3, color: '#d8b98a', scale: 1.0 },
  { kind: 'peanut', angle: 2.7, radius: 0.55, color: '#c9a97a', scale: 0.9 },
  { kind: 'peanut', angle: 4.6, radius: 0.33, color: '#e0c69b', scale: 0.8 },
] as const;

type Props = { steamCount: number; detail: number };

export function Bowl({ steamCount, detail }: Props) {
  const group = useRef<THREE.Group>(null);
  const bowlRef = useRef<THREE.Mesh>(null);
  const rimRef = useRef<THREE.Mesh>(null);
  const brothRef = useRef<THREE.Mesh>(null);
  const garnishRefs = useRef<(THREE.Group | null)[]>([]);

  const lathe = useMemo(
    () => new THREE.LatheGeometry(PROFILE, detail >= 1 ? 96 : 48),
    [detail],
  );

  /** Brühenfarben der drei Signature-Gerichte, für die Überblendung. */
  const tones = useMemo(() => dishes.map((d) => new THREE.Color(d.tone)), []);
  const baseTone = useMemo(() => new THREE.Color(BASE_TONE), []);
  const toneTarget = useMemo(() => new THREE.Color(BASE_TONE), []);

  const spin = useRef(0);
  const tilt = useRef(0);
  const lift = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = scrollState.progress;
    const t = state.clock.elapsedTime;

    // --- Grundbewegung: die Schale dreht sich langsam und atmet ---------
    spin.current = damp(spin.current, p * Math.PI * 1.6, 2.4, dt);
    tilt.current = damp(tilt.current, 0.18 + range(p, 0.14, 0.42) * 0.34, 2, dt);
    lift.current = damp(lift.current, -range(p, 0.66, 0.92) * 0.5, 1.6, dt);

    if (group.current) {
      group.current.rotation.y = spin.current + t * 0.04;
      group.current.rotation.x = tilt.current;
      group.current.position.y = -0.35 + lift.current + Math.sin(t * 0.5) * 0.015;
    }

    // --- Brühe wechselt mit dem gezeigten Gericht -----------------------
    const stage = range(p, 0.36, 0.7) * (dishes.length - 1);
    const from = tones[Math.min(Math.floor(stage), tones.length - 1)];
    const to = tones[Math.min(Math.ceil(stage), tones.length - 1)];
    toneTarget.copy(from).lerp(to, stage % 1);
    // Vor dem Gerichte-Akt steht der Phở-Ton — die Übergabe passiert weich.
    toneTarget.lerp(baseTone, 1 - range(p, 0.28, 0.4));

    if (brothRef.current) {
      const material = brothRef.current.material as THREE.MeshPhysicalMaterial;
      material.color.lerp(toneTarget, 1 - Math.exp(-3 * dt));
      // Die Oberfläche wellt sich minimal, als stünde die Schale auf dem Tisch
      brothRef.current.position.y = 0.66 + Math.sin(t * 1.3) * 0.004;
    }

    // --- Zutaten fliegen auseinander und kehren zurück ------------------
    const explode = range(p, 0.62, 0.86);
    const settle = range(p, 0.86, 1);

    // Die Schale tritt dabei zurück — sonst liegt sie über der Zutatenliste.
    const recede = 1 - range(p, 0.66, 0.84) * 0.92;
    [bowlRef.current, rimRef.current, brothRef.current].forEach((mesh) => {
      if (!mesh) return;
      const material = mesh.material as THREE.Material;
      material.opacity = recede;
      material.transparent = true;
    });

    garnishRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const item = GARNISH[i];
      const radius = item.radius + explode * (1.5 + (i % 4) * 0.45) - settle * 0.35;
      const height = 0.7 + explode * (0.5 + (i % 3) * 0.42) + Math.sin(t * 0.9 + i) * 0.02 * (1 + explode * 4);
      const angle = item.angle + explode * 0.7 + t * 0.06;

      ref.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      ref.rotation.x = explode * (1.4 + i * 0.2) + Math.sin(t * 0.6 + i) * 0.12;
      ref.rotation.z = explode * (0.9 + i * 0.15);
      ref.scale.setScalar(item.scale * (1 - settle * 0.5));
    });
  });

  return (
    <group ref={group}>
      {/* Schale */}
      <mesh ref={bowlRef} geometry={lathe} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#241a17"
          roughness={0.34}
          metalness={0.05}
          clearcoat={0.7}
          clearcoatRoughness={0.25}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Goldrand — das Blattgold-Motiv der Lackkunst */}
      <mesh ref={rimRef} position={[0, 0.755, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.845, 0.011, 8, detail >= 1 ? 96 : 40]} />
        <meshStandardMaterial color="#c8a05a" metalness={0.9} roughness={0.28} transparent />
      </mesh>

      {/* Brühe */}
      <mesh ref={brothRef} position={[0, 0.66, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.77, detail >= 1 ? 96 : 48]} />
        <meshPhysicalMaterial
          color={BASE_TONE}
          roughness={0.12}
          metalness={0}
          transparent
          clearcoat={1}
          clearcoatRoughness={0.06}
        />
      </mesh>

      {/* Garnitur */}
      {GARNISH.map((item, i) => (
        <group
          key={i}
          ref={(el) => {
            garnishRefs.current[i] = el;
          }}
        >
          {item.kind === 'leaf' && (
            <mesh scale={[1.5, 0.1, 0.44]} rotation={[0, 0.6, 0]}>
              <sphereGeometry args={[0.14, 14, 8]} />
              <meshStandardMaterial color={item.color} roughness={0.55} />
            </mesh>
          )}
          {item.kind === 'chili' && (
            <mesh rotation={[0, 0, Math.PI / 2.4]}>
              <capsuleGeometry args={[0.018, 0.17, 3, 8]} />
              <meshStandardMaterial color={item.color} roughness={0.3} />
            </mesh>
          )}
          {item.kind === 'lime' && (
            <mesh scale={[1, 0.12, 1]} rotation={[0.1, 0, 0.18]}>
              <cylinderGeometry args={[0.11, 0.11, 0.16, 18]} />
              <meshStandardMaterial color={item.color} roughness={0.42} />
            </mesh>
          )}
          {item.kind === 'peanut' && (
            <mesh scale={[1, 0.72, 0.78]}>
              <sphereGeometry args={[0.038, 8, 6]} />
              <meshStandardMaterial color={item.color} roughness={0.6} />
            </mesh>
          )}
        </group>
      ))}

      <Steam count={steamCount} />
    </group>
  );
}
