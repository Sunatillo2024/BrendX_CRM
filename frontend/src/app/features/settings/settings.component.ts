import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Lang } from '../../core/i18n/translations';
import { TranslationService } from '../../core/i18n/translation.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="page-head">
      <h1 class="page-title">{{ 'settings.title' | t }}</h1>
    </div>

    <div class="page-body">
      <div class="grid grid-2">
        <!-- Profile -->
        <div class="card">
          <h3 class="card-title">{{ 'settings.profile' | t }}</h3>
          <div class="form-grid">
            <div class="field">
              <label class="field-label">{{ 'employees.name' | t }}</label>
              <input class="input" [(ngModel)]="profile.first_name" name="first_name">
            </div>
            <div class="field">
              <label class="field-label">{{ 'employees.name' | t }}</label>
              <input class="input" [(ngModel)]="profile.last_name" name="last_name">
            </div>
            <div class="field">
              <label class="field-label">Email</label>
              <input class="input" [(ngModel)]="profile.email" name="email">
            </div>
            <div class="field">
              <label class="field-label">{{ 'employees.phone' | t }}</label>
              <input class="input" [(ngModel)]="profile.phone" name="phone">
            </div>
          </div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn primary" (click)="saveProfile()">
              <mat-icon>save</mat-icon> {{ 'common.save' | t }}
            </button>
          </div>
        </div>

        <!-- Language -->
        <div class="card">
          <h3 class="card-title">{{ 'settings.changeLanguage' | t }}</h3>
          <div class="lang-list">
            @for (l of i18n.languages; track l.code) {
              <button class="lang-option" [class.active]="i18n.lang() === l.code"
                      (click)="setLang(l.code)">
                <mat-icon>{{ i18n.lang() === l.code ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
                {{ l.label }}
              </button>
            }
          </div>
        </div>

        <!-- PIN -->
        <div class="card">
          <h3 class="card-title">{{ 'settings.changePin' | t }}</h3>
          <div class="form-grid">
            <div class="field">
              <label class="field-label">{{ 'settings.currentPin' | t }}</label>
              <input class="input" inputmode="numeric" maxlength="8"
                     [(ngModel)]="pinForm.current" name="current">
            </div>
            <div class="field">
              <label class="field-label">{{ 'settings.newPin' | t }}</label>
              <input class="input" inputmode="numeric" maxlength="8"
                     [(ngModel)]="pinForm.pin" name="new">
            </div>
            <div class="field">
              <label class="field-label">{{ 'settings.confirmPin' | t }}</label>
              <input class="input" inputmode="numeric" maxlength="8"
                     [(ngModel)]="pinForm.confirm" name="confirm">
            </div>
          </div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn primary" (click)="changePin()">
              <mat-icon>pin</mat-icon> {{ 'common.save' | t }}
            </button>
          </div>
        </div>

        <!-- About -->
        <div class="card">
          <h3 class="card-title">{{ 'settings.about' | t }}</h3>
          <div class="kv"><span class="muted">{{ 'employees.role' | t }}</span>
            <b>{{ ('role.' + (auth.role() || '')) | t }}</b></div>
          <div class="kv"><span class="muted">{{ 'settings.currency' | t }}</span>
            <b>{{ environment.currency }}</b></div>
          <div class="kv"><span class="muted">{{ 'employees.username' | t }}</span>
            <b>{{ auth.currentUser()?.username }}</b></div>
          <div class="kv"><span class="muted">{{ 'settings.version' | t }}</span>
            <b>{{ environment.appName }}</b></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lang-list { display: grid; gap: 8px; }
    .lang-option {
      display: flex; align-items: center; gap: 9px; height: 44px; padding: 0 14px;
      border: 1px solid var(--border); border-radius: 10px; background: var(--surface);
      cursor: pointer; font-family: inherit; font-size: 14px; color: var(--text);
      transition: background 150ms, border-color 150ms;
      &:hover { background: var(--surface-2); }
      &.active { border-color: transparent; background: var(--primary-soft); color: var(--primary); font-weight: 600; }
      mat-icon { font-size: 19px; width: 19px; height: 19px; }
    }
    .kv {
      display: flex; justify-content: space-between; padding: 9px 0;
      border-bottom: 1px solid var(--border); font-size: 13.5px;
      &:last-child { border-bottom: none; }
    }
  `],
})
export class SettingsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  i18n = inject(TranslationService);
  auth = inject(AuthService);

  readonly environment = environment;

  profile = {
    first_name: this.auth.currentUser()?.first_name ?? '',
    last_name: this.auth.currentUser()?.last_name ?? '',
    email: this.auth.currentUser()?.email ?? '',
    phone: this.auth.currentUser()?.phone ?? '',
  };

  pinForm = { current: '', pin: '', confirm: '' };

  setLang(lang: Lang) {
    this.auth.persistLanguage(lang);
  }

  saveProfile() {
    this.api.updateMe(this.profile).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('common.saved'));
        this.auth.refreshCurrentUser();
      },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }

  changePin() {
    const { current, pin, confirm } = this.pinForm;
    if (!current || !pin) return;
    if (pin !== confirm) {
      this.toast.error(this.i18n.t('settings.pinMismatch'));
      return;
    }
    this.api.changeMyPin(current, pin).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('common.saved'));
        this.pinForm = { current: '', pin: '', confirm: '' };
      },
      error: err => {
        const detail = err.error?.current_pin?.[0] || err.error?.pin?.[0] ||
          err.error?.detail;
        this.toast.error(detail || this.i18n.t('common.error'));
      },
    });
  }
}
