
import React, { createContext, useReducer, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';
import type { ProjectState, ProjectAction, Scene, Character, Toast } from '../types';
import { 
    parseStoryboardIntoScenes, 
    identifyCharacters,
    generateImageForScene,
    generateVideoForScene,
    checkVideoStatus,
    generateAudioForScene
} from '../services/gemini';

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
    narratorVoice: 'Zephyr',
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

    useEffect(() => {
      const saved = localStorage.getItem('interactiveNovelProject');
      if (saved) dispatch({ type: 'SET_CONFIG', payload: { isProjectSaved: true }});
    }, []);

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
            const charsWithVoices = chars.map((char, i) => ({
                ...char,
                voice: AVAILABLE_VOICES[i % AVAILABLE_VOICES.length].name
            }));
            dispatch({ type: 'ANALYZE_SUCCESS', payload: charsWithVoices });
        } catch (err: any) {
            dispatch({ type: 'ANALYZE_FAILURE', payload: err.message });
        }
    }, [state.novelText, dispatch]);

    const handleGenerateImageForScene = useCallback(async (sceneId: number) => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene) return;

        dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingImage: true, imageError: undefined } } });
        try {
            const { imageUrl, imagePrompt } = await generateImageForScene(
                scene.parts, 
                state.imageStyle, 
                state.characters, 
                state.artDirection, 
                state.includeTextInImage
            );
            dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { imageUrl, imagePrompt, isGeneratingImage: false } } });
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Imagen sincronizada con estilo global', type: 'success' } });
        } catch (err: any) {
            dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingImage: false, imageError: err.message } } });
        }
    }, [state, dispatch]);

    const handleGenerateScenes = useCallback(async () => {
        dispatch({ type: 'START_SCENE_GENERATION' });
        try {
            const scenesData = await parseStoryboardIntoScenes(state.novelText);
            const initScenes: Scene[] = scenesData.map((s, i) => ({
                id: Date.now() + i,
                parts: s.parts,
                isGeneratingImage: true,
                isGeneratingVideo: false,
                isGeneratingAudio: false,
            }));
            dispatch({ type: 'SCENE_GENERATION_INITIALIZE', payload: initScenes });

            // Generar secuencialmente para asegurar carga controlada
            for (const scene of initScenes) {
                try {
                    const { imageUrl, imagePrompt } = await generateImageForScene(
                        scene.parts, 
                        state.imageStyle, 
                        state.characters, 
                        state.artDirection, 
                        state.includeTextInImage
                    );
                    dispatch({ type: 'UPDATE_SCENE', payload: { sceneId: scene.id, updates: { imageUrl, imagePrompt, isGeneratingImage: false } } });
                } catch {
                    dispatch({ type: 'UPDATE_SCENE', payload: { sceneId: scene.id, updates: { isGeneratingImage: false, imageError: 'Error de generación' } } });
                }
            }
            dispatch({ type: 'SCENE_GENERATION_COMPLETE' });
        } catch (err: any) {
            dispatch({ type: 'SCENE_GENERATION_FAILURE', payload: err.message });
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
        } catch (err: any) {
            dispatch({ type: 'UPDATE_SCENE', payload: { sceneId, updates: { isGeneratingAudio: false, audioError: err.message } } });
        }
    }, [state, dispatch]);

    const handleSaveProject = useCallback(async () => {
        dispatch({ type: 'SET_CONFIG', payload: { isSaving: true } });
        try {
            const cleanScenes = state.scenes.map(s => ({
                ...s,
                isGeneratingImage: false, isGeneratingVideo: false, isGeneratingAudio: false,
            }));
            const stateToSave = { ...state, scenes: cleanScenes, isSaving: false, statusMessage: '', error: '' };
            localStorage.setItem('interactiveNovelProject', JSON.stringify(stateToSave));
            dispatch({ type: 'SET_CONFIG', payload: { isSaving: false, isProjectSaved: true } });
            dispatch({ type: 'ADD_TOAST', payload: { message: '¡Proyecto guardado!', type: 'success' } });
        } catch (e) {
            dispatch({ type: 'SET_CONFIG', payload: { isSaving: false } });
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Error de espacio en almacenamiento.', type: 'error' } });
        }
    }, [state, dispatch]);

    const handleLoadProject = useCallback(() => {
        const saved = localStorage.getItem('interactiveNovelProject');
        if (saved) {
            dispatch({ type: 'LOAD_PROJECT', payload: JSON.parse(saved) });
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Proyecto cargado correctamente.', type: 'success' } });
        }
    }, [dispatch]);

    const handleResetProject = useCallback(() => {
        if (confirm('¿Seguro que quieres borrar todo y empezar de nuevo?')) {
            dispatch({ type: 'RESET_PROJECT' });
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Proyecto reseteado.', type: 'info' } });
        }
    }, [dispatch]);

    return {
        handleAnalyzeText,
        handleGenerateScenes,
        handleNarrateScene,
        handleSaveProject,
        handleLoadProject,
        handleResetProject,
        handleGenerateImageForScene
    };
};
