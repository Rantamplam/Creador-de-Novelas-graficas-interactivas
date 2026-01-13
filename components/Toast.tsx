import React, { useEffect } from 'react';
import { useProjectState, useProjectDispatch } from '../context/ProjectContext';
import type { Toast } from '../types';

const ToastMessage: React.FC<{ toast: Toast, onRemove: (id: number) => void }> = ({ toast, onRemove }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, 5000);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    const baseClasses = 'w-full max-w-sm p-4 rounded-xl shadow-lg flex items-center gap-3 transition-all duration-300';
    const typeClasses = {
        success: 'bg-green-500/80 backdrop-blur-md border border-green-400/50 text-white',
        error: 'bg-red-500/80 backdrop-blur-md border border-red-400/50 text-white',
        info: 'bg-sky-500/80 backdrop-blur-md border border-sky-400/50 text-white',
    };

    return (
        <div className={`${baseClasses} ${typeClasses[toast.type]}`}>
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => onRemove(toast.id)} className="ml-auto text-white/70 hover:text-white">&times;</button>
        </div>
    );
};

export default function ToastContainer() {
    const { toasts } = useProjectState();
    const dispatch = useProjectDispatch();

    const handleRemove = (id: number) => {
        dispatch({ type: 'REMOVE_TOAST', payload: id });
    };

    return (
        <div className="fixed top-5 right-5 z-[100] space-y-3">
            {toasts.map(toast => (
                <ToastMessage key={toast.id} toast={toast} onRemove={handleRemove} />
            ))}
        </div>
    );
}
