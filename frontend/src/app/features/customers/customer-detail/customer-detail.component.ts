import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ApiService } from '../../../core/services/api.service';
import { Customer, CustomerTransaction, InstallmentPlan, InstallmentPayment } from '../../../core/models/models';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatTableModule, MatSnackBarModule, MatProgressBarModule, MatTabsModule,
  ],
  template: `
    <div class="page-container">
      @if (customer()) {
        <div class="page-header">
          <div>
            <h1>{{ customer()!.name }}</h1>
            <p style="color:#888;margin:0">{{ customer()!.phone }} &middot; {{ customer()!.customer_type }}</p>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div [class]="'balance-chip ' + (customer()!.outstanding_balance > 0 ? 'positive' : '')">
              Outstanding: {{ customer()!.outstanding_balance | currency }}
            </div>
            <button mat-stroked-button [routerLink]="['/customers', customer()!.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
          </div>
        </div>

        <mat-tab-group>

          <!-- Overview Tab -->
          <mat-tab label="Overview">
            <div style="padding:16px">
              <div class="stats-grid">
                <mat-card>
                  <mat-card-content>
                    <div class="stat-label">Credit Limit</div>
                    <div class="stat-value">{{ customer()!.credit_limit | currency }}</div>
                  </mat-card-content>
                </mat-card>
                <mat-card>
                  <mat-card-content>
                    <div class="stat-label">Outstanding Balance</div>
                    <div class="stat-value text-danger">{{ customer()!.outstanding_balance | currency }}</div>
                  </mat-card-content>
                </mat-card>
                <mat-card>
                  <mat-card-content>
                    <div class="stat-label">Available Credit</div>
                    <div class="stat-value text-success">{{ availableCredit() | currency }}</div>
                  </mat-card-content>
                </mat-card>
              </div>

              <mat-card class="mt-16">
                <mat-card-header><mat-card-title>Receive Payment</mat-card-title></mat-card-header>
                <mat-card-content>
                  <form [formGroup]="payForm" (ngSubmit)="receivePayment()" style="display:flex;gap:12px;align-items:flex-end">
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
                      {{ paying ? 'Processing...' : 'Receive' }}
                    </button>
                  </form>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Transactions Tab (customer_transactions table) -->
          <mat-tab label="Transactions">
            <div style="padding:16px">
              @if (txLoading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:8px" /> }
              <div class="data-table-container">
                <table mat-table [dataSource]="transactions()">
                  <ng-container matColumnDef="date">
                    <th mat-header-cell *matHeaderCellDef>Date</th>
                    <td mat-cell *matCellDef="let t" style="color:#64748b">{{ t.date | date:'short' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="type">
                    <th mat-header-cell *matHeaderCellDef>Type</th>
                    <td mat-cell *matCellDef="let t">
                      <span [class]="'badge ' + txTypeBadge(t.transaction_type)">{{ t.transaction_type }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="amount">
                    <th mat-header-cell *matHeaderCellDef>Amount</th>
                    <td mat-cell *matCellDef="let t" class="fw-600">{{ t.amount | currency }}</td>
                  </ng-container>
                  <ng-container matColumnDef="balance_after">
                    <th mat-header-cell *matHeaderCellDef>Balance After</th>
                    <td mat-cell *matCellDef="let t">{{ t.balance_after | currency }}</td>
                  </ng-container>
                  <ng-container matColumnDef="notes">
                    <th mat-header-cell *matHeaderCellDef>Notes</th>
                    <td mat-cell *matCellDef="let t" style="color:#94a3b8">{{ t.notes || '&mdash;' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="recorded_by">
                    <th mat-header-cell *matHeaderCellDef>By</th>
                    <td mat-cell *matCellDef="let t" style="color:#64748b">{{ t.recorded_by_name }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="txCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: txCols;"></tr>
                </table>
                @if (!transactions().length && !txLoading) {
                  <p style="text-align:center;color:#94a3b8;padding:24px">No transactions found.</p>
                }
              </div>
            </div>
          </mat-tab>

          <!-- Installment Plans Tab (installment_plans + installment_payments) -->
          <mat-tab label="Installment Plans">
            <div style="padding:16px">
              @for (plan of installmentPlans(); track plan.id) {
                <mat-card class="mb-16">
                  <mat-card-content>
                    <div class="plan-header">
                      <div>
                        <strong>Plan #{{ plan.id }}</strong> &mdash; Sale #{{ plan.sale }}
                        <span [class]="'badge badge-' + planStatusColor(plan.status)">{{ plan.status }}</span>
                        @if (plan.overdue_installments > 0) {
                          <span class="badge badge-danger" style="margin-left:4px">{{ plan.overdue_installments }} overdue</span>
                        }
                      </div>
                      <div>{{ plan.paid_count }} / {{ plan.installment_count }} paid</div>
                    </div>
                    <div class="plan-details">
                      <span>Total: {{ plan.total_amount | currency }}</span>
                      <span>Down: {{ plan.down_payment | currency }}</span>
                      <span>Monthly: {{ plan.monthly_installment | currency }}</span>
                      <span>Remaining: {{ plan.remaining_amount | currency }}</span>
                    </div>
                    @if (plan.guarantor_name) {
                      <div style="font-size:12px;color:#94a3b8;margin-top:6px">
                        Guarantor: {{ plan.guarantor_name }} ({{ plan.guarantor_phone }})
                      </div>
                    }

                    <!-- Installment Payments History (installment_payments table) -->
                    @if (plan.payments && plan.payments.length) {
                      <div style="margin-top:12px">
                        <div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:6px">Payment History</div>
                        <div class="data-table-container" style="border:none;box-shadow:none">
                          <table mat-table [dataSource]="plan.payments" style="width:100%">
                            <ng-container matColumnDef="installment_number">
                              <th mat-header-cell *matHeaderCellDef>#</th>
                              <td mat-cell *matCellDef="let p">#{{ p.installment_number }}</td>
                            </ng-container>
                            <ng-container matColumnDef="payment_date">
                              <th mat-header-cell *matHeaderCellDef>Date</th>
                              <td mat-cell *matCellDef="let p" style="color:#64748b">{{ p.payment_date | date }}</td>
                            </ng-container>
                            <ng-container matColumnDef="amount">
                              <th mat-header-cell *matHeaderCellDef>Amount</th>
                              <td mat-cell *matCellDef="let p" class="fw-600 text-success">{{ p.amount | currency }}</td>
                            </ng-container>
                            <ng-container matColumnDef="received_by">
                              <th mat-header-cell *matHeaderCellDef>Received By</th>
                              <td mat-cell *matCellDef="let p" style="color:#64748b">{{ p.received_by_name }}</td>
                            </ng-container>
                            <ng-container matColumnDef="pay_notes">
                              <th mat-header-cell *matHeaderCellDef>Notes</th>
                              <td mat-cell *matCellDef="let p" style="color:#94a3b8">{{ p.notes || '&mdash;' }}</td>
                            </ng-container>
                            <tr mat-header-row *matHeaderRowDef="paymentCols"></tr>
                            <tr mat-row *matRowDef="let row; columns: paymentCols;"></tr>
                          </table>
                        </div>
                      </div>
                    }

                    @if (plan.status === 'active') {
                      <div style="margin-top:12px">
                        <form [formGroup]="installmentPayForm" (ngSubmit)="payInstallment(plan.id)">
                          <div style="display:flex;gap:12px;align-items:flex-end">
                            <mat-form-field appearance="outline">
                              <mat-label>Payment Amount</mat-label>
                              <input matInput formControlName="amount" type="number">
                            </mat-form-field>
                            <button mat-raised-button color="accent" type="submit">Pay Installment</button>
                          </div>
                        </form>
                      </div>
                    }
                  </mat-card-content>
                </mat-card>
              }
              @if (!installmentPlans().length) {
                <p style="color:#888">No installment plans found.</p>
              }
            </div>
          </mat-tab>

        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    .balance-chip { padding: 8px 16px; border-radius: 20px; background: #e8f5e9; font-weight: bold; &.positive { background: #ffebee; color: #c62828; } }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .plan-header { display: flex; justify-content: space-between; font-weight: bold; }
    .plan-details { display: flex; gap: 16px; color: #666; font-size: 13px; margin-top: 8px; }
  `]
})
export class CustomerDetailComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  customer = signal<Customer | null>(null);
  installmentPlans = signal<InstallmentPlan[]>([]);
  transactions = signal<CustomerTransaction[]>([]);
  paying = false;
  txLoading = false;

  txCols = ['date', 'type', 'amount', 'balance_after', 'notes', 'recorded_by'];
  paymentCols = ['installment_number', 'payment_date', 'amount', 'received_by', 'pay_notes'];

  payForm: FormGroup = this.fb.group({ amount: [null, [Validators.required, Validators.min(0.01)]], notes: [''] });
  installmentPayForm: FormGroup = this.fb.group({ amount: [null, [Validators.required, Validators.min(0.01)]] });

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    this.api.getCustomer(id).subscribe(c => this.customer.set(c));
    this.api.getInstallmentPlans({ customer: id, page_size: 50 }).subscribe(r => this.installmentPlans.set(r.results));
    this.txLoading = true;
    this.api.getCustomerTransactions({ customer: id, page_size: 100 }).subscribe({
      next: (r) => { this.transactions.set(r.results); this.txLoading = false; },
      error: () => this.txLoading = false,
    });
  }

  availableCredit() {
    const c = this.customer();
    if (!c) return 0;
    return Math.max(0, c.credit_limit - c.outstanding_balance);
  }

  receivePayment() {
    if (this.payForm.invalid) return;
    this.paying = true;
    this.api.receiveCustomerPayment(this.customer()!.id, this.payForm.value).subscribe({
      next: () => {
        this.paying = false;
        this.payForm.reset();
        const id = this.customer()!.id;
        this.api.getCustomer(id).subscribe(c => this.customer.set(c));
        this.txLoading = true;
        this.api.getCustomerTransactions({ customer: id, page_size: 100 }).subscribe({
          next: (r) => { this.transactions.set(r.results); this.txLoading = false; },
          error: () => this.txLoading = false,
        });
        this.snackBar.open('Payment received!', '', { duration: 2000 });
      },
      error: (err) => { this.paying = false; this.snackBar.open(err.error?.detail || 'Failed', 'Close', { duration: 3000 }); },
    });
  }

  payInstallment(planId: number) {
    if (this.installmentPayForm.invalid) return;
    this.api.payInstallment(planId, this.installmentPayForm.value).subscribe({
      next: () => {
        this.installmentPayForm.reset();
        const id = this.customer()!.id;
        this.api.getCustomer(id).subscribe(c => this.customer.set(c));
        this.api.getInstallmentPlans({ customer: id, page_size: 50 }).subscribe(r => this.installmentPlans.set(r.results));
        this.api.getCustomerTransactions({ customer: id, page_size: 100 }).subscribe(r => this.transactions.set(r.results));
        this.snackBar.open('Installment paid!', '', { duration: 2000 });
      },
      error: (err) => this.snackBar.open(err.error?.detail || 'Failed', 'Close', { duration: 3000 }),
    });
  }

  txTypeBadge(t: string) {
    return { purchase: 'badge-warning', payment: 'badge-success', return: 'badge-accent', installment_payment: 'badge-accent' }[t] || 'badge-default';
  }

  planStatusColor(s: string) {
    return { active: 'success', completed: 'default', defaulted: 'danger', cancelled: 'warning' }[s] || 'default';
  }
}