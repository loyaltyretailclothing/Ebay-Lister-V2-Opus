"use client";

// SEO keyword chips shown under the title. Every chip is a keyword that is
// already placed — in the title (solid blue) or in Theme (outlined). Clicking
// a chip moves it between the two; the parent rebuilds the title.

const TIERS = [1, 2, 3];

export default function KeywordChips({ keywords, onToggle, disabled, hasTheme, notice }) {
  if (!Array.isArray(keywords) || keywords.length === 0) return null;

  const indexed = keywords.map((k, i) => ({ ...k, index: i }));

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Keywords
        </p>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> In title
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-zinc-400" /> In Theme
          </span>
        </div>
      </div>

      {TIERS.map((tier) => {
        const items = indexed.filter((k) => k.tier === tier);
        if (items.length === 0) return null;
        return (
          <div key={tier} className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="w-12 flex-shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Tier {tier}
            </span>
            {items.map((k) => {
              const inTitle = k.placement === "title";
              const blocked = disabled || (inTitle && !hasTheme);
              const hint = inTitle
                ? hasTheme
                  ? "In title — click to move to Theme"
                  : "This category has no Theme field"
                : "In Theme — click to move into the title";
              return (
                <button
                  key={`${k.keyword}-${k.index}`}
                  type="button"
                  onClick={() => onToggle(k.index)}
                  disabled={blocked}
                  title={hint}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    inTitle
                      ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-blue-400 hover:text-blue-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-500"
                  }`}
                >
                  {k.keyword}
                  {!inTitle && (
                    <span className="ml-1 text-[10px] font-normal text-zinc-400">Theme</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}

      <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        Click a keyword to move it between the title and Theme. Clicking rebuilds the
        title, replacing any typed edits.
      </p>
      {notice && (
        <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          {notice}
        </p>
      )}
    </div>
  );
}
