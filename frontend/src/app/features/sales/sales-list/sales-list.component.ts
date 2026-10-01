import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { MoneyPipe, TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SaleListItem, User } from '../../../core/models/models';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, TranslatePipe, MoneyPipe],
  template: `
    <div class="page-head">
      <h1 class="page-title">{{ 'sales.title' | t }}</h1>
      <div class="period-bar">
        @for (p of periods; track p) {
          <button class="period-btn" [class.active]="period === p" (click)="setPeriod(p)">
            {{ ('common.' + p) | t }}
          </button>
        }
        @if (period === 'custom') {
          <input class="input" style="width:150px" type="date" [(ngModel)]="dateFrom"
                 (change)="load()">
          <input class="input" style="width:150px" type="date" [(ngModel)]="dateTo"
                 (change)="load()">
        }
        <select class="select" style="width:150px" [(ngModel)]="paymentFilter" (change)="load()">
          <option value="">{{ 'sales.paymentMethod' | t }}: {{ 'common.all' | t }}</option>
          <option value="cash">{{ 'payment.cash' | t }}</option>
          <option value="card">{{ 'payment.card' | t }}</option>
          <option value="mixed">{{ 'payment.mixed' | t }}</option>
        </select>
        @if (auth.isManager()) {
          <select class="select" style="width:170px" [(ngModel)]="cashierFilter"
                  (change)="load()">
            <option value="">{{ 'sales.cashier' | t }}: {{ 'common.all' | t }}</option>
            @for (u of employees(); track u.id) {
              <option [value]="u.id">{{ u.display_name || u.username }}</option>
            }
          </select>
        }
      </div>
    </div>

    <div class="page-body">
      <div class="card">
        @if (sales().length) {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'sales.number' | t }}</th>
                  <th>{{ 'common.date' | t }}</th>
                  <th>{{ 'sales.cashier' | t }}</th>
                  <th class="num">{{ 'sales.itemsCount' | t }}</th>
                  <th class="num">{{ 'common.total' | t }}</th>
                  <th>{{ 'sales.paymentMethod' | t }}</th>
                  <th>{{ 'common.status' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (sale of sales(); track sale.id) {
                  <tr>
                    <td class="strong">№{{ sale.sale_number }}</td>
                    <td class="nowrap small">{{ sale.created_at | date: 'dd.MM.yyyy HH:mm' }}</td>
                    <td>{{ sale.cashier_name }}</td>
                    <td class="num">{{ sale.item_count }}</td>
                    <td class="num strong">{{ sale.total_amount | money }}</td>
                    <td>
                      <span class="badge info">{{ ('payment.' + sale.payment_method) | t }}</span>
                    </td>
                    <td>
                      <span class="badge"
                            [class.success]="sale.status === 'completed'"
                            [class.warn]="sale.status === 'partially_refunded'"
                            [class.danger]="sale.status === 'refunded' || sale.status === 'cancelled'">
                        {{ ('sales.status.' + sale.status) | t }}
                      </span>
                    </td>
                    <td class="num">
                      <a class="btn sm" [routerLink]="['/sales', sale.id]">
                        <mat-icon>visibility</mat-icon>
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty">{{ 'common.noData' | t }}</div>
        }
      </div>
    </div>
  `,
})
export class SalesListComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  readonly periods: PeriodKey[] = ['today', 'yesterday', 'week', 'month', 'custom'];
  period: PeriodKey = 'today';
  dateFrom = new Date().toISOString().slice(0, 10);
  dateTo = new Date().toISOString().slice(0, 10);
  paymentFilter = '';
  cashierFilter = '';

  sales = signal<SaleListItem[]>([]);
  employees = signal<User[]>([]);

  ngOnInit() {
    this.load();
    if (this.auth.isManager()) {
      this.api.getUsers({ page_size: 200 }).subscribe(r => this.employees.set(r.results));
    }
  }

  setPeriod(period: PeriodKey) {
    this.period = period;
    this.load();
  }

  load() {
    const params: Record<string, any> = {
      page_size: 50,
      period: this.period,
      payment_method: this.paymentFilter || undefined,
      cashier: this.cashierFilter || undefined,
    };
    if (this.period === 'custom') {
      params['date_from'] = this.dateFrom;
      params['date_to'] = this.dateTo;
    }
    this.api.getSales(params).subscribe(r => this.sales.set(r.results));
  }
}
