import { Point2D, Wall } from '../types/cad';

export function distanceCm(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function snapToGrid(val: number, snapCm: number): number {
  if (snapCm <= 0) return Math.round(val);
  const rounded = Math.round(val / snapCm) * snapCm;
  return Number(rounded.toFixed(3));
}

export function snapPoint(p: Point2D, snapCm: number): Point2D {
  return {
    x: snapToGrid(p.x, snapCm),
    y: snapToGrid(p.y, snapCm),
  };
}

export function lockOrthoAngle(start: Point2D, current: Point2D): Point2D {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Snap to closest 45 degree angle (0, 45, 90, 135, 180, -135, -90, -45)
  const snappedAngle = Math.round(angle / 45) * 45;
  const rad = snappedAngle * (Math.PI / 180);

  return {
    x: start.x + dist * Math.cos(rad),
    y: start.y + dist * Math.sin(rad),
  };
}

// Ray-segment intersection (used for line of sight & wall penetration in RF Engine)
export function segmentsIntersect(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): boolean {
  function ccw(a: Point2D, b: Point2D, c: Point2D): boolean {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  }
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

// Calculate distance from point to segment
export function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return distanceCm(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceCm(p, {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  });
}

// Polygon area in square meters from vertex points (Shoelace formula)
export function calculatePolygonAreaM2(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let areaCm2 = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    areaCm2 += points[i].x * points[j].y;
    areaCm2 -= points[j].x * points[i].y;
  }
  const absArea = Math.abs(areaCm2) / 2;
  // 1 m2 = 10,000 cm2
  return Number((absArea / 10000).toFixed(2));
}

// Rescale or adjust wall to exact laser measurement length
export function resizeWallByLaserLength(wall: Wall, targetLengthMm: number): Wall {
  const targetLengthCm = targetLengthMm / 10;
  const currentLen = distanceCm(wall.start, wall.end);
  if (currentLen === 0) return wall;

  const ratio = targetLengthCm / currentLen;
  return {
    ...wall,
    end: {
      x: Number((wall.start.x + (wall.end.x - wall.start.x) * ratio).toFixed(1)),
      y: Number((wall.start.y + (wall.end.y - wall.start.y) * ratio).toFixed(1)),
    },
  };
}
