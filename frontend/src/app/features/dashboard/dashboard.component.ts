import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/services/api.service';
import { DashboardStats } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px">
            Welcome back, <strong>{{ auth.currentUser()?.username }}</strong>
          </div>
        </div>
        <button mat-raised-button color="primary" routerLink="/pos">
          <mat-icon>point_of_sale</mat-icon> New Sale
        </button>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:16px" /> }

      @if (stats) {
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card kpi-blue">
            <div class="kpi-icon-wrap" style="background:rgba(99,102,241,0.12)">
              <mat-icon style="color:#6366f1">receipt_long</mat-icon>
            </div>
            <div class="kpi-body">
              <div class="kpi-value">{{ stats.today.count || 0 }}</div>
              <div class="kpi-label">Sales Today</div>
            </div>
            <div class="kpi-trend">
              <mat-icon style="color:#10b981;font-size:16px">trending_up</mat-icon>
            </div>
          </div>

          <div class="kpi-card kpi-green">
            <div class="kpi-icon-wrap" style="background:rgba(16,185,129,0.12)">
              <mat-icon style="color:#10b981">attach_money</mat-icon>
            </div>
            <div class="kpi-body">
              <div class="kpi-value">{{ (stats.today.total || 0) | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="kpi-label">Revenue Today</div>
            </div>
          </div>

          <div class="kpi-card kpi-purple">
            <div class="kpi-icon-wrap" style="background:rgba(139,92,246,0.12)">
              <mat-icon style="color:#8b5cf6">calendar_month</mat-icon>
            </div>
            <div class="kpi-body">
              <div class="kpi-value">{{ (stats.this_month.total || 0) | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="kpi-label">Month Revenue</div>
            </div>
          </div>

          <div class="kpi-card kpi-red">
            <div class="kpi-icon-wrap" style="background:rgba(239,68,68,0.12)">
              <mat-icon style="color:#ef4444">account_balance_wallet</mat-icon>
            </div>
            <div class="kpi-body">
              <div class="kpi-value">{{ ((stats.outstanding_credit || 0) + (stats.outstanding_installment || 0)) | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="kpi-label">Outstanding Debt</div>
            </div>
          </div>
        </div>

        <!-- Sale Type Cards -->
        <div class="section-title">This Month by Payment Type</div>
        <div class="type-grid">
          <div class="type-card">
            <div class="type-icon" style="background:#d1fae5;color:#059669">
              <mat-icon>payments</mat-icon>
            </div>
            <div class="type-count" style="color:#059669">{{ stats.by_type.cash?.count || 0 }}</div>
            <div class="type-label">Cash Sales</div>
            <div class="type-amount">{{ (stats.by_type.cash?.total || 0) | currency:'USD':'symbol':'1.0-0' }}</div>
          </div>
          <div class="type-card">
            <div class="type-icon" style="background:#dbeafe;color:#2563eb">
              <mat-icon>credit_card</mat-icon>
            </div>
            <div class="type-count" style="color:#2563eb">{{ stats.by_type.credit?.count || 0 }}</div>
            <div class="type-label">Credit Sales</div>
            <div class="type-amount">{{ (stats.by_type.credit?.total || 0) | currency:'USD':'symbol':'1.0-0' }}</div>
          </div>
          <div class="type-card">
            <div class="type-icon" style="background:#fef3c7;color:#d97706">
              <mat-icon>schedule</mat-icon>
            </div>
            <div class="type-count" style="color:#d97706">{{ stats.by_type.installment?.count || 0 }}</div>
            <div class="type-label">Installment</div>
            <div class="type-amount">{{ (stats.by_type.installment?.total || 0) | currency:'USD':'symbol':'1.0-0' }}</div>
          </div>
        </div>

        <!-- Outstanding Balances -->
        <div class="section-title">Outstanding Balances</div>
        <div class="balance-grid">
          <div class="balance-card">
            <div class="balance-header">
              <div class="balance-icon" style="background:#fee2e2;color:#dc2626">
                <mat-icon>credit_score</mat-icon>
              </div>
              <div>
                <div class="balance-title">Credit Customers</div>
                <div class="balance-sub">Unpaid credit balance</div>
              </div>
            </div>
            <div class="balance-amount">{{ (stats.outstanding_credit || 0) | currency }}</div>
            <a class="balance-link" routerLink="/customers" [queryParams]="{type:'credit'}">
              View credit customers <mat-icon style="font-size:14px">arrow_forward</mat-icon>
            </a>
          </div>

          <div class="balance-card">
            <div class="balance-header">
              <div class="balance-icon" style="background:#fef3c7;color:#d97706">
                <mat-icon>event_repeat</mat-icon>
              </div>
              <div>
                <div class="balance-title">Installment Plans</div>
                <div class="balance-sub">Remaining installments</div>
              </div>
            </div>
            <div class="balance-amount">{{ (stats.outstanding_installment || 0) | currency }}</div>
            <a class="balance-link" routerLink="/customers" [queryParams]="{type:'installment'}">
              View installment plans <mat-icon style="font-size:14px">arrow_forward</mat-icon>
            </a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* KPI grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: white;
      border-radius: 14px;
      padding: 20px 22px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      border: 1px solid #e8edf4;
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      overflow: hidden;
      transition: box-shadow 0.2s, transform 0.2s;
      &::after {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        border-radius: 14px 14px 0 0;
      }
      &:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.09); transform: translateY(-2px); }
    }
    .kpi-blue::after  { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
    .kpi-green::after { background: linear-gradient(90deg, #10b981, #06b6d4); }
    .kpi-purple::after{ background: linear-gradient(90deg, #8b5cf6, #ec4899); }
    .kpi-red::after   { background: linear-gradient(90deg, #ef4444, #f97316); }
    .kpi-icon-wrap {
      width: 48px; height: 48px; flex-shrink: 0;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .kpi-body { flex: 1; }
    .kpi-value { font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1; margin-bottom: 5px; letter-spacing: -0.5px; }
    .kpi-label { font-size: 12px; color: #64748b; font-weight: 500; letter-spacing: 0.2px; }
    .kpi-trend { margin-left: auto; }

    /* Section title */
    .section-title {
      font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
      text-transform: uppercase; color: #94a3b8;
      margin: 4px 0 12px;
    }

    /* Type cards */
    .type-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .type-card {
      background: white;
      border-radius: 14px;
      padding: 24px 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border: 1px solid #e8edf4;
      text-align: center;
      transition: box-shadow 0.2s, transform 0.2s;
      &:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.09); transform: translateY(-2px); }
    }
    .type-icon {
      width: 54px; height: 54px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 14px;
      mat-icon { font-size: 26px; }
    }
    .type-count { font-size: 32px; font-weight: 700; margin-bottom: 3px; letter-spacing: -0.5px; }
    .type-label { font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 10px; }
    .type-amount { font-size: 15px; font-weight: 700; color: #0f172a; }

    /* Balance cards */
    .balance-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .balance-card {
      background: white;
      border-radius: 14px;
      padding: 22px 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border: 1px solid #e8edf4;
      transition: box-shadow 0.2s, transform 0.2s;
      &:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.09); transform: translateY(-2px); }
    }
    .balance-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
    .balance-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 22px; }
    }
    .balance-title { font-size: 14px; font-weight: 600; color: #0f172a; }
    .balance-sub { font-size: 12px; color: #94a3b8; margin-top: 3px; }
    .balance-amount { font-size: 30px; font-weight: 700; color: #ef4444; margin-bottom: 14px; letter-spacing: -0.5px; }
    .balance-link {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; color: #6366f1; font-weight: 600;
      text-decoration: none;
      padding: 4px 0;
      border-bottom: 1px solid transparent;
      transition: border-color 0.15s;
      &:hover { border-bottom-color: #6366f1; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);
  stats: DashboardStats | null = null;
  loading = true;

  ngOnInit() {
    this.api.getDashboardStats().subscribe({
      next: (data) => { this.stats = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}
