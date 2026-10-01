import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="toast-host">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div class="toast" [class]="toast.type" role="status">
          <mat-icon class="lead">{{ toastSvc.icon(toast.type) }}</mat-icon>
          <span class="toast-msg">{{ toast.message }}</span>
          @if (toast.actionLabel) {
            <button class="toast-action" (click)="run(toast.id, toast.action)">
              {{ toast.actionLabel }}
            </button>
          }
          <button class="icon-btn" (click)="toastSvc.dismiss(toast.id)" aria-label="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  toastSvc = inject(ToastService);

  run(id: number, action?: () => void) {
    action?.();
    this.toastSvc.dismiss(id);
  }
}
