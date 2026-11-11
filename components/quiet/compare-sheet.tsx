"use client";

import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NOISE_COPY, cityName, formatCoords, formatDb, labelText } from "@/components/ui/urban-noise-map";
import { format, type Lang } from "@/lib/kit/i18n";
import { WHO_DB, mainSource, quietest, reading, scaleShare, type Pin } from "@/lib/pins";
import type { Period } from "@/lib/url";
import { TEXT } from "@/lib/text";
import { PinBadge } from "./pin-badge";
import { placeName } from "./compare-tray";

const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;

/**
 * One level on the 30 to 80 dB scale every row shares, with the WHO guideline as a tick at the
 * same place on every row, so the eye runs down one line. The part of a bar past the guideline is
 * drawn in the destructive colour: how far over is the reading, not decoration.
 */
function LevelBar({ db, who }: { db: number; who: number }) {
  const share = scaleShare(db);
  const line = scaleShare(who);
  const under = Math.min(share, line);
  const over = Math.max(0, share - line);
  return (
    <span aria-hidden="true" className="relative block h-2.5 w-full rounded-full bg-muted">
      <span className="absolute inset-y-0 left-0 rounded-l-full bg-foreground/45 motion-safe:transition-[width] motion-safe:duration-500" style={{ width: pct(under) }} />
      {over > 0 ? (
        <span className="absolute inset-y-0 rounded-r-full bg-destructive motion-safe:transition-[width] motion-safe:duration-500" style={{ left: pct(line), width: pct(over) }} />
      ) : null}
      <span className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: pct(line) }} />
    </span>
  );
}

/** The day or night level of every pinned place, one bar each, with the quietest marked. */
function PeriodSection({ period, active, pins, lang }: { period: Period; active: boolean; pins: readonly Pin[]; lang: Lang }) {
  const t = TEXT[lang];
  const copy = NOISE_COPY[lang];
  const who = WHO_DB[period];
  const best = new Set(quietest(pins, period === "day" ? "lden" : "lnight"));
  const id = `compare-${period}`;
  return (
    <section aria-labelledby={id} data-period-section={period} data-active={active ? "true" : undefined} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={id} className="flex items-center gap-2 text-sm font-medium">
          {period === "day" ? t.dayTitle : t.nightTitle}
          {active ? (
            <Badge variant="secondary" className="font-normal">
              {t.onMap}
            </Badge>
          ) : null}
        </h3>
        <p className="text-xs text-muted-foreground tabular-nums">{format(t.who, { db: formatDb(who, lang) })}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {pins.map((pin, index) => {
          const row = reading(pin, period);
          return (
            <li key={pin.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
              <PinBadge n={index + 1} />
              <span className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{placeName(pin, lang)}</span>
                {row.db === null ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{t.noSource}</span>
                ) : (
                  <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                    {best.has(pin.id) ? <Badge variant="outline">{t.quietest}</Badge> : null}
                    <span className="font-semibold">{formatDb(row.db, lang)}</span>
                    <span className="text-xs text-muted-foreground">{row.above ? t.above : t.within}</span>
                  </span>
                )}
              </span>
              <span className="col-start-2">
                {row.db === null ? (
                  <span aria-hidden="true" className="block h-2.5 w-full rounded-full border border-dashed border-border" />
                ) : (
                  <LevelBar db={row.db} who={who} />
                )}
              </span>
              <span className="sr-only">{row.db === null ? "" : row.above ? copy.above[period] : copy.within[period]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The pinned places side by side: the day and the night level on one shared scale against the
 * WHO guideline, then the score, the main source and the city in a table. Everything comes from
 * the answers the block was already given, so opening it makes no call. A sheet beside the map on
 * a wide screen, from the bottom on a phone.
 */
export function CompareSheet({
  open,
  onOpenChange,
  side,
  pins,
  period,
  lang,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "right" | "bottom";
  pins: readonly Pin[];
  period: Period;
  lang: Lang;
  onRemove: (id: string) => void;
}) {
  const t = TEXT[lang];
  const copy = NOISE_COPY[lang];
  const bestScore = new Set(quietest(pins, "score"));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-full gap-5 overflow-y-auto data-[side=bottom]:max-h-[88dvh] data-[side=right]:sm:max-w-lg" data-compare-sheet="">
        <SheetHeader>
          <SheetTitle>{t.compareTitle}</SheetTitle>
          <SheetDescription>{t.sheetDescription}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <ol className="flex flex-col gap-2" aria-label={t.compareTitle}>
            {pins.map((pin, index) => (
              <li key={pin.id} className="flex items-center gap-3">
                <PinBadge n={index + 1} className="size-6 text-xs" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{placeName(pin, lang)}</span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {cityName(pin.point.city, lang)}, {formatCoords(pin.at, lang)}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={format(t.remove, { place: placeName(pin, lang) })} onClick={() => onRemove(pin.id)}>
                  <XIcon />
                </Button>
              </li>
            ))}
          </ol>
          {(["day", "night"] as const).map((value) => (
            <PeriodSection key={value} period={value} active={value === period} pins={pins} lang={lang} />
          ))}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28" />
                  {pins.map((pin, index) => (
                    <TableHead key={pin.id}>
                      <span className="flex items-center gap-1.5">
                        <PinBadge n={index + 1} />
                        <span className="sr-only">{placeName(pin, lang)}</span>
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">{t.score}</TableCell>
                  {pins.map((pin) => (
                    <TableCell key={pin.id} className="tabular-nums" data-best={bestScore.has(pin.id) ? "true" : undefined}>
                      {pin.point.score === null ? (
                        <span className="text-xs text-muted-foreground">{t.noSource}</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{pin.point.score}</span>
                          <span className="text-xs text-muted-foreground">{labelText(pin.point.label, lang)}</span>
                          {bestScore.has(pin.id) ? <Badge variant="outline">{t.quietest}</Badge> : null}
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">{t.mainSource}</TableCell>
                  {pins.map((pin) => {
                    const source = mainSource(pin);
                    return (
                      <TableCell key={pin.id} className="whitespace-normal">
                        {source ? copy.sources[source] : <span className="text-xs text-muted-foreground">{t.noMainSource}</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">{t.cityRow}</TableCell>
                  {pins.map((pin) => (
                    <TableCell key={pin.id} className="whitespace-normal">
                      {cityName(pin.point.city, lang)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
        <SheetFooter className="border-t text-xs text-muted-foreground">
          <p>
            <a className="underline underline-offset-2" href={copy.attributionUrl} target="_blank" rel="noreferrer">
              {copy.attribution}
            </a>{" "}
            (
            <a className="underline underline-offset-2" href={copy.licenceUrl} target="_blank" rel="noreferrer">
              {copy.licence}
            </a>
            ), {copy.model}.
          </p>
          <p>{copy.modelled}</p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
