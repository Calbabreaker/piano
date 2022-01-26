/// <reference types="svelte" />

interface Window {
    webkitAudioContext: typeof AudioContext;
}

interface ImportMetaEnv {
    readonly VITE_BACKEND_HOST?: string;
    readonly VITE_BACKEND_PATH?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
