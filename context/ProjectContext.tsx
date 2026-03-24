
import React, { createContext, useReducer, useContext, ReactNode, useCallback, useEffect } from 'react';
import type { ProjectState, ProjectAction, Scene, Character, Toast } from '../types';
import { 
    parseStoryboardIntoScenes, 
    identifyCharacters,
    generateImageForScene,
    generateVideoForScene,
    checkVideoStatus,
    generateAudioForScene
} from '../services/gemini';

export const AVAILABLE_VOICES = [
    { name: 'Puck', description: 'Voz Femenina, enérgica y juvenil', gender: 'FEMININE' },
    { name: 'Zephyr', description: 'Voz Masculina, amigable y clara', gender: 'MASCULINE' },
    { name: 'Kore', description: 'Voz Femenina, neutra y profesional', gender: 'FEMININE' },
    { name: 'Charon', description: 'Voz Masculina, grave y épica', gender: 'MASCULINE' },
    { name: 'Fenrir', description: 'Voz Masculina, profunda y misteriosa', gender: 'MASCULINE' },
    { name: 'Achernar', description: 'Voz Masculina, serena y adulta', gender: 'MASCULINE' },
    { name: 'Alnilam', description: 'Voz Masculina, resonante y profunda', gender: 'MASCULINE' },
    { name: 'Callirrhoe', description: 'Voz Femenina, suave y melódica', gender: 'FEMININE' },
    { name: 'Gacrux', description: 'Voz Masculina, autoritaria y madura', gender: 'MASCULINE' },
    { name: 'Sadachbia', description: 'Voz Femenina, cálida y conversacional', gender: 'FEMININE' },
    { name: 'Vindemiatrix', description: 'Voz Femenina, elegante y sofisticada', gender: 'FEMININE' },
    { name: 'Zubenelgenubi', description: 'Voz Masculina, única y distintiva', gender: 'MASCULINE' },
];

const initialState: ProjectState = {
    currentStep: 'input',
    novelText: '',
    scenes: [],
    characters: [],
    statusMessage: '',
    error: '',
    hasApiKey: false,
    imageStyle: 'Cinematográfica',
    artDirection: 'Colores saturados, iluminación dramática tipo noir',
    aspectRatio: '16:9',
    includeTextInImage: false,
    narratorVoice: 'Charon',
    showSubtitles: true,
    isSaving: false,
    isProjectSaved: false,
    isMovieModalOpen: false,
    toasts: [],
};

const projectReducer = (state: ProjectState, action: ProjectAction): ProjectState => {
    switch (action.type) {
        case 'SET_STEP': return { ...state, currentStep: action.payload };
        case 'SET_NOVEL_TEXT': return { ...state, novelText: action.payload };
        case 'SET_STATUS_MESSAGE': return { ...state, statusMessage: action.payload };
        case 'SET_ERROR': return { ...state, error: action.payload, statusMessage: '' };
        case 'START_ANALYSIS': return { ...state, statusMessage: 'Analizando el alma de tu historia...', error: '' };
        case 'ANALYZE_SUCCESS': return { ...state, characters: action.payload, currentStep: 'config', statusMessage: '' };
        case 'ANALYZE_FAILURE': return { ...state, error: action.payload, statusMessage: '' };
        case 'START_SCENE_GENERATION': return { ...state, statusMessage: 'Arquitectando el storyboard visual...', currentStep: 'scenes', error: '' };
        case 'SCENE_GENERATION_INITIALIZE': return { ...state, scenes: action.payload };
        case 'SCENE_GENERATION_COMPLETE': return { ...state, statusMessage: '' };
        case 'SCENE_GENERATION_FAILURE': return { ...state, error: action.payload, statusMessage: '' };
        case 'UPDATE_SCENE': return { ...state, scenes: state.scenes.map(s => s.id === action.payload.sceneId ? { ...s, ...action.payload.updates } : s) };
        case 'UPDATE_SCENES_ORDER': return { ...state, scenes: action.payload };
        case 'DELETE_SCENE': return { ...state, scenes: state.scenes.filter(s => s.id !== action.payload) };
        case 'UPDATE_CHARACTER_VOICE': return { ...state, characters: state.characters.map(c => c.name === action.payload.characterName ? { ...c, voice: action.payload.newVoice } : c) };
        case 'TOGGLE_SUBTITLES': return { ...state, showSubtitles: !state.showSubtitles };
        case 'SET_CONFIG': return { ...state, ...action.payload };
        case 'UPDATE_SCENE_CONFIG': return { ...state, scenes: state.scenes.map(s => s.id === action.payload.sceneId ? { ...s, ...action.payload.config } : s)};
        case 'OPEN_MOVIE_MODAL': return { ...state, isMovieModalOpen: true };
        case 'CLOSE_MOVIE_MODAL': return { ...state, isMovieModalOpen: false };
        case 'LOAD_PROJECT': 
            return {
                ...initialState,
                ...action.payload,
                statusMessage: '',
                isSaving: false,
                isMovieModalOpen: false,
                scenes: action.payload.scenes.map(s => ({...s, isGeneratingAudio: false, isGeneratingImage: false, isGeneratingVideo: false })),
            };
        case 'RESET_PROJECT': return { ...initialState };
        case 'SET_API_KEY_STATUS': return { ...state, hasApiKey: action.payload };
        case 'ADD_TOAST': return { ...state, toasts: [...state.toasts, { ...action.payload, id: Date.now() }] };
        case 'REMOVE_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        default: return state;
    }
};

