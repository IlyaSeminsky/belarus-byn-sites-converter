const minskDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Minsk",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the current date key ("YYYY-MM-DD") as observed in the
 * Europe/Minsk timezone, which is the timezone NBRB publishes rates in.
 * `now` is injectable so staleness logic is testable without mocking globals.
 */
export function minskDateKey(now: Date = new Date()): string {
  return minskDateFormatter.format(now);
}
