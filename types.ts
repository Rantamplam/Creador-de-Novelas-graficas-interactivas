
export interface Character {
  name: string;
  description: string;
  voice?: string;
}

export type NarrationPartType = 'NARRATION' | 'DIALOGUE' | 'INSTRUCTION';

export interface NarrationPart {
  type: NarrationPartType;
  speaker?: string;
  text: string;
}

export interface Scene {
  id: number;
  parts: NarrationPart[];
  imageUrl?: string;
  imagePrompt?: string;
  imageError?: string;
  videoUrl?: string;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  videoGenerationOperation?: any; 
  videoError?: string;
  audioUrl?: string;
  isGeneratingAudio: boolean;
  audioError?: string;
  duration?: number; // Duración en segundos del audio
  backgroundMusicUrl?: string;
  musicVolume?: number;
  speechVolume?: number;
}

export type AppStep = 'input' | 'config' | 'scenes';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ProjectState {
    currentStep: AppStep;
    novelText: string;
    scenes: Scene[];
    characters: Character[];
    statusMessage: string;
    error: string;
    hasApiKey: boolean;
    imageStyle: string;
    artDirection: string;
    aspectRatio: '16:9' | '9:16';
    includeTextInImage: boolean;
    narratorVoice: string;
    isSaving: boolean;
    isProjectSaved: boolean;
    isMovieModalOpen: boolean;
    toasts: Toast[];
}

export type ProjectAction =
    | { type: 'SET_STEP'; payload: AppStep }
    | { type: 'SET_NOVEL_TEXT'; payload: string }
    | { type: 'SET_STATUS_MESSAGE'; payload: string }
    | { type: 'SET_ERROR'; payload: string }
    | { type: 'START_ANALYSIS' }
    | { type: 'ANALYZE_SUCCESS'; payload: Character[] }
    | { type: 'ANALYZE_FAILURE'; payload: string }
    | { type: 'START_SCENE_GENERATION' }
    | { type: 'SCENE_GENERATION_INITIALIZE'; payload: Scene[] }
    | { type: 'SCENE_GENERATION_COMPLETE' }
    | { type: 'SCENE_GENERATION_FAILURE'; payload: string }
    | { type: 'UPDATE_SCENE'; payload: { sceneId: number; updates: Partial<Scene> } }
    | { type: 'UPDATE_SCENES_ORDER'; payload: Scene[] }
    | { type: 'DELETE_SCENE'; payload: number }
    | { type: 'UPDATE_CHARACTER_VOICE'; payload: { characterName: string; newVoice: string } }
    /* Added isSaving and isProjectSaved to SET_CONFIG payload to fix TypeScript errors in ProjectContext.tsx */
    | { type: 'SET_CONFIG'; payload: Partial<Pick<ProjectState, 'imageStyle' | 'artDirection' | 'aspectRatio' | 'includeTextInImage' | 'narratorVoice' | 'isSaving' | 'isProjectSaved'>> }
    | { type: 'UPDATE_SCENE_CONFIG', payload: { sceneId: number, config: Partial<Pick<Scene, 'backgroundMusicUrl' | 'musicVolume' | 'speechVolume'>>}}
    | { type: 'OPEN_MOVIE_MODAL' }
    | { type: 'CLOSE_MOVIE_MODAL' }
    | { type: 'LOAD_PROJECT'; payload: ProjectState }
    | { type: 'RESET_PROJECT' }
    | { type: 'SET_API_KEY_STATUS'; payload: boolean }
    | { type: 'ADD_TOAST'; payload: Omit<Toast, 'id'> }
    | { type: 'REMOVE_TOAST'; payload: number };
