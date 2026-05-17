import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="login-page">
      <!-- Left panel -->
      <div class="login-left">
        <div class="login-left-content">
          <div class="left-logo">
            <mat-icon>checkroom</mat-icon>
          </div>
          <h2>Welcome Back</h2>
          <p>Manage your multi-branch clothes shop with BrandX POS &mdash; sales, inventory, customers and analytics all in one place.</p>
          <div class="feature-list">
            <div class="feature-item"><mat-icon>point_of_sale</mat-icon><span>Fast Point of Sale</span></div>
            <div class="feature-item"><mat-icon>inventory_2</mat-icon><span>Real-time Inventory</span></div>
            <div class="feature-item"><mat-icon>people</mat-icon><span>Customer Management</span></div>
            <div class="feature-item"><mat-icon>bar_chart</mat-icon><span>AI-powered Analytics</span></div>
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

          <h1 class="form-title">Sign in to your account</h1>
          <p class="form-subtitle">Enter your credentials to access the system</p>

          <form [formGroup]="form" (ngSubmit)="login()" class="login-form">
            <div class="field-group">
              <label class="field-label">Username</label>
              <div class="input-wrap" [class.error]="form.get('username')?.invalid && form.get('username')?.touched">
                <mat-icon class="input-icon">person_outline</mat-icon>
                <input matInput formControlName="username" placeholder="Enter your username" autocomplete="username">
              </div>
              @if (form.get('username')?.hasError('required') && form.get('username')?.touched) {
                <span class="field-error">Username is required</span>
              }
            </div>

            <div class="field-group">
              <label class="field-label">Password</label>
              <div class="input-wrap" [class.error]="form.get('password')?.invalid && form.get('password')?.touched">
                <mat-icon class="input-icon">lock_outline</mat-icon>
                <input [type]="showPassword() ? 'text' : 'password'" formControlName="password"
                  placeholder="Enter your password" autocomplete="current-password">
                <button type="button" class="toggle-pw" (click)="showPassword.set(!showPassword())">
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <span class="field-error">Password is required</span>
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
                <span>Signing in...</span>
              } @else {
                <mat-icon>login</mat-icon>
                <span>Sign In</span>
              }
            </button>
          </form>

          <p class="form-footer">BrandX POS v2.0 &bull; Django REST Framework + Angular 19</p>
          <p style="text-align:center;font-size:13px;color:#64748b;margin:12px 0 0">
            Don&apos;t have an account? <a routerLink="/auth/register" style="color:#6366f1;font-weight:600;text-decoration:none">Create one</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      font-family: 'Inter', 'Roboto', sans-serif;
      background: #f8fafc;
    }

    /* Left side */
    .login-left {
      flex: 1;
      background: linear-gradient(150deg, #0f172a 0%, #1e1b4b 45%, #2e1065 100%);
      display: flex; align-items: center; justify-content: center;
      padding: 48px;
      position: relative;
      overflow: hidden;
      &::before {
        content: '';
        position: absolute;
        width: 400px; height: 400px;
        background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
        top: -100px; right: -100px;
        pointer-events: none;
      }
      &::after {
        content: '';
        position: absolute;
        width: 300px; height: 300px;
        background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%);
        bottom: -80px; left: -80px;
        pointer-events: none;
      }
    }
    .login-left-content { max-width: 420px; color: white; }
    .left-logo {
      width: 64px; height: 64px;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 32px;
      mat-icon { font-size: 34px; width: 34px; height: 34px; color: #a5b4fc; }
    }
    .login-left-content h2 { font-size: 32px; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.5px; }
    .login-left-content p { font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.7; margin: 0 0 36px; }
    .feature-list { display: flex; flex-direction: column; gap: 14px; }
    .feature-item {
      display: flex; align-items: center; gap: 12px;
      font-size: 14px; color: rgba(255,255,255,0.8);
      mat-icon { color: #818cf8; font-size: 20px; width: 20px; height: 20px; }
    }

    /* Right side */
    .login-right {
      width: 480px; flex-shrink: 0;
      background: white;
      display: flex; align-items: center; justify-content: center;
      padding: 48px 52px;
      box-shadow: -8px 0 40px rgba(0,0,0,0.08);
    }
    .login-form-wrap { width: 100%; }

    .form-brand {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 36px;
    }
    .form-brand-icon {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; color: white; }
    }
    .form-brand-name { font-size: 18px; font-weight: 700; color: #0f172a; }

    .form-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.4px; }
    .form-subtitle { font-size: 14px; color: #64748b; margin: 0 0 28px; }

    .login-form { display: flex; flex-direction: column; gap: 20px; }

    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 13px; font-weight: 600; color: #374151; }
    .input-wrap {
      display: flex; align-items: center;
      border: 1.5px solid #d1d5db; border-radius: 10px;
      padding: 0 14px; height: 46px;
      background: #fafafa; transition: border-color 0.2s;
      &:focus-within { border-color: #6366f1; background: white; }
      &.error { border-color: #ef4444; }
      input {
        flex: 1; border: none; background: transparent; outline: none;
        font-size: 14px; color: #0f172a; font-family: 'Inter', sans-serif;
        &::placeholder { color: #9ca3af; }
      }
    }
    .input-icon { font-size: 18px; color: #9ca3af; margin-right: 8px; width: 18px; height: 18px; }
    .toggle-pw {
      background: none; border: none; cursor: pointer; padding: 0;
      display: flex; align-items: center;
      mat-icon { font-size: 18px; color: #9ca3af; &:hover { color: #6366f1; } }
    }
    .field-error { font-size: 12px; color: #ef4444; }

    .error-alert {
      display: flex; align-items: center; gap: 8px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #dc2626; padding: 10px 14px; border-radius: 8px;
      font-size: 13.5px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .signin-btn {
      height: 48px; width: 100%; margin-top: 4px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 600; cursor: pointer; letter-spacing: 0.1px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 14px rgba(99,102,241,0.38);
      transition: box-shadow 0.2s, transform 0.15s;
      mat-icon { font-size: 20px; }
      &:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(99,102,241,0.5); transform: translateY(-1px); }
      &:active:not(:disabled) { transform: translateY(0); }
      &:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
    }

    .form-footer { text-align: center; font-size: 12px; color: #94a3b8; margin: 24px 0 0; }

    @media (max-width: 768px) {
      .login-left { display: none; }
      .login-right { width: 100%; padding: 32px 24px; }
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  login() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set(null);
    const { username, password } = this.form.value;
    this.authService.login(username, password).subscribe({
      next: () => { this.loading.set(false); this.router.navigate(['/dashboard']); },
      error: (err) => {
        this.loading.set(false);
        const detail = err.error?.detail || err.error?.non_field_errors?.[0] || 'Invalid username or password';
        this.errorMsg.set(detail);
      }
    });
  }
}
