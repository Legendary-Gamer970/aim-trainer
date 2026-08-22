import { DEFAULT_SETTINGS, GameSettings } from './constants';

const SETTINGS_STORAGE_KEY = 'cyber_aim_settings_v1';

export type SettingsListener = (settings: GameSettings) => void;

class SettingsManager {
  private settings: GameSettings;
  private listeners: Set<SettingsListener> = new Set();

  constructor() {
    this.settings = this.loadSettings();
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this.settings[key];
  }

  public set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.settings[key] = value;
    this.saveSettings();
    this.notifyListeners();
  }

  public update(partial: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
    this.notifyListeners();
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    // Immediately invoke with current settings
    listener(this.getSettings());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const current = this.getSettings();
    for (const listener of this.listeners) {
      listener(current);
    }
  }

  private loadSettings(): GameSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage, using defaults', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
  }
}

export const settingsManager = new SettingsManager();
