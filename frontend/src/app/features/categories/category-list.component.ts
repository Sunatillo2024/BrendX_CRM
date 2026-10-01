import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { Category } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, TranslatePipe],
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ 'categories.title' | t }}</h1>
        <div class="page-sub">{{ categories().length }} {{ 'categories.title' | t }}</div>
      </div>
      <button class="btn primary" (click)="openCreate()">
        <mat-icon>add</mat-icon> {{ 'categories.new' | t }}
      </button>
    </div>

    <div class="page-body">
      <div class="card pad-0">
        @if (categories().length) {
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ 'categories.name' | t }}</th>
                  <th>{{ 'categories.description' | t }}</th>
                  <th class="num">{{ 'categories.productCount' | t }}</th>
                  <th>{{ 'common.status' | t }}</th>
                  <th class="actions"></th>
                </tr>
              </thead>
              <tbody>
                @for (c of categories(); track c.id) {
                  <tr>
                    <td class="strong">{{ c.name }}</td>
                    <td class="muted">{{ c.description || '—' }}</td>
                    <td class="num">
                      <span class="chip">{{ c.product_count }}</span>
                    </td>
                    <td>
                      <span class="badge" [class.success]="c.is_active" [class.danger]="!c.is_active">
                        <span class="dot"></span>
                        {{ (c.is_active ? 'common.active' : 'common.inactive') | t }}
                      </span>
                    </td>
                    <td class="actions">
                      <button class="icon-btn" (click)="edit(c)" [matTooltip]="'common.edit' | t">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button class="icon-btn" (click)="remove(c)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-state">
            <mat-icon>category</mat-icon>
            <h4>{{ 'categories.emptyTitle' | t }}</h4>
            <p>{{ 'categories.emptyHint' | t }}</p>
            <button class="btn primary" (click)="openCreate()">
              <mat-icon>add</mat-icon> {{ 'categories.new' | t }}
            </button>
          </div>
        }
      </div>
    </div>

    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" style="max-width:440px" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ (editing ? 'categories.edit' : 'categories.new') | t }}</h3>
            <button class="icon-btn" (click)="close()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label class="field-label">{{ 'categories.name' | t }} *</label>
              <input class="input" [(ngModel)]="form.name" name="name" autofocus>
            </div>
            <div class="field mt-12">
              <label class="field-label">{{ 'categories.description' | t }}</label>
              <textarea class="textarea" [(ngModel)]="form.description" name="description"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="close()">{{ 'common.cancel' | t }}</button>
            <button class="btn primary" [disabled]="!form.name || saving()" (click)="save()">
              {{ saving() ? ('common.loading' | t) : ('common.save' | t) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CategoryListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private i18n = inject(TranslationService);

  categories = signal<Category[]>([]);
  modalOpen = signal(false);
  saving = signal(false);
  form: any = { name: '', description: '' };
  editing: Category | null = null;

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.getCategories({ page_size: 200 }).subscribe(r => this.categories.set(r.results));
  }

  openCreate() {
    this.editing = null;
    this.form = { name: '', description: '' };
    this.modalOpen.set(true);
  }

  edit(category: Category) {
    this.editing = category;
    this.form = { name: category.name, description: category.description };
    this.modalOpen.set(true);
  }

  close() {
    this.modalOpen.set(false);
  }

  save() {
    if (!this.form.name) return;
    this.saving.set(true);
    const request = this.editing
      ? this.api.updateCategory(this.editing.id, this.form)
      : this.api.createCategory(this.form);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t('common.saved'));
        this.close();
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.i18n.t('common.error'));
      },
    });
  }

  async remove(category: Category) {
    const approved = await this.confirm.confirm({
      title: this.i18n.t('categories.deleteTitle'),
      message: `${category.name}`,
      confirmLabel: this.i18n.t('common.delete'),
      danger: true,
    });
    if (!approved) return;

    this.api.deleteCategory(category.id).subscribe({
      next: (res: any) => {
        if (res?.deactivated) {
          this.toast.warn(this.i18n.t('categories.deactivated'));
        } else {
          this.toast.success(this.i18n.t('common.deleted'));
        }
        this.load();
      },
      error: () => this.toast.error(this.i18n.t('common.error')),
    });
  }
}
