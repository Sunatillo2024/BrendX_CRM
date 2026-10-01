import { Component, HostListener, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    @if (confirmSvc.request(); as req) {
      <div class="modal-backdrop" (click)="confirmSvc.respond(false)">
        <div class="modal" style="max-width:420px" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="flex gap-12" style="align-items:flex-start">
              <div class="stat-icon" [class.danger]="req.danger">
                <mat-icon>{{ req.danger ? 'warning_amber' : 'help' }}</mat-icon>
              </div>
              <div>
                <h3>{{ req.title }}</h3>
                @if (req.message) {
                  <p class="muted" style="margin:6px 0 0;font-size:13px;line-height:1.5">
                    {{ req.message }}
                  </p>
                }
              </div>
            </div>
            <button class="icon-btn" (click)="confirmSvc.respond(false)" aria-label="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="confirmSvc.respond(false)">
              {{ req.cancelLabel || ('common.cancel' | t) }}
            </button>
            <button class="btn" [class.primary]="!req.danger" [class.danger]="req.danger"
                    (click)="confirmSvc.respond(true)">
              {{ req.confirmLabel || ('common.confirm' | t) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  confirmSvc = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.confirmSvc.request()) this.confirmSvc.respond(false);
  }
}
