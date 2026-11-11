"use client";

import { CheckIcon, Columns3Icon, PinIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatDb } from "@/components/ui/urban-noise-map";
import { format, type Lang } from "@/lib/kit/i18n";
import { reading, type Pin } from "@/lib/pins";
import { TEXT } from "@/lib/text";
import { PinBadge } from "./pin-badge";

/** What the block's card is showing, as far as pinning goes. */
export type Candidate =
  | { state: "none" }
  | { state: "pending" }
  /** `number` is its place in the list once pinned, 0 before; `full` when three are pinned already. */
  | { state: "ready"; pin: Pin; number: number; full: boolean };

/** A place's name: the search result's, or "Dropped pin" for a map click. */
export function placeName(pin: Pin, lang: Lang): string {
  return pin.name ?? TEXT[lang].droppedPin;
}

/** "Day 54 dB, night 45 dB", or that nothing is modelled: never a number for a null level. */
export function levelsLine(pin: Pin, lang: Lang): string {
  const day = reading(pin, "day");
  const night = reading(pin, "night");
  const t = TEXT[lang];
  if (day.db === null) return t.noSource;
  return format(t.levels, { day: formatDb(day.db, lang), night: night.db === null ? t.notModelled : formatDb(night.db, lang) });
}

function PinButton({ candidate, lang, onPin, short = false, className }: { candidate: Candidate; lang: Lang; onPin: (pin: Pin) => void; short?: boolean; className?: string }) {
  const t = TEXT[lang];
  if (candidate.state === "pending") {
    return (
      <Button type="button" size="sm" disabled className={className}>
        <Spinner data-icon="inline-start" />
        {short ? t.pinShort : t.lookingUp}
      </Button>
    );
  }
  if (candidate.state !== "ready") return null;
  if (candidate.number > 0) {
    return (
      <Button type="button" size="sm" variant="secondary" disabled className={className} data-pin-state="pinned">
        <CheckIcon data-icon="inline-start" />
        {format(t.pinned, { n: candidate.number })}
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" disabled={candidate.full} onClick={() => onPin(candidate.pin)} className={className} data-pin-state={candidate.full ? "full" : "ready"}>
      <PinIcon data-icon="inline-start" />
      {short ? t.pinShort : t.pin}
    </Button>
  );
}

/**
 * The comparison's way in, beside the block's own card: pin what the card is showing, see the
 * pinned places, open them side by side. A floating card at the map's top right on a wide screen
 * (left of the zoom buttons), a bar above the map on a phone, where the block's card is a sheet
 * across the bottom.
 */
export function CompareTray({
  lang,
  pins,
  candidate,
  onPin,
  onRemove,
  onOpen,
}: {
  lang: Lang;
  pins: readonly Pin[];
  candidate: Candidate;
  onPin: (pin: Pin) => void;
  onRemove: (id: string) => void;
  onOpen: () => void;
}) {
  const t = TEXT[lang];
  const count = format(t.pinCount, { n: pins.length });
  const full = candidate.state === "ready" && candidate.full && candidate.number === 0;
  return (
    <>
      {/* Phone: one line above the map. */}
      <div data-compare-tray="bar" className="flex shrink-0 items-center gap-2 border-b bg-background px-3 py-2 sm:hidden">
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground tabular-nums">{format(t.pinnedCount, { n: pins.length })}</p>
        <PinButton candidate={candidate} lang={lang} onPin={onPin} short />
        <Button type="button" size="sm" variant="outline" disabled={pins.length === 0} onClick={onOpen}>
          <Columns3Icon data-icon="inline-start" />
          {t.compareShort}
        </Button>
      </div>

      {/* Wide: a card on the map. */}
      <Card data-compare-tray="card" size="sm" className="absolute top-2.5 right-14 z-10 w-72 gap-3 max-sm:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
        <CardHeader className="flex items-baseline justify-between gap-2">
          <CardTitle role="heading" aria-level={2}>
            {t.compareTitle}
          </CardTitle>
          <Badge variant="outline" className="tabular-nums">
            {count}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {candidate.state !== "none" ? <PinButton candidate={candidate} lang={lang} onPin={onPin} className="w-full" /> : null}
          {full ? <p className="text-xs text-muted-foreground">{t.full}</p> : null}
          {pins.length === 0 ? (
            candidate.state === "none" ? <p className="text-xs text-muted-foreground">{t.compareHint}</p> : null
          ) : (
            <ol className="flex flex-col gap-1" aria-label={t.compareTitle}>
              {pins.map((pin, index) => (
                <li key={pin.id} className="flex items-center gap-2.5 py-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                  <PinBadge n={index + 1} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{placeName(pin, lang)}</span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">{levelsLine(pin, lang)}</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={format(t.remove, { place: placeName(pin, lang) })} onClick={() => onRemove(pin.id)}>
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ol>
          )}
          {pins.length > 0 ? (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={onOpen} data-open-compare="">
              <Columns3Icon data-icon="inline-start" />
              {t.compare}
            </Button>
          ) : null}
          <p className="sr-only" aria-live="polite">
            {pins.length > 0 ? count : ""}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
