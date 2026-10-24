import React, { useState } from 'react';
import { 
  CadProject, 
  Wall, 
  DeviceNode, 
  WallMaterialType, 
  LayerId 
} from './types/cad';
import { INITIAL_PROJECT } from './constants/inventoryHardware';
import { WALL_MATERIALS } from './constants/materials';
import { useProjectHistory } from './hooks/useProjectHistory';
import { Cad2DCanvas, CadTool } from './components/Cad2DCanvas';
import { Cad3DViewer } from './components/Cad3DViewer';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { LaserMeasureModal } from './components/LaserMeasureModal';
import { AiBridgeModal } from './components/AiBridgeModal';
import { DocumentationDrawer } from './components/DocumentationDrawer';
import { ExportReportModal } from './components/ExportReportModal';
import { 
  Box, 
  Layers, 
  Radio, 
  Ruler, 
  Bot, 
  Printer, 
  Save, 
  FolderOpen, 
  MousePointer, 
  Square, 
  Activity, 
  Plus, 
  ShieldCheck, 
  Settings,
  Sparkles,
  HardDrive,
  Undo2,
  Redo2
} from 'lucide-react';

export default function App() {
  // State History Manager for Undo/Redo
  const {
    project,
    canUndo,
    canRedo,
    pastCount,
    futureCount,
    updateProject,
    undo,
    redo,
    resetProject,
  } = useProjectHistory(INITIAL_PROJECT);

  // Main navigation view mode
  const [viewMode, setViewMode] = useState<'2d_cad' | '3d_view' | 'rf_heatmap'>('2d_cad');

  // CAD interactive tool state
  const [activeTool, setActiveTool] = useState<CadTool>('select');
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Active drawing presets
  const [activeMaterial, setActiveMaterial] = useState<WallMaterialType>('brick_interior');
  const [wallThicknessMm, setWallThicknessMm] = useState<number>(140);
  const [deviceToPlace, setDeviceToPlace] = useState<Omit<DeviceNode, 'id' | 'position'> | null>(null);

  // Modals state
  const [laserModalWall, setLaserModalWall] = useState<Wall | null>(null);
  const [isAiBridgeOpen, setIsAiBridgeOpen] = useState(false);
  const [isExportReportOpen, setIsExportReportOpen] = useState(false);
  const [docDrawer, setDocDrawer] = useState<{ isOpen: boolean; title: string; markdown: string } | null>(null);

  const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];

  // Tool handlers
  const handleSelectTool = (tool: CadTool) => {
    setActiveTool(tool);
    if (tool !== 'place_device') {
      setDeviceToPlace(null);
    }
  };

  const handleDevicePlaceSelect = (dev: Omit<DeviceNode, 'id' | 'position'> | null) => {
    setDeviceToPlace(dev);
    if (dev) {
      setActiveTool('place_device');
    } else {
      setActiveTool('select');
    }
  };

  const handleDeleteWall = (wallId: string) => {
    const updatedFloors = project.building.floors.map((fl) => {
      if (fl.id === activeFloor.id) {
        return {
          ...fl,
          walls: fl.walls.filter((w) => w.id !== wallId),
          rooms: fl.rooms.map((r) => ({
            ...r,
            wallIds: r.wallIds.filter((id) => id !== wallId),
          })),
        };
      }
      return fl;
    });
    updateProject({ ...project, building: { ...project.building, floors: updatedFloors } });
    setSelectedWallId(null);
  };

  const handleDeleteDevice = (devId: string) => {
    const updatedFloors = project.building.floors.map((fl) => {
      if (fl.id === activeFloor.id) {
        return {
          ...fl,
          devices: fl.devices.filter((d) => d.id !== devId),
        };
      }
      return fl;
    });
    updateProject({ ...project, building: { ...project.building, floors: updatedFloors } });
    setSelectedDeviceId(null);
  };

  const handleApplyLaserDimension = (updatedWall: Wall) => {
    const updatedFloors = project.building.floors.map((fl) => {
      if (fl.id === activeFloor.id) {
        return {
          ...fl,
          walls: fl.walls.map((w) => (w.id === updatedWall.id ? updatedWall : w)),
        };
      }
      return fl;
    });
    updateProject({ ...project, building: { ...project.building, floors: updatedFloors } });
  };

  const handleSaveJsonFile = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.building && parsed.building.floors) {
          resetProject(parsed);
        }
      } catch (err) {
        alert('Neplatný formát souboru projektu');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0d14] text-gray-200 font-sans select-none">
      {/* 1. Cyber Glass Top Navigation Bar */}
      <header className="h-14 bg-[#141a26]/95 border-b border-white/10 px-4 flex items-center justify-between shrink-0 shadow-xl z-30">
        {/* Brand & Project Name */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-[#00F0FF]/30 to-[#3B82F6]/20 border border-[#00F0FF]/50 rounded-xl text-[#00F0FF] shadow-lg shadow-[#00F0FF]/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-white tracking-wide">
                CAD-IoT Spatial Planner
              </h1>
              <span className="text-[10px] bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Local-First
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-medium">
              {project.name} • 100% lokální data bez telemetrie
            </p>
          </div>
        </div>

        {/* Primary View Mode Switcher */}
        <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setViewMode('2d_cad')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              viewMode === '2d_cad'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Ruler className="w-4 h-4" />
            2D CAD Půdorys
          </button>
          <button
            onClick={() => setViewMode('3d_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              viewMode === '3d_view'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Box className="w-4 h-4" />
            3D Prostorový Model
          </button>
          <button
            onClick={() => setViewMode('rf_heatmap')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              viewMode === 'rf_heatmap'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-purple-400" />
            RF Heatmap Simulace
          </button>
        </div>

        {/* Undo / Redo History Stack Controls */}
        <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10 gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              canUndo
                ? 'text-gray-200 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                : 'text-gray-600 cursor-not-allowed opacity-40'
            }`}
            title={`Zpět (Undo) [Ctrl+Z]${pastCount > 0 ? ` (${pastCount} kroků)` : ''}`}
          >
            <Undo2 className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-[11px] font-mono hidden md:inline">Zpět</span>
            {pastCount > 0 && (
              <span className="text-[9px] bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 px-1.5 py-0.2 rounded-full font-mono">
                {pastCount}
              </span>
            )}
          </button>

          <button
            onClick={redo}
            disabled={!canRedo}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              canRedo
                ? 'text-gray-200 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                : 'text-gray-600 cursor-not-allowed opacity-40'
            }`}
            title={`Vpřed (Redo) [Ctrl+Y / Ctrl+Shift+Z]${futureCount > 0 ? ` (${futureCount} kroků)` : ''}`}
          >
            <Redo2 className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-[11px] font-mono hidden md:inline">Vpřed</span>
            {futureCount > 0 && (
              <span className="text-[9px] bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 px-1.5 py-0.2 rounded-full font-mono">
                {futureCount}
              </span>
            )}
          </button>
        </div>

        {/* Global Action Tools (AI Bridge, PDF, Backup) */}
        <div className="flex items-center gap-2">
          {/* AI-Agent Bridge */}
          <button
            onClick={() => setIsAiBridgeOpen(true)}
            className="bg-[#A855F7]/15 hover:bg-[#A855F7]/25 text-[#A855F7] border border-[#A855F7]/40 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Export / Import dat pro AI agenty"
          >
            <Bot className="w-4 h-4" />
            AI-Agent Bridge
          </button>

          {/* Export / PDF Report */}
          <button
            onClick={() => setIsExportReportOpen(true)}
            className="bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Generovat PDF výkres a soupis materiálu"
          >
            <Printer className="w-4 h-4" />
            Tisk / PDF
          </button>

          {/* Local Backup to NAS / JSON */}
          <button
            onClick={handleSaveJsonFile}
            className="bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 p-2 rounded-xl transition-colors"
            title="Zálohovat projekt na NAS (JSON)"
          >
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </button>

          <label
            className="bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 p-2 rounded-xl transition-colors cursor-pointer"
            title="Načíst projekt z JSON"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <input
              type="file"
              accept=".json"
              onChange={handleLoadJsonFile}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* 2. Layers Bar (Independent Layer Visibility & Selection) */}
      <LayersPanel project={project} onUpdateProject={updateProject} />

      {/* 3. Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar (visible in 2D and RF modes) */}
        {viewMode !== '3d_view' && (
          <aside className="w-16 bg-[#10141e] border-r border-white/10 flex flex-col items-center py-4 gap-2 z-20 shrink-0">
            {/* Select Tool */}
            <button
              onClick={() => handleSelectTool('select')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'select'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Výběr & Přesun [V]"
            >
              <MousePointer className="w-5 h-5" />
            </button>

            {/* Wall Tool */}
            <button
              onClick={() => handleSelectTool('wall')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'wall'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Kreslení zdi [W]"
            >
              <Ruler className="w-5 h-5" />
            </button>

            {/* Rectangular Room Tool */}
            <button
              onClick={() => handleSelectTool('rect_room')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'rect_room'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Obdélníková místnost [R]"
            >
              <Square className="w-5 h-5" />
            </button>

            {/* Laser Measure Tool */}
            <button
              onClick={() => handleSelectTool('laser_measure')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'laser_measure'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Laserový dálkoměr – Přesná kóta [L]"
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
            </button>

            <div className="w-8 h-px bg-white/10 my-1" />

            {/* Quick Undo in toolbar */}
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`p-2.5 rounded-xl transition-all ${
                canUndo
                  ? 'text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                  : 'text-gray-700 cursor-not-allowed opacity-30'
              }`}
              title={`Zpět (Undo) [Ctrl+Z]${pastCount > 0 ? ` (${pastCount})` : ''}`}
            >
              <Undo2 className="w-4 h-4 text-[#00F0FF]" />
            </button>

            {/* Quick Redo in toolbar */}
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-2.5 rounded-xl transition-all ${
                canRedo
                  ? 'text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                  : 'text-gray-700 cursor-not-allowed opacity-30'
              }`}
              title={`Vpřed (Redo) [Ctrl+Y]${futureCount > 0 ? ` (${futureCount})` : ''}`}
            >
              <Redo2 className="w-4 h-4 text-[#F59E0B]" />
            </button>

            <div className="w-8 h-px bg-white/10 my-1" />

            {/* Unit Switcher (mm / cm) */}
            <button
              onClick={() =>
                updateProject({
                  ...project,
                  unit: project.unit === 'mm' ? 'cm' : 'mm',
                })
              }
              className="px-2 py-1 bg-black/40 border border-white/10 rounded text-[10px] font-mono font-bold text-[#00F0FF] hover:bg-white/10 transition-colors"
              title="Přepnout jednotky kóty (mm / cm)"
            >
              {project.unit.toUpperCase()}
            </button>
          </aside>
        )}

        {/* Central Viewport Area */}
        <main className="flex-1 relative overflow-hidden bg-[#07090e]">
          {viewMode === '3d_view' ? (
            <Cad3DViewer project={project} />
          ) : (
            <Cad2DCanvas
              project={project}
              activeTool={activeTool}
              selectedWallId={selectedWallId}
              selectedDeviceId={selectedDeviceId}
              selectedRoomId={selectedRoomId}
              activeMaterial={activeMaterial}
              wallThicknessMm={wallThicknessMm}
              deviceToPlace={deviceToPlace}
              showHeatmap={viewMode === 'rf_heatmap'}
              onSelectWall={setSelectedWallId}
              onSelectDevice={setSelectedDeviceId}
              onSelectRoom={setSelectedRoomId}
              onUpdateProject={updateProject}
              onRequestLaserModal={(wall) => setLaserModalWall(wall)}
            />
          )}
        </main>

        {/* Right Inspector & Settings Sidebar */}
        <PropertiesPanel
          project={project}
          selectedWallId={selectedWallId}
          selectedDeviceId={selectedDeviceId}
          selectedRoomId={selectedRoomId}
          activeMaterial={activeMaterial}
          wallThicknessMm={wallThicknessMm}
          deviceToPlace={deviceToPlace}
          onChangeActiveMaterial={setActiveMaterial}
          onChangeWallThickness={setWallThicknessMm}
          onSetDeviceToPlace={handleDevicePlaceSelect}
          onRequestLaserModal={(wall) => setLaserModalWall(wall)}
          onOpenDocDrawer={(item) =>
            setDocDrawer({ isOpen: true, title: item.title, markdown: item.markdown })
          }
          onUpdateProject={updateProject}
          onDeleteWall={handleDeleteWall}
          onDeleteDevice={handleDeleteDevice}
        />
      </div>

      {/* Modals & Dialogs */}
      {laserModalWall && (
        <LaserMeasureModal
          wall={laserModalWall}
          isOpen={!!laserModalWall}
          onClose={() => setLaserModalWall(null)}
          onApply={handleApplyLaserDimension}
        />
      )}

      {isAiBridgeOpen && (
        <AiBridgeModal
          project={project}
          isOpen={isAiBridgeOpen}
          onClose={() => setIsAiBridgeOpen(false)}
          onApplyAiPatch={(patched) => updateProject(patched)}
        />
      )}

      {isExportReportOpen && (
        <ExportReportModal
          project={project}
          isOpen={isExportReportOpen}
          onClose={() => setIsExportReportOpen(false)}
        />
      )}

      {docDrawer?.isOpen && (
        <DocumentationDrawer
          isOpen={docDrawer.isOpen}
          title={docDrawer.title}
          initialMarkdown={docDrawer.markdown}
          onClose={() => setDocDrawer(null)}
          onSave={(updatedMd) => {
            // Update device or room markdown notes
            const updatedFloors = project.building.floors.map((fl) => {
              if (fl.id === activeFloor.id) {
                return {
                  ...fl,
                  devices: fl.devices.map((d) =>
                    d.name === docDrawer.title ? { ...d, notesMarkdown: updatedMd } : d
                  ),
                  rooms: fl.rooms.map((r) =>
                    r.name === docDrawer.title ? { ...r, notesMarkdown: updatedMd } : r
                  ),
                };
              }
              return fl;
            });
            updateProject({ ...project, building: { ...project.building, floors: updatedFloors } });
          }}
        />
      )}
    </div>
  );
}
