import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CadProject, 
  Point2D, 
  Wall, 
  WallMaterialType, 
  DeviceNode, 
  FrequencyBand
} from '../types/cad';
import { WALL_MATERIALS, LAYER_DEFINITIONS } from '../constants/materials';
import { 
  distanceCm, 
  snapPoint, 
  snapToGrid,
  lockOrthoAngle, 
  distanceToSegment 
} from '../utils/cadMath';
import { computeRfHeatmap, rssiToRgba } from '../utils/rfEngine';
import { 
  Ruler, 
  Maximize2, 
  Minus, 
  Plus, 
  Crosshair, 
  Magnet, 
  Grid, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Hand,
  Check,
  ChevronDown
} from 'lucide-react';

export type CadTool = 'select' | 'pan' | 'wall' | 'rect_room' | 'laser_measure' | 'place_device' | 'route_cable';

interface Cad2DCanvasProps {
  project: CadProject;
  activeTool: CadTool;
  selectedWallId: string | null;
  selectedDeviceId: string | null;
  selectedRoomId: string | null;
  activeMaterial: WallMaterialType;
  wallThicknessMm: number;
  deviceToPlace: Omit<DeviceNode, 'id' | 'position'> | null;
  showHeatmap: boolean;
  onSelectWall: (id: string | null) => void;
  onSelectDevice: (id: string | null) => void;
  onSelectRoom: (id: string | null) => void;
  onUpdateProject: (updated: CadProject, commitToHistory?: boolean) => void;
  onRequestLaserModal: (wall: Wall) => void;
}

