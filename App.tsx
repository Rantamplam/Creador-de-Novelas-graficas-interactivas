
import React from 'react';
import { ProjectProvider, useProjectState, useProjectDispatch, useProjectActions } from './context/ProjectContext';
import InputStep from './components/InputStep';
import ConfigStep from './components/ConfigStep';
import ScenesDashboard from './components/ScenesDashboard';
import Loader from './components/Loader';
import MovieModal from './components/MovieModal';
import ToastContainer from './components/Toast';
import { SaveIcon, FolderOpenIcon, TrashIcon, DownloadIcon } from './components/Icons';

const GlobalHeader: React.FC = () => {
    const { isSaving, isProjectSaved, currentStep } = useProjectState();
    const { handleSaveProject, handleLoadProject, handleResetProject } = useProjectActions();
    const dispatch = useProjectDispatch();

    const handleExport = () => {
        const data = localStorage.getItem('interactiveNovelProject');
        if (!data) return;
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proyecto-novela-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        dispatch({ type: 'ADD_TOAST', payload: { message: 'Proyecto exportado como JSON', type: 'success' } });
    };

    return (
        <header className="sticky top-0 z-40 bg-gray-900/60 backdrop-blur-xl border-b border-white/10 p-4 shadow-2xl">
            <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                        <span className="text-white font-black text-xl">N</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight leading-none">NovaStory AI</h1>
                        <p className="text-[10px] text-sky-400 uppercase tracking-widest font-bold mt-1">Generador de Cine con IA</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {currentStep !== 'input' && (
                        <button 
                            onClick={() => dispatch({ type: 'SET_STEP', payload: 'input' })}
                            className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                        >
                            Volver al Inicio
                        </button>
                    )}
                    
                    <button 
                        onClick={handleSaveProject} 
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${isSaving ? 'bg-gray-700 text-gray-400' : 'bg-sky-600 hover:bg-sky-500 text-white hover:scale-105 active:scale-95 shadow-sky-500/20'}`}
                    >
                        <SaveIcon className="w-4 h-4" />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>

                    <button 
                        onClick={handleExport}
                        disabled={!isProjectSaved}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition-all disabled:opacity-30"
                        title="Descargar archivo del proyecto"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Exportar
                    </button>

                    <button 
                        onClick={handleResetProject}
                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                        title="Empezar de nuevo"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
};

const AppContent: React.FC = () => {
    const { currentStep, statusMessage } = useProjectState();

    const renderStep = () => {
        if (statusMessage) {
            return (
                <div className="flex flex-col justify-center items-center h-[60vh] space-y-8">
                    <Loader message={statusMessage} />
                </div>
            );
        }
        switch (currentStep) {
            case 'input': return <InputStep />;
            case 'config': return <ConfigStep />;
            case 'scenes': return <ScenesDashboard />;
            default: return <InputStep />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-sky-500/30">
            <GlobalHeader />
            
            <main className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-160px)]">
                {renderStep()}
            </main>
            
            <footer className="text-center p-8 border-t border-white/5 mt-12">
                <p className="text-xs text-gray-500 max-w-xl mx-auto leading-relaxed">
                    NovaStory utiliza los modelos más avanzados de Google Gemini para transformar texto en experiencias visuales. 
                    Las imágenes y videos generados son propiedad del usuario.
                    <br />
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline font-medium">Información sobre Facturación API</a>
                </p>
            </footer>
            
            <MovieModal />
            <ToastContainer />
        </div>
    );
}

export default function App() {
    return (
        <ProjectProvider>
            <AppContent />
        </ProjectProvider>
    );
}
