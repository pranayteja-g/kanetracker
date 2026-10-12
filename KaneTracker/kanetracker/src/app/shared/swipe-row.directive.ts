import { Directive, ElementRef, EventEmitter, HostListener, Output, inject } from '@angular/core';

/** Swipe left → delete, right → edit. Vertical scroll is left alone. */
@Directive({ selector: '[kSwipe]', standalone: true, exportAs: 'kSwipe' })
export class SwipeRowDirective {
  @Output() swipeLeft = new EventEmitter<void>();
  @Output() swipeRight = new EventEmitter<void>();
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private x0 = 0; private y0 = 0; private dx = 0; private on = false; private lock: 'h' | 'v' | '' = '';
  /** Set after a swipe so the trailing click doesn't open the row. */
  swiped = false;

  @HostListener('touchstart', ['$event']) start(e: TouchEvent) {
    this.x0 = e.touches[0].clientX; this.y0 = e.touches[0].clientY; this.dx = 0; this.on = true; this.lock = ''; this.swiped = false;
    this.el.style.transition = 'none';
  }

  @HostListener('touchmove', ['$event']) move(e: TouchEvent) {
    if (!this.on) return;
    const dx = e.touches[0].clientX - this.x0, dy = e.touches[0].clientY - this.y0;
    if (!this.lock && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) this.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (this.lock !== 'h') return;
    this.dx = dx;
    this.el.style.transform = `translateX(${dx}px)`;
    this.el.dataset['dir'] = dx < 0 ? 'del' : 'edit';
  }

  @HostListener('touchend') end() {
    if (!this.on) return;
    this.on = false;
    const w = this.el.offsetWidth * 0.3;
    this.el.style.transition = 'transform .18s';
    this.el.style.transform = '';
    delete this.el.dataset['dir'];
    if (this.lock === 'h' && Math.abs(this.dx) > w) {
      this.swiped = true;
      setTimeout(() => (this.swiped = false), 350);
      (this.dx < 0 ? this.swipeLeft : this.swipeRight).emit();
    }
  }

  @HostListener('touchcancel') cancel() {
    this.on = false;
    this.el.style.transform = '';
  }
}
