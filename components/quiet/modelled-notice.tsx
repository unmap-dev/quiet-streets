"use client";

import { InfoIcon } from "lucide-react";
import type { Lang } from "@/lib/kit/i18n";
import { TEXT } from "@/lib/text";

/**
 * What the numbers are and are not, with the way to the docs' limits: one line across the page
 * above the map, so it is always in view without covering the map. On a phone it keeps the title
 * and the link and drops the sentence between them, which the block's card repeats in its credits.
 */
export function ModelledNotice({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  return (
    <p data-modelled-notice="" className="flex shrink-0 items-start gap-2 border-b bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground sm:items-center">
      <InfoIcon aria-hidden="true" className="mt-px size-3.5 shrink-0 sm:mt-0" />
      <span>
        <span className="font-medium text-foreground">{t.modelledTitle}</span> <span className="max-sm:hidden">{t.modelledBody}</span>{" "}
        <a className="font-medium whitespace-nowrap text-foreground underline underline-offset-4" href={t.limitsUrl} target="_blank" rel="noreferrer">
          {t.limits}
        </a>
      </span>
    </p>
  );
}
