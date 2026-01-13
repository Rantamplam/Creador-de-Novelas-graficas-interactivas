
import React, { useRef, useState, useEffect } from 'react';
import type { Scene } from '../types';
import { useProjectState, useProjectDispatch, useProjectActions } from '../context/ProjectContext';
import Loader from './Loader';
import { FilmIcon, SpeakerWaveIcon, TrashIcon, DragHandleIcon, MusicNoteIcon, PlayIcon, PauseIcon, DownloadIcon, UploadIcon, VolumeUpIcon } from './Icons';
import { generateVideoForScene, checkVideoStatus } from '../services/gemini';

const PREDEFINED_MUSIC = [
    { name: "Sin música ambiental", url: "" }, 
    { name: "Misterio y Tensión", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" }, 
    { name: "Acción Heroica", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" }, 
    { name: "Atmósfera de Ensueño", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { name: "Suspenso Noir", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];

interface SceneCardProps {
    scene: Scene;
    sceneNumber: number;
}

export default function SceneCard({ scene, sceneNumber }: SceneCardProps) {
    const dispatch = useProjectDispatch();
    const { hasApiKey, aspectRatio } = useProjectState();
    const { handleNarrateScene, handleGenerateImageForScene } = useProjectActions();
    
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isPlayingMusic, setIsPlayingMusic] = useState(false);
    const [customMusicName, setCustomMusicName] = useState<string | null>(null);
    
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const musicPlayerRef = useRef<HTMLAudioElement | null>(null);
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const videoUploadRef = useRef<HTMLInputElement>(null);
    const musicUploadRef = useRef<HTMLInputElement>(null);

    // Sincronizar volumen del reproductor con el estado
    useEffect(() => {
        if (musicPlayerRef.current) {
            musicPlayerRef.current.volume = (scene.musicVolume ?? 40) / 100;
        }
    }, [scene.musicVolume]);

    const toggleAudioPreview = () => {
        const player = audioPlayerRef.current;
        if (!player) return;
        if (isPlayingAudio) {
            player.pause();
        } else {
            if (isPlayingMusic && musicPlayerRef.current) musicPlayerRef.current.pause();
            player.play().catch(e => console.error("Error voz:", e));
        }
    };

    const toggleMusicPreview = () => {
        const player = musicPlayerRef.current;
        if (!player || !scene.backgroundMusicUrl) return;
        
        if (isPlayingMusic) {
            player.pause();
        } else {
            if (isPlayingAudio && audioPlayerRef.current) audioPlayerRef.current.pause();
            
            // Asegurar volumen antes de reproducir
            player.volume = (scene.musicVolume ?? 40) / 100;

            const playPromise = player.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Error al reproducir música:", error);
                    let msg = 'Error de conexión con el servidor de audio. Prueba subiendo tu propio archivo.';
                    if (error.name === 'NotAllowedError') msg = 'Haz clic en la página para habilitar el sonido';
                    dispatch({ type: 'ADD_TOAST', payload: { message: msg, type: 'error' } });
                    setIsPlayingMusic(false);
                });
            }
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const volume = parseInt(e.target.value);
        dispatch({ type: 'UPDATE_SCENE_CONFIG', payload: { sceneId: scene.id, config: { musicVolume: volume } } });
    };

    // Fix: Implemented handleImageUpload to process local image files
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target?.result as string;
                dispatch({ type: 'UPDATE_SCENE', payload: { sceneId: scene.id, updates: { imageUrl, imagePrompt: 'Cargada por el usuario' } } });
                dispatch({ type: 'ADD_TOAST', payload: { message: 'Imagen subida correctamente', type: 'success' } });
            };
            reader.readAsDataURL(file);
        }
    };

    // Fix: Implemented handleVideoUpload to process local video files
    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const videoUrl = URL.createObjectURL(file);
            dispatch({ type: 'UPDATE_SCENE', payload: { sceneId: scene.id, updates: { videoUrl } } });
            dispatch({ type: 'ADD_TOAST', payload: { message: 'Video subido correctamente', type: 'success' } });
        }
    };

    const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const musicUrl = URL.createObjectURL(file);
            setCustomMusicName(file.name);
            dispatch({ type: 'UPDATE_SCENE_CONFIG', payload: { sceneId: scene.id, config: { backgroundMusicUrl: musicUrl } } });
            dispatch({ type: 'ADD_TOAST', payload: { message: `"${file.name}" cargada correctamente`, type: 'success' } });
        }
    };

    const handleAnimate = async () => {
        if (typeof (window as any).aistudio !== 'undefined' && !hasApiKey) {
            await (window as any).aistudio.openSelectKey();
            dispatch({ type: 'SET_API_KEY_STATUS', payload: true });
        }
        dispatch({type: 'UPDATE_SCENE', payload: {sceneId: scene.id, updates: { isGeneratingVideo: true, videoError: undefined }}});
        try {
            const operation = await generateVideoForScene(scene.parts, aspectRatio);
            const check = async () => {
                const status = await checkVideoStatus(operation);
                if (status.done) {
                    const url = `${status.response?.generatedVideos?.[0]?.video?.uri}&key=${process.env.API_KEY}`;
                    dispatch({type: 'UPDATE_SCENE', payload: {sceneId: scene.id, updates: { videoUrl: url, isGeneratingVideo: false }}});
                    dispatch({ type: 'ADD_TOAST', payload: { message: `Video listo`, type: 'success' } });
                } else {
                    setTimeout(check, 8000);
                }
            };
            check();
        } catch (err: any) {
            dispatch({type: 'UPDATE_SCENE', payload: {sceneId: scene.id, updates: { isGeneratingVideo: false, videoError: err.message }}});
        }
    };

    return (
        <div className="bg-gray-900/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl hover:border-sky-500/30 transition-all duration-700 group/card">
            <header className="flex items-center justify-between bg-white/[0.02] p-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-sky-500/10 rounded-2xl text-sky-400 group-hover/card:scale-110 transition-transform">
                        <DragHandleIcon className="w-5 h-5 cursor-grab active:cursor-grabbing" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-white tracking-tight">ESCENA {sceneNumber}</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Bloque de Storyboard</p>
                    </div>
                </div>
                <button onClick={() => dispatch({ type: 'DELETE_SCENE', payload: scene.id })} className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </header>

            <div className="flex flex-col xl:flex-row">
                <div className="xl:w-3/5 aspect-video bg-gray-950 relative group/media overflow-hidden border-r border-white/5">
                    {scene.isGeneratingImage ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-950"><Loader message="Sincronizando estilo..." /></div>
                    ) : scene.imageUrl ? (
                        scene.videoUrl ? (
                            <div className="relative w-full h-full">
                                <video src={scene.videoUrl} controls className="w-full h-full object-cover" />
                                <div className="absolute top-6 left-6 flex gap-2">
                                    <div className="px-4 py-1.5 bg-purple-600/90 backdrop-blur-xl rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-2xl animate-pulse">Cinemática Lista</div>
                                    <button onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = scene.videoUrl!;
                                        link.download = `nova-video-${sceneNumber}.mp4`;
                                        link.click();
                                    }} className="p-2 bg-black/60 hover:bg-sky-500 rounded-full text-white transition-all shadow-xl">
                                        <DownloadIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative w-full h-full group/img">
                                <img src={scene.imageUrl} alt="" className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-[2s]" />
                                <div className="absolute top-6 left-6 flex gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity duration-500">
                                    <button onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = scene.imageUrl!;
                                        link.download = `nova-img-${sceneNumber}.png`;
                                        link.click();
                                    }} className="p-2 bg-black/60 hover:bg-sky-500 rounded-full text-white transition-all shadow-xl">
                                        <DownloadIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => imageUploadRef.current?.click()} className="p-2 bg-black/60 hover:bg-sky-500 rounded-full text-white transition-all shadow-xl">
                                        <UploadIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleGenerateImageForScene(scene.id)} className="p-2 bg-sky-600 hover:bg-sky-500 rounded-full text-white transition-all shadow-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-gray-700 bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]">
                             <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-gray-800 flex items-center justify-center">
                                <UploadIcon className="w-6 h-6 opacity-20" />
                             </div>
                             <div className="flex flex-col gap-2">
                                <button onClick={() => handleGenerateImageForScene(scene.id)} className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-2xl text-xs font-bold text-white transition-all">Generar con Estilo Global</button>
                                <button onClick={() => imageUploadRef.current?.click()} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-gray-400 border border-white/5 transition-all">Subir Arte Propio</button>
                             </div>
                        </div>
                    )}
                    <input ref={imageUploadRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <input ref={videoUploadRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                </div>

                <div className="xl:w-2/5 p-10 flex flex-col justify-between space-y-8 bg-gradient-to-br from-white/[0.01] to-transparent">
                    <div className="space-y-6">
                        <div className="max-h-40 overflow-y-auto pr-4 custom-scrollbar space-y-3">
                            {scene.parts.map((p, i) => (
                                <div key={i} className={`p-3 rounded-2xl border transition-colors ${p.type === 'DIALOGUE' ? 'bg-sky-500/5 border-sky-500/20' : 'bg-white/5 border-transparent'}`}>
                                    {p.speaker && <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest mb-1">{p.speaker}</p>}
                                    <p className={`text-sm leading-relaxed ${p.type === 'DIALOGUE' ? 'text-white font-medium italic' : 'text-gray-400'}`}>
                                        {p.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {!scene.audioUrl ? (
                                <button 
                                    onClick={() => handleNarrateScene(scene.id)} 
                                    disabled={scene.isGeneratingAudio}
                                    className="flex flex-col items-center justify-center gap-2 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-600/10 transition-all disabled:opacity-50 group/btn"
                                >
                                    {scene.isGeneratingAudio ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <SpeakerWaveIcon className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />}
                                    Generar Voz
                                </button>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={toggleAudioPreview}
                                        className={`flex flex-col items-center justify-center gap-2 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${isPlayingAudio ? 'bg-amber-500 text-white shadow-amber-500/20 shadow-xl' : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'}`}
                                    >
                                        {isPlayingAudio ? <PauseIcon className="w-6 h-6 animate-pulse" /> : <PlayIcon className="w-6 h-6" />}
                                        {isPlayingAudio ? 'Reproduciendo' : 'Oír Narración'}
                                        <audio 
                                            ref={audioPlayerRef} 
                                            src={scene.audioUrl} 
                                            crossOrigin="anonymous"
                                            onEnded={() => setIsPlayingAudio(false)}
                                            onPause={() => setIsPlayingAudio(false)}
                                            onPlay={() => setIsPlayingAudio(true)}
                                            className="hidden" 
                                        />
                                    </button>
                                    <button onClick={() => dispatch({ type: 'UPDATE_SCENE', payload: { sceneId: scene.id, updates: { audioUrl: undefined } } })} className="text-[9px] text-gray-600 hover:text-sky-400 uppercase tracking-[0.2em] font-black transition-colors text-center">Remplazar Voz</button>
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={handleAnimate}
                                    disabled={scene.isGeneratingVideo || !scene.imageUrl || !!scene.videoUrl}
                                    className={`flex flex-col items-center justify-center gap-2 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${scene.videoUrl ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-600/10 disabled:opacity-20'}`}
                                >
                                    {scene.isGeneratingVideo ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <FilmIcon className="w-6 h-6" />}
                                    {scene.videoUrl ? 'Cinemática OK' : 'Animar con IA'}
                                </button>
                                {!scene.videoUrl && scene.imageUrl && (
                                    <button onClick={() => videoUploadRef.current?.click()} className="text-[9px] text-gray-600 hover:text-purple-400 uppercase tracking-[0.2em] font-black transition-colors text-center">Subir Video</button>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-gray-400">
                                    <MusicNoteIcon className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Música Ambiental</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {scene.backgroundMusicUrl && (
                                        <button 
                                            onClick={toggleMusicPreview}
                                            className={`p-2 rounded-xl transition-all ${isPlayingMusic ? 'bg-sky-500 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                        >
                                            {isPlayingMusic ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => musicUploadRef.current?.click()} 
                                        className="p-2 bg-white/5 text-gray-400 hover:bg-sky-500/20 hover:text-sky-400 rounded-xl transition-all"
                                        title="Subir MP3/WAV propio"
                                    >
                                        <UploadIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <select 
                                value={PREDEFINED_MUSIC.some(m => m.url === scene.backgroundMusicUrl) ? scene.backgroundMusicUrl : (customMusicName ? "custom" : "")} 
                                onChange={e => {
                                    if (e.target.value === "custom") return;
                                    setCustomMusicName(null);
                                    dispatch({ type: 'UPDATE_SCENE_CONFIG', payload: { sceneId: scene.id, config: { backgroundMusicUrl: e.target.value } } });
                                }}
                                className="bg-gray-900 border border-white/5 text-xs text-gray-400 focus:text-white outline-none w-full p-2.5 rounded-xl cursor-pointer font-medium"
                            >
                                {PREDEFINED_MUSIC.map(m => <option key={m.name} value={m.url}>{m.name}</option>)}
                                {customMusicName && <option value="custom">Personalizada: {customMusicName}</option>}
                            </select>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                    <span>Volumen Música</span>
                                    <span>{scene.musicVolume ?? 40}%</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <VolumeUpIcon className="w-4 h-4 text-gray-600" />
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={scene.musicVolume ?? 40} 
                                        onChange={handleVolumeChange}
                                        className="flex-grow h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                </div>
                            </div>

                            <input ref={musicUploadRef} type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} />
                            <audio 
                                ref={musicPlayerRef} 
                                src={scene.backgroundMusicUrl} 
                                crossOrigin="anonymous"
                                preload="auto"
                                onEnded={() => setIsPlayingMusic(false)}
                                onPause={() => setIsPlayingMusic(false)}
                                onPlay={() => setIsPlayingMusic(true)}
                                loop
                                className="hidden"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
