import React from 'react';
import { useProjectState, useProjectDispatch, useProjectActions } from '../context/ProjectContext';

const AVAILABLE_VOICES = [
    { name: 'Puck', description: 'Voz Femenina, enérgica y juvenil' },
    { name: 'Zephyr', description: 'Voz Masculina, amigable y clara' },
    { name: 'Kore', description: 'Voz Femenina, neutra y profesional' },
    { name: 'Charon', description: 'Voz Masculina, grave y épica' },
    { name: 'Fenrir', description: 'Voz Masculina, profunda y misteriosa' },
    { name: 'Achernar', description: 'Voz Masculina, serena y adulta' },
    { name: 'Alnilam', description: 'Voz Masculina, resonante y profunda' },
    { name: 'Callirrhoe', description: 'Voz Femenina, suave y melódica' },
    { name: 'Gacrux', description: 'Voz Masculina, autoritaria y madura' },
    { name: 'Sadachbia', description: 'Voz Femenina, cálida y conversacional' },
    { name: 'Vindemiatrix', description: 'Voz Femenina, elegante y sofisticada' },
    { name: 'Zubenelgenubi', description: 'Voz Masculina, única y distintiva' },
];

export default function ConfigStep() {
    const state = useProjectState();
    const dispatch = useProjectDispatch();
    const { handleGenerateScenes } = useProjectActions();

    const handleCharacterVoiceChange = (characterName: string, newVoice: string) => {
        dispatch({ type: 'UPDATE_CHARACTER_VOICE', payload: { characterName, newVoice } });
    };

    const handleConfigChange = (field: string, value: any) => {
        dispatch({ type: 'SET_CONFIG', payload: { [field]: value } as any });
    };
    
    return (
        <div className="max-w-5xl mx-auto bg-gray-800/60 p-8 rounded-2xl shadow-lg border border-gray-700 space-y-8">
             <div>
                <h2 className="text-2xl font-bold text-sky-300 mb-4">Paso 2: Configuración Creativa</h2>
                <p className="text-gray-400 mb-6">La IA ha identificado estos personajes. Asígnales una voz y ajusta los parámetros de generación.</p>
                
                <div className="space-y-4 mb-8">
                    {state.characters.map(char => (
                        <div key={char.name} className="bg-gray-900/70 p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-grow">
                                <h3 className="font-bold text-lg text-white">{char.name}</h3>
                                <p className="text-gray-400 text-sm mt-1">{char.description}</p>
                            </div>
                            <div className="w-full sm:w-64 flex-shrink-0">
                                <label className="block text-xs font-medium text-gray-300 mb-1">Voz del Personaje</label>
                                <select value={char.voice} onChange={(e) => handleCharacterVoiceChange(char.name, e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-sm">
                                    {AVAILABLE_VOICES.map(voice => <option key={voice.name} value={voice.name}>{voice.description}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                    {state.characters.length === 0 && <p className="text-center text-gray-500">No se identificaron personajes con diálogo en el texto.</p>}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Estilo visual:</label><select value={state.imageStyle} onChange={(e) => handleConfigChange('imageStyle', e.target.value)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"><option>Estilo Animación Pixar 3D</option><option>Cinematográfica</option><option>Realista</option><option>Anime</option><option>Estilo Cómic Marvel</option><option>Estilo Animación Disney</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Dirección de Arte / Paleta:</label><input type="text" value={state.artDirection} onChange={e => handleConfigChange('artDirection', e.target.value)} placeholder="Ej: azules noche, dorados cálidos" className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"/></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Voz del narrador:</label><select value={state.narratorVoice} onChange={(e) => handleConfigChange('narratorVoice', e.target.value)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg">{AVAILABLE_VOICES.map(voice => <option key={voice.name} value={voice.name}>{voice.description}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">Formato de Aspecto:</label><select value={state.aspectRatio} onChange={(e) => handleConfigChange('aspectRatio', e.target.value as any)} className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"><option value="16:9">16:9 (Cinematográfico)</option><option value="9:16">9:16 (Vertical)</option></select></div>
                    <div className="md:col-span-2 flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg"><input type="checkbox" id="include-text" checked={state.includeTextInImage} onChange={e => handleConfigChange('includeTextInImage', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" /><label htmlFor="include-text" className="text-sm text-gray-300">Incluir diálogos como texto en las imágenes (bocadillos/subtítulos)</label></div>
                </div>
             </div>

             <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button onClick={() => dispatch({ type: 'SET_STEP', payload: 'input' })} className="flex-1 px-6 py-3 border border-gray-500 text-base font-medium rounded-md shadow-sm text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition">Volver</button>
                <button onClick={handleGenerateScenes} className="flex-1 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 transition-transform transform hover:scale-105">¡Crear Magia!</button>
             </div>
        </div>
    );
}