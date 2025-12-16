/**
 * ColorPicker Component
 * Displays Chrome's 9 tab group colors as clickable swatches
 */

import type { TabGroupColor } from '../../shared/types';
import { TAB_GROUP_COLORS, TAB_GROUP_COLOR_VALUES } from '../../shared/constants';

interface ColorPickerProps {
  /** Currently selected color */
  selectedColor: TabGroupColor;
  /** Callback when a color is selected */
  onColorSelect: (color: TabGroupColor) => void;
}

export function ColorPicker({ selectedColor, onColorSelect }: ColorPickerProps) {
  return (
    <div class="color-picker">
      {TAB_GROUP_COLORS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          class={`color-swatch ${selectedColor === value ? 'selected' : ''}`}
          style={{ backgroundColor: TAB_GROUP_COLOR_VALUES[value] }}
          onClick={() => onColorSelect(value)}
          title={label}
          aria-label={`Select ${label} color`}
          aria-pressed={selectedColor === value}
        />
      ))}
    </div>
  );
}

