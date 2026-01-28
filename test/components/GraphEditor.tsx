import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

interface GraphEditorProps {
    outInfluence: number;
    inInfluence: number;
    onUpdate: (out: number, inInf: number) => void;
    isCompact?: boolean;
}

const GraphEditor: React.FC<GraphEditorProps> = ({
    outInfluence,
    inInfluence,
    onUpdate,
    isCompact = false,
}) => {
    const containerRef = useRef<SVGSVGElement>(null);
    const [activeHandle, setActiveHandle] = useState<'out' | 'in' | null>(null);

    const WIDTH = 240;
    const HEIGHT = isCompact ? 100 : 140;
    const PX = 40;
    const PY = 40;

    const TOTAL_W = WIDTH + PX * 2;
    const TOTAL_H = HEIGHT + PY * 2;
    const BASE_Y = HEIGHT + PY;
    const HALF_W = WIDTH / 2;

    const getSpeedAtT = (t: number, ho: number, hi: number) => {
        const mt = 1 - t;
        const dxdt = 3 * mt * mt * ho + 6 * mt * t * (1 - hi - ho) + 3 * t * t * hi;
        const dydt = 6 * mt * t;
        return dxdt < 0.0001 ? 100 : dydt / dxdt;
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!activeHandle || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const scaleX = TOTAL_W / rect.width;
            const xPos = (e.clientX - rect.left) * scaleX - PX;

            if (activeHandle === 'out') {
                const val = Math.max(0.1, Math.min(100, (xPos / HALF_W) * 100));
                onUpdate(val, inInfluence);
            } else {
                const val = Math.max(0.1, Math.min(100, ((WIDTH - xPos) / HALF_W) * 100));
                onUpdate(outInfluence, val);
            }
        },
        [activeHandle, outInfluence, inInfluence, onUpdate, TOTAL_W, WIDTH, HALF_W]
    );

    useEffect(() => {
        if (activeHandle) {
            const stop = () => setActiveHandle(null);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', stop);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', stop);
            };
        }
    }, [activeHandle, handleMouseMove]);

    const pathData = useMemo(() => {
        const ho = outInfluence / 100;
        const hi = inInfluence / 100;
        const steps = 100;
        let pts = [];
        let maxV = 0;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const v = getSpeedAtT(t, ho, hi);
            if (v > maxV) maxV = v;
            pts.push({ t, v });
        }

        const standardPeak = 1.5;
        const visualScaleFactor = (HEIGHT * 0.7) / standardPeak;
        const currentMaxV = Math.max(0.1, maxV);
        const adaptiveScale = Math.min(visualScaleFactor, HEIGHT / currentMaxV);

        let d = '';
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mt = 1 - t;
            const x = (3 * mt * mt * t * ho + 3 * mt * t * t * (1 - hi) + t * t * t) * WIDTH;
            const y = HEIGHT - pts[i].v * adaptiveScale;
            d += (i === 0 ? 'M ' : ' L ') + (x + PX).toFixed(2) + ',' + (y + PY).toFixed(2);
        }
        return d;
    }, [outInfluence, inInfluence, WIDTH, HEIGHT, PX, PY]);

    const hXOut = PX + HALF_W * (outInfluence / 100);
    const hXIn = PX + WIDTH - HALF_W * (inInfluence / 100);

    return (
        <div className="w-full flex flex-col items-center justify-center select-none bg-black/20 rounded-3xl p-4">
            <svg
                ref={containerRef}
                viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
                className={`w-full h-auto overflow-visible touch-none ${
                    activeHandle ? 'cursor-grabbing' : 'cursor-default'
                }`}
            >
                <line
                    x1={PX}
                    y1={BASE_Y}
                    x2={hXOut}
                    y2={BASE_Y}
                    stroke="#fbbf24"
                    strokeWidth="1"
                    strokeDasharray="3,2"
                    opacity="0.4"
                />
                <line
                    x1={PX + WIDTH}
                    y1={BASE_Y}
                    x2={hXIn}
                    y2={BASE_Y}
                    stroke="#fbbf24"
                    strokeWidth="1"
                    strokeDasharray="3,2"
                    opacity="0.4"
                />

                <path
                    d={pathData}
                    fill="none"
                    stroke="#3f42f4"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                <rect
                    x={PX - 4}
                    y={BASE_Y - 4}
                    width="8"
                    height="8"
                    fill="#141414"
                    stroke="#f7f7f7"
                    strokeWidth="2"
                />
                <rect
                    x={PX + WIDTH - 4}
                    y={BASE_Y - 4}
                    width="8"
                    height="8"
                    fill="#141414"
                    stroke="#f7f7f7"
                    strokeWidth="2"
                />

                <g onMouseDown={() => setActiveHandle('out')} className="cursor-ew-resize group">
                    <rect
                        x={hXOut - 15}
                        y={BASE_Y - 15}
                        width="30"
                        height="30"
                        fill="transparent"
                    />
                    <rect
                        x={hXOut - 5}
                        y={BASE_Y - 5}
                        width="10"
                        height="10"
                        fill="#a2fa00"
                        style={{
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                            transform: 'rotate(45deg)',
                        }}
                        className="group-hover:scale-125 transition-transform"
                    />
                </g>

                <g onMouseDown={() => setActiveHandle('in')} className="cursor-ew-resize group">
                    <rect x={hXIn - 15} y={BASE_Y - 15} width="30" height="30" fill="transparent" />
                    <rect
                        x={hXIn - 5}
                        y={BASE_Y - 5}
                        width="10"
                        height="10"
                        fill="#a2fa00"
                        style={{
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                            transform: 'rotate(45deg)',
                        }}
                        className="group-hover:scale-125 transition-transform"
                    />
                </g>
            </svg>
        </div>
    );
};

export default GraphEditor;
