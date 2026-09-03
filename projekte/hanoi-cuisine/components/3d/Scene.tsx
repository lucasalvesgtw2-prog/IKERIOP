'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { damp, range, scrollState } from '@/lib/scroll';
import { Bowl } from './Bowl';

/**
 * Kamerafahrt: eine einzige durchgehende Einstellung über alle fünf Akte.
 * Alle Werte werden gedämpft nachgeführt, damit die Bewegung Masse hat und
 * nicht am Scrollrad klebt.
 */
function CameraRig() {
  const { camera, size } = useThree();
  const state = useRef({ z: 6.4, y: 1.05, x: 0 });
  const pointer = useRef({ x: 0, y: 0 });

  useFrame(({ pointer: p }, delta) => {
    const dt = Math.min(delta, 0.05);
    const progress = scrollState.progress;

    // Akt 1 → 2: Kamera fährt heran. Akt 4 → 5: sie weicht zurück und hebt an.
    const push = range(progress, 0.06, 0.34);
    const pull = range(progress, 0.6, 0.95);
    const targetZ = 6.4 - push * 2.5 + pull * 5.2;
    const targetY = 1.05 - push * 0.3 + pull * 2.1;
    const targetX = Math.sin(range(progress, 0.3, 0.72) * Math.PI) * 0.9;

    pointer.current.x = damp(pointer.current.x, p.x, 3, dt);
    pointer.current.y = damp(pointer.current.y, p.y, 3, dt);

    state.current.z = damp(state.current.z, targetZ, 2.2, dt);
    state.current.y = damp(state.current.y, targetY, 2.2, dt);
    state.current.x = damp(state.current.x, targetX, 2.2, dt);

    camera.position.set(
      state.current.x + pointer.current.x * 0.35,
      state.current.y - pointer.current.y * 0.25,
      state.current.z,
    );

    // Breite Screens: die Schale rückt nach rechts, die Headline bekommt die
    // linke Hälfte. Schmale Screens: sie rückt nach oben, der Text steht
    // darunter — auf dem Handy wird gestapelt, nicht verkleinert.
    const wide = size.width > 1024;
    camera.lookAt(wide ? -1.35 : 0, wide ? 0.3 : -0.95, 0);
  });

  return null;
}

/** Blendet die gesamte Szene aus, sobald der erzählerische Teil endet. */
function Presence({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = scrollState.presence;
    group.current.scale.setScalar(damp(group.current.scale.x, 0.7 + target * 0.3, 3, Math.min(delta, 0.05)));
    group.current.visible = target > 0.01;
  });
  return <group ref={group}>{children}</group>;
}

type Props = {
  /** Bei reduzierter Bewegung und auf schwachen Geräten wird abgespeckt. */
  quality: 'full' | 'reduced';
};

export default function Scene({ quality }: Props) {
  const full = quality === 'full';

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        camera={{ fov: 38, position: [0, 1.05, 6.4], near: 0.1, far: 40 }}
        dpr={full ? [1, 1.8] : [1, 1.25]}
        gl={{ antialias: full, alpha: true, powerPreference: 'high-performance' }}
        frameloop={full ? 'always' : 'demand'}
      >
        <Suspense fallback={null}>
          <CameraRig />

          {/* Licht wie in einem Food-Studio: harter Schlüssel von schräg oben,
              warmes Fülllicht, kalte Kante von hinten. */}
          <ambientLight intensity={0.35} color="#e8d9c0" />
          <directionalLight position={[3.2, 5, 2.4]} intensity={2.6} color="#fff3e0" />
          <directionalLight position={[-3, 1.4, -2.6]} intensity={1.5} color="#b23a2c" />
          <pointLight position={[0, 1.4, 1.8]} intensity={2} color="#c8a05a" distance={7} />

          {/* Spiegelungen aus der Szene selbst — kein externes HDR nötig. */}
          <Environment resolution={128}>
            <mesh scale={30}>
              <sphereGeometry args={[1, 24, 16]} />
              <meshBasicMaterial color="#150f0e" side={THREE.BackSide} />
            </mesh>
            <mesh position={[4, 6, 3]} rotation={[-Math.PI / 3, 0, 0]}>
              <planeGeometry args={[9, 9]} />
              <meshBasicMaterial color="#fff0d8" />
            </mesh>
            <mesh position={[-5, 1, -4]} rotation={[0, Math.PI / 2.6, 0]}>
              <planeGeometry args={[7, 7]} />
              <meshBasicMaterial color="#8a2f24" />
            </mesh>
          </Environment>

          <Presence>
            <Bowl steamCount={full ? 260 : 90} detail={full ? 1 : 0} />
          </Presence>
        </Suspense>
      </Canvas>
    </div>
  );
}
