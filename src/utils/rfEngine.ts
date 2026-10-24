import { DeviceNode, FrequencyBand, Point2D, Wall } from '../types/cad';
import { WALL_MATERIALS } from '../constants/materials';
import { distanceCm, segmentsIntersect } from './cadMath';

export interface RfSimulationResult {
  sourceDevice: DeviceNode;
  band: FrequencyBand;
  heatmapGrid: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    stepCm: number;
    cols: number;
    rows: number;
    data: Float32Array; // RSSI in dBm
  };
  zoneAudit: {
    roomName: string;
    avgRssiDbm: number;
    minRssiDbm: number;
    status: 'optimal' | 'acceptable' | 'critical' | 'dead_zone';
    recommendation?: string;
  }[];
}

const FREQUENCY_SPECS: Record<FrequencyBand, { mhz: number; pathLossExp: number }> = {
  rf433: { mhz: 433.92, pathLossExp: 2.2 },
  rf868: { mhz: 868.0, pathLossExp: 2.4 },
  rf2400: { mhz: 2412.0, pathLossExp: 2.8 },
  rf5000: { mhz: 5200.0, pathLossExp: 3.2 },
};

// Calculate Free Space Path Loss at 1 meter in dB
function getFspsAt1Meter(freqMhz: number): number {
  return 20 * Math.log10(freqMhz) - 27.55;
}

export function calculatePathLossAtPoint(
  txPos: Point2D,
  targetPos: Point2D,
  txPowerDbm: number,
  band: FrequencyBand,
  walls: Wall[],
  txPenaltyDb: number = 0
): number {
  const distCm = distanceCm(txPos, targetPos);
  const distM = Math.max(0.1, distCm / 100);

  const spec = FREQUENCY_SPECS[band];
  const fspl1m = getFspsAt1Meter(spec.mhz);

  // Path loss over distance (Log-distance path loss model)
  const distanceLossDb = fspl1m + 10 * spec.pathLossExp * Math.log10(distM);

  // Wall penetration losses
  let wallLossDb = 0;
  for (const wall of walls) {
    if (segmentsIntersect(txPos, targetPos, wall.start, wall.end)) {
      const mat = WALL_MATERIALS[wall.material] || WALL_MATERIALS.brick_interior;
      const baseLoss = mat.attenuationDb[band] || 5;
      // Adjust slightly by wall thickness ratio compared to standard
      const thicknessRatio = wall.thicknessMm / mat.defaultThicknessMm;
      wallLossDb += baseLoss * Math.max(0.7, Math.min(2.5, thicknessRatio));
    }
  }

  // RSSI = TxPower - PathLoss - HardwarePenalty
  const totalLoss = distanceLossDb + wallLossDb + txPenaltyDb;
  const rssiDbm = txPowerDbm - totalLoss;
  return Number(rssiDbm.toFixed(1));
}

// Compute entire floor heatmap raster
export function computeRfHeatmap(
  sourceDevice: DeviceNode,
  walls: Wall[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  stepCm: number = 30,
  bandOverride?: FrequencyBand
): RfSimulationResult {
  const band = bandOverride || sourceDevice.rfConfig?.band || 'rf2400';
  const txPower = sourceDevice.rfConfig?.txPowerDbm ?? 18;
  const penalty = sourceDevice.rfConfig?.attenuationPenaltyDb ?? 0;

  const widthCm = bounds.maxX - bounds.minX;
  const heightCm = bounds.maxY - bounds.minY;

  const cols = Math.max(2, Math.ceil(widthCm / stepCm));
  const rows = Math.max(2, Math.ceil(heightCm / stepCm));
  const data = new Float32Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    const y = bounds.minY + r * stepCm;
    for (let c = 0; c < cols; c++) {
      const x = bounds.minX + c * stepCm;
      const rssi = calculatePathLossAtPoint(
        sourceDevice.position,
        { x, y },
        txPower,
        band,
        walls,
        penalty
      );
      data[r * cols + c] = rssi;
    }
  }

  return {
    sourceDevice,
    band,
    heatmapGrid: {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      stepCm,
      cols,
      rows,
      data,
    },
    zoneAudit: [],
  };
}

// Convert RSSI dBm to Heatmap RGBA for Canvas rendering
export function rssiToRgba(rssiDbm: number): [number, number, number, number] {
  // Typical thresholds:
  // > -50 dBm: Excellent (Cyan/Green)
  // -50 to -65 dBm: Good (Green)
  // -65 to -75 dBm: Moderate (Yellow)
  // -75 to -85 dBm: Weak (Orange/Red)
  // < -85 dBm: Dead zone / Cutoff
  if (rssiDbm >= -50) {
    return [0, 240, 255, 160]; // Electric cyan
  } else if (rssiDbm >= -65) {
    const t = (rssiDbm - -65) / 15;
    return [Math.round(16 + (0 - 16) * t), Math.round(185 + (240 - 185) * t), Math.round(129 + (255 - 129) * t), 150];
  } else if (rssiDbm >= -75) {
    const t = (rssiDbm - -75) / 10;
    return [Math.round(245 + (16 - 245) * t), Math.round(158 + (185 - 158) * t), Math.round(11 + (129 - 11) * t), 140];
  } else if (rssiDbm >= -88) {
    const t = (rssiDbm - -88) / 13;
    return [Math.round(239 + (245 - 239) * t), Math.round(68 + (158 - 68) * t), Math.round(68 + (11 - 68) * t), 130];
  } else {
    // Dead zone
    return [30, 20, 50, 90]; // Dark violet dead zone
  }
}
