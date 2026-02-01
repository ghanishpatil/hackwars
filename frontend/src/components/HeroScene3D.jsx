import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';

const PARALLAX_STRENGTH = 0.4;

function WireframeSphere() {
  const meshRef = useRef(null);
  const { pointer } = useThree((s) => ({ pointer: s.pointer }));
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.12;
    meshRef.current.rotation.x = pointer.y * PARALLAX_STRENGTH;
    meshRef.current.rotation.y += pointer.x * PARALLAX_STRENGTH * 0.5;
  });
  return (
    <mesh ref={meshRef} position={[2.2, 0.2, -1.5]} scale={1.8}>
      <sphereGeometry args={[1, 24, 18]} />
      <meshBasicMaterial
        color="#00E5FF"
        wireframe
        transparent
        opacity={0.3}
      />
    </mesh>
  );
}

function CharacterWithFlag() {
  const groupRef = useRef(null);
  const flagRef = useRef(null);
  const { pointer } = useThree((s) => ({ pointer: s.pointer }));
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.08 + pointer.x * 0.15;
      groupRef.current.rotation.x = pointer.y * 0.1;
    }
    if (flagRef.current) flagRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
  });

  return (
    <group ref={groupRef} position={[1.8, -0.4, -1]} scale={0.9}>
      {/* Body - capsule-ish (cylinder) */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.5, 12]} />
        <meshStandardMaterial color="#1a3a2e" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshStandardMaterial color="#2d2a26" metalness={0.1} roughness={0.9} />
      </mesh>
      {/* Helmet visor accent */}
      <mesh position={[0, 0.78, 0.12]}>
        <sphereGeometry args={[0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        <meshBasicMaterial color="#00E5FF" transparent opacity={0.4} />
      </mesh>
      {/* Arm holding flag pole */}
      <mesh position={[0.35, 0.5, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <meshStandardMaterial color="#3d3d3d" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Flag pole */}
      <group ref={flagRef} position={[0.6, 0.65, 0]} rotation={[0, 0, -0.4]}>
        <mesh position={[0.35, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
          <meshStandardMaterial color="#555" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* Flag - plane with dark background */}
        <mesh position={[0.7, 0, 0]} rotation={[0, 0, -0.4]}>
          <planeGeometry args={[0.5, 0.35]} />
          <meshBasicMaterial color="#0a0a0a" side={THREE.DoubleSide} />
        </mesh>
        {/* Flag text - CTF{flag} */}
        <Html
          position={[0.7, 0, 0.02]}
          rotation={[0, 0, -0.4]}
          transform
          center
          distanceFactor={5}
          style={{
            fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
            fontSize: '12px',
            color: '#00E5FF',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textShadow: '0 0 8px rgba(0,229,255,0.6)',
          }}
        >
          <span>CTF{'{'}flag{'}'}</span>
        </Html>
      </group>
    </group>
  );
}

export function HeroScene3D({ className = '' }) {
  return (
    <div className={`absolute inset-0 w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-3, 2, 2]} intensity={0.4} />
        <WireframeSphere />
        <Float speed={0.8} rotationIntensity={0.2} floatIntensity={0.3}>
          <CharacterWithFlag />
        </Float>
      </Canvas>
    </div>
  );
}
