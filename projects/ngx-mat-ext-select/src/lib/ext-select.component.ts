import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input,
  OnDestroy, OnInit, Output, ViewChild, ViewEncapsulation
} from '@angular/core';
import { ControlValueAccessor, FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { NgxMatSearchboxComponent, SearchData, SearchResults, SearchTerms } from '@fgrid-ngx/mat-searchbox';
import { MdePopoverTrigger } from '@fgrid-ngx/mde';
import { BehaviorSubject, combineLatest, Observable, of, Subscription } from 'rxjs';
import { catchError, distinctUntilKeyChanged, filter, map, switchMap, take } from 'rxjs/operators';
import { ScrollerDirective } from './ext-select-scroller.directive';
import { arrowDropDownImage, imagePlaceholder } from './ext-select.images';
import { SelectedItem, SelectItem, SelectItemIcon, SelectItems } from './ext-select.model';
import { enableControls } from './ext-select.utils';

/**
 * Implements a select (drop-down) component which has the following capabilities in addition to the standard mat-select
 * 1>  Multi-row labels 2> search field.  Otherwise it is designed to work much as the standard mat-select
 * component as possible (single selection only)
 */
@Component({
  // tslint:disable-next-line:component-selector
  selector: 'ngx-mat-ext-select',
  exportAs: 'ngxMatExtSelect',
  templateUrl: './ext-select.component.html',
  styleUrls: ['./ext-select.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => NgxMatExtSelectComponent),
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class NgxMatExtSelectComponent implements OnInit, OnDestroy, ControlValueAccessor {

  /**
   * Reference to virtual scrolling viewport for list
   */
  @ViewChild('viewport')
  private viewport?: CdkVirtualScrollViewport;

  /**
   * References the popup trigger i.e. the text field
   */
  @ViewChild(MdePopoverTrigger)
  private trigger?: MdePopoverTrigger;

  /**
   * References the Search component (if included)
   */
  @ViewChild('search')
  private searchComponent?: NgxMatSearchboxComponent;

  /**
   * Scroller directive on either a cdkVirtualViewport or on MatSelectionList
   */
  @ViewChild(ScrollerDirective)
  private scroller?: ScrollerDirective;

  /**
   * Data source for select - keep both a map and an array for improved performance
   */
  private selectItemsSource: SelectItems = new Map();

  private selectItemsArray: BehaviorSubject<SelectItem[]> = new BehaviorSubject([] as SelectItem[]);

  public selectItems$: Observable<SelectItem[]> = of([]);

  @Input()
  public get selectItems(): SelectItems | null | undefined { return this.selectItemsSource; }
  public set selectItems(selectItems: SelectItems | null | undefined) {
    if (!selectItems) {
      this.selectItemsSource = new Map();
      this.selectItemsArray.next([]);
    }
    else {
      // include the key value in the SelectItem object in case not there
      Array.from(selectItems.entries()).forEach(([key, selectItem], index) => {
        selectItem.value = key;
        selectItem.index = index;
      });

      // extract array
      this.selectItemsSource = selectItems;
      const items = this.selectItemsAsArray(selectItems);

      // register / load icons included in items (if any)
      this.loadImages(items);

      // set in BehaviorSubject
      this.selectItemsArray.next(items);
    }
    this.setSelectFieldEnabledState();

    // set status to start on reload of the component, so that DOM is rebuilt
    if (this.popupStatus.value !== 'start') { this.popupStatus.next('start'); }
  }

  /**
   * Placeholder and label for select component
   */
  @Input() public selectPlaceholder = 'Select item';

  /**
   * Fixed height of each list item.  The default is a reasonable size
   * for a two-line display
   */
  @Input() public selectItemHeight = 55;

  /**
   * The width of the field displaying the selection
   */
  @Input() public selectFieldWidth = 350;

  /**
   * Width of drop down.  If not set then the same as the select field width
   */
  private ddWidth = 0;

  @Input()
  public get selectDDWidth(): number {
    const width = this.ddWidth <= 0 ? this.selectFieldWidth : this.ddWidth;

    // if there is a search field ensure that the width is at least 250
    if (this.selectSearch && width < 250) { return 250; }
    return width;
  }
  public set selectDDWidth(width: number) { this.ddWidth = width; }

  /**
   * The minimum number of items that will be visible in
   * the scrolling viewport (if item count exceeds this value)
   */
  @Input() public selectNoItemsVisible = 5;

  /**
   * If there is an icon associated with the selected item, display
   * it in the field as well as in the drop-down list
   */
  @Input() public selectDisplayIconInField = true;

  /**
   * Determine if this component is disabled.  Does not apply when
   * the component is part of a form, in which case the component need to
   * be disabled and enabled via the FornControl or FormGroup
   */
  private disabled = false;

  @Input()
  public get selectDisabled(): boolean { return this.disabled || !this.selectItems || this.selectItems.size === 0; }
  public set selectDisabled(disabled: boolean) {
    this.disabled = disabled;
    this.setSelectFieldEnabledState();
  }

  /**
   * Determine the currently selected item.  This can be used to specify the initially
   * selected item for the component.  If the input is attached to an observable, allows the
   * currenly selected item to be adjusted from an external action (i.e. other than a selection in
   * the drop down list)
   */
  private sselectedItem?: SelectedItem | null;

  @Input()
  public get selectedItem(): SelectedItem | undefined | null { return this.sselectedItem; }
  public set selectedItem(selectedItem: SelectedItem | undefined | null) {
    this.sselectedItem = selectedItem;
    this.updateSelectField(selectedItem);
    this.updateSelection(selectedItem);
  }

  /**
   * Applies angular material apperance to the field
   */
  @Input() public selectFieldAppearance: 'outline' | 'standard' | 'fill' | 'legacy' = 'outline';

  /**
   * If 'small' then the field has a font of 9pt and the margins, padding etc. are reduced so that
   * the field can comfortably fit on a toolbar.
   */
  @Input() public selectFieldSize: 'small' | 'default' = 'small';

  /**
   * Vertical offset relative to top-left of select field that popup is displyed
   */
  private ddoffsetY?: number = undefined;

  @Input()
  public get selectDDOffsetY(): number {
    if (this.ddoffsetY !== undefined) { return this.ddoffsetY; }
    return this.selectFieldSize === 'small' ? 15 : 20;
  }
  public set selectDDOffsetY(offset: number) { this.ddoffsetY = offset; }

  /**
   * Horizontal offset relative to top-left of select field that popup is displyed
   */
  private ddoffsetX = 0;

  @Input()
  public get selectDDOffsetX(): number { return this.ddoffsetX; }
  public set selectDDOffsetX(offset: number) { this.ddoffsetX = offset; }

  /**
   * Determines if virtual scrolling should be used for list.  Virtual scrolling
   * is more efficient in terms of DOM usage for large lists, but scrolling might not
   * be as smooth for smaller lists - repainting is slower
   */
  @Input() public selectVirtualScroll = true;

  /**
   * When the dropdown list closes in response to a click outside the component,
   * determines whether to propogate the click to an underlying component.  If set to true, a single click
   * both closes the dropdown and operates on the component on which the click occurs.  If
   * set to false, a second click is needed on the underlying component.
   */
  @Input() public selectPropogateBackdropClick = false;

  /**
   * Determines if there is a search component appearing on top of the list
   */
  @Input() public selectSearch = true;

  /**
   * Determines if the extended search capabilities are provided in the
   * search component
   */
  @Input() public searchExtended = true;

  /**
   * Panel to enter extended search params open on hovering over
   * extended (+) button.  This determines how long the dealy is in milliseconds
   * before the appears.
   */
  @Input() public searchExtendedPopupDelay = 1000;

  /**
   * Strip these characters from the fields when matching to the search
   * expression
   */
  @Input() public searchExcludeChars: string[] = [];

  /**
   * Localization of searchbox
   */
  @Input() public searchTerms: SearchTerms = {};

  /**
   * Determines if search happens on each key stroke or only when search button is clicked (or on enter key stoke)
   */
  @Input() public searchContinuous = true;

  /**
   * Determine if search looks for first match and then each click of the button looks for next match,
   * or whether all occurrences are searched for in each search request (=true)
   */
  private multiple = false;
  @Input()
  public get searchMultiple(): boolean { return (this.multiple || this.searchFilter) && this.selectSearch; }
  public set searchMultiple(searchMultiple: boolean) { this.multiple = searchMultiple; }

  /**
   * Determines whether the search should filter the matched list items (true)
   * of hightlight them instead (false)
   */
  private filter = false;
  @Input()
  public get searchFilter(): boolean { return this.filter && this.selectSearch; }
  public set searchFilter(searchFilter: boolean) { this.filter = searchFilter; }

  /**
   * When searching for next match, skip other matched entries in cells on same row
   */
  @Input() public searchNextRow = true;

  /**
   * When doing continuous searches, the debounce time in milliseconds to be applied to key stokes
   */
  @Input() public searchDebounceMS = 200;

  /**
   * Determine is the search comparison are case sensitive by default
   */
  @Input() public searchCaseSensitive = false;

  /**
   * Determine if search string is to be identified only at the start of the searched value,
   * otherwise it can occur anywhere in the value
   */
  @Input() public searchStartsWith = false;

  /**
   * Independently supplied data for search.  If not set, the data set for the search is
   * automatically derived from the selection data (value, label text).  If supplied separately,
   * the rows in the search dataset must be a one-to-one match with the select dataset, i.e one search row
   * per select row, in the same order
   */
  private searchDataSource = new BehaviorSubject<SearchData>([]);

  @Input()
  public set searchData(searchData: SearchData) {
    this.searchDataSource.next(searchData);
  }

  /**
   * Observable to deliver search data set to search component. This is derived
   * from input data (value + label text), but can be overridden by search dataset which is independently
   * supplied
   */
  public searchData$: Observable<SearchData> = of([]);

  /**
   * Reports a selection change to the parent
   */
  @Output() public itemSelected: EventEmitter<SelectedItem> = new EventEmitter();

  /**
   * Form used to bind controls (field and list) to a model
   */
  public selectForm = new FormGroup({});

  /**
   * Tracks results of search
   */
  private searchResults: BehaviorSubject<SearchResults> = new BehaviorSubject([] as SearchResults);

  /**
   * Used to track and unsubsribe from all subscriptions
   */
  private subscriptions: Subscription = new Subscription();

  /**
   * Tracks status of popup
   */
  public popupStatus: BehaviorSubject<'start' | 'opening' | 'open' | 'closed'> =
    new BehaviorSubject('start' as 'start' | 'opening' | 'open' | 'closed');

  /**
   * Tracks icon of currently selected item
   */
  public currentIcon: BehaviorSubject<SelectItemIcon> = new BehaviorSubject<SelectItemIcon>({ type: 'svg', id: '' });

  /**
   * Determine whether the control has been touched for the first time
   */
  private touched = false;

  constructor(
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer) {

    // load drop-down arrow image into registry
    this.loadImageLiteral('ngx-mat-ext-select-ddarrow', arrowDropDownImage);

    // current item list, which can change dynamically, and if search filer is on will be limited
    // by the search criteria
    this.selectItems$ = combineLatest([this.selectItemsArray, this.searchResults]).pipe(
      map(([selectItems, searchResults]) => {

        // determine if filtering should occur - if not return all items
        if (!this.searchFilter) { return selectItems; }

        // if the search is not valid i.e. if the search string or range is empty then return all items
        if (!searchResults.searchParams ||
          (searchResults.searchParams.search.trim().length === 0 && !searchResults.searchParams.searchRange)) { return selectItems; }

        // filter items based on search rows found
        const searchRows = Array.from(new Set(searchResults.map(searchResult => searchResult.rowIndex)));
        return selectItems.filter((item, index) => searchRows.includes(index));
      })
    );

    // search data is either supplied or mapped from select data if not supplied
    this.searchData$ = combineLatest([
      this.selectItemsArray,
      this.searchDataSource
    ]).pipe(map((([derived, supplied]) => {
      if (!this.selectSearch) { return []; }
      return supplied && supplied.length > 0 ?
        supplied :
        derived.map(selectItem => [selectItem.value, ...selectItem.labels.map(label => label.text)]);
    })));
  }

  public ngOnInit(): void {
    // get the initially selected item from input, if supplied
    let initSelectedItem = this.selectedItem;

    // if a selected item is not specified via input, attempt to get the value from the dataset, else
    // assume the first item is selected
    const selectItems = this.selectItemsArray.getValue();
    if (!initSelectedItem && (selectItems.length ?? 0) > 0) {
      initSelectedItem = selectItems
        .filter(item => !!item.selected).map(item => ({ value: item.value ?? '', display: item.display }))[0];
      if (!initSelectedItem) {
        initSelectedItem = { ...selectItems[0], value: selectItems[0].value ?? '' };
      }
    }

    // define form controls with initial values
    this.trackCurrentIcon(initSelectedItem?.value);
    const selectField = new FormControl(initSelectedItem?.display.trimRight() || null);
    const selectList = new FormControl(initSelectedItem?.value ? [initSelectedItem.value] : []);
    this.selectForm.addControl('selectField', selectField);
    this.selectForm.addControl('selectList', selectList);

    // set initial enabled state
    this.setSelectFieldEnabledState();

    // listen to list selection changes
    this.subscriptions.add(selectList.valueChanges
      .pipe(map((changes: string[]) => ({ key: changes.join(), changes })),
        distinctUntilKeyChanged('key'))
      .subscribe(c => this.listSelectionChanged(c.changes)));
  }

  /**
   * Determine the appropriate height for the drop-down vieport component
   */
  public get viewportHeight(): number {
    const noItems = Math.min(this.selectNoItemsVisible, this.selectItems?.size ?? 0);
    return noItems * this.selectItemHeight;
  }

  /**
   * Remaps the SelectItems structure to an array of SelectItem, in map insert order
   */
  private selectItemsAsArray(selectItems: SelectItems | null | undefined): SelectItem[] {
    if (!selectItems) { return []; }
    return Array.from(selectItems.values());
  }

  /**
   * Gets currently selected value in the list
   */
  public getSelectedValue(): string | number | undefined {
    const selectList = this.selectForm.get('selectList');
    if (!selectList) { return undefined; }
    return ((selectList.value ?? []) as (string | number)[])[0];
  }

  /**
   * Sets currently selected value and emits event to parent
   */
  public setSelectedValue(value: string | number | undefined): void {
    const selectList = this.selectForm.get('selectList');
    if (!selectList) { return; }
    const changes = value && this.selectItems?.get(value) ? [value] : [];
    if (value === this.getSelectedValue()) { return; }
    selectList.setValue(changes, { emitEvent: true });
    this.ensureSelectionVisible();
  }

  /**
   * Update the selection field with the current selection
   */
  private updateSelectField(selectedItem: SelectedItem | undefined | null): void {
    const selectField = this.selectForm.get('selectField');
    if (!selectField) { return; }
    const currentValue = selectField.value;

    // update currently selected item text if changed from current selection
    if (currentValue !== (selectedItem?.display.trimRight() || null)) {
      this.selectForm.patchValue({ selectField: selectedItem?.display.trimRight() || null }, { emitEvent: false });
    }

    // update currently selected item icon
    this.trackCurrentIcon(selectedItem?.value);
  }

  /**
   * Track icon to be displayed in field
   */
  private trackCurrentIcon(value: string | number | undefined): void {
    const placeholder: SelectItemIcon = { type: 'svg', id: '' };
    if (!this.selectDisplayIconInField || !value) {
      this.currentIcon.next(placeholder);
      return;
    }
    const icon = this.selectItems?.get(value)?.icon || placeholder;
    const currentIcon = this.currentIcon.getValue();
    if (currentIcon.type === icon.type && currentIcon.id === icon.id) { return; }
    this.currentIcon.next(icon);
  }

  /**
   * Update the currently selected value for the list. Since this is likely called form the
   * parent component, an event is not emitted (avoid circular calls)
   */
  private updateSelection(selectedItem: SelectedItem | undefined | null): void {
    const selectList = this.selectForm.get('selectList');
    if (!selectList) { return; }

    // check if current selection is the same
    if (selectedItem?.value === this.getSelectedValue()) { return; }

    selectList.setValue(selectedItem ? [selectedItem.value] : [], { emitEvent: false });
  }

  /**
   * Enable or disable the component.  If there are no selection items, the component is
   * always disabled.  Otherwise determined by input selectDisabled
   */
  private setSelectFieldEnabledState(): void {
    this.trigger?.closePopover();
    enableControls(this.selectForm, !this.selectDisabled);
  }

  /**
   * Scrolls the viewport so the currently selected item is visible
   */
  private ensureSelectionVisible(): void {
    const value = this.getSelectedValue();
    if (!value || !this.selectItems || this.selectItems.size === 0) { return; }
    this.valueToListIndex(value).pipe(take(1)).subscribe(listIndex => {
      if (listIndex < 0) { return; }
      this.scrollTo(listIndex);
    });
  }

  /** Scrolls to  list index */
  private scrollTo(listIndex: number): void {
    if (!this.scroller) { return; }
    this.scroller.scrollTo(listIndex, this.selectItemHeight);
  }

  /**
   * A selection change in the list has occurred.  This will sync the associated text field,
   * emit the selected item to the parent, and close the popup
   */
  private listSelectionChanged(changes: string[]): void {
    if (changes.length === 0) {
      this.itemSelected.emit();
      this.trigger?.closePopover();
      return;
    }
    const value = changes[0];
    const selectItem = this.selectItems?.get(value);
    if (!selectItem) {
      this.itemSelected.emit();
      this.trigger?.closePopover();
      return;
    }
    const selectedItem: SelectedItem = { value, display: selectItem.display };

    // update text field
    this.updateSelectField(selectedItem);

    // emit change
    this.itemSelected.emit(selectedItem);

    // control value accessor
    this.onChange(selectedItem.value);

    // close the popup
    this.trigger?.closePopover();
  }

  /**
   * ngFor trackby function for items displayed in popup list
   */
  public listTrackBy(index: number, item: SelectItem): string {
    return `${item.value}${item.display}`;
  }

  /**
   * Detect click on an option, and if popup is still open, close it
   */
  public clickOption(): void {
    if (this.popupStatus.getValue() === 'open') { this.trigger?.closePopover(); }
  }

  /**
   * Calculate style for an option line
   */
  public getLineStyle(
    lineNo: number,
    style: Record<string, string | undefined | null> | undefined,
    fontSizePt: number | undefined): Record<string, string | undefined | null> {
    const cstyle = style ? { ...style } : {};

    // if the font size is defined, put it in style, overriding any existing font-style
    if (fontSizePt) {
      cstyle['font-size'] = `${fontSizePt}pt`;
    }

    // if no font-size specified in style then put in a default
    if (!cstyle['font-size']) {
      cstyle['font-size'] = `${lineNo === 0 ? 10 : 9}pt`;
    }
    return cstyle;
  }

  /**
   * Responds to users Search field result emission
   */
  public searched(searchResults: SearchResults): void {
    this.searchResults.next(searchResults);

    // scroll to the first found item to ensure it is visible
    if (searchResults.length > 0 && !this.searchFilter) {
      const dataIndex = searchResults[0].rowIndex;
      this.dataToListIndex(dataIndex).pipe(take(1)).subscribe(listIndex =>
        this.scrollTo(listIndex));
    }
  }

  /**
   * Used for each option in list, to query as to whether it is current search found set
   */
  public searchValueFound(value: number | string): Observable<boolean> {
    return this.searchResults.pipe(
      // map to array of unique rows found in search
      map(searchResults => Array.from(new Set(searchResults.map(searchResult => searchResult.rowIndex)))),
      // convert to values
      switchMap(searchRows => this.dataIndiciesToValues(searchRows)),
      // does it include this value
      filter(values => values.includes(value)),
      // map to true if value found
      map(values => values.length > 0)
    );
  }

  /**
   * Popup opened
   */
  public opened(): void {
    const scrollToVisible = (this.selectItems?.get(this.getSelectedValue() || '')?.index ?? 0) >= this.selectNoItemsVisible;

    if (this.popupStatus.getValue() !== 'start') {
      setTimeout(() => {
        this.checkViewportSize();
        if (scrollToVisible) { this.ensureSelectionVisible(); }
        this.popupStatus.next('open');
      });
    } else {
      // delay rendering of virtual scroll on first-open to get around a Firefox rendering issue
      setTimeout(() => {
        this.popupStatus.next('opening'); // allows dom to be populated
        setTimeout(() => {
          this.checkViewportSize();
          if (scrollToVisible) { this.ensureSelectionVisible(); }
          this.popupStatus.next('open'); // list becomes visible
        });
      });
    }
  }

  /**
   * Adjusts size of virtual scrolling viewport if necessary
   */
  private checkViewportSize(): void {
    if (this.selectVirtualScroll) {
      if (!this.viewport?.getViewportSize()) {
        this.viewport?.checkViewportSize();
      }
    }
  }

  /**
   * Popup closed
   */
  public closed(): void {
    // reset the search component
    this.popupStatus.next('closed');
    if (this.selectSearch) {
      this.searchResults.next([]);
      this.searchComponent?.clearSearchField();
    }
  }

  /**
   * Loads an SVG image to the MatIconRegistry from a string literal,
   * representing an svg
   */
  private loadImageLiteral(iconId: string, svg: string): void {
    this.iconRegistry.addSvgIconLiteral(
      iconId,
      this.sanitizer.bypassSecurityTrustHtml(svg)
    );
  }

  /**
   * Registers and preloads SVG image from url
   */
  private loadImage(iconId: string, url: string): void {
    // register the image
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.iconRegistry.addSvgIcon(iconId, safeUrl);

    // preload the image
    this.iconRegistry.getSvgIconFromUrl(safeUrl).pipe(take(1), catchError(e => {
      this.loadImageLiteral(iconId, imagePlaceholder);
      return of();
    })).subscribe();
  }

  /**
   * Registers and preloads SVG images contained in a list of items, if url is provided
   */
  private loadImages(items: SelectItem[]): void {
    Array.from(items
      .filter(selectItem => selectItem.icon && selectItem.icon.type === 'svg' && selectItem.icon.url)
      .map(selectItem => [selectItem.icon?.id ?? '', selectItem.icon?.url ?? ''])
      .reduce((m, [id, url]) => {
        if (m.has(id)) { return m; }
        m.set(id, url);
        return m;
      }, new Map<string, string>())
      .entries())
      .forEach(([id, url]) => this.loadImage(id, url));
  }

  /**
   * Get the current index in list for a item value
   */
  private valueToListIndex(value: string | number | undefined): Observable<number> {
    return this.selectItems$.pipe(map(selectItems => selectItems.findIndex(selectItem => selectItem.value === value)));
  }

  /**
   * Get value in full selectItem data set for an index
   */
  private dataIndexToValue(dataIndex: number): Observable<string | number | undefined> {
    return this.selectItemsArray.pipe(map(selectItems => selectItems[dataIndex]?.value));
  }

  /**
   * Get values for list of full dataset indexes
   */
  private dataIndiciesToValues(dataIndicies: number[]): Observable<(string | number)[]> {
    if (dataIndicies.length === 0) { return of([]); }
    return this.selectItemsArray.pipe(
      map(selectItems => selectItems.filter((selectItem, index) => dataIndicies.includes(index))),
      map(selectItems => selectItems.map(selectItem => selectItem?.value || '')));
  }

  /**
   * Convert from full dataset index to current list index
   */
  private dataToListIndex(dataIndex: number): Observable<number> {
    return this.dataIndexToValue(dataIndex).pipe(switchMap(value => this.valueToListIndex(value)));
  }

  /** Implementation for ControlValueAccessor */
  private onChange = (value: string | number | undefined) => { };

  private onTouched = () => { };

  public writeValue(value: string | number | undefined): void {
    this.setSelectedValue(value);
  }

  public registerOnChange(fn: (value: number | string | undefined) => void): void {
    this.onChange = (value: number | string | undefined) => {
      fn(value);
      this.markAsTouched();
    };
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(disabled: boolean): void {
    this.selectDisabled = disabled;
  }

  private markAsTouched(): void {
    if (!this.touched) {
      this.onTouched();
      this.touched = true;
    }
  }

  /**
   * Unsubscribe active subscriptions
   */
  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.searchResults.complete();
    this.selectItemsArray.complete();
    this.popupStatus.complete();
  }
}
