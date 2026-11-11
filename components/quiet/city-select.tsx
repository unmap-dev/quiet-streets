"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CITIES, findCity, type City } from "@/lib/cities";
import type { Lang } from "@/lib/kit/i18n";
import { TEXT } from "@/lib/text";

/**
 * The header's city switch. It shows the city the camera is over, so panning to another city (or
 * the block's own "start in a city" buttons) moves it too; between cities it says so.
 */
export function CitySelect({ lang, value, onCity }: { lang: Lang; value: string | null; onCity: (city: City) => void }) {
  const t = TEXT[lang];
  const items = CITIES.map((city) => ({ value: city.slug, label: city.name[lang] }));
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(slug) => {
        const city = findCity(typeof slug === "string" ? slug : null);
        if (city) onCity(city);
      }}
    >
      <SelectTrigger size="sm" aria-label={t.city} className="min-w-32" data-city-select="">
        <SelectValue placeholder={t.otherPlace} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
