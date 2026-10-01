import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** Promise-based confirmation modal — replaces browser confirm(). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private _request = signal<ConfirmRequest | null>(null);
  readonly request = this._request.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._request.set({ ...options, resolve });
    });
  }

  respond(value: boolean) {
    const current = this._request();
    this._request.set(null);
    current?.resolve(value);
  }
}
