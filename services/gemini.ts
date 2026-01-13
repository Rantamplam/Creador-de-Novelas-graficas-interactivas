
import { GoogleGenAI, Type, Modality } from '@google/genai';
import type { Scene, Character, NarrationPart } from '../types';

const getAiClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Helpers for Audio Generation ---

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


// --- API Functions ---

export const parseStoryboardIntoScenes = async (novelText: string): Promise<Pick<Scene, 'parts'>[]> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';

    const prompt = `
    Eres un guionista y director de cine experto. Tu tarea es transformar el siguiente texto de una novela en un guion gráfico (storyboard) estructurado.
    
    Analiza el texto y divídelo en escenas visuales lógicas. 
    Para cada escena, genera un array de "parts" con:
    - "NARRATION": Texto descriptivo cinematográfico.
    - "DIALOGUE": Diálogos literales de personajes.
    - "INSTRUCTION": Instrucciones de cámara (Ej: "Gran plano general"), iluminación o ambiente.

    Proporciona ÚNICAMENTE el JSON.

    Texto:
    ${novelText}
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
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
    } catch (error) {
        console.error('Error parsing storyboard:', error);
        throw new Error('No se pudo estructurar el guion.');
    }
};

export const identifyCharacters = async (novelText: string): Promise<Character[]> => {
    const ai = getAiClient();
    const model = 'gemini-3-flash-preview';

    const prompt = `Identifica a los personajes principales (máx 5) del texto. Crea una descripción visual MUY detallada de cada uno para IA (cabello, ojos, ropa, edad).
    Devuelve un array JSON con "name" y "description".
    Texto: ${novelText}`;

    try {
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
                        },
                        required: ['name', 'description'],
                    },
                },
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        return [];
    }
};

export const generateImageForScene = async (parts: NarrationPart[], style: string, characters: Character[], artDirection: string, includeTextInImage: boolean): Promise<{ imageUrl: string, imagePrompt: string }> => {
    const ai = getAiClient();
    const textModel = 'gemini-3-flash-preview';
    const imageModel = 'gemini-2.5-flash-image';

    const charRef = characters.map(c => `${c.name}: ${c.description}`).join('\n');
    const sceneContent = parts.map(p => p.text).join(' ');

    const promptGenPrompt = `
    TASK: Act as an Art Director for a consistent visual series. 
    You must create a highly detailed image generation prompt for a specific scene while maintaining a strictly UNIFORM STYLE across all frames.

    GLOBAL PROJECT STYLE: "${style.toUpperCase()}"
    ARTISTIC DIRECTION & PALETTE: "${artDirection}"

    MANDATORY STYLE ANCHORS:
    1. Every prompt MUST start with the phrase: "A high-quality masterpiece in ${style} style, part of a consistent narrative series, with ${artDirection} lighting and colors."
    2. Characters MUST be identical to these descriptions:
    ${charRef}
    3. Ensure the lighting, texture, and overall artistic vibe matches the GLOBAL PROJECT STYLE exactly.

    SCENE DESCRIPTION:
    ${sceneContent}

    TECHNICAL CONSTRAINTS:
    - Language: English.
    - Details: Professional cinematic composition, 8k, detailed textures.
    - Atmosphere: Consistent with "${artDirection}".
    ${includeTextInImage ? '- Note: Reserve space for Spanish subtitles if dialogue is present.' : '- NO TEXT, NO LOGOS, NO WATERMARKS.'}
    - ONLY return the generated prompt string.
    `;
    
    const promptResponse = await ai.models.generateContent({ model: textModel, contents: promptGenPrompt });
    const imagePrompt = promptResponse.text;

    const imageResponse = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [{ text: imagePrompt }] },
    });

    const candidate = imageResponse.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(p => p.inlineData);

    if (imagePart?.inlineData) {
        return {
            imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
            imagePrompt: imagePrompt
        };
    }
    throw new Error('La generación de imagen falló.');
};

export const generateVideoForScene = async (parts: NarrationPart[], aspectRatio: '16:9' | '9:16'): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'veo-3.1-fast-generate-preview';
    const action = parts.filter(p => p.type !== 'INSTRUCTION').map(p => p.text).join(' ').substring(0, 500);

    return await ai.models.generateVideos({
        model,
        prompt: `Cinematic high-quality animation: ${action}. Maintain strictly consistent character design and lighting. Fluid professional motion, filmic look.`,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
    });
};

export const checkVideoStatus = async (operation: any): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.operations.getVideosOperation({ operation });
};

export const generateAudioForScene = async (parts: NarrationPart[], allCharacters: Character[], narratorVoice: string): Promise<string> => {
    const ai = getAiClient();
    const model = 'gemini-2.5-flash-preview-tts';
    
    const speakableParts = parts.filter(p => p.type !== 'INSTRUCTION' && p.text.trim());
    const pcmChunks: Uint8Array[] = [];
    let totalLength = 0;

    for (const part of speakableParts) {
        const char = allCharacters.find(c => c.name === part.speaker);
        const voiceName = (part.type === 'DIALOGUE' && char?.voice) ? char.voice : narratorVoice;

        try {
            const response = await ai.models.generateContent({
                model,
                contents: [{ parts: [{ text: part.text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                    },
                },
            });

            const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (data) {
                const pcm = decode(data);
                pcmChunks.push(pcm);
                totalLength += pcm.length;
            }
        } catch (e) {
            console.error("TTS Error:", e);
        }
    }

    if (pcmChunks.length === 0) throw new Error("No se pudo generar el audio.");

    const concatenated = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pcmChunks) {
        concatenated.set(chunk, offset);
        offset += chunk.length;
    }

    return URL.createObjectURL(createWavBlob(concatenated, 24000, 1, 16));
};
