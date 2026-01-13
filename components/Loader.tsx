import React from 'react';

export default function Loader({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-sky-400"></div>
            <p className="text-sky-200 text-lg font-medium">{message}</p>
        </div>
    );
}
