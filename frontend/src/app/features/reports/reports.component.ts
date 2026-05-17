import { Component, OnInit, inject, signal, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatProgressBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Reports & Analytics</h1>
      </div>

      @if (loading) { <mat-progress-bar mode="indeterminate" style="border-radius:4px;margin-bottom:16px" /> }

      <!-- Revenue Chart Card -->
      <div class="report-card" style="margin-bottom:24px">
        <div class="report-card-header">
          <div class="report-card-title">
            <mat-icon style="color:#6366f1">bar_chart</mat-icon>
            Monthly Revenue
          </div>
        </div>
        <canvas #monthlyChart style="width:100%;max-height:280px"></canvas>
      </div>

      <!-- Monthly stats grid -->
      @if (monthlyData().length) {
        <div class="month-grid" style="margin-bottom:24px">
          @for (item of monthlyData(); track item.month) {
            <div class="month-tile">
              <div class="month-name">{{ item.month_label || item.month }}</div>
              <div class="month-total">{{ item.total | currency:'USD':'symbol':'1.0-0' }}</div>
              <div class="month-count">{{ item.count }} sales</div>
            </div>
          }
        </div>
      }

      <!-- AI Analysis -->
      <div class="report-card">
        <div class="report-card-header">
          <div class="report-card-title">
            <mat-icon style="color:#8b5cf6">auto_awesome</mat-icon>
            AI Financial Analysis
          </div>
        </div>
        <div style="padding:20px">
          <div class="ai-query">
            <mat-form-field appearance="outline" style="flex:1">
              <mat-label>Ask a financial question</mat-label>
              <input matInput [(ngModel)]="aiQuery" placeholder="e.g. What are my top selling products this month?">
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="runAiAnalysis()" [disabled]="!aiQuery || aiLoading"
              style="height:56px;min-width:120px">
              @if (aiLoading) { <mat-spinner diameter="20"></mat-spinner> } @else { <mat-icon>send</mat-icon> }
              {{ aiLoading ? 'Analyzing...' : 'Analyze' }}
            </button>
          </div>

          @if (aiResponse()) {
            <div class="ai-response">
              <div class="ai-response-header">
                <mat-icon style="color:#8b5cf6">psychology</mat-icon>
                <strong>AI Response</strong>
              </div>
              <div style="white-space:pre-wrap;line-height:1.75;color:#1e293b">{{ aiResponse() }}</div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .report-card {
      background: white; border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .report-card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      display: flex; align-items: center; justify-content: space-between;
    }
    .report-card-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 15px; font-weight: 600; color: #0f172a;
    }
    canvas { display: block; padding: 16px; }
    .month-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
    }
    .month-tile {
      background: white; border-radius: 10px;
      border: 1px solid #e2e8f0; padding: 16px 14px;
      text-align: center;
    }
    .month-name { font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 6px; }
    .month-total { font-size: 16px; font-weight: 700; color: #0f172a; }
    .month-count { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .ai-query { display: flex; gap: 12px; align-items: flex-end; margin-bottom: 16px; }
    .ai-response {
      background: #f5f3ff; border-left: 4px solid #8b5cf6;
      padding: 16px 20px; border-radius: 8px;
    }
    .ai-response-header { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
  `]
})
export class ReportsComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);

  @ViewChild('monthlyChart') chartRef!: ElementRef<HTMLCanvasElement>;

  monthlyData = signal<any[]>([]);
  loading = false;
  aiQuery = '';
  aiLoading = false;
  aiResponse = signal<string | null>(null);

  ngOnInit() {
    this.loading = true;
    this.api.getMonthlySalesReport().subscribe({
      next: (data) => { this.monthlyData.set(data.slice(-6)); this.loading = false; this.drawChart(); },
      error: () => this.loading = false,
    });
  }

  ngAfterViewInit() { this.drawChart(); }

  drawChart() {
    const data = this.monthlyData();
    if (!data.length || !this.chartRef) return;
    setTimeout(() => {
      const ctx = this.chartRef.nativeElement.getContext('2d');
      if (!ctx) return;
      const labels = data.map(d => d.month_label || d.month);
      const values = data.map(d => d.total);
      const width = this.chartRef.nativeElement.clientWidth || 600;
      const height = 250;
      this.chartRef.nativeElement.width = width;
      this.chartRef.nativeElement.height = height;
      const max = Math.max(...values) || 1;
      const barW = Math.floor(width / labels.length) - 10;
      values.forEach((v, i) => {
        const barH = (v / max) * (height - 50);
        const x = i * (barW + 10) + 10;
        const y = height - barH - 28;
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, '#818cf8');
        grad.addColorStop(1, '#6366f1');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 4);
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x + barW / 2, height - 8);
        if (v > 0) {
          ctx.fillStyle = '#0f172a';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText('$' + (v / 1000).toFixed(1) + 'k', x + barW / 2, y - 4);
        }
      });
    }, 100);
  }

  runAiAnalysis() {
    if (!this.aiQuery) return;
    this.aiLoading = true;
    this.api.analyzeWithAI({ query: this.aiQuery }).subscribe({
      next: (res) => { this.aiResponse.set(res.analysis || res.message || JSON.stringify(res)); this.aiLoading = false; },
      error: (err) => { this.aiLoading = false; this.aiResponse.set(err.error?.detail || 'AI analysis failed.'); }
    });
  }
}
