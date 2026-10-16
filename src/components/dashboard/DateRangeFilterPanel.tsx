import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button, Card, CardContent, Input, Label } from '@/components/ui';
import { OVERVIEW_PRESETS } from '@/hooks/overviewQuery';
import type { OverviewPresetKey } from '@/hooks/overviewQuery';

export interface DateRangeFilterPanelProps {
  /** Prefix for input ids so multiple panels on one page never collide. */
  idPrefix: string;
  title: string;
  description: string;
  pendingPreset: OverviewPresetKey;
  pendingStart: string;
  pendingEnd: string;
  rangeError: string | null;
  /** Applied-range summary line (with optional unsaved-changes hint). */
  summary: ReactNode;
  onSelectPreset: (preset: OverviewPresetKey) => void;
  onDateChange: (which: 'start' | 'end', value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

/**
 * Shared presentational date-range filter card. State lives in the parent so
 * each tab keeps an independent applied range; this component only renders.
 * Date math, validation, and timezone behavior come from overviewQuery and
 * are intentionally not duplicated here.
 */
export function DateRangeFilterPanel({
  idPrefix,
  title,
  description,
  pendingPreset,
  pendingStart,
  pendingEnd,
  rangeError,
  summary,
  onSelectPreset,
  onDateChange,
  onApply,
  onReset,
}: DateRangeFilterPanelProps) {
  return (
    <section aria-label="Date range filter">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight text-foreground">{title}</h2>
                <p className="truncate text-xs text-muted-foreground sm:whitespace-normal">{description}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1" role="group" aria-label="Date range presets">
              {OVERVIEW_PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  size="sm"
                  variant={pendingPreset === preset.key ? 'primary' : 'ghost'}
                  onClick={() => onSelectPreset(preset.key)}
                  aria-pressed={pendingPreset === preset.key}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5 sm:w-44">
                  <Label htmlFor={`${idPrefix}-start-date`}>Start date</Label>
                  <Input
                    id={`${idPrefix}-start-date`}
                    type="date"
                    value={pendingStart}
                    hasError={rangeError !== null}
                    onChange={(event) => onDateChange('start', event.target.value)}
                  />
                </div>
                <div className="min-w-0 space-y-1.5 sm:w-44">
                  <Label htmlFor={`${idPrefix}-end-date`}>End date</Label>
                  <Input
                    id={`${idPrefix}-end-date`}
                    type="date"
                    value={pendingEnd}
                    hasError={rangeError !== null}
                    onChange={(event) => onDateChange('end', event.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="flex-1 md:flex-none" onClick={onApply}>Apply</Button>
                <Button type="button" size="sm" variant="outline" className="flex-1 md:flex-none" onClick={onReset}>Reset</Button>
              </div>
            </div>
            {rangeError && <p role="alert" className="text-xs font-medium text-danger">{rangeError}</p>}
            <div className="border-t border-border pt-2.5">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {summary}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
