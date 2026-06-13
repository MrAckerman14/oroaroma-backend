import { env } from '../../config/env.js';

export interface DateRange {
  from?: Date;
  to?: Date;
}

export function parseDateRange(input: { from?: string | undefined; to?: string | undefined }): DateRange {
  const range: DateRange = {};

  if (input.from) {
    range.from = startOfDay(parseDateInput(input.from));
  }

  if (input.to) {
    range.to = nextDay(startOfDay(parseDateInput(input.to)));
  }

  return range;
}

export function currentBusinessDayRange(now = new Date()): Required<DateRange> {
  const start = new Date(now);
  start.setHours(env.BUSINESS_DAY_START_HOUR, 0, 0, 0);

  if (now < start) {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { from: start, to: end };
}

export function currentCalendarDayRange(now = new Date()): Required<DateRange> {
  const from = startOfDay(now);
  return { from, to: nextDay(from) };
}

export function dateRangeOrCurrentDay(input: { from?: string | undefined; to?: string | undefined }) {
  return input.from || input.to ? parseDateRange(input) : currentCalendarDayRange();
}

export function buildCreatedAtFilter(range: DateRange) {
  if (range.from && range.to) {
    return { gte: range.from, lt: range.to };
  }

  if (range.from) {
    return { gte: range.from };
  }

  if (range.to) {
    return { lt: range.to };
  }

  return undefined;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function nextDay(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}
