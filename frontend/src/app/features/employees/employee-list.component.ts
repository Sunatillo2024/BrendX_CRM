import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { User, UserRole } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ 'employees.title' | t }}</h1>
        <div class="page-sub">{{ employees().length }} {{ 'employees.title' | t }}</div>
      </div>
      <button class="btn primary" (click)="openForm()">
        <mat-icon>person_add</mat-icon> {{ 'employees.new' | t }}
      </button>
    </div>

    <div class="page-body">
      <div class="card pad-0">
        @if (employees().length) {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'employees.name' | t }}</th>
                  <th>{{ 'employees.username' | t }}</th>
                  <th>{{ 'employees.role' | t }}</th>
                  <th>{{ 'employees.phone' | t }}</th>
                  <th>{{ 'employees.pin' | t }}</th>
                  <th>{{ 'common.status' | t }}</th>
                  <th class="actions"></th>
                </tr>
              </thead>
              <tbody>
                @for (user of employees(); track user.id) {
                  <tr>
                    <td>
                      <div class="flex gap-12" style="align-items:center">
                        <div class="avatar">{{ initial(user) }}</div>
                        <span class="strong">{{ user.display_name }}</span>
                      </div>
                    </td>
                    <td class="muted">{{ user.username }}</td>
                    <td>
                      <span class="badge" [class.info]="user.role === 'owner'"
                            [class.success]="user.role === 'manager'">
                        {{ ('role.' + user.role) | t }}
                      </span>
                    </td>
                    <td>{{ user.phone || '—' }}</td>
                    <td>
                      <span class="badge" [class.success]="user.pin_set" [class.warn]="!user.pin_set">
                        <mat-icon>{{ user.pin_set ? 'lock' : 'lock_open' }}</mat-icon>
                        {{ (user.pin_set ? 'employees.pinSet' : 'employees.pinNotSet') | t }}
                      </span>
                    </td>
                    <td>
                      <span class="badge" [class.success]="user.is_active" [class.danger]="!user.is_active">
                        <span class="dot"></span>
                        {{ (user.is_active ? 'common.active' : 'common.inactive') | t }}
                      </span>
                    </td>
                    <td class="actions">
                      <button class="icon-btn" (click)="openForm(user)" [title]="'common.edit' | t">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button class="icon-btn" (click)="openPin(user)" [title]="'employees.setPin' | t">
                        <mat-icon>pin</mat-icon>
                      </button>
                      @if (user.is_active) {
                        <button class="icon-btn" (click)="deactivate(user)">
                          <mat-icon>person_off</mat-icon>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-state">
            <mat-icon>badge</mat-icon>
            <h4>{{ 'employees.emptyTitle' | t }}</h4>
            <p>{{ 'employees.emptyHint' | t }}</p>
            <button class="btn primary" (click)="openForm()">
              <mat-icon>person_add</mat-icon> {{ 'employees.new' | t }}
            </button>
          </div>
        }
      </div>
    </div>

    <!-- create / edit -->
    @if (showForm()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <div class="modal lg" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ (editing ? 'employees.edit' : 'employees.new') | t }}</h3>
            <button class="icon-btn" (click)="closeForm()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field">
                <label class="field-label">{{ 'employees.name' | t }} *</label>
                <input class="input" [(ngModel)]="form.first_name" name="first_name">
              </div>
              <div class="field">
                <label class="field-label">{{ 'employees.username' | t }} *</label>
                <input class="input" [(ngModel)]="form.username" name="username"
                       [disabled]="!!editing">
              </div>
              <div class="field">
                <label class="field-label">{{ 'employees.role' | t }}</label>
                <select class="select" [(ngModel)]="form.role" name="role">
                  @for (r of roles; track r) {
                    <option [value]="r">{{ ('role.' + r) | t }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label class="field-label">{{ 'employees.phone' | t }}</label>
                <input class="input" [(ngModel)]="form.phone" name="phone">
              </div>
              <div class="field">
                <label class="field-label">{{ 'employees.pin' | t }}
                  <span class="field-hint">({{ 'employees.pinRule' | t }})</span>
                </label>
                <input class="input" inputmode="numeric" [(ngModel)]="form.pin" name="pin"
                       maxlength="8" [placeholder]="'common.optional' | t">
              </div>
              @if (!editing) {
                <div class="field">
                  <label class="field-label">{{ 'auth.password' | t }}
                    <span class="field-hint">({{ 'common.optional' | t }})</span>
                  </label>
                  <input class="input" type="password" [(ngModel)]="form.password" name="password">
                </div>
              }
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="closeForm()">{{ 'common.cancel' | t }}</button>
            <button class="btn primary" [disabled]="!form.first_name || saving()" (click)="save()">
              {{ saving() ? ('common.loading' | t) : ('common.save' | t) }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- PIN -->
    @if (pinUser(); as user) {
      <div class="modal-backdrop" (click)="closePin()">
        <div class="modal" style="max-width:400px" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <h3>{{ 'employees.setPin' | t }}</h3>
              <div class="small muted">{{ user.display_name }}</div>
            </div>
            <button class="icon-btn" (click)="closePin()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label class="field-label">{{ 'employees.pin' | t }} ({{ 'employees.pinRule' | t }})</label>
              <input class="input" inputmode="numeric" maxlength="8" [(ngModel)]="pinValue"
                     name="pinValue" autofocus>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="closePin()">{{ 'common.cancel' | t }}</button>
            <button class="btn primary" [disabled]="!pinValue" (click)="savePin()">
              {{ 'common.save' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EmployeeListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private i18n = inject(TranslationService);

  readonly roles: UserRole[] = ['owner', 'manager', 'cashier'];

  employees = signal<User[]>([]);
  showForm = signal(false);
  saving = signal(false);
  editing: User | null = null;
  pinUser = signal<User | null>(null);
  pinValue = '';

  form: any = this.blankForm();

  ngOnInit() {
    this.load();
  }

  blankForm() {
    return { first_name: '', username: '', role: 'cashier' as UserRole, phone: '',
      pin: '', password: '', is_active: true };
  }

  initial(user: User) {
    const name = user.display_name || user.username || '?';
    return name.trim().charAt(0).toUpperCase();
  }

  load() {
    this.api.getUsers({ page_size: 200 }).subscribe(r => this.employees.set(r.results));
  }

  openForm(user?: User) {
    if (user) {
      this.editing = user;
      this.form = {
        first_name: user.first_name, username: user.username, role: user.role,
        phone: user.phone, pin: '', password: '', is_active: user.is_active,
      };
    } else {
      this.editing = null;
      this.form = this.blankForm();
    }
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editing = null;
  }

  save() {
    if (!this.form.first_name) return;
    this.saving.set(true);
    const payload: any = {
      first_name: this.form.first_name,
      role: this.form.role,
      phone: this.form.phone,
      is_active: this.form.is_active,
    };
    if (this.form.pin) payload.pin = String(this.form.pin);

    const request = this.editing
      ? this.api.updateUser(this.editing.id, payload)
      : this.api.createUser({
          ...payload,
          username: this.form.username,
          ...(this.form.password ? { password: this.form.password } : {}),
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t('common.saved'));
        this.closeForm();
        this.load();
      },
      error: err => {
        this.saving.set(false);
        const body = err.error ?? {};
        const detail = body.pin?.[0] || body.username?.[0] || body.detail ||
          this.i18n.t('common.error');
        this.toast.error(String(detail));
      },
    });
  }

  openPin(user: User) {
    this.pinUser.set(user);
    this.pinValue = '';
  }

  closePin() {
    this.pinUser.set(null);
  }

  savePin() {
    const user = this.pinUser();
    if (!user || !this.pinValue) return;
    this.api.setUserPin(user.id, String(this.pinValue)).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('common.saved'));
        this.closePin();
        this.load();
      },
      error: err => this.toast.error(err.error?.pin?.[0] || this.i18n.t('employees.pinTaken')),
    });
  }

  async deactivate(user: User) {
    const approved = await this.confirm.confirm({
      title: this.i18n.t('employees.deactivate'),
      message: `${user.display_name} — ${this.i18n.t('employees.deactivateHint')}`,
      confirmLabel: this.i18n.t('common.confirm'),
      danger: true,
    });
    if (!approved) return;

    this.api.deactivateUser(user.id).subscribe({
      next: () => { this.toast.success(this.i18n.t('common.saved')); this.load(); },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }
}
