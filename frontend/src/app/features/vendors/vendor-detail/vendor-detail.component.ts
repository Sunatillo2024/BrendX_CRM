import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/services/api.service';
import { Vendor, VendorTransaction } from '../../../core/models/models';

@Component({
  selector: 'app-vendor-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatTableModule,
    MatSnackBarModule, MatProgressBarModule, MatTabsModule, MatDividerModule,
  ],
  template: `
    <div class="page-container">
      @if (vendor()) {
        <div class="page-header">
          <div>
            <h1>{{ vendor()!.name }}</h1>
            <p style="color:#888;margin:0">{{ vendor()!.company_name }} · {{ vendor()!.phone }}</p>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div class="balance-chip" [class.positive]="vendor()!.balance > 0">
              Balance: {{ vendor()!.balance | currency }}
            </div>
            <button mat-stroked-button [routerLink]="['/vendors', vendor()!.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
          </div>
        </div>

        <mat-tab-group>
          <!-- Info Tab -->
          <mat-tab label="Info">
            <div style="padding:16px">
              <mat-card>
                <mat-card-content>
                  <div class="info-grid">
                    <div><strong>Contact:</strong> {{ vendor()!.contact_person }}</div>
                    <div><strong>Email:</strong> {{ vendor()!.email || '—' }}</div>
                    <div><strong>Address:</strong> {{ vendor()!.address || '—' }}</div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Transactions Tab -->
          <mat-tab label="Transactions">
            <div style="padding:16px">
              <!-- Pay Vendor Form -->
              <mat-card class="mb-16">
                <mat-card-header><mat-card-title>Record Payment</mat-card-title></mat-card-header>
                <mat-card-content>
                  <form [formGroup]="payForm" (ngSubmit)="pay()" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
                    <mat-form-field appearance="outline">
                      <mat-label>Transaction Type</mat-label>
                      <mat-select formControlName="transaction_type">
                        <mat-option value="payment">Payment to Vendor</mat-option>
                        <mat-option value="purchase">Purchase</mat-option>
                        <mat-option value="return">Return</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Amount</mat-label>
                      <input matInput formControlName="amount" type="number" min="0.01">
                      <mat-icon matPrefix>attach_money</mat-icon>
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="flex:1">
                      <mat-label>Notes</mat-label>
                      <input matInput formControlName="notes">
                    </mat-form-field>
                    <button mat-raised-button color="primary" type="submit" [disabled]="payForm.invalid || paying">
                      {{ paying ? 'Processing...' : 'Record' }}
                    </button>
                  </form>
                </mat-card-content>
              </mat-card>

              <div class="data-table-container">
                <table mat-table [dataSource]="transactions()">
                  <ng-container matColumnDef="date">
                    <th mat-header-cell *matHeaderCellDef>Date</th>
                    <td mat-cell *matCellDef="let t">{{ t.created_at | date:'short' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="type">
                    <th mat-header-cell *matHeaderCellDef>Type</th>
                    <td mat-cell *matCellDef="let t">
                      <span class="badge badge-default">{{ t.transaction_type }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="amount">
                    <th mat-header-cell *matHeaderCellDef>Amount</th>
                    <td mat-cell *matCellDef="let t">{{ t.amount | currency }}</td>
                  </ng-container>
                  <ng-container matColumnDef="balance_after">
                    <th mat-header-cell *matHeaderCellDef>Balance After</th>
                    <td mat-cell *matCellDef="let t">{{ t.balance_after | currency }}</td>
                  </ng-container>
                  <ng-container matColumnDef="notes">
                    <th mat-header-cell *matHeaderCellDef>Notes</th>
                    <td mat-cell *matCellDef="let t">{{ t.notes }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="txCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: txCols;"></tr>
                </table>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    .balance-chip { padding: 8px 16px; border-radius: 20px; background: #e8f5e9; font-weight: bold; &.positive { background: #ffebee; color: #c62828; } }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class VendorDetailComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  vendor = signal<Vendor | null>(null);
  transactions = signal<VendorTransaction[]>([]);
  paying = false;
  txCols = ['date', 'type', 'amount', 'balance_after', 'notes'];

  payForm: FormGroup = this.fb.group({
    transaction_type: ['payment', Validators.required],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    this.api.getVendor(id).subscribe(v => this.vendor.set(v));
    this.api.getVendorTransactions({ vendor: id, page_size: 50 }).subscribe(r => this.transactions.set(r.results));
  }

  pay() {
    if (this.payForm.invalid) return;
    this.paying = true;
    const data = { ...this.payForm.value, vendor: this.vendor()?.id };
    this.api.createVendorTransaction(data).subscribe({
      next: () => {
        this.paying = false;
        this.payForm.reset({ transaction_type: 'payment' });
        const id = this.vendor()!.id;
        this.api.getVendor(id).subscribe(v => this.vendor.set(v));
        this.api.getVendorTransactions({ vendor: id, page_size: 50 }).subscribe(r => this.transactions.set(r.results));
        this.snackBar.open('Transaction recorded!', '', { duration: 2000 });
      },
      error: (err) => { this.paying = false; this.snackBar.open(err.error?.detail || 'Failed', 'Close', { duration: 3000 }); }
    });
  }
}
