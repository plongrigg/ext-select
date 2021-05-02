import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ContentChild, ContentChildren, Directive, ElementRef, QueryList } from '@angular/core';
import { MatListOption } from '@angular/material/list';

/**
 * Scrolls to an mat-list-option within a mat-selection-list.  This directive should be placed on one of the following:
 * 1> on a mat-selection-list element, containing a cdkVirtualViewport, which in turn contains a list of mat-list-option elements
 * 2> on a mat-selection-list element, directly containing a list of mat-list-option.
 * 3> on the mat-list-option element itself
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '[ngxScrollTo]',
  exportAs: 'ngxScroller'
})
export class ScrollToDirective {

  /** list of options within either the mat selection list or the virtual viewport */
  @ContentChildren(MatListOption, { read: ElementRef }) options?: QueryList<ElementRef>;

  /** virtual viewport if existing */
  @ContentChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

  constructor(private elementRef: ElementRef) { }

  /** relevant when the directive has been placed on a mat-list-option element  */
  public scrollTo(): void {
    setTimeout(() =>
      this.elementRef.nativeElement.scrollIntoView({ behavior: 'auto' }));
  }

  /** relevant when the directive has been placed on mat-selection-list */
  public scrollToIndex(listIndex: number): void {
    setTimeout(() => {
      if (this.viewport) {
        this.viewport.scrollToIndex(listIndex);
      } else {
        const option = this.options?.get(listIndex);
        if (!option) { return; }
        option.nativeElement.scrollIntoView({ behavior: 'auto' });
      }
    });
  }
}
