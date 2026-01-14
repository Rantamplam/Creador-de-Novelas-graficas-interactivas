
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectState, useProjectDispatch } from '../context/ProjectContext';

const DEFAULT_SCENE_DURATION = 6;

export default function MovieModal() {
    const { scenes, isMovieModalOpen } = useProjectState();
    const dispatch = useProjectDispatch();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    
    const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
    const musicAudioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const currentScene = scenes[currentIndex];

    const goToNextScene = useCallback(() => {
        if (currentIndex < scenes.length - 1) {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setIsTransitioning(false);
            }, 600);
        } else {
            handleClose();
        }
    }, [currentIndex, scenes.length]);

    const handleClose = () => {
        if (narrationAudioRef.current) narrationAudioRef.current.pause();
        if (musicAudioRef.current) musicAudioRef.current.pause();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        dispatch({ type: 'CLOSE_MOVIE_MODAL' });
        setCurrentIndex(0);
    };

    useEffect(() => {
        if (isMovieModalOpen && !isTransitioning && currentScene) {
            const nar = narrationAudioRef.current;
            const mus = musicAudioRef.current;
            const vid = videoRef.current;

            if (mus) {
                if (currentScene.backgroundMusicUrl && currentScene.backgroundMusicUrl.trim() !== "") {
                    if (mus.src !== currentScene.backgroundMusicUrl) {
                        mus.src = currentScene.backgroundMusicUrl;
                        mus.load();
                    }
                    // Aplicar el volumen específico de la mezcla de música para esta escena
                    mus.volume = (currentScene.musicVolume ?? 40) / 100;
                    mus.play().catch(e => console.error("Error música película:", e));
                } else {
                    mus.pause();
                    mus.src = "";
                }
            }

            if (nar && currentScene.audioUrl) {
                nar.src = currentScene.audioUrl;
                // Aplicar el volumen específico de la voz para esta escena
                nar.volume = (currentScene.speechVolume ?? 100) / 100;
                nar.onended = () => {
                    if (!vid) goToNextScene();
                };
                nar.play().catch(e => console.error("Error voz película:", e));
            }

            if (vid) {
                vid.onended = goToNextScene;
                vid.play().catch(e => console.error("Error video película:", e));
            } else if (!currentScene.audioUrl) {
                timeoutRef.current = window.setTimeout(goToNextScene, DEFAULT_SCENE_DURATION * 1000);
            }
        }
    }, [isMovieModalOpen, currentIndex, currentScene, isTransitioning, goToNextScene]);

    if (!isMovieModalOpen || !currentScene) return null;
    
    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4 md:p-12 overflow-hidden">
            <div className={`relative w-full max-w-6xl aspect-video rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] transition-all duration-700 transform ${isTransitioning ? 'scale-95 opacity-0 rotate-1' : 'scale-100 opacity-100 rotate-0'}`}>
                {currentScene.videoUrl ? (
                    <video ref={videoRef} src={currentScene.videoUrl} className="w-full h-full object-cover" />
                ) : (
                    <img src={currentScene.imageUrl} className="w-full h-full object-cover" />
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-12 pt-24 pointer-events-none">
                    <div className="max-w-3xl mx-auto text-center space-y-4">
                        {currentScene.parts.filter(p => p.type !== 'INSTRUCTION').map((p, i) => (
                            <p key={i} className={`text-lg md:text-2xl font-medium tracking-tight drop-shadow-lg ${p.type === 'DIALOGUE' ? 'text-sky-300 italic' : 'text-white'}`}>
                                {p.speaker && <span className="font-black uppercase text-xs tracking-widest block mb-1 opacity-70">{p.speaker}</span>}
                                "{p.text}"
                            </p>
                        ))}
                    </div>
                </div>

                <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
                    <div 
                        className="h-full bg-sky-500 transition-all duration-500" 
                        style={{ width: `${((currentIndex + 1) / scenes.length) * 100}%` }}
                    />
                </div>
            </div>

            <button onClick={handleClose} className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <audio ref={narrationAudioRef} crossOrigin="anonymous" />
            <audio ref={musicAudioRef} crossOrigin="anonymous" preload="auto" loop />
        </div>
    );
};
