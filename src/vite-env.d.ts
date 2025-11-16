/// <reference types="vite/client" />

declare interface Window {
  electronAPI?: {
    getAppPath: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    showSaveDialog: (options: unknown) => Promise<{ canceled: boolean; filePath?: string }>;
    showOpenDialog: (options: unknown) => Promise<{ canceled: boolean; filePaths?: string[] }>;
    onNewProject: (callback: () => void) => void;
    onOpenProject: (callback: (event: unknown, path: string) => void) => void;
    onSaveProject: (callback: () => void) => void;
    onExport: (callback: () => void) => void;
    onUndo: (callback: () => void) => void;
    onRedo: (callback: () => void) => void;
    onSettings: (callback: () => void) => void;
    platform: string;
  };
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}
