/**
 * Format a number as Indonesian Rupiah.
 * Used for display only — never for calculations.
 */
export function formatCurrency(amount: number, currency = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format an ISO date string to a human-readable local date-time.
 */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * Format an ISO date string to a local date only.
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(new Date(iso));
}

/**
 * Format an integer count with locale grouping (id-ID).
 * Used for display only — never for calculations.
 */
export function formatInteger(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Truncate a string to a given length.
 */
export function truncate(str: string, length = 24): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}…`;
}

/**
 * Converts a calendar date string (YYYY-MM-DD) to an RFC3339 timestamp
 * representing the end of that day (23:59:59) in the local browser timezone.
 *
 * If the input is empty, null, or undefined, returns undefined.
 */
export function dateOnlyToRFC3339EndOfDay(dateStr: string | null | undefined): string | undefined {
  if (!dateStr || dateStr.trim() === '') {
    return undefined;
  }

  // Parse YYYY-MM-DD
  const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateStr.match(regex);
  if (!match) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${dateStr}`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Construct local date representing the end of the day
  const dateObj = new Date(year, month - 1, day, 23, 59, 59, 0);

  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  // Verify no rollover (e.g. February 30th)
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }

  // Format with local timezone offset to represent the browser's timezone correctly
  const offsetMinutes = dateObj.getTimezoneOffset();
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absOffset / 60);
  const offsetMins = absOffset % 60;
  const sign = offsetMinutes <= 0 ? '+' : '-';
  
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const offsetStr = `${sign}${pad(offsetHours)}:${pad(offsetMins)}`;
  const localRFC3339 = `${year}-${pad(month)}-${pad(day)}T23:59:59${offsetStr}`;

  return localRFC3339;
}
