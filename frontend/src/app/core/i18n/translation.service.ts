import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_LANG, LANGUAGES, Lang, translations } from './translations';

const STORAGE_KEY = 'brandx_lang';

/**
 * Tiny RU/UZ translation service.
 *
 * No external i18n dependency: a signal holds the current language, the pipe
 * re-renders when it changes, and the choice is remembered in localStorage
 * (and on the employee record via the API when logged in).
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private _lang = signal<Lang>(this.loadInitial());
  readonly lang = this._lang.asReadonly();
  readonly languages = LANGUAGES;
  readonly language = computed(() => this._lang());

  private loadInitial(): Lang {
    const stored = (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? null;
    return stored && translations[stored] ? stored : DEFAULT_LANG;
  }

  setLang(lang: Lang, persist = true) {
    if (!translations[lang]) return;
    this._lang.set(lang);
    if (persist) localStorage.setItem(STORAGE_KEY, lang);
  }

  /** Translate a key. Falls back to the key itself so nothing renders blank. */
  t(key: string): string {
    const dict = translations[this._lang()];
    return dict[key] ?? translations[DEFAULT_LANG][key] ?? key;
  }

  /** Translate an enum value produced by the API (e.g. payment.cash). */
  tEnum(prefix: string, value: string | null | undefined): string {
    if (!value) return '';
    return this.t(`${prefix}.${value}`);
  }
}
