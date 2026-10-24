import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CadProject, Wall } from '../types/cad';
import { WALL_MATERIALS, LAYER_DEFINITIONS } from '../constants/materials';
import { distanceCm } from '../utils/cadMath';

interface Cad3DViewerProps {
  project: CadProject;
}

export const Cad3DViewer: React.FC<Cad3DViewerProps> = ({ project }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.0008);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 20000);
    // Position camera isometric looking at center of building
    camera.position.set(600, 900, 1100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(800, 1500, 800);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const cyanPointLight = new THREE.PointLight(0x00f0ff, 0.6, 2000);
    cyanPointLight.position.set(300, 300, 300);
    scene.add(cyanPointLight);

    // 3. Ground Grid Helper
    const gridHelper = new THREE.GridHelper(3000, 60, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    // 4. Render Active Floor Walls & Elements
    const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];

    if (activeFloor) {
      // Floor Slab
      const floorPlaneGeo = new THREE.PlaneGeometry(1600, 1200);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x121722,
        roughness: 0.8,
        metalness: 0.1,
      });
      const floorMesh = new THREE.Mesh(floorPlaneGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(500, 0, 400);
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Build 3D Walls
      for (const wall of activeFloor.walls) {
        const matDef = WALL_MATERIALS[wall.material] || WALL_MATERIALS.brick_interior;
        const lengthCm = distanceCm(wall.start, wall.end);
        const heightCm = wall.heightMm / 10;
        const thicknessCm = wall.thicknessMm / 10;

        // Create extruded box geometry for wall
        const wallGeo = new THREE.BoxGeometry(lengthCm, heightCm, thicknessCm);
        const wallMaterial = new THREE.MeshStandardMaterial({
          color: matDef.threeColor,
          roughness: matDef.roughness,
          metalness: 0.2,
          transparent: wall.material === 'insulating_glass',
          opacity: wall.material === 'insulating_glass' ? 0.45 : 1.0,
        });

        const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        // Position and rotate wall
        const midX = (wall.start.x + wall.end.x) / 2;
        const midZ = (wall.start.y + wall.end.y) / 2;
        wallMesh.position.set(midX, heightCm / 2, midZ);

        const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        wallMesh.rotation.y = -angle;

        scene.add(wallMesh);
      }

      // Build 3D Devices with glowing status markers
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

        // Vertical mounting guide line from floor
        const guidePoints = [
          new THREE.Vector3(dev.position.x, 0, dev.position.y),
          new THREE.Vector3(dev.position.x, elevCm, dev.position.y),
        ];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(guidePoints);
        const lineMat = new THREE.LineDashedMaterial({
          color: devColor,
          dashSize: 5,
          gapSize: 5,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        scene.add(line);
      }

      // Build 3D Technical Routes (Tubes/Pipes)
      for (const route of activeFloor.routes) {
        if (!project.visibleLayers[route.layer]) continue;
        const layerDef = LAYER_DEFINITIONS.find((l) => l.id === route.layer);
        const routeColor = layerDef ? new THREE.Color(layerDef.color) : new THREE.Color(0x3b82f6);

        if (route.points.length >= 2) {
          const curvePoints = route.points.map(
            (p) => new THREE.Vector3(p.x, route.elevationMm / 10, p.y)
          );
          const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal');
          const tubeGeo = new THREE.TubeGeometry(curve, 40, 3, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: routeColor,
            emissive: routeColor,
            emissiveIntensity: 0.3,
            roughness: 0.4,
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          scene.add(tubeMesh);
        }
      }
    }

    // 5. Interactive Orbit Navigation via pointer
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(new THREE.Vector3(500, 0, 400)));
    const targetCenter = new THREE.Vector3(500, 100, 400);

    const onPointerDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      spherical.theta -= deltaX * 0.006;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - deltaY * 0.006));

      camera.position.setFromSpherical(spherical).add(targetCenter);
      camera.lookAt(targetCenter);

      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(200, Math.min(4000, spherical.radius + e.deltaY * 0.8));
      camera.position.setFromSpherical(spherical).add(targetCenter);
      camera.lookAt(targetCenter);
    };

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    camera.lookAt(targetCenter);

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
      container.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [project]);

  return (
    <div className="relative w-full h-full select-none bg-[#0a0d14]">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Viewport Controls HUD */}
      <div className="absolute top-4 left-4 z-10 bg-[#141a26]/90 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-xs text-gray-300 shadow-xl">
        <div className="font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
          3D Prostorový Model Budovy & Tras
        </div>
        <div className="text-[11px] text-gray-400 mt-1">
          Otáčení: <span className="text-[#00F0FF]">Levé tlačítko myši</span> | Zoom: <span className="text-[#00F0FF]">Kolečko</span>
        </div>
      </div>
    </div>
  );
};
