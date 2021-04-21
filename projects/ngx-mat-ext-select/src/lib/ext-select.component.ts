import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input,
  OnDestroy, OnInit, Output, ViewChild, ViewEncapsulation
} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { NgxMatSearchboxComponent, SearchData, SearchResult, SearchTerms } from '@fgrid-ngx/mat-searchbox';
import { MdePopoverTrigger } from '@fgrid-ngx/mde';
import { enableControls } from './ext-select.utils';
import { BehaviorSubject, combineLatest, Observable, of, Subscription } from 'rxjs';
import { distinctUntilKeyChanged, filter, map } from 'rxjs/operators';
import { SelectedItem, SelectItem, SelectItemIcon, SelectItems } from './ext-select.model';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { arrowDropDownImage } from './ext-searchbox.images';

/** TODO:
 * filter option instead of search
 * separate dataset for search
 */


/**
 * Implements a select (drop-down) component which has the following capabilities in addition to the standard mat-select
 * 1>  Multi-row labels 2> search field.  Otherwise it is designed to work much as the standard mat-select
 * component as possible (single selection only)
 */
@Component({
  // tslint:disable-next-line:component-selector
  selector: 'ngx-mat-ext-select',
  templateUrl: './ext-select.component.html',
  styleUrls: ['./ext-select.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class NgxMatExtSelectComponent implements OnInit, OnDestroy {

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
   * Data source for select
   */
  private selectItemsSource: BehaviorSubject<SelectItems> = new BehaviorSubject(new Map());

  public selectItems$: Observable<SelectItem[]> = of([]);

  @Input()
  public get selectItems(): SelectItems | null | undefined { return this.selectItemsSource.value; }
  public set selectItems(selectItems: SelectItems | null | undefined) {
    if (!selectItems) {
      this.selectItemsSource.next(new Map());
    }
    else {
      // include the key value in the SelectItem object in case not there
      Array.from(selectItems.entries()).forEach(([key, selectItem]) => {
        selectItem.value = key;
      });
      this.selectItemsSource.next(selectItems);
    }
    this.setSelectFieldEnabledState();

    // determine if icon included in any display and if not set the firstOpen to true
    let icons = false;
    if (selectItems) {
      icons = Array.from(selectItems.values()).some(selectItem => !!selectItem.icon);
    }
    if (!icons && !this.firstOpen.value) { this.firstOpen.next(true); }
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
  public get selectDDWidth(): number { return this.ddWidth <= 0 ? this.selectFieldWidth : this.ddWidth; }
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
   * Determine if this component is disabled
   */
  private disabled = false;

  @Input()
  public get selectDisabled(): boolean { return this.disabled || !this.selectItems || this.selectItems.size === 0; }
  public set selectDisabled(disabled: boolean) {
    this.disabled = disabled;
    this.setSelectFieldEnabledState();
  }

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
  @Input() public searchMultiple = false;

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
   * automatically derived from the selection data (value, label text)
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
   * Reports a selection change to the parent
   */
  @Output() public itemSelected: EventEmitter<SelectedItem> = new EventEmitter();

  /**
   * Form used to bind controls (field and list) to a model
   */
  public selectForm = new FormGroup({});

  /**
   * Tracks row(s) found on search
   */
  private rowsFound: BehaviorSubject<number[]> = new BehaviorSubject(new Array<number>());

  /**
   * Used to track and unsubsribe from all subscriptions
   */
  private subscriptions: Subscription = new Subscription();

  /**
   * Tracks when popup if opened for the first time
   */
  public firstOpen: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Tracks icon of currently selected item
   */
  public currentIcon: BehaviorSubject<SelectItemIcon> = new BehaviorSubject<SelectItemIcon>({ type: 'svg', id: '' });

  constructor(
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer) {

    // load drop-down arrow image into registry
    this.loadImage('ngx-mat-ext-select-ddarrow', arrowDropDownImage);

    // current item list, which can change dynamically
    this.selectItems$ = this.selectItemsSource
      .pipe(map(selectItems => this.selectItemsAsArray(selectItems)));

    // search data is either supplied or mapped from select data if not supplied
    this.searchData$ = combineLatest([
      this.selectItems$,
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
    if (!initSelectedItem && (this.selectItems?.size ?? 0) > 0) {
      const items = this.selectItemsAsArray(this.selectItems);
      initSelectedItem = items
        .filter(item => !!item.selected).map(item => ({ value: item.value ?? '', display: item.display }))[0];
      if (!initSelectedItem) {
        initSelectedItem = { ...items[0], value: items[0].value ?? '' };
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

    // listen to selection changes
    this.subscriptions.add(selectList.valueChanges
      .pipe(map((changes: string[]) => ({ key: changes.join(), changes })),
        distinctUntilKeyChanged('key'))
      .subscribe(c => this.listSelectionChanged(c.changes)));
  }

  /**
   * Determine the appropriate height for the drop-down component
   */
  public get dropDownHeight(): number {
    let height = this.selectSearch ? 52 : 0; // space for searchbox + gap

    const noItems = Math.min(this.selectNoItemsVisible, this.selectItems?.size ?? 0);
    height += (noItems * this.selectItemHeight);

    return height;
  }

  /**
   * Remaps the SelectItems structure to an array of SelectItem
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
    this.ensureSelectionVisible();
    selectList.setValue(changes, { emitEvent: true });
  }

  /**
   * Update the selection field with the current selection
   */
  private updateSelectField(selectedItem: SelectedItem | undefined | null): void {
    const selectField = this.selectForm.get('selectField');
    if (!selectField) { return; }
    const currentValue = selectField.value;
    if (currentValue === selectedItem?.display.trimRight() || null) { return; }
    this.selectForm.patchValue({ selectField: selectedItem?.display.trimRight() || null }, { emitEvent: false });

    // update currently selected item
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
    const icon = Array.from(this.selectItems?.values() || []).find(selectItem => selectItem.value === value)?.icon || placeholder;
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
    enableControls(this.selectForm, !this.selectDisabled);
  }

  /**
   * Scrolls the viewport so the currently selected item is visible
   */
  private ensureSelectionVisible(): void {
    const value = this.getSelectedValue();
    if (!value || !this.selectItems || this.selectItems.size === 0) { return; }
    const index = Array.from(this.selectItems.keys()).indexOf(value);
    if (index < 0) { return; }
    this.viewport?.scrollToOffset(this.selectItemHeight * index);
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
   * Calculate style for an option line
   */
  public getLineStyle(lineNo: number, style: Record<string, string> | undefined, fontSizePt: number | undefined): Record<string, string> {
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
  public searched(searchResults: SearchResult[]): void {
    this.rowsFound.next(Array.from(new Set(searchResults.map(searchResult => searchResult.rowIndex))));

    // scroll to the first found item to ensure it is visible
    if (searchResults.length > 0) {
      this.viewport?.scrollToOffset(this.selectItemHeight * (searchResults[0].rowIndex));
    }
  }

  /**
   * Used for each option in list, to query as to whether it is current search found set
   */
  public searchRowFound(row: number): Observable<boolean> {
    return this.rowsFound.pipe(filter(rows => rows.includes(row)), map(rows => rows.length > 0));
  }

  /**
   * Popup opened
   */
  public opened(): void {
    // adjust viewport if necessary
    if (isNaN(this.viewport?.getRenderedRange().start ?? 0) || isNaN(this.viewport?.getRenderedRange().end ?? 0)) {
      this.viewport?.setRenderedRange({ start: 0, end: 0 }); // will adjust
      this.viewport?.setRenderedContentOffset(0);
    }
    this.viewport?.checkViewportSize();

    setTimeout(() => {
      // delay rendering of virtual scroll on first-open to get around a Firefox rendering issue
      // when there are icons involved
      if (!this.firstOpen.value) {
        this.firstOpen.next(true);
      }

      // scroll to currently selected item
      this.ensureSelectionVisible();
    });
  }

  /**
   * Popup closed
   */
  public closed(): void {
    // reset the search component
    if (this.selectSearch) {
      this.rowsFound.next([]);
      this.searchComponent?.clearSearchField();
    }
  }


  /**
   * Loads an SVG image to the MatIconRegistry from a string literal,
   * representing an svg
   */
  private loadImage(
    iconName: string,
    svg: string
  ): void {
    this.iconRegistry.addSvgIconLiteral(
      iconName,
      this.sanitizer.bypassSecurityTrustHtml(svg)
    );
  }

  /**
   * Unsubscribe active subscriptions
   */
  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.rowsFound.complete();
    this.selectItemsSource.complete();
  }
}
