import { Directive, ElementRef } from '@angular/core';

/**
 * Scrolls to an element within list (non-virtual scrolling)
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '[ngxScrollTo]'
})
export class ScrollToDirective {

  constructor(private elementRef: ElementRef) { }

  public scrollTo(): void {
    setTimeout(() =>
      this.elementRef.nativeElement.scrollIntoView({ behavior: 'auto' }));
  }

}
