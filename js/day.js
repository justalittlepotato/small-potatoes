// The day, as this app understands it. Pure: every function takes a Date and
// reads nothing from the clock itself, so it can be tested at fixed instants.
//
// A day runs from 4am to 4am. An evening written at half past midnight
// belongs to the day it is closing, not the one that has technically begun.

export const DAY_STARTS_AT = 4;   // hour, local time
export const EVENING_FROM = 14;   // 2pm: after this the evening tab opens first

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

// "yyyy-mm-dd" for the day an instant belongs to. A string, never a Date, so
// two records from the same day compare equal without a timezone getting in.
export function dayKey(date) {
  const shifted = new Date(date.getTime());
  shifted.setHours(shifted.getHours() - DAY_STARTS_AT);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

// Which tab to open first. Morning from 4am until 2pm; evening the rest of the
// time, including the small hours, which are the tail of an evening.
export function suggestedTab(date) {
  const hour = date.getHours();
  return hour >= DAY_STARTS_AT && hour < EVENING_FROM ? 'morning' : 'evening';
}

// "friday 19 september", from a day key. No year: this page does not last
// long enough to need one.
export function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}
