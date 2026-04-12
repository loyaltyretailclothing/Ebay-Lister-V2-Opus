"use client";

export default function PhotoGrid({
  photos,
  selected,
  onSelect,
  onToggle,
  draggable = false,
  compact = false,
}) {
  if (!photos.length) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 py-16 dark:border-zinc-700">
        <svg
          className="h-10 w-10 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No photos yet. Upload some to get started.
        </p>
      </div>
    );
  }

  function handleClick(e, publicId) {
    if (e.ctrlKey || e.metaKey) {
      onToggle(publicId);
    } else if (e.shiftKey && selected.length > 0) {
      const ids = photos.map((p) => p.public_id);
      const lastSelected = selected[selected.length - 1];
      const lastIdx = ids.indexOf(lastSelected);
      const currentIdx = ids.indexOf(publicId);
      const start = Math.min(lastIdx, currentIdx);
      const end = Math.max(lastIdx, currentIdx);
      const range = ids.slice(start, end + 1);
      const merged = [...new Set([...selected, ...range])];
      onSelect(merged);
    } else {
      onSelect(selected.includes(publicId) ? [] : [publicId]);
    }
  }

  function handleDragStart(e, photo) {
    if (!draggable) return;

    let dragPhotos;
    if (selected.length > 0 && selected.includes(photo.public_id)) {
      dragPhotos = photos.filter((p) => selected.includes(p.public_id));
    } else {
      dragPhotos = [photo];
    }

    e.dataTransfer.setData(
      "application/x-library-photo",
      JSON.stringify(dragPhotos)
    );
    e.dataTransfer.effectAllowed = "copy";
  }

  const gridClasses = compact
    ? "mt-3 grid grid-cols-3 gap-2"
    : "mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";

  const thumbSize = compact ? "w_200,h_200" : "w_300,h_300";

  return (
    <div className={gridClasses}>
      {photos.map((photo) => {
        const isSelected = selected.includes(photo.public_id);
        const thumb = photo.secure_url.replace(
          "/upload/",
          `/upload/c_fill,${thumbSize}/`
        );
        return (
          <div
            key={photo.public_id}
            draggable={draggable}
            onDragStart={(e) => handleDragStart(e, photo)}
            onClick={(e) => handleClick(e, photo.public_id)}
            className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
              isSelected
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
            }`}
          >
            <div className="aspect-square">
              <img
                src={thumb}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </div>
            {isSelected && (
              <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
            )}
            {photo.note && (
              <div className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs text-zinc-900">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
