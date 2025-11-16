import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserPreferences, Notification, OnboardingStep } from '@/types';

interface UIState {
  preferences: UserPreferences;
  notifications: Notification[];
  sidebarOpen: boolean;
  currentPanel: 'media' | 'effects' | 'captions' | 'templates' | 'export';
  showOnboarding: boolean;
  onboardingStep: number;
  showNewProjectDialog: boolean;
  showExportDialog: boolean;
  showSettingsDialog: boolean;
  showShortifyDialog: boolean;
  isProcessing: boolean;
  processingMessage: string;
  processingProgress: number;
}

interface UIActions {
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  toggleTheme: () => void;
  setEditorMode: (mode: 'beginner' | 'advanced') => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentPanel: (panel: UIState['currentPanel']) => void;
  setShowOnboarding: (show: boolean) => void;
  nextOnboardingStep: () => void;
  previousOnboardingStep: () => void;
  completeOnboarding: () => void;
  setShowNewProjectDialog: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;
  setShowShortifyDialog: (show: boolean) => void;
  setProcessing: (isProcessing: boolean, message?: string) => void;
  setProcessingProgress: (progress: number) => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  editorMode: 'beginner',
  language: 'en',
  autoPlay: true,
  showTooltips: true,
  keyboardShortcuts: {
    play: 'Space',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Shift+Z',
    save: 'Ctrl+S',
    export: 'Ctrl+E',
    split: 'S',
    delete: 'Delete',
    zoomIn: 'Ctrl+=',
    zoomOut: 'Ctrl+-',
  },
  recentProjects: [],
  cloudEnabled: false,
  privacyMode: true,
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ClipFlow Studio!',
    description: 'Let\'s create your first video in just a few steps. This editor is designed for creators like you.',
    target: 'body',
    position: 'bottom',
  },
  {
    id: 'import',
    title: 'Import Your Media',
    description: 'Drag and drop videos, images, or audio files here. Or click to browse.',
    target: '[data-onboarding="import"]',
    position: 'right',
  },
  {
    id: 'timeline',
    title: 'Your Timeline',
    description: 'This is where your video comes together. Drag clips here to arrange them.',
    target: '[data-onboarding="timeline"]',
    position: 'top',
  },
  {
    id: 'preview',
    title: 'Preview Your Work',
    description: 'Watch your video here in real-time as you edit.',
    target: '[data-onboarding="preview"]',
    position: 'left',
  },
  {
    id: 'tools',
    title: 'Editing Tools',
    description: 'Use these tools to trim, add captions, effects, and more.',
    target: '[data-onboarding="tools"]',
    position: 'bottom',
  },
  {
    id: 'shortify',
    title: 'One-Click Shortify',
    description: 'Turn long videos into engaging shorts automatically with AI.',
    target: '[data-onboarding="shortify"]',
    position: 'bottom',
  },
  {
    id: 'export',
    title: 'Export & Share',
    description: 'Export your video with presets optimized for any platform.',
    target: '[data-onboarding="export"]',
    position: 'left',
  },
];

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set, get) => ({
      // State
      preferences: defaultPreferences,
      notifications: [],
      sidebarOpen: true,
      currentPanel: 'media',
      showOnboarding: true,
      onboardingStep: 0,
      showNewProjectDialog: false,
      showExportDialog: false,
      showSettingsDialog: false,
      showShortifyDialog: false,
      isProcessing: false,
      processingMessage: '',
      processingProgress: 0,

      // Actions
      setPreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }));
      },

      toggleTheme: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            theme: state.preferences.theme === 'dark' ? 'light' : 'dark',
          },
        }));
      },

      setEditorMode: (mode) => {
        set((state) => ({
          preferences: { ...state.preferences, editorMode: mode },
        }));
      },

      addNotification: (notification) => {
        const id = Date.now().toString();
        set((state) => ({
          notifications: [
            {
              ...notification,
              id,
              timestamp: new Date(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, 50),
        }));
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      setCurrentPanel: (panel) => {
        set({ currentPanel: panel });
      },

      setShowOnboarding: (show) => {
        set({ showOnboarding: show });
      },

      nextOnboardingStep: () => {
        const { onboardingStep } = get();
        if (onboardingStep < ONBOARDING_STEPS.length - 1) {
          set({ onboardingStep: onboardingStep + 1 });
        } else {
          get().completeOnboarding();
        }
      },

      previousOnboardingStep: () => {
        const { onboardingStep } = get();
        if (onboardingStep > 0) {
          set({ onboardingStep: onboardingStep - 1 });
        }
      },

      completeOnboarding: () => {
        set({
          showOnboarding: false,
          onboardingStep: 0,
        });
      },

      setShowNewProjectDialog: (show) => {
        set({ showNewProjectDialog: show });
      },

      setShowExportDialog: (show) => {
        set({ showExportDialog: show });
      },

      setShowSettingsDialog: (show) => {
        set({ showSettingsDialog: show });
      },

      setShowShortifyDialog: (show) => {
        set({ showShortifyDialog: show });
      },

      setProcessing: (isProcessing, message = '') => {
        set({
          isProcessing,
          processingMessage: message,
          processingProgress: isProcessing ? 0 : 100,
        });
      },

      setProcessingProgress: (progress) => {
        set({ processingProgress: progress });
      },
    }),
    {
      name: 'clipflow-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        showOnboarding: state.showOnboarding,
      }),
    }
  )
);
