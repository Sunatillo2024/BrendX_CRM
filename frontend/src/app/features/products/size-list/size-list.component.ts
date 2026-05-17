import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { Size } from '../../../core/models/models';

const SIZE_TYPES = ['clothing', 'footwear', 'general'];

@Component({
  selector: 'app-size-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatTableModule, MatSnackBarModule,
    MatProgressBarModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Sizes</h1>
          <p style="color:#888;margin:0">Manage product sizes</p>
        </div>
        <button mat-raised-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> New Size
        </button>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" style="margin-bottom:16px" /> }

      @if (showForm()) {
        <mat-card style="margin-bottom:16px">
          <mat-card-header>
            <mat-card-title>{{ editing() ? 'Edit Size' : 'New Size' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:16px">
            <div style="display:flex;gap:16px;flex-wrap:wrap">
              <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="form.name" required>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Type</mat-label>
                <mat-select [(ngModel)]="form.size_type">
                  @for (t of sizeTypes; track t) {
                    <mat-option [value]="t">{{ t | titlecase }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" style="width:120px">
                <mat-label>Display Order</mat-label>
                <input matInput type="number" [(ngModel)]="form.display_order">
              </mat-form-field>
            </div>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-button (click)="cancelForm()">Cancel</button>
            <button mat-raised-button color="primary" [disabled]="!form.name || saving()" (click)="save()">
              {{ saving() ? 'Saving...' : 'Save' }}
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <mat-card>
        <mat-card-content style="padding:0">
          <table mat-table [dataSource]="sizes()" style="width:100%">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let s">{{ s.name }}</td>
            </ng-container>
            <ng-container matColumnDef="size_type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let s">
                <span class="badge badge-accent">{{ s.size_type | titlecase }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="display_order">
              <th mat-header-cell *matHeaderCellDef>Order</th>
              <td mat-cell *matCellDef="let s">{{ s.display_order }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s">
                <button mat-icon-button (click)="openForm(s)" title="Edit">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="delete(s)" title="Delete">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols"></tr>
          </table>
          @if (!loading() && sizes().length === 0) {
            <div style="text-align:center;padding:40px;color:#888">No sizes found.</div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class SizeListComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  cols = ['name', 'size_type', 'display_order', 'actions'];
  sizeTypes = SIZE_TYPES;
  sizes = signal<Size[]>([]);
  loading = signal(false);
  saving = signal(false);
  showForm = signal(false);
  editing = signal<Size | null>(null);
  form: { name: string; size_type: string; display_order: number } = { name: '', size_type: 'general', display_order: 0 };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getSizes().subscribe({
      next: res => { this.sizes.set(res.results ?? (res as any)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(size?: Size) {
    this.editing.set(size ?? null);
    this.form = { name: size?.name ?? '', size_type: size?.size_type ?? 'general', display_order: size?.display_order ?? 0 };
    this.showForm.set(true);
  }

  cancelForm() { this.showForm.set(false); this.editing.set(null); }

  save() {
    this.saving.set(true);
    const size = this.editing();
    const req = size
      ? this.api.updateSize(size.id, this.form)
      : this.api.createSize(this.form);
    req.subscribe({
      next: () => {
        this.snack.open(size ? 'Size updated' : 'Size created', 'OK', { duration: 3000 });
        this.cancelForm();
        this.load();
        this.saving.set(false);
      },
      error: () => { this.snack.open('Error saving size', 'OK', { duration: 3000 }); this.saving.set(false); },
    });
  }

  delete(size: Size) {
    if (!confirm(`Delete size "${size.name}"?`)) return;
    this.api.deleteSize(size.id).subscribe({
      next: () => { this.snack.open('Size deleted', 'OK', { duration: 3000 }); this.load(); },
      error: () => this.snack.open('Error deleting size', 'OK', { duration: 3000 }),
    });
  }
}
