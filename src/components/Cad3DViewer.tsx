import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CadProject } from '../types/cad';
import { WALL_MATERIALS, LAYER_DEFINITIONS } from '../constants/materials';
import { distanceCm } from '../utils/cadMath';
import { Box, Maximize2, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye } from 'lucide-react';

interface Cad3DViewerProps {
  project: CadProject;
}

export const Cad3DViewer: React.FC<Cad3DViewerProps> = ({ project }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(550, 80, 400));
  const sphericalRef = useRef<THREE.Spherical>(new THREE.Spherical(1200, Math.PI / 3, Math.PI / 4));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);
    scene.fog = new THREE.FogExp2(0x080c14, 0.0006);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 30000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.85);
    sunLight.position.set(900, 1600, 700);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const blueFill = new THREE.DirectionalLight(0x38bdf8, 0.35);
    blueFill.position.set(-800, 600, -600);
    scene.add(blueFill);

    // 3. Grid Plane
    const groundGrid = new THREE.GridHelper(3000, 60, 0x00f0ff, 0x1e293b);
    groundGrid.position.y = -1;
    scene.add(groundGrid);

    // 4. Render Active Floor
    const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];

    if (activeFloor) {
      // Floor Slab Mesh
      const floorPlaneGeo = new THREE.PlaneGeometry(1600, 1200);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x101622,
        roughness: 0.85,
        metalness: 0.1,
      });
      const floorMesh = new THREE.Mesh(floorPlaneGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(550, 0, 400);
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Build 3D Walls
      for (const wall of activeFloor.walls) {
        const matDef = WALL_MATERIALS[wall.material] || WALL_MATERIALS.brick_interior;
        const lengthCm = distanceCm(wall.start, wall.end);
        const heightCm = wall.heightMm / 10;
        const thicknessCm = wall.thicknessMm / 10;

        const wallGeo = new THREE.BoxGeometry(lengthCm, heightCm, thicknessCm);
        const wallMaterial = new THREE.MeshStandardMaterial({
          color: matDef.threeColor,
          roughness: matDef.roughness,
          metalness: 0.15,
          transparent: wall.material === 'insulating_glass',
          opacity: wall.material === 'insulating_glass' ? 0.4 : 1.0,
        });

        const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        const midX = (wall.start.x + wall.end.x) / 2;
        const midZ = (wall.start.y + wall.end.y) / 2;
        wallMesh.position.set(midX, heightCm / 2, midZ);

        const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        wallMesh.rotation.y = -angle;

        scene.add(wallMesh);
      }

      // Build 3D Devices with Elevation Pillars
      for (const dev of activeFloor.devices) {
        if (!project.visibleLayers[dev.layer]) continue;
        const layerDef = LAYER_DEFINITIONS.find((l) => l.id === dev.layer);
        const devColor = layerDef ? new THREE.Color(layerDef.color) : new THREE.Color(0x00f0ff);

        const devGeo = new THREE.SphereGeometry(12, 16, 16);
        const devMat = new THREE.MeshStandardMaterial({
          color: devColor,
          emissive: devColor,
          emissiveIntensity: 0.6,
        });

        const devMesh = new THREE.Mesh(devGeo, devMat);
        const elevCm = dev.elevationMm / 10;
        devMesh.position.set(dev.position.x, elevCm, dev.position.y);
        scene.add(devMesh);

        // Mounting Pillar
        const pillarGeo = new THREE.CylinderGeometry(1.5, 1.5, elevCm, 8);
        const pillarMat = new THREE.MeshBasicMaterial({ color: devColor, wireframe: true });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(dev.position.x, elevCm / 2, dev.position.y);
        scene.add(pillar);
      }

      // Build 3D Conduit Routes
      for (const route of activeFloor.routes) {
        if (!project.visibleLayers[route.layer]) continue;
        const layerDef = LAYER_DEFINITIONS.find((l) => l.id === route.layer);
        const routeColor = layerDef ? new THREE.Color(layerDef.color) : new THREE.Color(0x3b82f6);

        if (route.points.length >= 2) {
          const curvePoints = route.points.map(
            (p) => new THREE.Vector3(p.x, route.elevationMm / 10, p.y)
          );
          const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal');
          const tubeGeo = new THREE.TubeGeometry(curve, 32, 2.8, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: routeColor,
            emissive: routeColor,
            emissiveIntensity: 0.35,
            roughness: 0.3,
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          scene.add(tubeMesh);
        }
      }
    }

    // 5. Dual Navigation: Left-click Orbit & Right-click/Middle-click Pan
    let isMouseDown = false;
    let mouseButton = 0;
    let prevMouse = { x: 0, y: 0 };

    const updateCamera = () => {
      camera.position.setFromSpherical(sphericalRef.current).add(targetCenterRef.current);
      camera.lookAt(targetCenterRef.current);
    };

    updateCamera();

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      mouseButton = e.button;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      if (mouseButton === 0 && !e.shiftKey) {
        // Orbit (Rotate around target)
        sphericalRef.current.theta -= dx * 0.006;
        sphericalRef.current.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.04, sphericalRef.current.phi - dy * 0.006));
      } else {
        // Pan (Translate target Center)
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();

        const panSpeed = (sphericalRef.current.radius / 800) * 1.2;
        targetCenterRef.current.addScaledVector(right, -dx * panSpeed);
        targetCenterRef.current.addScaledVector(forward, dy * panSpeed);
      }

      updateCamera();
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(150, Math.min(5000, sphericalRef.current.radius + e.deltaY * 0.9));
      updateCamera();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [project]);

  const handleResetCamera = (view: 'isometric' | 'top' | 'front') => {
    targetCenterRef.current.set(550, 80, 400);
    if (view === 'isometric') {
      sphericalRef.current.set(1300, Math.PI / 3, Math.PI / 4);
    } else if (view === 'top') {
      sphericalRef.current.set(1500, 0.1, 0);
    } else if (view === 'front') {
      sphericalRef.current.set(1400, Math.PI / 2 - 0.05, 0);
    }
    if (cameraRef.current) {
      cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetCenterRef.current);
      cameraRef.current.lookAt(targetCenterRef.current);
    }
  };

  const handlePan3D = (dx: number, dz: number) => {
    targetCenterRef.current.x += dx;
    targetCenterRef.current.z += dz;
    if (cameraRef.current) {
      cameraRef.current.position.setFromSpherical(sphericalRef.current).add(targetCenterRef.current);
      cameraRef.current.lookAt(targetCenterRef.current);
    }
  };

  return (
    <div className="relative w-full h-full select-none bg-[#080c14] overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Navigation Legend */}
      <div className="absolute top-4 left-4 z-10 bg-[#121824]/95 backdrop-blur-md border border-white/10 px-3.5 py-2.5 rounded-xl text-xs text-gray-300 shadow-xl space-y-1">
        <div className="font-bold text-white flex items-center gap-2">
          <Box className="w-4 h-4 text-[#00F0FF]" />
          <span>3D Prostorový model budovy</span>
        </div>
        <div className="text-[11px] text-gray-400">
          Otáčení: <span className="text-white">Levé tlačítko myši</span> • Posun: <span className="text-white">Pravé tlačítko / Shift</span> • Přiblížení: <span className="text-white">Kolečko</span>
        </div>
      </div>

      {/* Camera Viewpoints & Navigation D-Pad */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
        {/* View Preset Buttons */}
        <div className="flex items-center gap-1.5 bg-[#121824]/95 backdrop-blur-md border border-white/10 p-1.5 rounded-xl text-xs shadow-xl">
          <button
            onClick={() => handleResetCamera('isometric')}
            className="px-2.5 py-1 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium"
          >
            Nadhled 3D
          </button>
          <button
            onClick={() => handleResetCamera('top')}
            className="px-2.5 py-1 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium"
          >
            Půdorys zvrchu
          </button>
          <button
            onClick={() => handleResetCamera('front')}
            className="px-2.5 py-1 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium"
          >
            Čelní pohled
          </button>
        </div>

        {/* Directional Camera Pan */}
        <div className="bg-[#121824]/95 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-xl flex flex-col items-center gap-0.5">
          <button
            onClick={() => handlePan3D(0, -100)}
            className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
            title="Posunout kameru vpřed"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => handlePan3D(-100, 0)}
              className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
              title="Posunout kameru doleva"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleResetCamera('isometric')}
              className="p-1.5 text-[#00F0FF] hover:bg-[#00F0FF]/20 rounded-lg transition-colors"
              title="Vycentrovat model"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handlePan3D(100, 0)}
              className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
              title="Posunout kameru doprava"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => handlePan3D(0, 100)}
            className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
            title="Posunout kameru vzad"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
