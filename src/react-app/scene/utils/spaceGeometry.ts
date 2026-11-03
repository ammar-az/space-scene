export type Point = { x: number; y: number };

export function hasFiniteSize(size: { width: number; height: number }) {
    return Number.isFinite(size.width) && size.width > 0 && Number.isFinite(size.height) && size.height > 0;
}

export type Orbit = {
    center: Point;
    radiusX: number;
    radiusY: number;
    tilt: number;
    // Unprojected extent when an inclined orbit looks smaller than its true outer radius.
    depthRadius?: number;
};

// Matches an SVG ellipse rotated around its center. Angles are in degrees.
export function getOrbitPoint(orbit: Orbit, phase: number): Point {
    const angle = phase * Math.PI / 180;
    const tilt = orbit.tilt * Math.PI / 180;
    const x = orbit.radiusX * Math.cos(angle);
    const y = orbit.radiusY * Math.sin(angle);

    return {
        x: orbit.center.x + x * Math.cos(tilt) - y * Math.sin(tilt),
        y: orbit.center.y + x * Math.sin(tilt) + y * Math.cos(tilt),
    };
}

/** Camera-facing depth in CSS pixels, on the same near/far halves as the projected orbit. */
export function getOrbitDepth(orbit: Orbit, phase: number, scale: Point, depthScale: number) {
    const tilt = orbit.tilt * Math.PI / 180;
    const major = Math.hypot(orbit.radiusX * Math.cos(tilt) * scale.x, orbit.radiusX * Math.sin(tilt) * scale.y);
    const minor = Math.hypot(orbit.radiusY * Math.sin(tilt) * scale.x, orbit.radiusY * Math.cos(tilt) * scale.y);
    const radius = orbit.depthRadius === undefined ? Math.max(major, minor) : orbit.depthRadius * scale.x;
    return Math.sin(phase * Math.PI / 180) * radius * depthScale;
}

/** Upper intersection with a vertical line, including inclined ellipses. */
export function getUpperOrbitPoint(orbit: Orbit, x: number) {
    const tilt = orbit.tilt * Math.PI / 180, c = Math.cos(tilt), s = Math.sin(tilt);
    const horizontalExtent = Math.hypot(orbit.radiusX * c, orbit.radiusY * s);
    const dx = Math.max(-horizontalExtent, Math.min(horizontalExtent, x - orbit.center.x));
    const inverseX = 1 / orbit.radiusX ** 2, inverseY = 1 / orbit.radiusY ** 2;
    const a = c * c * inverseX + s * s * inverseY;
    const b = 2 * c * s * (inverseX - inverseY) * dx;
    const d = s * s * inverseX + c * c * inverseY;
    const dy = (-b - Math.sqrt(Math.max(0, b * b - 4 * d * (a * dx * dx - 1)))) / (2 * d);
    return {
        point: { x: orbit.center.x + dx, y: orbit.center.y + dy },
        angle: Math.atan2((-dx * s + dy * c) / orbit.radiusY,
            (dx * c + dy * s) / orbit.radiusX) * 180 / Math.PI,
    };
}

/** Intersections of two projected ellipses, with each orbit's phase at the crossing. */
export function getOrbitCrossings(first: Orbit, second: Orbit) {
    const tilt = second.tilt * Math.PI / 180;
    const local = (point: Point) => {
        const x = point.x - second.center.x, y = point.y - second.center.y;
        return { x: (x * Math.cos(tilt) + y * Math.sin(tilt)) / second.radiusX,
            y: (-x * Math.sin(tilt) + y * Math.cos(tilt)) / second.radiusY };
    };
    const level = (phase: number) => {
        const point = local(getOrbitPoint(first, phase));
        return point.x ** 2 + point.y ** 2 - 1;
    };
    const crossings: { point: Point; firstPhase: number; secondPhase: number }[] = [];
    let previous = level(0);
    for (let phase = 1; phase <= 360; phase++) {
        const current = level(phase);
        if (previous * current < 0 || current === 0) {
            let low = phase - 1, high = phase, lowValue = previous;
            for (let step = 0; step < 24; step++) {
                const middle = (low + high) / 2, value = level(middle);
                if (lowValue * value <= 0) high = middle;
                else { low = middle; lowValue = value; }
            }
            const firstPhase = (low + high) / 2, point = getOrbitPoint(first, firstPhase);
            if (!crossings.some(crossing => Math.hypot(crossing.point.x - point.x, crossing.point.y - point.y) < 0.01)) {
                const normalized = local(point);
                crossings.push({ point, firstPhase, secondPhase: Math.atan2(normalized.y, normalized.x) * 180 / Math.PI });
            }
        }
        previous = current;
    }
    return crossings;
}
