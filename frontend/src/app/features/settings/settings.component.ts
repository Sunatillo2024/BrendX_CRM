import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Category, Color, Size } from '../../core/models/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatSelectModule, MatTableModule,
    MatSnackBarModule, MatProgressBarModule, MatTabsModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header"><h1>Settings</h1></div>

      <mat-tab-group>
        <!-- Categories Tab -->
        <mat-tab label="Categories">
          <div style="padding:16px">
            <form [formGroup]="catForm" (ngSubmit)="addCategory()" style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px">
              <mat-form-field appearance="outline">
                <mat-label>Category Name</mat-label>
                <input matInput formControlName="name">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Parent Category</mat-label>
                <mat-select formControlName="parent">
                  <mat-option [value]="null">Top Level</mat-option>
                  @for (c of categories(); track c.id) {
                    <mat-option [value]="c.id">{{ c.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-raised-button color="primary" type="submit" [disabled]="catForm.invalid">
                <mat-icon>add</mat-icon> Add
              </button>
            </form>
            <div class="data-table-container">
              <table mat-table [dataSource]="categories()">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Name</th>
                  <td mat-cell *matCellDef="let c">{{ c.name }}</td>
                </ng-container>
                <ng-container matColumnDef="description">
                  <th mat-header-cell *matHeaderCellDef>Description</th>
                  <td mat-cell *matCellDef="let c">{{ c.description || '—' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['name','description']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['name','description'];"></tr>
              </table>
            </div>
          </div>
        </mat-tab>

        <!-- Colors Tab -->
        <mat-tab label="Colors">
          <div style="padding:16px">
            <form [formGroup]="colorForm" (ngSubmit)="addColor()" style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px">
              <mat-form-field appearance="outline">
                <mat-label>Color Name</mat-label>
                <input matInput formControlName="name">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Hex Code</mat-label>
                <input matInput formControlName="hex_code" placeholder="#RRGGBB">
              </mat-form-field>
              <input type="color" [(ngModel)]="colorPickerValue" [ngModelOptions]="{standalone:true}"
                (input)="colorForm.get('hex_code')?.setValue(colorPickerValue)" style="height:56px;cursor:pointer">
              <button mat-raised-button color="primary" type="submit" [disabled]="colorForm.invalid">
                <mat-icon>add</mat-icon> Add
              </button>
            </form>
            <div class="data-table-container">
              <table mat-table [dataSource]="colors()">
                <ng-container matColumnDef="swatch">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let c">
                    <span class="color-circle" [style.background]="c.hex_code"></span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Name</th>
                  <td mat-cell *matCellDef="let c">{{ c.name }}</td>
                </ng-container>
                <ng-container matColumnDef="hex">
                  <th mat-header-cell *matHeaderCellDef>Hex</th>
                  <td mat-cell *matCellDef="let c"><code>{{ c.hex_code }}</code></td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['swatch','name','hex']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['swatch','name','hex'];"></tr>
              </table>
            </div>
          </div>
        </mat-tab>

        <!-- Sizes Tab -->
        <mat-tab label="Sizes">
          <div style="padding:16px">
            <form [formGroup]="sizeForm" (ngSubmit)="addSize()" style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px">
              <mat-form-field appearance="outline">
                <mat-label>Size Name</mat-label>
                <input matInput formControlName="name">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Type</mat-label>
                <mat-select formControlName="size_type">
                  <mat-option value="letter">Letter (XS, S, M, L, XL)</mat-option>
                  <mat-option value="numeric">Numeric (28, 30, 32...)</mat-option>
                  <mat-option value="age">Age (2Y, 4Y...)</mat-option>
                  <mat-option value="universal">Universal</mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-raised-button color="primary" type="submit" [disabled]="sizeForm.invalid">
                <mat-icon>add</mat-icon> Add
              </button>
            </form>
            <div class="data-table-container">
              <table mat-table [dataSource]="sizes()">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Name</th>
                  <td mat-cell *matCellDef="let s">{{ s.name }}</td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let s">{{ s.size_type }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['name','type']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['name','type'];"></tr>
              </table>
            </div>
          </div>
        </mat-tab>

        <!-- Users Tab (Admin only) -->
        @if (auth.isAdmin()) {
          <mat-tab label="Users">
            <div style="padding:16px">
              <div class="data-table-container">
                <table mat-table [dataSource]="users()">
                  <ng-container matColumnDef="username">
                    <th mat-header-cell *matHeaderCellDef>Username</th>
                    <td mat-cell *matCellDef="let u">{{ u.username }}</td>
                  </ng-container>
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Full Name</th>
                    <td mat-cell *matCellDef="let u">{{ u.first_name }} {{ u.last_name }}</td>
                  </ng-container>
                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let u">
                      <span class="badge badge-default">{{ u.role }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let u">
                      <span [class]="'badge ' + (u.is_active ? 'badge-success' : 'badge-default')">
                        {{ u.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="['username','name','role','status']"></tr>
                  <tr mat-row *matRowDef="let row; columns: ['username','name','role','status'];"></tr>
                </table>
              </div>
            </div>
          </mat-tab>
        }
      </mat-tab-group>
    </div>
  `,
  styles: [`.color-circle { display: inline-block; width: 24px; height: 24px; border-radius: 50%; border: 1px solid #ccc; }`]
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  categories = signal<Category[]>([]);
  colors = signal<Color[]>([]);
  sizes = signal<Size[]>([]);
  users = signal<any[]>([]);
  colorPickerValue = '#000000';

  catForm: FormGroup = this.fb.group({ name: ['', Validators.required], parent: [null] });
  colorForm: FormGroup = this.fb.group({ name: ['', Validators.required], hex_code: ['#000000', Validators.required] });
  sizeForm: FormGroup = this.fb.group({ name: ['', Validators.required], size_type: ['letter', Validators.required] });

  ngOnInit() {
    this.loadAll();
    if (this.auth.isAdmin()) {
      this.api.getUsers().subscribe(r => this.users.set(r.results || r));
    }
  }

  loadAll() {
    this.api.getCategories({ page_size: 100 }).subscribe(r => this.categories.set(r.results));
    this.api.getColors({ page_size: 100 }).subscribe(r => this.colors.set(r.results));
    this.api.getSizes({ page_size: 100 }).subscribe(r => this.sizes.set(r.results));
  }

  addCategory() {
    if (this.catForm.invalid) return;
    this.api.createCategory(this.catForm.value).subscribe({
      next: () => { this.catForm.reset(); this.api.getCategories({ page_size: 100 }).subscribe(r => this.categories.set(r.results)); this.snackBar.open('Category added!', '', { duration: 2000 }); },
      error: (err) => this.snackBar.open(err.error?.name?.[0] || 'Failed', 'Close', { duration: 3000 })
    });
  }

  addColor() {
    if (this.colorForm.invalid) return;
    this.api.createColor(this.colorForm.value).subscribe({
      next: () => { this.colorForm.reset({ hex_code: '#000000' }); this.api.getColors({ page_size: 100 }).subscribe(r => this.colors.set(r.results)); this.snackBar.open('Color added!', '', { duration: 2000 }); },
      error: (err) => this.snackBar.open(err.error?.name?.[0] || 'Failed', 'Close', { duration: 3000 })
    });
  }

  addSize() {
    if (this.sizeForm.invalid) return;
    this.api.createSize(this.sizeForm.value).subscribe({
      next: () => { this.sizeForm.reset({ size_type: 'letter' }); this.api.getSizes({ page_size: 100 }).subscribe(r => this.sizes.set(r.results)); this.snackBar.open('Size added!', '', { duration: 2000 }); },
      error: (err) => this.snackBar.open(err.error?.name?.[0] || 'Failed', 'Close', { duration: 3000 })
    });
  }
}
