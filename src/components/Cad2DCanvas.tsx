import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CadProject, 
  Point2D, 
  Wall, 
  WallMaterialType, 
  DeviceNode, 
  LayerId, 
  TechnicalRoute,
  FrequencyBand
} from '../types/cad';
import { WALL_MATERIALS, LAYER_DEFINITIONS } from '../constants/materials';
import { 
  distanceCm, 
  snapPoint, 
  lockOrthoAngle, 
  distanceToSegment,
  resizeWallByLaserLength 
} from '../utils/cadMath';
import { computeRfHeatmap, rssiToRgba } from '../utils/rfEngine';
import { 
  Ruler, 
  Maximize2, 
  Minus, 
  Plus, 
  Crosshair, 
  Eye, 
  EyeOff, 
  Layers, 
  Sparkles,
  Info,
  Sliders,
  Check
} from 'lucide-react';

export type CadTool = 'select' | 'wall' | 'rect_room' | 'laser_measure' | 'place_device' | 'route_cable';

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

  // Pan and Zoom viewport state
  const [zoom, setZoom] = useState<number>(0.85); // pixels per cm
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Interactive drawing states
  const [drawStart, setDrawStart] = useState<Point2D | null>(null);
  const [cursorPosCm, setCursorPosCm] = useState<Point2D>({ x: 0, y: 0 });
  const [orthoLock, setOrthoLock] = useState<boolean>(false);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'wall_endpoint' | 'wall_whole' | 'device';
    id: string;
    pointKey?: 'start' | 'end';
    initialPos: Point2D;
    initialWall?: Wall;
  } | null>(null);

  // Active floor data
  const currentFloor = useMemo(() => {
    return project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];
  }, [project.building.floors, project.activeFloorId]);

  // Screen to World (cm) coordinate transforms
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

  // Pre-calculate floor bounds for heatmap
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

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#0a0d14'; // Cyber dark background
    ctx.fillRect(0, 0, rect.width, rect.height);

    // 1. Draw Grid
    const stepCm = snapEnabled ? project.gridSnapCm : 10;
    const gridPixelStep = stepCm * zoom;

    if (gridPixelStep >= 8) {
      ctx.lineWidth = 1;
      const startX = pan.x % gridPixelStep;
      const startY = pan.y % gridPixelStep;

      // Fine grid dots / lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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

      // Major grid lines (every 100 cm = 1 meter)
      const majorPixelStep = 100 * zoom;
      const majorStartX = pan.x % majorPixelStep;
      const majorStartY = pan.y % majorPixelStep;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
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

    // 2. Draw RF Signal Heatmap if enabled
    if (showHeatmap && rfHeatmapData) {
      const { minX, minY, stepCm, cols, rows, data } = rfHeatmapData.heatmapGrid;
      const cellSizePx = stepCm * zoom;

      for (let r = 0; r < rows; r++) {
        const wy = minY + r * stepCm;
        const sy = wy * zoom + pan.y;
        for (let c = 0; c < cols; c++) {
          const wx = minX + c * stepCm;
          const sx = wx * zoom + pan.x;
          const rssi = data[r * cols + c];
          const [red, green, blue, alpha] = rssiToRgba(rssi);

          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
          ctx.fillRect(sx, sy, cellSizePx + 0.5, cellSizePx + 0.5);
        }
      }
    }

    // 3. Draw Rooms (Polygons and labels)
    for (const room of currentFloor.rooms) {
      const isSelected = selectedRoomId === room.id;
      // Find room bounding box from walls
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

        // Subtle fill for room
        ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.15)' : 'rgba(30, 41, 59, 0.35)';
        ctx.fillRect(screenMin.x, screenMin.y, rw, rh);

        // Room label and area in m2
        ctx.fillStyle = isSelected ? '#00F0FF' : '#94A3B8';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(room.name, screenMin.x + rw / 2, screenMin.y + rh / 2 - 8);

        ctx.fillStyle = '#64748B';
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillText(`${room.areaSquareMeters} m²`, screenMin.x + rw / 2, screenMin.y + rh / 2 + 8);
      }
    }

    // 4. Draw Technical Routes / Cables (by layer)
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

      // Route waypoint dots
      ctx.fillStyle = strokeColor;
      route.points.forEach((pt) => {
        const spt = worldToScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(spt.x, spt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 5. Draw Walls with true physical thickness
    for (const wall of currentFloor.walls) {
      const isSelected = selectedWallId === wall.id;
      const mat = WALL_MATERIALS[wall.material] || WALL_MATERIALS.brick_interior;
      const thicknessPx = Math.max(3, (wall.thicknessMm / 10) * zoom); // mm to cm then zoom

      const s1 = worldToScreen(wall.start.x, wall.start.y);
      const s2 = worldToScreen(wall.end.x, wall.end.y);

      // Wall core stroke
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

      // Wall edge outlines
      ctx.lineWidth = 1;
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      // Wall Openings (Doors and Windows)
      for (const op of wall.openings) {
        const opCmX = wall.start.x + (wall.end.x - wall.start.x) * op.positionRatio;
        const opCmY = wall.start.y + (wall.end.y - wall.start.y) * op.positionRatio;
        const sop = worldToScreen(opCmX, opCmY);
        const opWidthPx = (op.widthMm / 10) * zoom;

        ctx.save();
        ctx.translate(sop.x, sop.y);
        const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
        ctx.rotate(angle);

        if (op.type === 'door') {
          // Door cutout and swing arc
          ctx.fillStyle = '#0a0d14';
          ctx.fillRect(-opWidthPx / 2, -thicknessPx / 2 - 1, opWidthPx, thicknessPx + 2);

          // Swing arc
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(-opWidthPx / 2, 0, opWidthPx, 0, Math.PI / 2);
          ctx.stroke();
        } else {
          // Window: cutout with double glass line
          ctx.fillStyle = '#0a0d14';
          ctx.fillRect(-opWidthPx / 2, -thicknessPx / 2 - 1, opWidthPx, thicknessPx + 2);

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

      // Dimension Label along wall
      const wallLenCm = distanceCm(wall.start, wall.end);
      if (wallLenCm > 20) {
        const midX = (s1.x + s2.x) / 2;
        const midY = (s1.y + s2.y) / 2;

        const displayLength = project.unit === 'mm' 
          ? `${Math.round(wallLenCm * 10)} mm` 
          : `${wallLenCm.toFixed(1)} cm`;

        ctx.save();
        ctx.font = 'bold 10px monospace';
        const txtWidth = ctx.measureText(displayLength).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
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

    // 6. Draw Interactive Drawing Preview (active wall or rect tool)
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

        // Measurement tooltip floating near cursor
        ctx.fillStyle = '#00F0FF';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`📏 ${curLenStr}`, s2.x + 12, s2.y - 12);
      } else if (activeTool === 'rect_room') {
        const rw = s2.x - s1.x;
        const rh = s2.y - s1.y;

        ctx.save();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(s1.x, s1.y, rw, rh);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
        ctx.fillRect(s1.x, s1.y, rw, rh);
        ctx.restore();

        const wCm = Math.abs(cursorPosCm.x - drawStart.x);
        const hCm = Math.abs(cursorPosCm.y - drawStart.y);
        const areaM2 = ((wCm * hCm) / 10000).toFixed(2);
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`Místnost: ${wCm.toFixed(0)}x${hCm.toFixed(0)} cm (${areaM2} m²)`, s2.x + 12, s2.y - 12);
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
      // Outer glow/ring if selected or active RF source
      if (isSelected || isRfSource) {
        ctx.strokeStyle = devColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Device body
      ctx.fillStyle = devColor;
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0d14';
      ctx.lineWidth = 2;
      ctx.stroke();

      // RF wave rings if RF active
      if (dev.rfConfig) {
        ctx.strokeStyle = `${devColor}88`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Label
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

    // Middle mouse button or Spacebar pan
    if (e.button === 1 || e.button === 2 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return; // Only primary click for actions

    let worldPt = screenToWorld(mouseX, mouseY);
    if (snapEnabled) {
      worldPt = snapPoint(worldPt, project.gridSnapCm);
    }

    if (activeTool === 'wall' || activeTool === 'rect_room') {
      if (!drawStart) {
        setDrawStart(worldPt);
      } else {
        // Complete Wall or Rect Room
        if (activeTool === 'wall') {
          const finalPt = orthoLock ? lockOrthoAngle(drawStart, worldPt) : worldPt;
          const len = distanceCm(drawStart, finalPt);
          if (len >= 5) {
            const newWall: Wall = {
              id: `wall_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              start: drawStart,
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
            });
            onSelectWall(newWall.id);
          }
          // Chain to next wall if Shift not pressed, or finish
          setDrawStart(e.shiftKey ? finalPt : null);
        } else if (activeTool === 'rect_room') {
          const minX = Math.min(drawStart.x, worldPt.x);
          const maxX = Math.max(drawStart.x, worldPt.x);
          const minY = Math.min(drawStart.y, worldPt.y);
          const maxY = Math.max(drawStart.y, worldPt.y);

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
              name: `Nová místnost (${roomAreaM2} m²)`,
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
            });
          }
          setDrawStart(null);
        }
      }
    } else if (activeTool === 'place_device' && deviceToPlace) {
      const newDev: DeviceNode = {
        ...deviceToPlace,
        id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        position: worldPt,
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
      });
      onSelectDevice(newDev.id);
    } else if (activeTool === 'select' || activeTool === 'laser_measure') {
      // 1. Check if clicked near device
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

      // 2. Check if clicked near wall
      let closestWall: Wall | null = null;
      let minDistance = 20; // 20cm tolerance
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
          // Check if clicked near start/end point
          const distStart = distanceCm(worldPt, closestWall.start);
          const distEnd = distanceCm(worldPt, closestWall.end);
          if (distStart < 12) {
            setDraggedItem({
              type: 'wall_endpoint',
              id: closestWall.id,
              pointKey: 'start',
              initialPos: worldPt,
              initialWall: closestWall,
            });
          } else if (distEnd < 12) {
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

      // 3. Clear selection or select room
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

    let worldPt = screenToWorld(mouseX, mouseY);
    if (snapEnabled) {
      worldPt = snapPoint(worldPt, project.gridSnapCm);
    }

    if (drawStart && orthoLock) {
      worldPt = lockOrthoAngle(drawStart, worldPt);
    }

    setCursorPosCm(worldPt);

    // Handle dragging endpoint or device
    if (draggedItem) {
      if (draggedItem.type === 'device') {
        const updatedFloors = project.building.floors.map((fl) => {
          if (fl.id === currentFloor.id) {
            return {
              ...fl,
              devices: fl.devices.map((d) => (d.id === draggedItem.id ? { ...d, position: worldPt } : d)),
            };
          }
          return fl;
        });
        onUpdateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, false);
      } else if (draggedItem.type === 'wall_endpoint' && draggedItem.pointKey) {
        const key = draggedItem.pointKey;
        const updatedFloors = project.building.floors.map((fl) => {
          if (fl.id === currentFloor.id) {
            return {
              ...fl,
              walls: fl.walls.map((w) => (w.id === draggedItem.id ? { ...w, [key]: worldPt } : w)),
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
      // Commit the final dragged position to the undo/redo history stack
      onUpdateProject(project, true);
      setDraggedItem(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.15, Math.min(3.5, zoom * zoomFactor));

    // Zoom centered on cursor
    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full select-none overflow-hidden bg-[#07090e]">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Floating Precision Coordinates & Laser HUD */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#141a26]/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg shadow-xl text-xs font-mono">
          <Crosshair className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span className="text-gray-400">X:</span>
          <span className="text-white font-semibold">{cursorPosCm.x.toFixed(1)} cm</span>
          <span className="text-gray-500">({Math.round(cursorPosCm.x * 10)} mm)</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">Y:</span>
          <span className="text-white font-semibold">{cursorPosCm.y.toFixed(1)} cm</span>
          <span className="text-gray-500">({Math.round(cursorPosCm.y * 10)} mm)</span>
        </div>

        {/* Snap & Ortho Toggles */}
        <div className="flex items-center bg-[#141a26]/90 backdrop-blur-md border border-white/10 p-1 rounded-lg text-xs gap-1">
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1.5 ${
              snapEnabled ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40' : 'text-gray-400 hover:text-white'
            }`}
            title="Přichytávání k rastru (Snap to Grid)"
          >
            <Sliders className="w-3 h-3" />
            Rastr: {project.gridSnapCm} cm
          </button>
          <button
            onClick={() => setOrthoLock(!orthoLock)}
            className={`px-2 py-1 rounded transition-colors ${
              orthoLock ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40' : 'text-gray-400 hover:text-white'
            }`}
            title="Ortogonální zámek 45°/90° (Shift)"
          >
            Ortho 90°
          </button>
        </div>
      </div>

      {/* Viewport Zoom & Fit Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-[#141a26]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-lg text-xs shadow-2xl">
        <button
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
          className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Přiblížit (Zoom In)"
        >
          <Plus className="w-4 h-4" />
        </button>
        <span className="px-2 font-mono text-gray-300 text-[11px] min-w-[48px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(0.15, z / 1.2))}
          className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Oddálit (Zoom Out)"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={() => {
            setZoom(0.85);
            setPan({ x: 80, y: 80 });
          }}
          className="p-1.5 text-gray-300 hover:text-[#00F0FF] hover:bg-white/10 rounded transition-colors"
          title="Resetovat pohled (Fit to Screen)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Wall Quick Info HUD */}
      {selectedWallId && (() => {
        const wall = currentFloor.walls.find((w) => w.id === selectedWallId);
        if (!wall) return null;
        const lenCm = distanceCm(wall.start, wall.end);
        const mat = WALL_MATERIALS[wall.material] || WALL_MATERIALS.brick_interior;

        return (
          <div className="absolute bottom-4 left-4 z-20 bg-[#141a26]/95 backdrop-blur-md border border-[#00F0FF]/40 p-3 rounded-xl shadow-2xl flex items-center gap-4 text-xs animate-in fade-in slide-in-from-bottom-2">
            <div>
              <div className="text-[#00F0FF] font-semibold flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5" />
                Vybraná stěna: {lenCm.toFixed(1)} cm ({Math.round(lenCm * 10)} mm)
              </div>
              <div className="text-gray-400 text-[11px] mt-0.5">
                Materiál: <span className="text-white">{mat.name}</span> | Tloušťka: <span className="text-white">{wall.thicknessMm} mm</span>
              </div>
            </div>
            <button
              onClick={() => onRequestLaserModal(wall)}
              className="bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-black font-semibold px-3 py-1.5 rounded-lg transition-transform active:scale-95 flex items-center gap-1 shadow-lg shadow-[#00F0FF]/20"
            >
              <Ruler className="w-3.5 h-3.5" />
              Dálkoměr (Laser)
            </button>
          </div>
        );
      })()}
    </div>
  );
};
