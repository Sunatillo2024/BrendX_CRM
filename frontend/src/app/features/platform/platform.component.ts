import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-body" style="max-width:1200px;margin:auto">
      <div class="page-head"><h1>{{ text('Platforma boshqaruvi', 'Управление платформой') }}</h1>
        <div class="btn-row"><button class="btn" (click)="i18n.setLang(i18n.lang() === 'ru' ? 'uz' : 'ru')">RU / UZ</button>
        <button class="btn" (click)="auth.logout()">{{ text('Chiqish', 'Выйти') }}</button></div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        @for (k of counters; track k.key) {
          <div class="card"><div class="muted">{{ text(k.uz,k.ru) }}</div><h2>{{ stats()[k.key] || 0 }}</h2></div>
        }
      </div>
      <div class="card mt-16">
        <h3>{{ text('Yangi do‘kon va Owner', 'Новый магазин и владелец') }}</h3>
        <form (ngSubmit)="create()" class="form-grid">
          <div class="field"><label>{{ text('Do‘kon nomi', 'Название магазина') }}</label><input class="input" name="name" [(ngModel)]="form.name" required></div>
          <div class="field"><label>{{ text('Do‘kon kodi', 'Код магазина') }}</label><input class="input" name="code" [(ngModel)]="form.code" required pattern="[A-Za-z0-9_-]{2,40}"></div>
          <div class="field"><label>{{ text('Owner ismi', 'Имя владельца') }}</label><input class="input" name="owner" [(ngModel)]="form.owner_name" required></div>
          <div class="field"><label>PIN</label><input class="input" name="pin" type="password" inputmode="numeric" [(ngModel)]="form.owner_pin" required pattern="[0-9]{4,8}"></div>
          <div class="field"><label>{{ text('Til', 'Язык') }}</label><select class="select" name="language" [(ngModel)]="form.owner_language"><option value="ru">Русский</option><option value="uz">O‘zbekcha</option></select></div>
          <button class="btn primary" type="submit" [disabled]="busy()">{{ text('Do‘kon yaratish', 'Создать магазин') }}</button>
        </form>
      </div>
      <div class="card mt-16">
        <div class="btn-row"><input class="input" [(ngModel)]="search" [placeholder]="text('Qidirish','Поиск')"><button class="btn" (click)="loadStores()">{{ text('Qidirish','Поиск') }}</button></div>
        <table class="data"><thead><tr><th>{{ text('Do‘kon','Магазин') }}</th><th>{{ text('Kod','Код') }}</th><th>{{ text('Holat','Статус') }}</th><th></th></tr></thead>
          <tbody>@for (s of stores(); track s.id) {<tr><td>{{ s.name }}</td><td>{{ s.code }}</td><td>{{ s.is_active ? text('Faol','Активен') : text('Nofaol','Неактивен') }}</td><td><button class="btn sm" (click)="open(s)">{{ text('Ochish','Открыть') }}</button></td></tr>}</tbody>
        </table>
        <div class="btn-row"><button class="btn" [disabled]="page === 1" (click)="page=page-1;loadStores()">←</button><span>{{ page }}</span><button class="btn" [disabled]="!hasNext()" (click)="page=page+1;loadStores()">→</button></div>
      </div>
      @if (selected(); as s) {
        <div class="card mt-16">
          <h2>{{ s.name }}</h2>
          <p>{{ text('Xodimlar','Сотрудники') }}: {{ s.employees_count }} · {{ text('Mahsulotlar','Товары') }}: {{ s.products_count }} · {{ text('Bugungi sotuvlar','Продажи сегодня') }}: {{ s.sales_today }}</p>
          <p>{{ text('Oxirgi kirish','Последний вход') }}: {{ s.last_activity | date:'dd.MM.yyyy HH:mm' }}</p>
          @for (owner of s.owners; track owner.id) {<p>Owner: {{ owner.display_name }}</p>}
          <p>{{ text('Kirish havolasi','Ссылка для входа') }}: <a [href]="'/store/'+s.code+'/login'" target="_blank" rel="noopener">/store/{{ s.code }}/login</a></p>
          <div class="form-grid"><input class="input" [(ngModel)]="s.name"><input class="input" [(ngModel)]="s.phone" [placeholder]="text('Telefon','Телефон')"><input class="input" [(ngModel)]="s.address" [placeholder]="text('Manzil','Адрес')"></div>
          <div class="btn-row mt-16"><button class="btn primary" (click)="save(s)">{{ text('Saqlash','Сохранить') }}</button><button class="btn" (click)="pendingToggle.set(s)">{{ s.is_active ? text('O‘chirish emas: deaktivatsiya','Деактивировать') : text('Faollashtirish','Активировать') }}</button></div>
          @if (pendingToggle()) {<div class="alert mt-16"><p>{{ text('Do‘kon kirishini o‘zgartirishni tasdiqlaysizmi? Ma’lumotlar saqlanadi.','Подтвердить изменение доступа? Данные сохранятся.') }}</p><button class="btn danger" (click)="toggle(s)">{{ text('Tasdiqlash','Подтвердить') }}</button><button class="btn" (click)="pendingToggle.set(null)">{{ text('Bekor qilish','Отмена') }}</button></div>}
          <h3 class="mt-16">{{ text('Owner boshqaruvi','Управление владельцем') }}</h3>
          <form (ngSubmit)="owner(s)" class="form-grid"><input class="input" name="oname" [(ngModel)]="ownerForm.name" required [placeholder]="text('Ism','Имя')"><input class="input" name="opin" type="password" inputmode="numeric" [(ngModel)]="ownerForm.pin" required pattern="[0-9]{4,8}" placeholder="PIN"><select class="select" name="olang" [(ngModel)]="ownerForm.language"><option value="ru">Русский</option><option value="uz">O‘zbekcha</option></select><button class="btn" type="submit" [disabled]="busy()">{{ text('Ownerni saqlash','Сохранить владельца') }}</button></form>
        </div>
      }
    </div>
  `,
})
export class PlatformComponent {
  private http = inject(HttpClient);
  auth = inject(AuthService);
  i18n = inject(TranslationService);
  private toast = inject(ToastService);
  stats = signal<any>({}); stores = signal<any[]>([]); selected = signal<any>(null);
  pendingToggle = signal<any>(null); busy = signal(false); hasNext = signal(false);
  search = ''; page = 1;
  form = { name: '', code: '', owner_name: '', owner_pin: '', owner_language: 'ru' };
  ownerForm = { name: '', pin: '', language: 'ru' };
  counters = [
    {key:'total_stores',uz:'Do‘konlar',ru:'Магазины'}, {key:'active_stores',uz:'Faol do‘konlar',ru:'Активные'},
    {key:'inactive_stores',uz:'Nofaol do‘konlar',ru:'Неактивные'}, {key:'total_users',uz:'Xodimlar',ru:'Сотрудники'},
    {key:'total_owners',uz:'Ownerlar',ru:'Владельцы'}, {key:'total_sales_transactions',uz:'Sotuvlar soni',ru:'Количество продаж'},
  ];
  constructor() { this.load(); }
  text(uz: string, ru: string) { return this.i18n.lang() === 'ru' ? ru : uz; }
  load() { this.http.get<any>(environment.apiUrl+'/platform/dashboard/').subscribe(v=>this.stats.set(v)); this.loadStores(); }
  loadStores() { this.http.get<any>(environment.apiUrl+'/platform/stores/',{params:{search:this.search,page:this.page}}).subscribe({next:r=>{this.stores.set(r.results);this.hasNext.set(!!r.next);},error:e=>this.error(e)}); }
  open(s:any) { this.http.get<any>(environment.apiUrl+'/platform/stores/'+s.id+'/').subscribe(v=>{this.selected.set(v);this.pendingToggle.set(null);this.ownerForm={name:v.owners[0]?.display_name || '',pin:'',language:v.owners[0]?.language || 'ru'};}); }
  create() { this.busy.set(true);this.http.post<any>(environment.apiUrl+'/platform/stores/',this.form).subscribe({next:s=>{this.busy.set(false);this.form={name:'',code:'',owner_name:'',owner_pin:'',owner_language:'ru'};this.load();this.open(s);},error:e=>this.error(e)}); }
  save(s:any) { this.http.patch(environment.apiUrl+'/platform/stores/'+s.id+'/',{name:s.name,phone:s.phone,address:s.address}).subscribe({next:()=>this.load(),error:e=>this.error(e)}); }
  toggle(s:any) { this.http.patch(environment.apiUrl+'/platform/stores/'+s.id+'/',{is_active:!s.is_active}).subscribe({next:()=>{this.open(s);this.load();},error:e=>this.error(e)}); }
  owner(s:any) { this.busy.set(true);this.http.post(environment.apiUrl+'/platform/stores/'+s.id+'/manage_owner/',this.ownerForm).subscribe({next:()=>{this.busy.set(false);this.ownerForm.pin='';this.open(s);},error:e=>this.error(e)}); }
  error(e:any) { this.busy.set(false);this.toast.error(JSON.stringify(e.error || this.text('Xatolik','Ошибка')).slice(0,220)); }
}
