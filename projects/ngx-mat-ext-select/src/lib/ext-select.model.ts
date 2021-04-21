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
export type SelectItemIcon = { type: 'basic' | 'svg', id: string, fieldDisplayGapPx?: number };

/**
 * List item
 */
export type SelectItem = {
  value: string | number;
  icon?: SelectItemIcon;
  labels: SelectItemLabel[];
  display: string;
  selected?: boolean;
};

/**
 * Map of items to be displayed in a drop-down list, keyed by value
 */
export type SelectItems = Map<string | number, SelectItem>;
