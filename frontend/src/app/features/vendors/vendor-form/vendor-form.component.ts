import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatCheckboxModule, MatSnackBarModule,
    MatProgressBarModule, MatDividerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>{{ isEdit ? 'Edit Vendor' : 'New Vendor' }}</h1>
          <p style="color:var(--text-muted);margin:0;font-size:13px">
            {{ isEdit ? 'Update vendor information' : 'Add a new supplier to your network' }}
          </p>
        </div>
        <button mat-stroked-button routerLink="/vendors">
          <mat-icon>arrow_back</mat-icon> Back
        </button>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:16px" /> }

      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">

          <!-- Basic Info -->
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon style="color:#6366f1;vertical-align:middle;margin-right:6px">store</mat-icon>
                Basic Information
              </mat-card-title>
            </mat-card-header>
            <mat-card-content class="card-fields">
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Vendor Name *</mat-label>
                  <input matInput formControlName="name" placeholder="e.g. Al-Ameen Textiles">
                  <mat-icon matSuffix>storefront</mat-icon>
                  @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
                    <mat-error>Name is required</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Company Name</mat-label>
                  <input matInput formControlName="company_name" placeholder="Legal company name">
                  <mat-icon matSuffix>business</mat-icon>
                </mat-form-field>
              </div>
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Phone *</mat-label>
                  <input matInput formControlName="phone" placeholder="+964 XXX XXX XXXX">
                  <mat-icon matSuffix>phone</mat-icon>
                  @if (form.get('phone')?.hasError('required') && form.get('phone')?.touched) {
                    <mat-error>Phone is required</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput formControlName="email" type="email" placeholder="vendor@example.com">
                  <mat-icon matSuffix>email</mat-icon>
                  @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
                    <mat-error>Enter a valid email</mat-error>
                  }
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Address</mat-label>
                <textarea matInput formControlName="address" rows="2" placeholder="Street, city, country"></textarea>
                <mat-icon matSuffix>location_on</mat-icon>
              </mat-form-field>
            </mat-card-content>
          </mat-card>

          <!-- Business Details -->
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon style="color:#10b981;vertical-align:middle;margin-right:6px">badge</mat-icon>
                Business Details
              </mat-card-title>
            </mat-card-header>
            <mat-card-content class="card-fields">
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Contact Person</mat-label>
                  <input matInput formControlName="contact_person" placeholder="Primary contact name">
                  <mat-icon matSuffix>person</mat-icon>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Tax Number</mat-label>
                  <input matInput formControlName="tax_number" placeholder="VAT / Tax ID">
                  <mat-icon matSuffix>receipt</mat-icon>
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="3" placeholder="Any additional notes about this vendor"></textarea>
              </mat-form-field>
              <mat-checkbox formControlName="is_active" color="primary">
                Vendor is Active
              </mat-checkbox>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Submit -->
        <div class="form-actions">
          <button mat-stroked-button type="button" routerLink="/vendors">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
            <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
            {{ saving ? 'Saving…' : (isEdit ? 'Update Vendor' : 'Create Vendor') }}
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
export class VendorFormComponent implements OnInit {
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
    company_name:    [''],
    phone:           ['', Validators.required],
    email:           ['', Validators.email],
    address:         [''],
    contact_person:  [''],
    tax_number:      [''],
    notes:           [''],
    is_active:       [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loading = true;
      this.api.getVendor(+id).subscribe({
        next: (v) => { this.form.patchValue(v); this.loading = false; },
        error: () => { this.loading = false; this.router.navigate(['/vendors']); },
      });
    }
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const id = this.route.snapshot.params['id'];
    const req = this.isEdit
      ? this.api.updateVendor(+id, this.form.value)
      : this.api.createVendor(this.form.value);

    req.subscribe({
      next: (v) => {
        this.saving = false;
        this.snackBar.open(this.isEdit ? 'Vendor updated!' : 'Vendor created!', '', { duration: 2500 });
        this.router.navigate(['/vendors', v.id]);
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.detail || Object.values(err.error || {})[0] || 'Save failed';
        this.snackBar.open(String(msg), 'Close', { duration: 4000 });
      },
    });
  }
}
