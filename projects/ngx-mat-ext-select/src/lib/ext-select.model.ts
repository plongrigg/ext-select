/**
 * Report change in item selection
 */
export type SelectedItem = {
  value: string | number;
  display: string;
};

/**
 * Label (potentially multiple labels for each item)
 */
export type SelectItemLabel = {
  text: string;
  fontSizePt?: number;
  style?: Record<string, string | undefined | null>;
};

/**
 * Icon to prefix item display
 */
export type SelectItemIcon = {
  type: 'basic' | 'svg', id: string,  // if an svg it should be registered in the icon registry, basic is a css based icon
  url?: string,                       // if provided, the svg will be registered and preloaded,
                                      // otherwise the host application is assumed to have registered the svg
  fieldDisplayIconGapPx?: number      // gap between icon and display in the field, needed if icon does not include a whitespace border
};

/**
 * List item
 */
export type SelectItem = {
  value?: string | number;   // no need to populate this field for input, as it is the key of the map
  index?: number;            // no need to populate this field for input
  icon?: SelectItemIcon;
  labels: SelectItemLabel[];
  display: string;         // single-line representation of item for field display
  selected?: boolean;      // initially selected item
};

/**
 * Map of items to be displayed in a drop-down list, keyed by value
 */
export type SelectItems = Map<string | number, SelectItem>;