export const Cad2DCanvas: React.FC<Cad2DCanvasProps> = ({
  project,
  activeTool,
  selectedWallId,
  selectedDeviceId,
  selectedRoomId,
  activeMaterial,
  wallThicknessMm,
  deviceToPlace,
  showHeatmap,
  onSelectWall,
  onSelectDevice,
  onSelectRoom,
  onUpdateProject,
  onRequestLaserModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transformation: zoom and pan
  const [zoom, setZoom] = useState<number>(0.85); // pixels per cm
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 90, y: 70 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Interactive drawing & snap states
  const [drawStart, setDrawStart] = useState<Point2D | null>(null);
  const [cursorPosCm, setCursorPosCm] = useState<Point2D>({ x: 0, y: 0 });
  const [orthoLock, setOrthoLock] = useState<boolean>(false);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [showGridMenu, setShowGridMenu] = useState<boolean>(false);

  const [draggedItem, setDraggedItem] = useState<{
    type: 'wall_endpoint' | 'wall_whole' | 'device';
    id: string;
    pointKey?: 'start' | 'end';
    initialPos: Point2D;
    initialWall?: Wall;
  } | null>(null);

  // Active floor
  const currentFloor = useMemo(() => {
    return project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];
  }, [project.building.floors, project.activeFloorId]);

  // Coordinate transforms
  const screenToWorld = useCallback((screenX: number, screenY: number): Point2D => {
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const worldToScreen = useCallback((cmX: number, cmY: number): { x: number; y: number } => {
    return {
      x: cmX * zoom + pan.x,
      y: cmY * zoom + pan.y,
    };
  }, [pan, zoom]);

  // Global Keyboard shortcuts: Space for temporary Pan, 'S' for Snap-to-Grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setSnapEnabled((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Floor bounding box for simulation
  const floorBounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = 1200;
    let maxY = 800;
    if (currentFloor.walls.length > 0) {
      minX = Math.min(...currentFloor.walls.flatMap((w) => [w.start.x, w.end.x])) - 60;
      minY = Math.min(...currentFloor.walls.flatMap((w) => [w.start.y, w.end.y])) - 60;
      maxX = Math.max(...currentFloor.walls.flatMap((w) => [w.start.x, w.end.x])) + 60;
      maxY = Math.max(...currentFloor.walls.flatMap((w) => [w.start.y, w.end.y])) + 60;
    }
    return { minX, minY, maxX, maxY };
  }, [currentFloor.walls]);

  // RF Heatmap computation
  const rfHeatmapData = useMemo(() => {
    if (!showHeatmap) return null;
    const sourceDev = currentFloor.devices.find((d) => d.id === project.rfSimulation.sourceDeviceId) 
      || currentFloor.devices.find((d) => d.rfConfig) 
      || currentFloor.devices[0];

    if (!sourceDev) return null;

    return computeRfHeatmap(
      sourceDev,
      currentFloor.walls,
      floorBounds,
      project.rfSimulation.gridResolutionCm,
      project.rfSimulation.activeBand
    );
  }, [showHeatmap, currentFloor.devices, currentFloor.walls, floorBounds, project.rfSimulation]);

  // Main canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Deep dark blueprint background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // 1. Draw Metrical Grid
    const stepCm = snapEnabled ? project.gridSnapCm : 10;
    const gridPixelStep = stepCm * zoom;

    if (gridPixelStep >= 6) {
      ctx.lineWidth = 1;
      const startX = pan.x % gridPixelStep;
      const startY = pan.y % gridPixelStep;

      // Fine grid
      ctx.strokeStyle = snapEnabled ? 'rgba(0, 240, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      for (let x = startX; x < rect.width; x += gridPixelStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
      }
      for (let y = startY; y < rect.height; y += gridPixelStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
      }
      ctx.stroke();

      // Major grid (100 cm = 1 metr)
      const majorPixelStep = 100 * zoom;
      const majorStartX = pan.x % majorPixelStep;
      const majorStartY = pan.y % majorPixelStep;

      ctx.strokeStyle = snapEnabled ? 'rgba(0, 240, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      for (let x = majorStartX; x < rect.width; x += majorPixelStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
      }
      for (let y = majorStartY; y < rect.height; y += majorPixelStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
      }
      ctx.stroke();
    }

    // 2. Draw RF Heatmap if enabled
    if (showHeatmap && rfHeatmapData) {
      const { minX, minY, stepCm: hmStep, cols, rows, data } = rfHeatmapData.heatmapGrid;
      const cellSizePx = hmStep * zoom;

      for (let r = 0; r < rows; r++) {
        const wy = minY + r * hmStep;
        const sy = wy * zoom + pan.y;
        for (let c = 0; c < cols; c++) {
          const wx = minX + c * hmStep;
          const sx = wx * zoom + pan.x;
          const rssi = data[r * cols + c];
          const [red, green, blue, alpha] = rssiToRgba(rssi);

          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
          ctx.fillRect(sx, sy, cellSizePx + 0.5, cellSizePx + 0.5);
        }
      }
    }

    // 3. Draw Rooms
    for (const room of currentFloor.rooms) {
      const isSelected = selectedRoomId === room.id;
      const roomWalls = currentFloor.walls.filter((w) => room.wallIds.includes(w.id));
      if (roomWalls.length > 0) {
        const pts = roomWalls.flatMap((w) => [w.start, w.end]);
        const minRx = Math.min(...pts.map((p) => p.x));
        const maxRx = Math.max(...pts.map((p) => p.x));
        const minRy = Math.min(...pts.map((p) => p.y));
        const maxRy = Math.max(...pts.map((p) => p.y));

        const screenMin = worldToScreen(minRx, minRy);
        const screenMax = worldToScreen(maxRx, maxRy);
        const rw = screenMax.x - screenMin.x;
        const rh = screenMax.y - screenMin.y;

        ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(30, 41, 59, 0.28)';
        ctx.fillRect(screenMin.x, screenMin.y, rw, rh);

        ctx.fillStyle = isSelected ? '#00F0FF' : '#94A3B8';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(room.name, screenMin.x + rw / 2, screenMin.y + rh / 2 - 6);

        ctx.fillStyle = '#64748B';
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillText(`${room.areaSquareMeters} m²`, screenMin.x + rw / 2, screenMin.y + rh / 2 + 10);
      }
    }

    // 4. Draw Technical Routes / Cables
    for (const route of currentFloor.routes) {
      if (!project.visibleLayers[route.layer]) continue;
      const layerDef = LAYER_DEFINITIONS.find((l) => l.id === route.layer);
      const strokeColor = layerDef ? layerDef.color : '#94a3b8';

      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (route.installationMethod === 'in_floor') {
        ctx.setLineDash([8, 6]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      route.points.forEach((pt, idx) => {
        const spt = worldToScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(spt.x, spt.y);
        else ctx.lineTo(spt.x, spt.y);
      });
      ctx.stroke();

      ctx.fillStyle = strokeColor;
      route.points.forEach((pt) => {
        const spt = worldToScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(spt.x, spt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 5. Draw Walls with true physical thickness
    for (const wall of currentFloor.walls) {
      const isSelected = selectedWallId === wall.id;
      const mat = WALL_MATERIALS[wall.material] || WALL_MATERIALS.brick_interior;
      const thicknessPx = Math.max(3, (wall.thicknessMm / 10) * zoom);

      const s1 = worldToScreen(wall.start.x, wall.start.y);
      const s2 = worldToScreen(wall.end.x, wall.end.y);

      ctx.save();
      ctx.lineWidth = thicknessPx;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = isSelected ? '#00F0FF' : mat.color;

      if (isSelected) {
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.restore();

      // Outlines
      ctx.lineWidth = 1;
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      // Openings (doors/windows)
      for (const op of wall.openings) {
        const opCmX = wall.start.x + (wall.end.x - wall.start.x) * op.positionRatio;
        const opCmY = wall.start.y + (wall.end.y - wall.start.y) * op.positionRatio;
        const sop = worldToScreen(opCmX, opCmY);
        const opWidthPx = (op.widthMm / 10) * zoom;

        ctx.save();
        ctx.translate(sop.x, sop.y);
        const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
        ctx.rotate(angle);

        ctx.fillStyle = '#080c14';
        ctx.fillRect(-opWidthPx / 2, -thicknessPx / 2 - 1, opWidthPx, thicknessPx + 2);

        if (op.type === 'door') {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(-opWidthPx / 2, 0, opWidthPx, 0, Math.PI / 2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-opWidthPx / 2, -2);
          ctx.lineTo(opWidthPx / 2, -2);
          ctx.moveTo(-opWidthPx / 2, 2);
          ctx.lineTo(opWidthPx / 2, 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Endpoint handles if selected
      if (isSelected) {
        [s1, s2].forEach((pt) => {
          ctx.fillStyle = '#00F0FF';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }

      // Dimension Label
      const wallLenCm = distanceCm(wall.start, wall.end);
      if (wallLenCm > 25) {
        const midX = (s1.x + s2.x) / 2;
        const midY = (s1.y + s2.y) / 2;

        const displayLength = project.unit === 'mm' 
          ? `${Math.round(wallLenCm * 10)} mm` 
          : `${wallLenCm.toFixed(1)} cm`;

        ctx.save();
        ctx.font = 'bold 10px monospace';
        const txtWidth = ctx.measureText(displayLength).width;

        ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
        ctx.strokeStyle = isSelected ? '#00F0FF' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.fillRect(midX - txtWidth / 2 - 4, midY - 8, txtWidth + 8, 16);
        ctx.strokeRect(midX - txtWidth / 2 - 4, midY - 8, txtWidth + 8, 16);

        ctx.fillStyle = isSelected ? '#00F0FF' : '#E2E8F0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayLength, midX, midY);
        ctx.restore();
      }
    }

    // 6. Interactive Drawing Preview
    if (drawStart) {
      const s1 = worldToScreen(drawStart.x, drawStart.y);
      const s2 = worldToScreen(cursorPosCm.x, cursorPosCm.y);

      if (activeTool === 'wall') {
        const curLenCm = distanceCm(drawStart, cursorPosCm);
        const curLenStr = project.unit === 'mm' ? `${Math.round(curLenCm * 10)} mm` : `${curLenCm.toFixed(1)} cm`;

        ctx.save();
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = Math.max(3, (wallThicknessMm / 10) * zoom);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#00F0FF';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`📏 ${curLenStr}`, s2.x + 14, s2.y - 12);
      } else if (activeTool === 'rect_room') {
        const rw = s2.x - s1.x;
        const rh = s2.y - s1.y;

        ctx.save();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(s1.x, s1.y, rw, rh);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.fillRect(s1.x, s1.y, rw, rh);
        ctx.restore();

        const wCm = Math.abs(cursorPosCm.x - drawStart.x);
        const hCm = Math.abs(cursorPosCm.y - drawStart.y);
        const areaM2 = ((wCm * hCm) / 10000).toFixed(2);
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${wCm.toFixed(0)} × ${hCm.toFixed(0)} cm (${areaM2} m²)`, s2.x + 14, s2.y - 12);
      }
    }

    // 7. Draw Devices & Nodes
    for (const dev of currentFloor.devices) {
      if (!project.visibleLayers[dev.layer]) continue;
      const isSelected = selectedDeviceId === dev.id;
      const isRfSource = project.rfSimulation.sourceDeviceId === dev.id;
      const layerDef = LAYER_DEFINITIONS.find((l) => l.id === dev.layer);
      const devColor = isRfSource ? '#00F0FF' : (layerDef?.color || '#38BDF8');

      const sPos = worldToScreen(dev.position.x, dev.position.y);

      ctx.save();
      if (isSelected || isRfSource) {
        ctx.strokeStyle = devColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = devColor;
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#080c14';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (dev.rfConfig) {
        ctx.strokeStyle = `${devColor}77`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillStyle = isSelected ? '#00F0FF' : '#E2E8F0';
      ctx.textAlign = 'left';
      ctx.fillText(dev.name, sPos.x + 12, sPos.y + 3);

      if (dev.ip) {
        ctx.font = '500 9px monospace';
        ctx.fillStyle = '#64748B';
        ctx.fillText(dev.ip, sPos.x + 12, sPos.y + 14);
      }
      ctx.restore();
    }

    // 8. Place Device Cursor Preview
    if (activeTool === 'place_device' && deviceToPlace) {
      const sPos = worldToScreen(cursorPosCm.x, cursorPosCm.y);
      ctx.save();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.fill();

      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = '#00F0FF';
      ctx.fillText(`+ ${deviceToPlace.name}`, sPos.x + 16, sPos.y + 4);
      ctx.restore();
    }

  }, [
    project,
    currentFloor,
    activeTool,
    selectedWallId,
    selectedDeviceId,
    selectedRoomId,
    zoom,
    pan,
    drawStart,
    cursorPosCm,
    snapEnabled,
    wallThicknessMm,
    deviceToPlace,
    showHeatmap,
    rfHeatmapData,
    worldToScreen,
  ]);

  // Pointer event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Pan trigger: Middle button, Right button, Alt, Space held, or activeTool === 'pan'
    if (e.button === 1 || e.button === 2 || e.altKey || isSpacePressed || activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return;

    let rawWorldPt = screenToWorld(mouseX, mouseY);
    let worldPt = snapEnabled ? snapPoint(rawWorldPt, project.gridSnapCm) : rawWorldPt;

    if (activeTool === 'wall' || activeTool === 'rect_room') {
      if (!drawStart) {
        const startPt = snapEnabled ? snapPoint(worldPt, project.gridSnapCm) : worldPt;
        setDrawStart(startPt);
      } else {
        if (activeTool === 'wall') {
          let finalPt = orthoLock ? lockOrthoAngle(drawStart, worldPt) : worldPt;
          if (snapEnabled) {
            finalPt = snapPoint(finalPt, project.gridSnapCm);
          }
          const startPt = snapEnabled ? snapPoint(drawStart, project.gridSnapCm) : drawStart;
          const len = distanceCm(startPt, finalPt);
          if (len >= Math.max(1, project.gridSnapCm * 0.4)) {
            const newWall: Wall = {
              id: `wall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              start: startPt,
              end: finalPt,
              thicknessMm: wallThicknessMm,
              heightMm: currentFloor.ceilingHeightMm,
              material: activeMaterial,
              openings: [],
            };
            const updatedFloors = project.building.floors.map((fl) => {
              if (fl.id === currentFloor.id) {
                return { ...fl, walls: [...fl.walls, newWall] };
              }
              return fl;
            });
            onUpdateProject({
              ...project,
              building: { ...project.building, floors: updatedFloors },
            }, true);
            onSelectWall(newWall.id);
          }
          setDrawStart(e.shiftKey ? finalPt : null);
        } else if (activeTool === 'rect_room') {
          let minX = Math.min(drawStart.x, worldPt.x);
          let maxX = Math.max(drawStart.x, worldPt.x);
          let minY = Math.min(drawStart.y, worldPt.y);
          let maxY = Math.max(drawStart.y, worldPt.y);

          if (snapEnabled) {
            minX = snapPoint({ x: minX, y: minY }, project.gridSnapCm).x;
            maxX = snapPoint({ x: maxX, y: maxY }, project.gridSnapCm).x;
            minY = snapPoint({ x: minX, y: minY }, project.gridSnapCm).y;
            maxY = snapPoint({ x: maxX, y: maxY }, project.gridSnapCm).y;
          }

          if (maxX - minX >= 20 && maxY - minY >= 20) {
            const w1: Wall = {
              id: `w_rect_${Date.now()}_1`,
              start: { x: minX, y: minY },
              end: { x: maxX, y: minY },
              thicknessMm: wallThicknessMm,
              heightMm: currentFloor.ceilingHeightMm,
              material: activeMaterial,
              openings: [],
            };
            const w2: Wall = {
              id: `w_rect_${Date.now()}_2`,
              start: { x: maxX, y: minY },
              end: { x: maxX, y: maxY },
              thicknessMm: wallThicknessMm,
              heightMm: currentFloor.ceilingHeightMm,
              material: activeMaterial,
              openings: [],
            };
            const w3: Wall = {
              id: `w_rect_${Date.now()}_3`,
              start: { x: maxX, y: maxY },
              end: { x: minX, y: maxY },
              thicknessMm: wallThicknessMm,
              heightMm: currentFloor.ceilingHeightMm,
              material: activeMaterial,
              openings: [],
            };
            const w4: Wall = {
              id: `w_rect_${Date.now()}_4`,
              start: { x: minX, y: maxY },
              end: { x: minX, y: minY },
              thicknessMm: wallThicknessMm,
              heightMm: currentFloor.ceilingHeightMm,
              material: activeMaterial,
              openings: [],
            };

            const roomAreaM2 = Number((((maxX - minX) * (maxY - minY)) / 10000).toFixed(2));
            const newRoom = {
              id: `room_${Date.now()}`,
              name: `Místnost (${roomAreaM2} m²)`,
              wallIds: [w1.id, w2.id, w3.id, w4.id],
              areaSquareMeters: roomAreaM2,
              floorHeightMm: currentFloor.ceilingHeightMm,
              color: '#1e293b',
              type: 'living' as const,
            };

            const updatedFloors = project.building.floors.map((fl) => {
              if (fl.id === currentFloor.id) {
                return {
                  ...fl,
                  walls: [...fl.walls, w1, w2, w3, w4],
                  rooms: [...fl.rooms, newRoom],
                };
              }
              return fl;
            });
            onUpdateProject({
              ...project,
              building: { ...project.building, floors: updatedFloors },
            }, true);
          }
          setDrawStart(null);
        }
      }
    } else if (activeTool === 'place_device' && deviceToPlace) {
      const devPos = snapEnabled ? snapPoint(worldPt, project.gridSnapCm) : worldPt;
      const newDev: DeviceNode = {
        ...deviceToPlace,
        id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        position: devPos,
      };
      const updatedFloors = project.building.floors.map((fl) => {
        if (fl.id === currentFloor.id) {
          return { ...fl, devices: [...fl.devices, newDev] };
        }
        return fl;
      });
      onUpdateProject({
        ...project,
        building: { ...project.building, floors: updatedFloors },
      }, true);
      onSelectDevice(newDev.id);
    } else if (activeTool === 'select' || activeTool === 'laser_measure') {
      const clickedDevice = currentFloor.devices.find((d) => {
        return distanceCm(d.position, worldPt) <= 15;
      });
      if (clickedDevice) {
        onSelectDevice(clickedDevice.id);
        onSelectWall(null);
        onSelectRoom(null);
        setDraggedItem({
          type: 'device',
          id: clickedDevice.id,
          initialPos: { ...clickedDevice.position },
        });
        return;
      }

      let closestWall: Wall | null = null;
      let minDistance = 20;
      for (const w of currentFloor.walls) {
        const d = distanceToSegment(worldPt, w.start, w.end);
        if (d < minDistance) {
          minDistance = d;
          closestWall = w;
        }
      }

      if (closestWall) {
        onSelectWall(closestWall.id);
        onSelectDevice(null);
        onSelectRoom(null);

        if (activeTool === 'laser_measure') {
          onRequestLaserModal(closestWall);
        } else {
          const distStart = distanceCm(worldPt, closestWall.start);
          const distEnd = distanceCm(worldPt, closestWall.end);
          if (distStart < 14) {
            setDraggedItem({
              type: 'wall_endpoint',
              id: closestWall.id,
              pointKey: 'start',
              initialPos: worldPt,
              initialWall: closestWall,
            });
          } else if (distEnd < 14) {
            setDraggedItem({
              type: 'wall_endpoint',
              id: closestWall.id,
              pointKey: 'end',
              initialPos: worldPt,
              initialWall: closestWall,
            });
          }
        }
        return;
      }

      onSelectWall(null);
      onSelectDevice(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let rawWorldPt = screenToWorld(mouseX, mouseY);
    let worldPt = snapEnabled ? snapPoint(rawWorldPt, project.gridSnapCm) : rawWorldPt;

    if (drawStart && orthoLock) {
      worldPt = lockOrthoAngle(drawStart, worldPt);
      if (snapEnabled) {
        worldPt = snapPoint(worldPt, project.gridSnapCm);
      }
    }

    setCursorPosCm(worldPt);

    if (draggedItem) {
      if (draggedItem.type === 'device') {
        const devPt = snapEnabled ? snapPoint(worldPt, project.gridSnapCm) : worldPt;
        const updatedFloors = project.building.floors.map((fl) => {
          if (fl.id === currentFloor.id) {
            return {
              ...fl,
              devices: fl.devices.map((d) => (d.id === draggedItem.id ? { ...d, position: devPt } : d)),
            };
          }
          return fl;
        });
        onUpdateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, false);
      } else if (draggedItem.type === 'wall_endpoint' && draggedItem.pointKey) {
        const key = draggedItem.pointKey;
        const endPt = snapEnabled ? snapPoint(worldPt, project.gridSnapCm) : worldPt;
        const updatedFloors = project.building.floors.map((fl) => {
          if (fl.id === currentFloor.id) {
            return {
              ...fl,
              walls: fl.walls.map((w) => (w.id === draggedItem.id ? { ...w, [key]: endPt } : w)),
            };
          }
          return fl;
        });
        onUpdateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, false);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggedItem) {
      onUpdateProject(project, true);
      setDraggedItem(null);
    }
  };

  // Free Trackpad / Mouse Wheel handling
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const isZoomGesture = e.ctrlKey || e.metaKey;
    const isTwoFingerPan = Math.abs(e.deltaX) > 0 || e.shiftKey;

    if (isTwoFingerPan) {
      setPan((prev) => ({
        x: prev.x - (e.shiftKey ? e.deltaY : e.deltaX),
        y: prev.y - (e.shiftKey ? 0 : e.deltaY),
      }));
    } else if (isZoomGesture || Math.abs(e.deltaY) >= 45) {
      const zoomFactor = e.deltaY < 0 ? 1.14 : 0.88;
      const newZoom = Math.max(0.12, Math.min(4.0, zoom * zoomFactor));

      setPan({
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
      });
      setZoom(newZoom);
    } else {
      setPan((prev) => ({
        ...prev,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const canvasCursor = isPanning
    ? 'cursor-grabbing'
    : isSpacePressed || activeTool === 'pan'
    ? 'cursor-grab'
    : activeTool === 'wall' || activeTool === 'rect_room'
    ? 'cursor-crosshair'
    : 'cursor-default';

  return (
    <div ref={containerRef} className="relative w-full h-full select-none overflow-hidden bg-[#080c14]">
      {/* 2D Canvas */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full block ${canvasCursor}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Selected Wall Floating Banner */}
      {selectedWallId && (() => {
        const wall = currentFloor.walls.find((w) => w.id === selectedWallId);
        if (!wall) return null;
        const lenCm = distanceCm(wall.start, wall.end);
        const mat = WALL_MATERIALS[wall.material] || WALL_MATERIALS.brick_interior;

        return (
          <div className="absolute top-4 left-4 z-20 bg-[#121824]/95 backdrop-blur-md border border-[#00F0FF]/40 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-4 text-xs animate-in fade-in slide-in-from-top-2">
            <div>
              <span className="text-[#00F0FF] font-bold">Vybraná stěna: {lenCm.toFixed(1)} cm</span>
              <span className="text-gray-400 text-[11px] ml-2">({Math.round(lenCm * 10)} mm • {mat.name} • {wall.thicknessMm} mm)</span>
            </div>
            <button
              onClick={() => onRequestLaserModal(wall)}
              className="bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-black font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-md shadow-[#00F0FF]/20"
            >
              <Ruler className="w-3.5 h-3.5" />
              Zadat dálkoměrem
            </button>
          </div>
        );
      })()}

      {/* Unified Bottom Ergonomic CAD Dock */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Precision Coordinates & Control Guidance */}
        <div className="pointer-events-auto flex items-center gap-3 bg-[#121824]/95 backdrop-blur-md border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono shadow-xl text-gray-300">
          <Crosshair className="w-4 h-4 text-[#00F0FF]" />
          <span className="text-gray-400">X:</span>
          <span className="text-white font-bold">{cursorPosCm.x.toFixed(1)} cm</span>
          <span className="text-gray-500">({Math.round(cursorPosCm.x * 10)} mm)</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">Y:</span>
          <span className="text-white font-bold">{cursorPosCm.y.toFixed(1)} cm</span>
          <span className="text-gray-500">({Math.round(cursorPosCm.y * 10)} mm)</span>
          <div className="w-px h-3.5 bg-white/10 mx-1 hidden md:block" />
          <span className="text-[11px] text-gray-400 font-sans hidden md:inline">
            Mezerník + myš = posun • Kolečko = zoom
          </span>
        </div>

        {/* Center: Snap & Ortho Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-[#121824]/95 backdrop-blur-md border border-white/10 p-1.5 rounded-xl text-xs shadow-xl relative">
          {/* Snap-to-Grid Toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              snapEnabled
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/50 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Zapnout / vypnout přichytávání k rastru (Klávesa [S])"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Přichytávání: {snapEnabled ? 'ZAP' : 'VYP'}</span>
          </button>

          {/* Grid Size Selector */}
          <div className="relative">
            <button
              onClick={() => setShowGridMenu(!showGridMenu)}
              className="px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-1 font-mono"
              title="Zvolit velikost rastru"
            >
              <Grid className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>{project.gridSnapCm} cm</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showGridMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#141a26] border border-white/15 rounded-xl p-2 shadow-2xl space-y-1 text-xs">
                <div className="text-[10px] uppercase font-bold text-gray-400 px-2 py-1">
                  Krok rastru:
                </div>
                {[1, 2.5, 5, 10, 20, 50].map((step) => (
                  <button
                    key={step}
                    onClick={() => {
                      onUpdateProject({ ...project, gridSnapCm: step }, true);
                      setShowGridMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                      project.gridSnapCm === step
                        ? 'bg-[#00F0FF]/20 text-[#00F0FF] font-bold'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span>{step} cm ({step * 10} mm)</span>
                    {project.gridSnapCm === step && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ortho Lock */}
          <button
            onClick={() => setOrthoLock(!orthoLock)}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
              orthoLock
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Ortogonální úhlový zámek 45° a 90° (Shift)"
          >
            Ortho 90°
          </button>
        </div>

        {/* Right: Directional D-Pad Navigation & Zoom */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Quick Directional Pan Cross */}
          <div className="bg-[#121824]/95 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-xl flex items-center gap-0.5">
            <button
              onClick={() => setPan((p) => ({ ...p, x: p.x + 120 }))}
              className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
              title="Posunout doleva [Doleva o 120px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setPan((p) => ({ ...p, y: p.y + 120 }))}
                className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
                title="Posunout nahoru [Nahoru o 120px]"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPan((p) => ({ ...p, y: p.y - 120 }))}
                className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
                title="Posunout dolů [Dolů o 120px]"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setPan((p) => ({ ...p, x: p.x - 120 }))}
              className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded-lg transition-colors"
              title="Posunout doprava [Doprava o 120px]"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={() => {
                setZoom(0.85);
                setPan({ x: 90, y: 70 });
              }}
              className="p-1.5 text-[#00F0FF] hover:bg-[#00F0FF]/20 rounded-lg transition-colors"
              title="Vystředit celý půdorys na střed obrazovky"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom In / Out */}
          <div className="flex items-center gap-1 bg-[#121824]/95 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-xl text-xs">
            <button
              onClick={() => setZoom((z) => Math.min(4.0, z * 1.2))}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Přiblížit zobrazení"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-gray-300 text-[11px] min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.12, z / 1.2))}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Oddálit zobrazení"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
