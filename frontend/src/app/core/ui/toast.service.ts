import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warn' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  actionLabel?: string;
  action?: () => void;
  /** ms; 0 = stay until dismissed */
  duration: number;
}

const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warn: 'warning_amber',
  info: 'info',
};

/**
 * Consistent toast notifications for the whole CRM.
 * Success/info/warn auto-dismiss; toasts with an action stay longer.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private seq = 1;

  icon(type: ToastType): string {
    return ICONS[type];
  }

  success(message: string, duration = 2600) {
    return this.push('success', message, duration);
  }

  error(message: string, duration = 4200) {
    return this.push('error', message, duration);
  }

  warn(message: string, duration = 3600) {
    return this.push('warn', message, duration);
  }

  info(message: string, duration = 3000) {
    return this.push('info', message, duration);
  }

  /** A toast with an action button (e.g. "Print receipt"). */
  withAction(type: ToastType, message: string, actionLabel: string, action: () => void,
             duration = 8000) {
    return this.push(type, message, duration, actionLabel, action);
  }

  dismiss(id: number) {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(type: ToastType, message: string, duration: number,
               actionLabel?: string, action?: () => void) {
    const id = this.seq++;
    this._toasts.update(list => [...list, { id, type, message, duration, actionLabel, action }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }
}
