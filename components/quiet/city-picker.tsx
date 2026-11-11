"use client";

import { Button } from "@/components/ui/button";
import { CITIES, type City } from "@/lib/cities";
import { format, formatNumber, type Lang } from "@/lib/kit/i18n";
import { TEXT } from "@/lib/text";
import { ModelledNotice } from "./modelled-notice";

/**
 * Where the app opens: the six covered cities, each with what the model knows about it (the size
 * of its grid, and whether its traffic is counted or assumed). Picking one opens the noise map
 * there. Makes no call.
 */
export function CityPicker({ lang, onPick }: { lang: Lang; onPick: (city: City) => void }) {
  const t = TEXT[lang];
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-muted/40" data-city-picker="">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-14">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{t.pickTitle}</h2>
          <p className="text-sm text-pretty text-muted-foreground sm:text-base">{t.pickLead}</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CITIES.map((city) => (
            <li key={city.slug}>
              <Button
                type="button"
                variant="outline"
                aria-label={format(t.openCity, { city: city.name[lang] })}
                data-city={city.slug}
                onClick={() => onPick(city)}
                className="h-auto w-full flex-col items-start gap-3 bg-background p-4 text-left whitespace-normal"
              >
                <span className="flex w-full flex-col gap-0.5">
                  <span className="text-lg leading-tight font-semibold">{city.name[lang]}</span>
                  <span className="text-sm font-normal text-muted-foreground">{city.province[lang]}</span>
                </span>
                <span className="flex w-full flex-col gap-1 text-xs font-normal text-muted-foreground">
                  <span className="tabular-nums">{format(t.hexagons, { n: formatNumber(city.hexagons, lang) })}</span>
                  <span className={city.calibrated ? "font-medium text-foreground" : undefined}>{city.calibrated ? t.calibrated : t.defaults}</span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
        <ModelledNotice lang={lang} />
      </div>
    </main>
  );
}
