import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../../core/services/api.service';
import { Color } from '../../../core/models/models';

@Component({
  selector: 'app-color-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatTableModule, MatSnackBarModule, MatProgressBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Colors</h1>
          <p style="color:#888;margin:0">Manage product colors</p>
        </div>
        <button mat-raised-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> New Color
        </button>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" style="margin-bottom:16px" /> }

      @if (showForm()) {
        <mat-card style="margin-bottom:16px">
          <mat-card-header>
            <mat-card-title>{{ editing() ? 'Edit Color' : 'New Color' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:16px">
            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
              <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="form.name" required>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Hex Code</mat-label>
                <input matInput [(ngModel)]="form.hex_code" placeholder="#RRGGBB">
                <mat-icon matSuffix [style.color]="form.hex_code">circle</mat-icon>
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

      <div class="data-table-container">
          <table mat-table [dataSource]="colors()" style="width:100%">
            <ng-container matColumnDef="swatch">
              <th mat-header-cell *matHeaderCellDef>Color</th>
              <td mat-cell *matCellDef="let c">
                <div style="width:24px;height:24px;border-radius:50%;border:1px solid #ccc"
                     [style.background]="c.hex_code"></div>
              </td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let c">{{ c.name }}</td>
            </ng-container>
            <ng-container matColumnDef="hex_code">
              <th mat-header-cell *matHeaderCellDef>Hex Code</th>
              <td mat-cell *matCellDef="let c">{{ c.hex_code }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let c">
                <button mat-icon-button (click)="openForm(c)" title="Edit">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="delete(c)" title="Delete">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols"></tr>
          </table>
          @if (!loading() && colors().length === 0) {
            <div style="text-align:center;padding:40px;color:#888">No colors found.</div>
          }
      </div>
    </div>
  `,
})
export class ColorListComponent implements OnInit {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  cols = ['swatch', 'name', 'hex_code', 'actions'];
  colors = signal<Color[]>([]);
  loading = signal(false);
  saving = signal(false);
  showForm = signal(false);
  editing = signal<Color | null>(null);
  form: { name: string; hex_code: string } = { name: '', hex_code: '#000000' };

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getColors().subscribe({
      next: res => { this.colors.set(res.results ?? (res as any)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(color?: Color) {
    this.editing.set(color ?? null);
    this.form = { name: color?.name ?? '', hex_code: color?.hex_code ?? '#000000' };
    this.showForm.set(true);
  }

  cancelForm() { this.showForm.set(false); this.editing.set(null); }

  save() {
    this.saving.set(true);
    const color = this.editing();
    const req = color
      ? this.api.updateColor(color.id, this.form)
      : this.api.createColor(this.form);
    req.subscribe({
      next: () => {
        this.snack.open(color ? 'Color updated' : 'Color created', 'OK', { duration: 3000 });
        this.cancelForm();
        this.load();
        this.saving.set(false);
      },
      error: () => { this.snack.open('Error saving color', 'OK', { duration: 3000 }); this.saving.set(false); },
    });
  }

  delete(color: Color) {
    if (!confirm(`Delete color "${color.name}"?`)) return;
    this.api.deleteColor(color.id).subscribe({
      next: () => { this.snack.open('Color deleted', 'OK', { duration: 3000 }); this.load(); },
      error: () => this.snack.open('Error deleting color', 'OK', { duration: 3000 }),
    });
  }
}
