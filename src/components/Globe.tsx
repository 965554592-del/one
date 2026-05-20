import { useRef, Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, Line } from '@react-three/drei';
import type { Line2 } from 'three-stdlib';
import * as THREE from 'three';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

// Helper to convert lat/lon to 3D coordinates
function latLongToVector3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = (radius * Math.sin(phi) * Math.sin(theta));
  const y = (radius * Math.cos(phi));

  return [x, y, z];
}

// Sales regions data
const salesRegions = [
  { name: '广州 (总部)', lat: 23.1291, lon: 113.2644 },
  { name: '迪拜', lat: 25.2048, lon: 55.2708 },
  { name: '法兰克福', lat: 50.1109, lon: 8.6821 },
  { name: '洛杉矶', lat: 34.0522, lon: -118.2437 },
  { name: '圣保罗', lat: -23.5505, lon: -46.6333 },
  { name: '约翰内斯堡', lat: -26.2041, lon: 28.0473 },
  { name: '悉尼', lat: -33.8688, lon: 151.2093 },
  { name: '莫斯科', lat: 55.7558, lon: 37.6173 },
  { name: '孟买', lat: 19.0760, lon: 72.8777 },
];

function AnimatedArc({ start, end }: { start: [number, number, number], end: [number, number, number] }) {
  const lineRef = useRef<Line2>(null);
  const particleRef = useRef<THREE.Mesh>(null);
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  
  // Calculate midpoint and push it out to create an arc
  const midPoint = new THREE.Vector3()
    .addVectors(startVec, endVec)
    .multiplyScalar(0.5);
  
  const distance = startVec.distanceTo(endVec);
  // Quadratic bezier midpoint
  midPoint.normalize().multiplyScalar(2 + distance * 0.4);

  const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
  const points = curve.getPoints(50);

  useFrame(({ clock }) => {
    const et = clock.getElapsedTime();
    
    if (lineRef.current && lineRef.current.material) {
      const material = lineRef.current.material as THREE.Material & { opacity: number };
      if (material && typeof material.opacity === 'number') {
        material.opacity = 0.2 + Math.sin(et * 2 + startVec.x) * 0.1;
      }
    }

    if (particleRef.current && particleRef.current.material) {
      // Each line has a different offset based on start position to avoid synchronized pulses
      const speed = 0.4;
      const t = ((et + Math.abs(startVec.x + startVec.y)) * speed) % 1;
      const pos = curve.getPoint(t);
      if (pos) {
        particleRef.current.position.copy(pos);
        
        // Fade in/out at start and end
        const opacity = Math.sin(t * Math.PI);
        const mat = particleRef.current.material as THREE.MeshBasicMaterial;
        if (mat && typeof mat.opacity === 'number') {
          mat.opacity = opacity;
        }
      }
    }
  });

  return (
    <group>
      <Line
        ref={lineRef}
        points={points}
        color="#FFB300"
        transparent
        opacity={0.3}
        lineWidth={1}
      />
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color="#FFB300" transparent opacity={1} />
      </mesh>
    </group>
  );
}

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const [regions, setRegions] = useState(salesRegions);
  
  // Load earth texture — useLoader suspends via Suspense, no try/catch needed
  const colorMap = useLoader(
    THREE.TextureLoader,
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
  );

  useEffect(() => {
    const q = query(collection(db, 'salesRegions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          name: data.name || '',
          lat: typeof data.lat === 'number' ? data.lat : 0,
          lon: typeof data.lon === 'number' ? data.lon : (typeof data.lng === 'number' ? data.lng : 0)
        };
      });
      if (fetched.length > 0) {
        setRegions(fetched);
      }
    }, (error) => {
      console.error('Error fetching sales regions:', error);
    });
    return () => unsubscribe();
  }, []);

  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.002;
    }
  });

  if (!regions || regions.length === 0) {
    return null;
  }

  const hq = latLongToVector3(regions[0].lat, regions[0].lon, 2.02);

  return (
    <group ref={earthRef}>
      <Sphere args={[2, 64, 64]}>
        <meshPhongMaterial 
          map={colorMap || undefined}
          color="#ffffff"
          emissive="#000000"
          shininess={25}
          wireframe={false}
        />
      </Sphere>
      
      {/* Sales Region Markers */}
      {regions.map((region, index) => (
        <Marker key={index} position={latLongToVector3(region.lat, region.lon, 2.02)} />
      ))}

      {/* Arcs from HQ to other regions */}
      {regions.length > 1 && regions.slice(1).map((region, index) => (
        <AnimatedArc 
          key={index} 
          start={hq} 
          end={latLongToVector3(region.lat, region.lon, 2.02)} 
        />
      ))}
    </group>
  );
}

function Marker({ position }: { position: [number, number, number] }) {
  const markerRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (markerRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 4 + position[0]) * 0.3;
      markerRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh position={position} ref={markerRef}>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshBasicMaterial color="#FFB300" />
      
      {/* Glow effect */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#FFB300" transparent opacity={0.3} />
      </mesh>
    </mesh>
  );
}

function Scene() {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.2; // Speed of cycle
    // Oscillate between night (0.2) and day (1.5)
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.5 + Math.sin(t) * 0.3;
    }
    if (sunRef.current) {
      sunRef.current.intensity = 1.0 + Math.sin(t) * 0.8;
      // Optionally move the sun
      sunRef.current.position.set(
        Math.cos(t) * 10,
        Math.sin(t) * 5,
        Math.sin(t) * 10
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.5} />
      <directionalLight 
        ref={sunRef} 
        position={[10, 5, 10]} 
        intensity={1.5} 
        color="#ffffff" 
      />
      <pointLight position={[-10, -10, -10]} intensity={0.2} color="#4466ff" />
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
    </>
  );
}

export default function Globe() {
  return (
    <div className="w-full h-full min-h-[300px] md:min-h-[500px]">
      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <Scene />
        <OrbitControls 
          enableZoom={true} 
          enablePan={false} 
          minDistance={3} 
          maxDistance={10} 
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
}
