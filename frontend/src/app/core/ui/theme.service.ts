import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'brandx_theme';

/** Applies and remembers the UI colour theme (light / dark / system). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _mode = signal<ThemeMode>(this.load());
  readonly mode = this._mode.asReadonly();

  constructor() {
    this.apply();
    // Follow the OS when in "system" mode.
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (this._mode() === 'system') this.apply();
      });
  }

  set(mode: ThemeMode) {
    this._mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    this.apply();
  }

  toggle() {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  /** The theme actually shown right now. */
  resolved(): 'light' | 'dark' {
    const mode = this._mode();
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  }

  private load(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }

  private apply() {
    document.documentElement.setAttribute('data-theme', this.resolved());
  }
}
