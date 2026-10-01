import { Pipe, PipeTransform, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TranslationService } from './translation.service';

/** Usage: {{ 'menu.pos' | t }}  /  {{ 'payment' | t: row.payment_method }} */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(TranslationService);

  transform(key: string | null | undefined, suffix?: string | null): string {
    if (!key) return '';
    return this.i18n.t(suffix ? `${key}.${suffix}` : key);
  }
}

/** Money with a thousand separator, e.g. 4 600 сом */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, showCurrency = true): string {
    const amount = Number(value ?? 0);
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
    return showCurrency ? `${formatted} ${environment.currency}` : formatted;
  }
}
