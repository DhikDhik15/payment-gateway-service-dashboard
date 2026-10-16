import { useState } from 'react';
import {
  OVERVIEW_PRESETS,
  defaultOverviewRange,
  isSameOverviewRange,
  presetDateRange,
  toOverviewParams,
  validateOverviewRange,
} from './overviewQuery';
import type { OverviewAppliedRange, OverviewPresetKey } from './overviewQuery';

/**
 * Canonical date-range filter state for one dashboard view. Each tab owns an
 * independent instance while sharing calculations, validation, and semantics.
 * Pending edits never trigger requests; only Apply commits the range.
 * Defaults to Last 7 Days.
 */
export function useDateRangeFilter() {
  const [applied, setApplied] = useState<OverviewAppliedRange>(() => defaultOverviewRange());
  const [pendingPreset, setPendingPreset] = useState<OverviewPresetKey>(applied.preset);
  const [pendingStart, setPendingStart] = useState(applied.start);
  const [pendingEnd, setPendingEnd] = useState(applied.end);
  const [rangeError, setRangeError] = useState<string | null>(null);

  // `to` is the exclusive end (midnight after the inclusive end day).
  // from/to belong in the query key so each range caches separately and a
  // slow response for an old range can never overwrite the current one.
  const params = toOverviewParams(applied);
  const appliedPresetLabel =
    OVERVIEW_PRESETS.find((preset) => preset.key === applied.preset)?.label ?? 'Custom';
  const pendingDirty =
    !isSameOverviewRange(
      { preset: pendingPreset, start: pendingStart, end: pendingEnd },
      applied,
    ) && rangeError === null;

  const selectPreset = (preset: OverviewPresetKey) => {
    setPendingPreset(preset);
    setRangeError(null);
    if (preset !== 'custom') {
      const { start, end } = presetDateRange(preset);
      setPendingStart(start);
      setPendingEnd(end);
    }
  };

  const handleCustomDateChange = (which: 'start' | 'end', value: string) => {
    setPendingPreset('custom');
    setRangeError(null);
    if (which === 'start') setPendingStart(value);
    else setPendingEnd(value);
  };

  const applyRange = () => {
    const validationError = validateOverviewRange(pendingStart, pendingEnd);
    if (validationError) {
      setRangeError(validationError);
      return false;
    }
    setRangeError(null);
    const next: OverviewAppliedRange = { preset: pendingPreset, start: pendingStart, end: pendingEnd };
    // Identical key → React Query serves cache; no duplicate request.
    if (!isSameOverviewRange(next, applied)) setApplied(next);
    return true;
  };

  const resetRange = () => {
    const defaults = defaultOverviewRange();
    setApplied(defaults);
    setPendingPreset(defaults.preset);
    setPendingStart(defaults.start);
    setPendingEnd(defaults.end);
    setRangeError(null);
  };

  return {
    applied,
    pendingPreset,
    pendingStart,
    pendingEnd,
    rangeError,
    params,
    appliedPresetLabel,
    pendingDirty,
    selectPreset,
    handleCustomDateChange,
    applyRange,
    resetRange,
  };
}
