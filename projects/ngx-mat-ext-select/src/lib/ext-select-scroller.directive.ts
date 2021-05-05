import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Directive, ElementRef, Optional } from '@angular/core';

/**
 * Scrolls to an element within list.  If there is a CdkVirtualScrollViewport, uses
 * that api to scroll, otherwise use the elementRef (should be a MatSelectionList)
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '[ngxScroller]'
})
export class ScrollerDirective {
  constructor(private selectionList: ElementRef, @Optional() private viewport: CdkVirtualScrollViewport) { }

  public scrollTo(index: number, itemHeight: number): void {
    if (this.viewport) {
      this.viewport.scrollToIndex(index, 'auto');
    } else { this.selectionList.nativeElement.scrollTop = index * itemHeight; }
  }
}
