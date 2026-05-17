import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('password_confirm')?.value;
  return pw && confirm && pw !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="login-page">
      <!-- Left panel (same as login) -->
      <div class="login-left">
        <div class="login-left-content">
          <div class="left-logo"><mat-icon>checkroom</mat-icon></div>
          <h2>Join BrandX POS</h2>
          <p>Create an account to get started. Your account will be reviewed and a role assigned by an administrator.</p>
          <div class="feature-list">
            <div class="feature-item"><mat-icon>point_of_sale</mat-icon><span>Fast Point of Sale</span></div>
            <div class="feature-item"><mat-icon>inventory_2</mat-icon><span>Real-time Inventory</span></div>
            <div class="feature-item"><mat-icon>people</mat-icon><span>Customer Management</span></div>
            <div class="feature-item"><mat-icon>bar_chart</mat-icon><span>Analytics Dashboard</span></div>
          </div>
        </div>
      </div>

      <!-- Right panel -->
      <div class="login-right">
        <div class="login-form-wrap">
          <div class="form-brand">
            <div class="form-brand-icon"><mat-icon>checkroom</mat-icon></div>
            <div class="form-brand-name">BrandX POS</div>
          </div>

          <h1 class="form-title">Create your account</h1>
          <p class="form-subtitle">Fill in the details below to register</p>

          @if (!success()) {
            <form [formGroup]="form" (ngSubmit)="register()" class="login-form">

              <div class="field-row">
                <div class="field-group">
                  <label class="field-label">First Name</label>
                  <div class="input-wrap" [class.error]="form.get('first_name')?.invalid && form.get('first_name')?.touched">
                    <mat-icon class="input-icon">person_outline</mat-icon>
                    <input formControlName="first_name" placeholder="First name">
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label">Last Name</label>
                  <div class="input-wrap" [class.error]="form.get('last_name')?.invalid && form.get('last_name')?.touched">
                    <mat-icon class="input-icon">person_outline</mat-icon>
                    <input formControlName="last_name" placeholder="Last name">
                  </div>
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Username *</label>
                <div class="input-wrap" [class.error]="form.get('username')?.invalid && form.get('username')?.touched">
                  <mat-icon class="input-icon">alternate_email</mat-icon>
                  <input formControlName="username" placeholder="Choose a username" autocomplete="username">
                </div>
                @if (form.get('username')?.hasError('required') && form.get('username')?.touched) {
                  <span class="field-error">Username is required</span>
                }
              </div>

              <div class="field-group">
                <label class="field-label">Email *</label>
                <div class="input-wrap" [class.error]="form.get('email')?.invalid && form.get('email')?.touched">
                  <mat-icon class="input-icon">email</mat-icon>
                  <input formControlName="email" type="email" placeholder="your@email.com" autocomplete="email">
                </div>
                @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                  <span class="field-error">Email is required</span>
                }
                @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
                  <span class="field-error">Enter a valid email</span>
                }
              </div>

              <div class="field-group">
                <label class="field-label">Phone</label>
                <div class="input-wrap">
                  <mat-icon class="input-icon">phone</mat-icon>
                  <input formControlName="phone" placeholder="+964 XXX XXX XXXX" autocomplete="tel">
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Password *</label>
                <div class="input-wrap" [class.error]="form.get('password')?.invalid && form.get('password')?.touched">
                  <mat-icon class="input-icon">lock_outline</mat-icon>
                  <input [type]="showPw() ? 'text' : 'password'" formControlName="password"
                    placeholder="Min 8 characters" autocomplete="new-password">
                  <button type="button" class="toggle-pw" (click)="showPw.set(!showPw())">
                    <mat-icon>{{ showPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </div>
                @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                  <span class="field-error">Password is required</span>
                }
                @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
                  <span class="field-error">Minimum 8 characters</span>
                }
              </div>

              <div class="field-group">
                <label class="field-label">Confirm Password *</label>
                <div class="input-wrap" [class.error]="form.hasError('mismatch') && form.get('password_confirm')?.touched">
                  <mat-icon class="input-icon">lock_outline</mat-icon>
                  <input [type]="showPw() ? 'text' : 'password'" formControlName="password_confirm"
                    placeholder="Repeat password" autocomplete="new-password">
                </div>
                @if (form.hasError('mismatch') && form.get('password_confirm')?.touched) {
                  <span class="field-error">Passwords do not match</span>
                }
              </div>

              @if (errorMsg()) {
                <div class="error-alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ errorMsg() }}</span>
                </div>
              }

              <button type="submit" class="signin-btn" [disabled]="form.invalid || loading()">
                @if (loading()) {
                  <mat-spinner diameter="18" style="--mdc-circular-progress-active-indicator-color:white"></mat-spinner>
                  <span>Creating account...</span>
                } @else {
                  <mat-icon>person_add</mat-icon>
                  <span>Create Account</span>
                }
              </button>

              <p class="switch-link">Already have an account? <a routerLink="/auth">Sign in</a></p>
            </form>
          } @else {
            <div class="success-state">
              <div class="success-icon"><mat-icon>check_circle</mat-icon></div>
              <h2>Account Created!</h2>
              <p>Your account has been registered successfully. An administrator will assign your access role. You can try signing in now.</p>
              <a routerLink="/auth" class="signin-btn" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px">
                <mat-icon>login</mat-icon> Go to Sign In
              </a>
            </div>
          }

          <p class="form-footer">BrandX POS v2.0 &bull; New accounts start with guest access</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: 100vh; display: flex; font-family: 'Inter', 'Roboto', sans-serif; background: #f8fafc; }

    .login-left {
      flex: 1;
      background: linear-gradient(150deg, #0f172a 0%, #1e1b4b 45%, #2e1065 100%);
      display: flex; align-items: center; justify-content: center;
      padding: 48px; position: relative; overflow: hidden;
      &::before { content: ''; position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%); top: -100px; right: -100px; pointer-events: none; }
      &::after { content: ''; position: absolute; width: 300px; height: 300px; background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%); bottom: -80px; left: -80px; pointer-events: none; }
    }
    .login-left-content { max-width: 420px; color: white; }
    .left-logo { width: 64px; height: 64px; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 32px; mat-icon { font-size: 34px; width: 34px; height: 34px; color: #a5b4fc; } }
    .login-left-content h2 { font-size: 32px; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.5px; }
    .login-left-content p { font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.7; margin: 0 0 36px; }
    .feature-list { display: flex; flex-direction: column; gap: 14px; }
    .feature-item { display: flex; align-items: center; gap: 12px; font-size: 14px; color: rgba(255,255,255,0.8); mat-icon { color: #818cf8; font-size: 20px; width: 20px; height: 20px; } }

    .login-right { width: 480px; flex-shrink: 0; background: white; display: flex; align-items: center; justify-content: center; padding: 40px 52px; box-shadow: -8px 0 40px rgba(0,0,0,0.08); overflow-y: auto; }
    .login-form-wrap { width: 100%; }

    .form-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
    .form-brand-icon { width: 38px; height: 38px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 9px; display: flex; align-items: center; justify-content: center; mat-icon { font-size: 20px; color: white; } }
    .form-brand-name { font-size: 18px; font-weight: 700; color: #0f172a; }

    .form-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.4px; }
    .form-subtitle { font-size: 14px; color: #64748b; margin: 0 0 22px; }

    .login-form { display: flex; flex-direction: column; gap: 16px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label { font-size: 13px; font-weight: 600; color: #374151; }
    .input-wrap { display: flex; align-items: center; border: 1.5px solid #d1d5db; border-radius: 10px; padding: 0 14px; height: 46px; background: #fafafa; transition: border-color 0.2s; &:focus-within { border-color: #6366f1; background: white; } &.error { border-color: #ef4444; } input { flex: 1; border: none; background: transparent; outline: none; font-size: 14px; color: #0f172a; font-family: 'Inter', sans-serif; &::placeholder { color: #9ca3af; } } }
    .input-icon { font-size: 18px; color: #9ca3af; margin-right: 8px; width: 18px; height: 18px; flex-shrink: 0; }
    .toggle-pw { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; mat-icon { font-size: 18px; color: #9ca3af; &:hover { color: #6366f1; } } }
    .field-error { font-size: 12px; color: #ef4444; }

    .error-alert { display: flex; align-items: center; gap: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13.5px; mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; } }

    .signin-btn { height: 48px; width: 100%; margin-top: 4px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; letter-spacing: 0.1px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(99,102,241,0.38); transition: box-shadow 0.2s, transform 0.15s; mat-icon { font-size: 20px; } &:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(99,102,241,0.5); transform: translateY(-1px); } &:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; } }

    .switch-link { text-align: center; font-size: 13px; color: #64748b; margin: 4px 0 0; a { color: #6366f1; font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } } }

    .success-state { text-align: center; padding: 16px 0; }
    .success-icon { width: 72px; height: 72px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; mat-icon { font-size: 40px; width: 40px; height: 40px; color: #059669; } }
    .success-state h2 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .success-state p { font-size: 14px; color: #64748b; line-height: 1.7; margin: 0 0 24px; }

    .form-footer { text-align: center; font-size: 12px; color: #94a3b8; margin: 20px 0 0; }

    @media (max-width: 768px) {
      .login-left { display: none; }
      .login-right { width: 100%; padding: 32px 24px; }
      .field-row { grid-template-columns: 1fr; }
    }
  `]
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  showPw = signal(false);
  loading = signal(false);
  success = signal(false);
  errorMsg = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    first_name:       [''],
    last_name:        [''],
    username:         ['', Validators.required],
    email:            ['', [Validators.required, Validators.email]],
    phone:            [''],
    password:         ['', [Validators.required, Validators.minLength(8)]],
    password_confirm: ['', Validators.required],
  }, { validators: passwordsMatch });

  register() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set(null);

    this.authService.register(this.form.value).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => {
        this.loading.set(false);
        const errors = err.error;
        if (typeof errors === 'object') {
          const first = Object.entries(errors)[0];
          const msg = Array.isArray(first[1]) ? first[1][0] : String(first[1]);
          this.errorMsg.set(`${first[0]}: ${msg}`);
        } else {
          this.errorMsg.set(errors?.detail || 'Registration failed');
        }
      },
    });
  }
}
