"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { citiesByName, findCity, type City } from "@/lib/cities";
import type { Lang } from "@/lib/kit/i18n";
import { TEXT } from "@/lib/text";

/**
 * The header's jump-to-an-area switch over all 41 covered metropolitan areas, by name in the
 * page's language. It shows the area the camera is over, so panning to another (or the block's
 * own nearest-area buttons) moves it too; at the national view and between areas it shows its
 * placeholder.
 */
export function CitySelect({ lang, value, onCity }: { lang: Lang; value: string | null; onCity: (city: City) => void }) {
  const t = TEXT[lang];
  const items = citiesByName(lang).map((city) => ({ value: city.slug, label: city.name[lang] }));
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(slug) => {
        const city = findCity(typeof slug === "string" ? slug : null);
        if (city) onCity(city);
      }}
    >
      <SelectTrigger size="sm" aria-label={t.city} className="max-w-52 min-w-32" data-city-select="">
        <SelectValue placeholder={t.jumpTo} />
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
