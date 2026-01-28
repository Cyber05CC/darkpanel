import React, { useMemo, useState } from 'react';
import { GraphPreset } from '../types';

interface PresetCardProps {
    preset: GraphPreset;
    isSelected: boolean;
    onClick: () => void;
    onContextMenu: () => void;
}

const PresetCard: React.FC<PresetCardProps> = ({ preset, onClick, onContextMenu }) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const startX = 6,
        endX = 34,
        width = endX - startX,
        halfW = width / 2;
    const height = 12,
        topPadding = 6;
    const baseY = height + topPadding;

    const pathData = useMemo(() => {
        if (preset.isEmpty) return '';
        const ho = preset.outInfluence / 100,
            hi = preset.inInfluence / 100;
        const steps = 40;
        let points = [],
            maxV = 0;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mt = 1 - t;
            const dxdt = 3 * mt * mt * ho + 6 * mt * t * (1 - hi - ho) + 3 * t * t * hi;
            const dydt = 6 * mt * t;
            const v = dxdt < 0.0001 ? 100 : dydt / dxdt;
            if (v > maxV) maxV = v;
            points.push({ t, v });
        }
        const standardPeak = 1.5;
        const visualScaleFactor = (height * 0.7) / standardPeak;
        const adaptiveScale = Math.min(visualScaleFactor, height / Math.max(0.1, maxV));

        let d = '';
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const mt = 1 - t;
            const x = (3 * mt * mt * t * ho + 3 * mt * t * t * (1 - hi) + t * t * t) * width;
            const y = height - points[i].v * adaptiveScale;
            d +=
                (i === 0 ? 'M ' : ' L ') +
                (x + startX).toFixed(1) +
                ',' +
                (y + topPadding).toFixed(1);
        }
        return d;
    }, [preset, width, height, startX, topPadding]);

    const hXOut = startX + (preset.outInfluence / 100) * halfW;
    const hXIn = endX - (preset.inInfluence / 100) * halfW;

    return (
        <button
            onClick={() => {
                setIsAnimating(true);
                onClick();
                setTimeout(() => setIsAnimating(false), 250);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu();
            }}
            className={`w-full h-full relative rounded-2xl border border-white/10 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.08] flex flex-col items-center justify-center transition-all duration-200 overflow-visible group ${
                isAnimating ? 'click-pop' : ''
            } shadow-lg`}
        >
            {!preset.isEmpty ? (
                <>
                    <svg
                        width="100%"
                        height="auto"
                        viewBox="0 0 40 28"
                        className="overflow-visible opacity-90 max-w-[75%] drop-shadow-xl"
                    >
                        <line
                            x1={startX}
                            y1={baseY}
                            x2={hXOut}
                            y2={baseY}
                            stroke="#fbbf24"
                            strokeWidth="0.25"
                            strokeDasharray="1,1"
                            opacity="0.5"
                        />
                        <line
                            x1={endX}
                            y1={baseY}
                            x2={hXIn}
                            y2={baseY}
                            stroke="#fbbf24"
                            strokeWidth="0.25"
                            strokeDasharray="1,1"
                            opacity="0.5"
                        />
                        <path
                            d={pathData}
                            fill="none"
                            stroke="#3f42f4"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <rect
                            x={startX - 0.7}
                            y={baseY - 0.7}
                            width="1.4"
                            height="1.4"
                            fill="#141414"
                            stroke="white"
                            strokeWidth="0.6"
                        />
                        <rect
                            x={endX - 0.7}
                            y={baseY - 0.7}
                            width="1.4"
                            height="1.4"
                            fill="#141414"
                            stroke="white"
                            strokeWidth="0.6"
                        />
                        <rect
                            x={hXOut - 0.6}
                            y={baseY - 0.6}
                            width="1.2"
                            height="1.2"
                            fill="#a2fa00"
                            style={{
                                transformBox: 'fill-box',
                                transformOrigin: 'center',
                                transform: 'rotate(45deg)',
                            }}
                        />
                        <rect
                            x={hXIn - 0.6}
                            y={baseY - 0.6}
                            width="1.2"
                            height="1.2"
                            fill="#a2fa00"
                            style={{
                                transformBox: 'fill-box',
                                transformOrigin: 'center',
                                transform: 'rotate(45deg)',
                            }}
                        />
                    </svg>
                    <span className="absolute bottom-[8%] text-[min(12px,2vmin)] font-black uppercase tracking-wider text-white/70 group-hover:text-white transition-colors duration-200 drop-shadow-md">
                        {preset.name}
                    </span>
                </>
            ) : (
                <span className="text-white/15 text-[6vmin] font-light group-hover:text-white/50 group-hover:scale-110 transition-all duration-300">
                    +
                </span>
            )}
        </button>
    );
};

export default PresetCard;
