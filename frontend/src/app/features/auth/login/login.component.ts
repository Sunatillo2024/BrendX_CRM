import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ToastService } from '../../../core/ui/toast.service';
import { Lang } from '../../../core/i18n/translations';
import { TranslationService } from '../../../core/i18n/translation.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="login-page">
      <!-- Left: brand / features -->
      <div class="login-left">
        <div class="brand-block">
          <div class="brand-logo"><mat-icon>checkroom</mat-icon></div>
          <h1>{{ 'app.name' | t }}</h1>
          <p class="tagline">{{ 'auth.tagline' | t }}</p>
          <ul class="feature-list">
            <li><mat-icon>point_of_sale</mat-icon> {{ 'auth.feature1' | t }}</li>
            <li><mat-icon>warehouse</mat-icon> {{ 'auth.feature2' | t }}</li>
            <li><mat-icon>trending_up</mat-icon> {{ 'auth.feature3' | t }}</li>
            <li><mat-icon>print</mat-icon> {{ 'auth.feature4' | t }}</li>
          </ul>
        </div>
      </div>

      <!-- Right: PIN pad -->
      <div class="login-right">
        <div class="pad-wrap">
          <div class="lang-row">
            @for (l of i18n.languages; track l.code) {
              <button class="lang-btn" [class.active]="i18n.lang() === l.code"
                      (click)="switchLang(l.code)">{{ l.label }}</button>
            }
          </div>

          <h2>{{ platform ? 'Platform Admin' : storeCode }}</h2>
          @if (!platform && !storeCode) {
            <input class="pw-input" [(ngModel)]="storeInput" placeholder="Do‘kon kodi / Код магазина">
            <button class="btn" (click)="chooseStore()">{{ i18n.lang() === 'ru' ? 'Открыть магазин' : 'Do‘konni ochish' }}</button>
            <a href="/platform/login">Platform Admin</a>
          }
          <h2 class="pad-title">{{ 'auth.enterPin' | t }}</h2>

          <div class="pin-dots">
            @for (i of slots(); track i) {
              <span class="dot" [class.filled]="pin().length > i"></span>
            }
          </div>

          @if (errorMsg()) {
            <div class="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMsg() | t }}
                @if (attemptsLeft() !== null && attemptsLeft()! >= 0 && !locked()) {
                  <b> ({{ 'auth.attemptsLeft' | t }}: {{ attemptsLeft() }})</b>
                }
              </span>
            </div>
          }

          <div class="keypad">
            @for (key of keys; track key) {
              <button class="key" [disabled]="locked() || loading()"
                      (click)="press(key)">{{ key }}</button>
            }
            <button class="key fn" [disabled]="loading()" (click)="clear()">
              <mat-icon>backspace</mat-icon>
            </button>
            <button class="key" [disabled]="locked() || loading()" (click)="press('0')">0</button>
            <button class="key fn ok" [disabled]="loading() || pin().length < 4"
                    (click)="submit()">
              <mat-icon>{{ loading() ? 'hourglass_top' : 'login' }}</mat-icon>
            </button>
          </div>

          @if (showPasswordForm()) {
            <div class="pw-form">
              <input class="pw-input" [(ngModel)]="username" [placeholder]="'auth.username' | t">
              <input class="pw-input" type="password" [(ngModel)]="password"
                     [placeholder]="'auth.password' | t">
              <button class="pw-submit" (click)="submitPassword()">{{ 'auth.signIn' | t }}</button>
            </div>
          } @else {
            <button class="link-btn" (click)="showPasswordForm.set(true)">
              {{ 'auth.passwordLogin' | t }}
            </button>
          }

          <p class="hint">{{ 'auth.ownerHint' | t }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: 100vh; display: flex; background: var(--bg); }
    .login-left {
      flex: 1; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, #0f172a 0%, #1e1b4b 50%, #2e1065 100%);
      padding: 48px; color: #fff;
    }
    .brand-block { max-width: 420px; }
    .brand-logo {
      width: 68px; height: 68px; border-radius: 18px; display: flex;
      align-items: center; justify-content: center; margin-bottom: 26px;
      background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.16);
      mat-icon { font-size: 36px; width: 36px; height: 36px; color: #a5b4fc; }
    }
    h1 { font-size: 34px; margin: 0 0 8px; letter-spacing: -.5px; }
    .tagline { color: rgba(255,255,255,.65); margin: 0 0 34px; font-size: 15px; }
    .feature-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px;
      li { display: flex; align-items: center; gap: 12px; color: rgba(255,255,255,.85);
        font-size: 14.5px; }
      mat-icon { color: #818cf8; font-size: 20px; width: 20px; height: 20px; }
    }
    .login-right {
      width: 460px; flex-shrink: 0; background: var(--surface); display: flex;
      align-items: center; justify-content: center; padding: 40px;
      box-shadow: var(--shadow-lg);
    }
    .pad-wrap { width: 100%; max-width: 320px; text-align: center; }
    .lang-row { display: flex; justify-content: center; gap: 8px; margin-bottom: 26px; }
    .lang-btn {
      border: 1px solid var(--border); background: var(--surface); border-radius: 8px;
      padding: 6px 14px; font-size: 13px; cursor: pointer; color: var(--text-2);
      font-family: inherit;
      &.active { background: var(--primary-soft); border-color: transparent; color: var(--primary); font-weight: 600; }
    }
    .pad-title { font-size: 20px; color: var(--text); margin: 0 0 18px; }
    .pin-dots { display: flex; justify-content: center; gap: 12px; margin-bottom: 18px; min-height: 16px; }
    .dot { width: 14px; height: 14px; border-radius: 50%; background: var(--surface-3); transition: background .15s; }
    .dot.filled { background: var(--primary); }
    .alert {
      display: flex; align-items: center; gap: 8px; justify-content: center;
      background: var(--danger-soft); border: 1px solid transparent; color: var(--danger);
      border-radius: 8px; padding: 9px 12px; font-size: 13px; margin-bottom: 14px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .key {
      height: 56px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2);
      font-size: 20px; font-weight: 600; color: var(--text); cursor: pointer;
      font-family: inherit; transition: background .12s, transform .1s;
      display: flex; align-items: center; justify-content: center;
      &:hover:not(:disabled) { background: var(--primary-soft); }
      &:active:not(:disabled) { transform: scale(.97); }
      &:disabled { opacity: .5; cursor: not-allowed; }
      &.fn { background: var(--surface); }
      &.ok { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; }
    }
    .pw-form { display: grid; gap: 10px; margin-top: 18px; }
    .pw-input {
      height: 42px; border: 1px solid var(--border); border-radius: 9px; padding: 0 12px;
      font-size: 14px; font-family: inherit; outline: none;
      background: var(--surface); color: var(--text);
      &:focus { border-color: var(--primary); }
    }
    .pw-submit {
      height: 42px; border: none; border-radius: 9px; background: var(--primary); color: #fff;
      font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
    }
    .link-btn {
      margin-top: 18px; background: none; border: none; color: var(--primary);
      font-size: 13px; cursor: pointer; font-family: inherit; text-decoration: underline;
    }
    .hint { margin-top: 14px; font-size: 12px; color: var(--text-3); }
    @media (max-width: 860px) {
      .login-left { display: none; }
      .login-right { width: 100%; padding: 28px 20px; }
    }
  `],
})
export class LoginComponent {
  private route = inject(ActivatedRoute);
  platform = !!this.route.snapshot.data['platform'];
  storeCode = this.route.snapshot.paramMap.get('code')?.toUpperCase() || '';
  storeInput = '';
  chooseStore() { if (this.storeInput.trim()) window.location.assign('/store/' + encodeURIComponent(this.storeInput.trim().toUpperCase()) + '/login'); }
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  i18n = inject(TranslationService);

  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  pin = signal('');
  errorMsg = signal<string | null>(null);
  attemptsLeft = signal<number | null>(null);
  locked = signal(false);
  loading = signal(false);
  showPasswordForm = signal(false);
  username = '';
  password = '';

  slots() {
    return Array.from({ length: Math.max(4, this.pin().length) }, (_, i) => i);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (this.showPasswordForm() || event.target instanceof HTMLInputElement) return;
    if (/^[0-9]$/.test(event.key)) this.press(event.key);
    else if (event.key === 'Backspace') this.clear();
    else if (event.key === 'Enter') this.submit();
  }

  switchLang(lang: Lang) {
    this.i18n.setLang(lang);
  }

  press(digit: string) {
    if (this.locked() || this.loading()) return;
    if (this.pin().length >= 8) return;
    this.errorMsg.set(null);
    this.pin.update(v => v + digit);
  }

  clear() {
    this.errorMsg.set(null);
    this.pin.update(v => v.slice(0, -1));
  }

  submit() {
    if (this.loading() || this.pin().length < 4) return;
    this.loading.set(true);
    this.errorMsg.set(null);

    this.auth.loginWithPin(this.pin(), this.storeCode, this.platform).subscribe({
      next: () => {
        this.loading.set(false);
        this.pin.set('');
        if (this.storeCode) localStorage.setItem('brandx_store_code', this.storeCode);
        this.router.navigate([this.auth.role() === 'platform_admin' ? '/platform' : this.auth.isCashier() ? '/pos' : '/dashboard']);
      },
      error: err => {
        this.loading.set(false);
        this.pin.set('');
        const status = err.status;
        const body = err.error ?? {};
        if (status === 429) {
          this.locked.set(true);
          this.errorMsg.set('auth.tooManyAttempts');
          const wait = (body.retry_after ?? 60) * 1000;
          setTimeout(() => this.locked.set(false), wait);
          return;
        }
        this.attemptsLeft.set(body.attempts_left ?? null);
        this.errorMsg.set('auth.wrongPin');
      },
    });
  }

  submitPassword() {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        if (this.storeCode) localStorage.setItem('brandx_store_code', this.storeCode);
        this.router.navigate([this.auth.role() === 'platform_admin' ? '/platform' : this.auth.isCashier() ? '/pos' : '/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('auth.wrongPin');
        this.toast.error(this.i18n.t('auth.wrongPin'));
      },
    });
  }
}
