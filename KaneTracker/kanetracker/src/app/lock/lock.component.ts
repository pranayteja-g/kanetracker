import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LockService } from './lock.service';

@Component({
  selector: 'app-lock',
  standalone: true,
  imports: [NgFor, NgIf, MatIconModule],
  template: `
    <div class="lock" role="dialog" aria-label="App locked">
      <mat-icon class="ic">lock</mat-icon>
      <p class="msg" [class.err]="err">{{ msg }}</p>
      <div class="dots"><i *ngFor="let d of [0,1,2,3]" [class.on]="pin.length > d"></i></div>
      <div class="pad">
        <button *ngFor="let k of keys" (click)="press(k)" [attr.aria-label]="k === 'x' ? 'Delete' : k">
          <mat-icon *ngIf="k === 'x'">backspace</mat-icon><ng-container *ngIf="k !== 'x' && k !== 'b'">{{ k }}</ng-container>
          <mat-icon *ngIf="k === 'b'">fingerprint</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .lock { position: fixed; inset: 0; z-index: 10000; background: var(--k-bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
    .ic { font-size: 36px; width: 36px; height: 36px; color: var(--k-muted); }
    .msg { color: var(--k-muted); font-size: 14px; min-height: 20px; }
    .msg.err { color: #dc2626; }
    .dots { display: flex; gap: 16px; }
    .dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--k-ink); }
    .dots i.on { background: var(--k-ink); }
    .pad { display: grid; grid-template-columns: repeat(3, 72px); gap: 14px; margin-top: 8px; }
    .pad button { height: 72px; border-radius: 50%; border: 1px solid var(--k-line); background: var(--k-surface); font-size: 24px; display: grid; place-items: center; }
    .pad button:empty { visibility: hidden; }
    .pad button:active { background: var(--k-line); }
  `],
})
export class LockComponent {
  lock = inject(LockService);
  pin = '';
  msg = 'Enter PIN';
  err = false;

  get keys() {
    return ['1', '2', '3', '4', '5', '6', '7', '8', '9', this.lock.hasBio() ? 'b' : '', '0', 'x'];
  }

  constructor() {
    if (this.lock.hasBio()) this.bio();
  }

  async press(k: string) {
    if (k === 'b') return this.bio();
    if (k === 'x') { this.pin = this.pin.slice(0, -1); return; }
    if (!k || this.pin.length >= 4) return;
    this.pin += k;
    if (this.pin.length < 4) return;
    const r = await this.lock.verify(this.pin);
    this.pin = '';
    this.err = r !== 'ok';
    this.msg = r === 'bad' ? 'Wrong PIN' : r === 'wait' ? 'Too many tries. Wait 30s' : 'Enter PIN';
  }

  async bio() {
    if (await this.lock.unlockBio()) return;
    this.msg = 'Use PIN';
  }
}
