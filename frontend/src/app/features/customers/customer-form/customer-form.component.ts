import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatCheckboxModule,
    MatSnackBarModule, MatProgressBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>{{ isEdit ? 'Edit Customer' : 'New Customer' }}</h1>
          <p style="color:var(--text-muted);margin:0;font-size:13px">
            {{ isEdit ? 'Update customer profile' : 'Register a new customer' }}
          </p>
        </div>
        <button mat-stroked-button routerLink="/customers">
          <mat-icon>arrow_back</mat-icon> Back
        </button>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:16px" /> }

      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">

          <!-- Personal Info -->
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon style="color:#6366f1;vertical-align:middle;margin-right:6px">person</mat-icon>
                Personal Information
              </mat-card-title>
            </mat-card-header>
            <mat-card-content class="card-fields">
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Full Name *</mat-label>
                  <input matInput formControlName="name" placeholder="Customer full name">
                  <mat-icon matSuffix>person</mat-icon>
                  @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
                    <mat-error>Name is required</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Phone *</mat-label>
                  <input matInput formControlName="phone" placeholder="+964 XXX XXX XXXX">
                  <mat-icon matSuffix>phone</mat-icon>
                  @if (form.get('phone')?.hasError('required') && form.get('phone')?.touched) {
                    <mat-error>Phone is required</mat-error>
                  }
                </mat-form-field>
              </div>
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput formControlName="email" type="email" placeholder="customer@example.com">
                  <mat-icon matSuffix>email</mat-icon>
                  @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
                    <mat-error>Enter a valid email</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>ID Number</mat-label>
                  <input matInput formControlName="id_number" placeholder="National ID / Passport">
                  <mat-icon matSuffix>badge</mat-icon>
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Address</mat-label>
                <textarea matInput formControlName="address" rows="2" placeholder="Street, city, region"></textarea>
                <mat-icon matSuffix>location_on</mat-icon>
              </mat-form-field>
            </mat-card-content>
          </mat-card>

          <!-- Account Settings -->
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon style="color:#10b981;vertical-align:middle;margin-right:6px">account_balance_wallet</mat-icon>
                Account Settings
              </mat-card-title>
            </mat-card-header>
            <mat-card-content class="card-fields">
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Customer Type *</mat-label>
                <mat-select formControlName="customer_type">
                  <mat-option value="regular">
                    <mat-icon style="font-size:18px;vertical-align:middle;margin-right:6px">person</mat-icon>
                    Regular (cash only)
                  </mat-option>
                  <mat-option value="credit">
                    <mat-icon style="font-size:18px;vertical-align:middle;margin-right:6px">credit_card</mat-icon>
                    Credit Account
                  </mat-option>
                  <mat-option value="installment">
                    <mat-icon style="font-size:18px;vertical-align:middle;margin-right:6px">calendar_month</mat-icon>
                    Installment Plan
                  </mat-option>
                </mat-select>
              </mat-form-field>

              @if (form.get('customer_type')?.value !== 'regular') {
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Credit Limit</mat-label>
                  <input matInput formControlName="credit_limit" type="number" min="0" placeholder="0.00">
                  <span matPrefix style="color:#888;padding-right:4px">IQD</span>
                  <mat-hint>Maximum allowed outstanding balance</mat-hint>
                </mat-form-field>
              }

              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="3" placeholder="Any notes about this customer"></textarea>
              </mat-form-field>

              <mat-checkbox formControlName="is_active" color="primary">
                Customer is Active
              </mat-checkbox>
            </mat-card-content>
          </mat-card>
        </div>

        <div class="form-actions">
          <button mat-stroked-button type="button" routerLink="/customers">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
            <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ saving ? 'Saving…' : (isEdit ? 'Update Customer' : 'Create Customer') }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .form-card mat-card-content { padding-top: 8px; }
    .card-fields { display: flex; flex-direction: column; gap: 12px; padding: 8px 0 4px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; padding-bottom: 24px; }
    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
      .field-row { grid-template-columns: 1fr; }
    }
  `]
})
export class CustomerFormComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  isEdit = false;
  loading = false;
  saving = false;

  form: FormGroup = this.fb.group({
    name:            ['', Validators.required],
    phone:           ['', Validators.required],
    email:           ['', Validators.email],
    id_number:       [''],
    address:         [''],
    customer_type:   ['regular', Validators.required],
    credit_limit:    [0],
    notes:           [''],
    is_active:       [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loading = true;
      this.api.getCustomer(+id).subscribe({
        next: (c) => { this.form.patchValue(c); this.loading = false; },
        error: () => { this.loading = false; this.router.navigate(['/customers']); },
      });
    }
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const id = this.route.snapshot.params['id'];
    const req = this.isEdit
      ? this.api.updateCustomer(+id, this.form.value)
      : this.api.createCustomer(this.form.value);

    req.subscribe({
      next: (c) => {
        this.saving = false;
        this.snackBar.open(this.isEdit ? 'Customer updated!' : 'Customer created!', '', { duration: 2500 });
        this.router.navigate(['/customers', c.id]);
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.detail || Object.values(err.error || {})[0] || 'Save failed';
        this.snackBar.open(String(msg), 'Close', { duration: 4000 });
      },
    });
  }
}
