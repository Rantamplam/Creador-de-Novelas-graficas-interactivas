
import React, { useRef } from 'react';
import { useProjectState, useProjectDispatch, useProjectActions } from '../context/ProjectContext';
import SceneCard from './SceneCard';
import { MovieIcon } from './Icons';

export default function ScenesDashboard() {
    const { scenes, imageStyle, artDirection } = useProjectState();
    const dispatch = useProjectDispatch();
    
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleDragEnd = () => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return;
        const scenesCopy = [...scenes];
        const draggedItemContent = scenesCopy.splice(dragItem.current, 1)[0];
        scenesCopy.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        dispatch({ type: 'UPDATE_SCENES_ORDER', payload: scenesCopy });
    };

    const allAudioGenerated = scenes.length > 0 && scenes.every(s => s.audioUrl);

    return (
       <div className="max-w-7xl mx-auto space-y-12">
         <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-sky-500/5 p-8 rounded-[2.5rem] border border-sky-500/10">
            <div className="text-center md:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                    <h2 className="text-3xl font-black text-white tracking-tight">Storyboard Interactivo</h2>
                    <div className="px-3 py-1 bg-sky-500/20 rounded-full border border-sky-500/30">
                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Estilo Global: {imageStyle}</span>
                    </div>
                </div>
                <p className="text-gray-400 text-sm mt-1">Dirección de arte: <span className="text-gray-300 italic">"{artDirection}"</span></p>
            </div>
            
             <button 
                onClick={() => dispatch({type: 'OPEN_MOVIE_MODAL'})} 
                disabled={!allAudioGenerated} 
                className="group relative px-8 py-4 flex items-center gap-3 bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-2xl shadow-purple-500/20 transition-all disabled:opacity-30 disabled:grayscale overflow-hidden"
             >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <MovieIcon className="w-6 h-6 relative z-10"/>
                <span className="relative z-10">{allAudioGenerated ? 'Producir Película' : 'Faltan Narraciones'}</span>
             </button>
        </div>

        <div className="space-y-10">
            {scenes.map((scene, index) => (
                <div
                    key={scene.id}
                    draggable
                    onDragStart={() => (dragItem.current = index)}
                    onDragEnter={() => (dragOverItem.current = index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="cursor-move group"
                >
                    <SceneCard 
                        scene={scene} 
                        sceneNumber={index + 1}
                    />
                </div>
            ))}
        </div>

        <div className="flex justify-center pb-20">
             <button 
                onClick={() => dispatch({ type: 'SET_STEP', payload: 'config' })}
                className="text-gray-500 hover:text-sky-400 font-bold text-sm transition-colors"
            >
                &larr; Volver a Configuración de Personajes
            </button>
        </div>
       </div>
    );
}