const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
        audio.addEventListener('error', () => resolve(6));
    });
};

const ProjectStateContext = createContext<ProjectState | undefined>(undefined);
const ProjectDispatchContext = createContext<React.Dispatch<ProjectAction> | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(projectReducer, initialState);
    return (
        <ProjectStateContext.Provider value={state}>
            <ProjectDispatchContext.Provider value={dispatch}>
                {children}
            </ProjectDispatchContext.Provider>
        </ProjectStateContext.Provider>
    );
};

export const useProjectState = () => {
    const context = useContext(ProjectStateContext);
    if (!context) throw new Error('useProjectState must be used within a ProjectProvider');
    return context;
};

export const useProjectDispatch = () => {
    const context = useContext(ProjectDispatchContext);
    if (!context) throw new Error('useProjectDispatch must be used within a ProjectProvider');
    return context;
};

export const useProjectActions = () => {
    const dispatch = useProjectDispatch();
    const state = useProjectState();

    const handleAnalyzeText = useCallback(async () => {
        if (!state.novelText.trim()) {
            dispatch({ type: 'SET_ERROR', payload: 'El guion no puede estar vacío.' });
            return;
        }
        dispatch({ type: 'START_ANALYSIS' });
        try {
            const chars = await identifyCharacters(state.novelText);
            const femaleVoices = AVAILABLE_VOICES.filter(v => v.gender === 'FEMININE');
            const maleVoices = AVAILABLE_VOICES.filter(v => v.gender === 'MASCULINE');
            
            const charsWithVoices = chars.map((char, i) => {
                let defaultVoice = 'Charon';
                if (char.gender === 'FEMININE') {
                    defaultVoice = femaleVoices[i % femaleVoices.length].name;
                } else if (char.gender === 'MASCULINE') {
                    defaultVoice = maleVoices[i % maleVoices.length].name;
                }
                return { ...char, voice: defaultVoice };
            });
            dispatch({ type: 'ANALYZE_SUCCESS', payload: charsWithVoices });
        } catch (err: any) {
            if (err.message === 'API_KEY_MISSING' || err.message === 'API_KEY_INVALID') {
                dispatch({ type: 'SET_API_KEY_STATUS', payload: false });
                dispatch({ type: 'ADD_TOAST', payload: { message: 'Configura tu API Key para continuar', type: 'info' } });
            } else {
                dispatch({ type: 'ANALYZE_FAILURE', payload: err.message });
            }
        }
    }, [state.novelText, dispatch]);

    const handleGenerateImageForScene = useCallback(async (sceneId: number) => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene) return;
        dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingImage: true, imageError: undefined } } });
        try {
            const { imageUrl, imagePrompt } = await generateImageForScene(
                scene.parts, state.imageStyle, state.characters, state.artDirection, state.includeTextInImage
            );
            dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { imageUrl, imagePrompt, isGeneratingImage: false } } });
        } catch (err: any) {
            if (err.message === 'API_KEY_MISSING' || err.message === 'API_KEY_INVALID') {
                dispatch({ type: 'SET_API_KEY_STATUS', payload: false });
                dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingImage: false, imageError: 'Configura tu API Key' } } });
                dispatch({ type: 'ADD_TOAST', payload: { message: 'Configura tu API Key para continuar', type: 'info' } });
            } else {
                const isQuota = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
                const msg = isQuota ? 'Cuota agotada. Espera unos segundos.' : err.message;
                dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingImage: false, imageError: msg } } });
                dispatch({ type: 'ADD_TOAST', payload: { message: msg, type: 'error' } });
            }
        }
    }, [state, dispatch]);

    const handleGenerateScenes = useCallback(async () => {
        dispatch({ type: 'START_SCENE_GENERATION' });
        try {
            const scenesData = await parseStoryboardIntoScenes(state.novelText);
            const baseTime = Date.now();
            const initScenes: Scene[] = scenesData.map((s, i) => ({
                id: baseTime + i,
                parts: s.parts,
                isGeneratingImage: true,
                isGeneratingVideo: false,
                isGeneratingAudio: false,
            }));
            
            dispatch({ type: 'SCENE_GENERATION_INITIALIZE', payload: initScenes });

            // Mayor delay para asegurar estabilidad en la primera escena
            setTimeout(async () => {
                for (const scene of initScenes) {
                    try {
                        const { imageUrl, imagePrompt } = await generateImageForScene(
                            scene.parts, state.imageStyle, state.characters, state.artDirection, state.includeTextInImage
                        );
                        dispatch({ type: 'UPDATE_SCENE', payload: { sceneId: scene.id, updates: { imageUrl, imagePrompt, isGeneratingImage: false } } });
                    } catch (err: any) {
                        dispatch({ type: 'UPDATE_SCENE', payload: { sceneId: scene.id, updates: { isGeneratingImage: false, imageError: 'Error al generar' } } });
                    }
                    // Pequeña pausa entre escenas para evitar picos de cuota
                    await new Promise(r => setTimeout(r, 1000));
                }
                dispatch({ type: 'SCENE_GENERATION_COMPLETE' });
            }, 1000);

        } catch (err: any) {
            if (err.message === 'API_KEY_MISSING' || err.message === 'API_KEY_INVALID') {
                dispatch({ type: 'SET_API_KEY_STATUS', payload: false });
                dispatch({ type: 'SCENE_GENERATION_FAILURE', payload: 'Configura tu API Key' });
                dispatch({ type: 'ADD_TOAST', payload: { message: 'Configura tu API Key para continuar', type: 'info' } });
            } else {
                dispatch({ type: 'SCENE_GENERATION_FAILURE', payload: err.message });
            }
        }
    }, [state, dispatch]);

    const handleNarrateScene = useCallback(async (sceneId: number) => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene) return;
        dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingAudio: true } } });
        try {
            const audioUrl = await generateAudioForScene(scene.parts, state.characters, state.narratorVoice);
            const duration = await getAudioDuration(audioUrl);
            dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { audioUrl, duration, isGeneratingAudio: false } } });
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Narración lista', type: 'success' } });
        } catch (err: any) {
            if (err.message === 'API_KEY_MISSING' || err.message === 'API_KEY_INVALID') {
                dispatch({ type: 'SET_API_KEY_STATUS', payload: false });
                dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingAudio: false, audioError: 'Configura tu API Key' } } });
                dispatch({ type: 'ADD_TOAST', payload: { message: 'Configura tu API Key para continuar', type: 'info' } });
            } else {
                const isQuota = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
                const msg = isQuota ? 'Cuota de voz agotada. Reintenta en 1 min.' : err.message;
                dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingAudio: false, audioError: msg } } });
                dispatch({ type: 'ADD_TOAST', payload: { message: msg, type: 'error' } });
            }
        }
    }, [state, dispatch]);

    const handleSaveProject = useCallback(async () => {
        dispatch({ type: 'SET_CONFIG', payload: { isSaving: true } });
        try {
            const cleanScenes = state.scenes.map(s => ({ ...s, isGeneratingImage: false, isGeneratingVideo: false, isGeneratingAudio: false }));
            localStorage.setItem('interactiveNovelProject', JSON.stringify({ ...state, scenes: cleanScenes }));
            dispatch({ type: 'SET_CONFIG', payload: { isSaving: false, isProjectSaved: true } });
            dispatch({ type: 'ADD_TOAST', payload: { message: '¡Proyecto guardado!', type: 'success' } });
        } catch (e) {
            dispatch({ type: 'SET_CONFIG', payload: { isSaving: false } });
        }
    }, [state, dispatch]);

    const handleLoadProject = useCallback(() => {
        const saved = localStorage.getItem('interactiveNovelProject');
        if (saved) {
            dispatch({ type: 'LOAD_PROJECT', payload: JSON.parse(saved) });
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Proyecto cargado.', type: 'success' } });
        }
    }, [dispatch]);

    const handleResetProject = useCallback(() => {
        if (confirm('¿Borrar todo y empezar de nuevo?')) dispatch({ type: 'RESET_PROJECT' });
    }, [dispatch]);

    return { handleAnalyzeText, handleGenerateScenes, handleNarrateScene, handleSaveProject, handleLoadProject, handleResetProject, handleGenerateImageForScene };
};
