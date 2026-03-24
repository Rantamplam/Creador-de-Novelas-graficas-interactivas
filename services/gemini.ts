
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import type { Scene, Character, NarrationPart } from '../types';

const getAiClient = () => {
    // En AI Studio Build, la API Key se inyecta en process.env.API_KEY
    const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
    
    if (!key || key === 'PLACEHOLDER_API_KEY' || key === 'undefined' || key === '') {
        throw new Error("API_KEY_MISSING");
    }
    return new GoogleGenAI({ apiKey: key });
};

// --- Helpers ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const createWavBlob = (pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob => {
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const pcmAsUint8 = new Uint8Array(pcmData);
    for (let i = 0; i < dataSize; i++) {
        view.setUint8(44 + i, pcmAsUint8[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
};

/**
 * Función envolvente para manejar reintentos y errores específicos de API Key
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            
            // Error de cuota
            const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
            if (isQuotaError && i < maxRetries - 1) {
                const waitTime = Math.pow(2, i) * 2000;
                console.warn(`Cuota agotada. Reintentando en ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }

            // Error de API Key inválida o no encontrada (común en Veo si no se selecciona correctamente)
            if (error.message?.includes('Requested entity was not found') || error.message?.includes('API_KEY_INVALID')) {
                console.error("API Key no válida o no encontrada. Solicitando nueva selección...");
                throw new Error("API_KEY_INVALID");
            }

            throw error;
        }
    }
    throw lastError;
}


// --- API Functions ---

export const parseStoryboardIntoScenes = async (novelText: string): Promise<Pick<Scene, 'parts'>[]> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';

    const prompt = `
    Eres un guionista y director de cine experto. Tu tarea es transformar el siguiente texto de una novela en un guion gráfico (storyboard) estructurado.
    Analiza el texto y divídelo en escenas visuales lógicas. 
    REGLA CRÍTICA: En el campo "speaker", usa el nombre exacto del personaje que habla.
    Proporciona ÚNICAMENTE el JSON.
    Texto: ${novelText}
    `;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                           parts: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        type: { type: Type.STRING, enum: ['NARRATION', 'DIALOGUE', 'INSTRUCTION'] },
                                        speaker: { type: Type.STRING },
                                        text: { type: Type.STRING },
                                    },
                                    required: ['type', 'text']
                                }
                           }
                        },
                        required: ['parts'],
                    },
                },
            },
        });
        return JSON.parse(response.text);
    });
};

export const identifyCharacters = async (novelText: string): Promise<Character[]> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';

    const prompt = `Identifica a los personajes principales (máx 5) del texto. Crea una descripción visual MUY detallada de cada uno.
    REGLA DE GÉNERO: "Lia" -> FEMININE. "Gato" -> MASCULINE. Analiza el contexto.
    Devuelve un array JSON con "name", "description" y "gender" (MASCULINE, FEMININE o NEUTRAL).
    Texto: ${novelText}`;

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            description: { type: Type.STRING },
                            gender: { type: Type.STRING, enum: ['MASCULINE', 'FEMININE', 'NEUTRAL'] }
                        },
                        required: ['name', 'description', 'gender'],
                    },
                },
            },
        });
        return JSON.parse(response.text);
    });
};

export const generateImageForScene = async (parts: NarrationPart[], style: string, characters: Character[], artDirection: string, includeTextInImage: boolean): Promise<{ imageUrl: string, imagePrompt: string }> => {
    const ai = getAiClient();
    const textModel = 'gemini-3-flash-preview';
    const imageModel = 'gemini-2.5-flash-image';

    const charRef = characters.map(c => `CHARACTER BIBLE FOR ${c.name}: ${c.description}`).join('\n');
    const sceneContent = parts.map(p => p.text).join(' ');

    const promptGenPrompt = `GENERATE A TECHNICAL CONCEPT ART PROMPT. Scene: "${sceneContent}". Style: ${style}. Art Direction: ${artDirection}. Characters: ${charRef}. Return ONLY the prompt.`;
    
    // Fix: Especificar explícitamente el tipo genérico GenerateContentResponse para conRetry para evitar que promptResponse se infiera como 'unknown'
    const promptResponse = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model: textModel, contents: promptGenPrompt }));
    const imagePrompt = promptResponse.text || "Cinematic landscape";

    return withRetry(async () => {
        const imageResponse = await ai.models.generateContent({
            model: imageModel,
            contents: { parts: [{ text: imagePrompt }] },
            config: { imageConfig: { aspectRatio: "16:9" } }
        });

        const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData) {
            return {
                imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
                imagePrompt: imagePrompt
            };
        }
        throw new Error('Sin datos de imagen.');
    });
};

export const generateVideoForScene = async (parts: NarrationPart[], aspectRatio: '16:9' | '9:16'): Promise<any> => {
    const ai = getAiClient();
    const model = 'veo-3.1-fast-generate-preview';
    const action = parts.filter(p => p.type !== 'INSTRUCTION').map(p => p.text).join(' ').substring(0, 500);

    return await ai.models.generateVideos({
        model,
        prompt: `Cinematic footage: ${action}`,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
    });
};

export const checkVideoStatus = async (operation: any): Promise<any> => {
    const ai = getAiClient();
    return await ai.operations.getVideosOperation({ operation });
};

export const generateAudioForScene = async (parts: NarrationPart[], allCharacters: Character[], narratorVoice: string): Promise<string> => {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash-preview-tts';
    
    const speakableParts = parts.filter(p => p.type !== 'INSTRUCTION' && p.text.trim());
    
    // OPTIMIZACIÓN: Agrupamos partes por voz para minimizar llamadas a la API
    const groupedGroups: { text: string, voice: string }[] = [];
    for (const part of speakableParts) {
        const speakerName = part.speaker?.trim().toLowerCase();
        const char = allCharacters.find(c => c.name.trim().toLowerCase() === speakerName);
        const voiceName = (part.type === 'DIALOGUE' && char?.voice) ? char.voice : narratorVoice;
        
        if (groupedGroups.length > 0 && groupedGroups[groupedGroups.length - 1].voice === voiceName) {
            groupedGroups[groupedGroups.length - 1].text += ". " + part.text;
        } else {
            groupedGroups.push({ text: part.text, voice: voiceName });
        }
    }

    const pcmChunks: Uint8Array[] = [];
    let totalLength = 0;

    for (const group of groupedGroups) {
        try {
            // Fix: Especificar el tipo genérico para conRetry
            const response = await withRetry<GenerateContentResponse>(async () => {
                // Añadimos un pequeño delay extra entre llamadas para ser amigables con la cuota
                await sleep(500);
                return await ai.models.generateContent({
                    model,
                    contents: [{ parts: [{ text: `Lee el siguiente texto con un acento de España (Castellano), de forma natural y expresiva: ${group.text}` }] }],
                    config: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: group.voice } },
                        },
                    },
                });
            });

            const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (data) {
                const pcm = decode(data);
                pcmChunks.push(pcm);
                totalLength += pcm.length;
            }
        } catch (e: any) {
            console.error(`Error TTS (${group.voice}):`, e.message);
        }
    }

    if (pcmChunks.length === 0) throw new Error("No se pudo generar audio.");

    const concatenated = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pcmChunks) {
        concatenated.set(chunk, offset);
        offset += chunk.length;
    }

    return URL.createObjectURL(createWavBlob(concatenated, 24000, 1, 16));
};
