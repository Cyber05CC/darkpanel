import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_PRESETS } from './constants.tsx';
import PresetCard from './components/PresetCard.tsx';
import GraphEditor from './components/GraphEditor.tsx';
import Modal from './components/Modal.tsx';
import { applyToAE } from './services/aeService.ts';

const STORAGE_KEY = 'SPEED_GRAPH_PRO_V12_FINAL';

const App = () => {
    const [state, setState] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return { presets: INITIAL_PRESETS, selectedId: 2, out: 33.3, inf: 33.3 };
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<any>(null);
    const [modalOut, setModalOut] = useState(33.3);
    const [modalIn, setModalIn] = useState(33.3);
    const [modalName, setModalName] = useState('USER');

    const handleApply = useCallback(async (out: number, inf: number) => {
        await applyToAE(out, inf);
    }, []);

    const handleRemove = () => {
        if (!editingPreset) return;
        const newPresets = state.presets.map((p) =>
            p.id === editingPreset.id
                ? { ...p, name: '', outInfluence: 33.3, inInfluence: 33.3, isEmpty: true }
                : p
        );
        setState((prev) => ({ ...prev, presets: newPresets }));
        setIsModalOpen(false);
    };

    return (
        <div className="relative flex items-center justify-center w-full h-full bg-[#080808] text-white overflow-hidden select-none font-['Inter']">
            {/* 
          Flexible Grid Container:
          - Scales based on the smaller viewport dimension (vmin) to stay visible and proportional
      */}
            <div className="w-full h-full flex items-center justify-center p-[4vmin]">
                <div className="w-[min(92vw,70vh)] h-fit flex items-center justify-center pointer-events-auto">
                    <div className="grid grid-cols-3 gap-[2vmin] w-full">
                        {state.presets.map((p) => (
                            <div key={p.id} className="w-full aspect-square">
                                <PresetCard
                                    preset={p}
                                    isSelected={false}
                                    onClick={() => {
                                        if (p.isEmpty) {
                                            setEditingPreset(p);
                                            setModalOut(33.3);
                                            setModalIn(33.3);
                                            setModalName('USER');
                                            setIsModalOpen(true);
                                        } else {
                                            setState((prev) => ({
                                                ...prev,
                                                selectedId: p.id,
                                                out: p.outInfluence,
                                                inf: p.inInfluence,
                                            }));
                                            handleApply(p.outInfluence, p.inInfluence);
                                        }
                                    }}
                                    onContextMenu={() => {
                                        setEditingPreset(p);
                                        setModalOut(p.outInfluence);
                                        setModalIn(p.inInfluence);
                                        setModalName(p.isEmpty ? 'USER' : p.name);
                                        setIsModalOpen(true);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="SPEED GRAPH EDITOR"
            >
                <div className="p-8 flex flex-col space-y-6 bg-[#0f0f0f]">
                    <div className="flex flex-col space-y-2 text-center">
                        <label className="text-[11px] font-bold uppercase text-white/50 tracking-[0.15em]">
                            PRESET NAME
                        </label>
                        <input
                            type="text"
                            maxLength={12}
                            value={modalName}
                            onChange={(e) => setModalName(e.target.value)}
                            className="bg-white/10 border border-white/10 rounded-xl px-4 py-4 text-[16px] font-bold text-white focus:border-blue-500/50 focus:bg-white/15 outline-none transition-all uppercase text-center placeholder:text-white/20"
                            placeholder="ENTER NAME"
                        />
                    </div>

                    <div className="flex justify-between px-6 bg-black/40 py-5 rounded-2xl border border-white/10">
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.1em] mb-1">
                                OUT INFLUENCE
                            </span>
                            <span className="font-mono text-[18px] font-bold text-[#fcd34d] tracking-tight">
                                {modalOut.toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-10 w-px bg-white/10 self-center"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.1em] mb-1">
                                IN INFLUENCE
                            </span>
                            <span className="font-mono text-[18px] font-bold text-[#fcd34d] tracking-tight">
                                {modalIn.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="bg-black/50 rounded-[2rem] p-4 border border-white/15 shadow-inner">
                        <GraphEditor
                            outInfluence={modalOut}
                            inInfluence={modalIn}
                            onUpdate={(o, i) => {
                                setModalOut(o);
                                setModalIn(i);
                            }}
                            isCompact
                        />
                    </div>

                    <div className="flex flex-col space-y-3 pt-2">
                        <button
                            onClick={() => {
                                const newPresets = state.presets.map((p) =>
                                    p.id === editingPreset.id
                                        ? {
                                              ...p,
                                              outInfluence: modalOut,
                                              inInfluence: modalIn,
                                              isEmpty: false,
                                              name: modalName.toUpperCase() || 'USER',
                                          }
                                        : p
                                );
                                setState((prev) => ({
                                    ...prev,
                                    presets: newPresets,
                                    selectedId: editingPreset.id,
                                    out: modalOut,
                                    inf: modalIn,
                                }));
                                handleApply(modalOut, modalIn);
                                setIsModalOpen(false);
                            }}
                            className="w-full bg-[#3f42f4] hover:bg-[#4f52f5] active:scale-95 transition-all py-5 rounded-[20px] text-[14px] font-bold uppercase tracking-[0.1em] shadow-2xl text-white"
                        >
                            Apply & Save
                        </button>

                        <div className="flex gap-3">
                            {editingPreset && !editingPreset.isEmpty && (
                                <button
                                    onClick={handleRemove}
                                    className="flex-1 border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 py-4 rounded-[16px] text-[11px] font-bold uppercase tracking-wider transition-all"
                                >
                                    Delete
                                </button>
                            )}
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 py-4 rounded-[16px] text-[11px] font-bold uppercase tracking-wider transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default App;
