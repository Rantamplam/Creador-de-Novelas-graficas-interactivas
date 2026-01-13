import React, { useEffect, useRef } from 'react';
import { useProjectState, useProjectDispatch, useProjectActions } from '../context/ProjectContext';
import { FolderOpenIcon, KeyIcon, UploadIcon } from './Icons';

export default function InputStep() {
    const { novelText, error, isProjectSaved, hasApiKey } = useProjectState();
    const dispatch = useProjectDispatch();
    const { handleAnalyzeText, handleLoadProject } = useProjectActions();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const checkApiKey = async () => {
        if (typeof (window as any).aistudio === 'undefined') { 
            dispatch({ type: 'SET_API_KEY_STATUS', payload: true });
            return true; 
        }
        const keySelected = await (window as any).aistudio.hasSelectedApiKey();
        dispatch({ type: 'SET_API_KEY_STATUS', payload: keySelected });
        return keySelected;
    };
    
    useEffect(() => { checkApiKey(); }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                dispatch({ type: 'SET_NOVEL_TEXT', payload: text });
                dispatch({ type: 'ADD_TOAST', payload: { message: `¡Archivo "${file.name}" cargado!`, type: 'success' } });
            };
            reader.onerror = () => {
                dispatch({ type: 'SET_ERROR', payload: 'Error al leer el archivo.' });
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-gray-800/60 p-8 rounded-2xl shadow-lg border border-gray-700">
             <textarea 
                value={novelText} 
                onChange={(e) => dispatch({ type: 'SET_NOVEL_TEXT', payload: e.target.value })} 
                placeholder="Pega tu storyboard o guion aquí..." 
                className="w-full h-64 p-4 bg-gray-900 border border-gray-600 rounded-lg text-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
            />
            {error && <p className="text-red-400 mt-4">{error}</p>}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button 
                    onClick={handleAnalyzeText} 
                    className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 transition-transform transform hover:scale-105"
                >
                    Analizar Guion
                </button>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".txt,.md,text/plain"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-500 text-base font-medium rounded-md text-gray-300 hover:bg-gray-700"
                >
                    <UploadIcon className="w-5 h-5" />
                    <span>Cargar Archivo</span>
                </button>
                
                <div className="flex gap-4 col-span-1 sm:col-span-2 lg:col-span-1">
                    <button 
                        onClick={handleLoadProject} 
                        disabled={!isProjectSaved} 
                        className="flex-grow flex items-center justify-center gap-2 px-4 py-3 border border-teal-500 text-base font-medium rounded-md text-teal-300 hover:bg-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                        <FolderOpenIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Cargar Proyecto</span>
                    </button>
                    {typeof (window as any).aistudio !== 'undefined' && !hasApiKey && 
                        <button 
                            onClick={() => (window as any).aistudio.openSelectKey().then(() => checkApiKey())} 
                            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 border border-amber-500 text-base font-medium rounded-md text-amber-300 hover:bg-amber-500/20" 
                            title="Se requiere una clave de API para la generación de videos."
                        >
                            <KeyIcon className="w-5 h-5" />
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}
