"use client";

import type { Lang } from "@/lib/kit/i18n";
import { MissingKey } from "@/lib/kit/missing-key";
import { TEXT } from "@/lib/text";

/**
 * No key in the build: the kit's "get a key" state, plus the one thing this app adds, that the key
 * also needs the Urban Noise add-on. Nothing is called.
 */
export function NeedsKey({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-y-auto px-4 py-8">
      <div className="w-full">
        <MissingKey lang={lang} />
      </div>
      <section aria-labelledby="needs-addon" className="flex max-w-sm flex-col items-center gap-2 text-center text-sm" data-needs-addon="">
        <h2 id="needs-addon" className="font-medium">
          {t.needsAddonTitle}
        </h2>
        <p className="text-muted-foreground">{t.needsAddonBody}</p>
        <a className="font-medium text-primary underline underline-offset-4" href={t.pricingUrl} target="_blank" rel="noreferrer">
          {t.pricing}
        </a>
      </section>
    </main>
  );
}
