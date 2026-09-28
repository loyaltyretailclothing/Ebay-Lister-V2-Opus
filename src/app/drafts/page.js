"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Dialog from "@/components/ui/Dialog";
import { DraftsIcon, RefreshIcon, Spinner, TrashIcon } from "@/components/ui/Icons";
import { CONDITION_MAP } from "@/lib/conditions";
import { thumbUrl } from "@/lib/resizeImage";
import { waitedFor } from "@/components/create/LibraryPanel";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// Drafts (phone, and any window smaller than the desktop layout). Oldest
// first by creation date — the same order as the desktop queue, so "next"
// means the same draft on both. No auto-refresh: the list updates when the
// page opens and when Refresh is tapped, never on a timer.
export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [confirmFor, setConfirmFor] = useState(null);
  // "Analyze now" on a draft waiting in Anthropic's queue — the id running.
  const [forcing, setForcing] = useState(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/drafts", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        const sorted = [...(data.drafts || [])].sort((a, b) =>
          (a.createdAt || a.updatedAt || "") < (b.createdAt || b.updatedAt || "") ? -1 : 1
        );
        setDrafts(sorted);
      } else {
        setError(data.error || "Failed to load drafts");
      }
    } catch (err) {
      console.error(err);
      setError("Could not connect to drafts service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // Pull a draft out of Anthropic's queue and analyze it on the spot (~45s,
  // full price). Anthropic doesn't bill a request it hadn't started yet, so
  // this normally costs nothing extra.
  async function forceNow(id) {
    if (forcing) return;
    setForcing(id);
    setError("");
    try {
      const res = await fetch("/api/batches/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Couldn't analyze that draft");
    } catch (err) {
      setError(err.message);
    } finally {
      setForcing(null);
      fetchDrafts();
    }
  }

  async function handleDelete(id) {
    setConfirmFor(null);
    setDeleting(id);
    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      } else {
        setError(`Delete failed: ${data.error}`);
      }
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  }

  const count = drafts.length;

  return (
    <div className="mx-auto flex h-full w-full max-w-[640px] flex-col bg-panel">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line pl-3.5 pr-1.5">
        <h1 className="m-0 text-3xl font-semibold tracking-[-0.01em]">Drafts</h1>
        {!loading && (
          <span className="rounded-chip border border-line bg-sunken px-2 py-[3px] font-mono text-base text-ink-2">
            {count} draft{count === 1 ? "" : "s"}
          </span>
        )}
        <div className="grow" />
        <button
          type="button"
          onClick={fetchDrafts}
          disabled={loading}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-panel border-0 bg-transparent px-2.5 font-sans text-md font-medium text-accent disabled:opacity-50"
        >
          {loading ? <Spinner className="size-4" /> : <RefreshIcon className="size-4" />}
          Refresh
        </button>
      </header>

      {error && (
        <p className="m-0 border-b border-bad-line bg-bad-weak px-3.5 py-2 text-md font-medium text-bad">{error}</p>
      )}

      {loading && count === 0 ? (
        <div className="flex grow items-center justify-center">
          <Spinner className="size-6 text-ink-3" />
        </div>
      ) : count === 0 ? (
        <div className="flex min-h-0 grow flex-col items-center justify-center gap-3.5 p-6">
          <span className="flex size-[60px] items-center justify-center rounded-full border border-line bg-sunken text-ink-3">
            <DraftsIcon className="size-7" strokeWidth={1.6} />
          </span>
          <p className="m-0 text-3xl font-semibold">No drafts yet</p>
          <Link href="/generate" className="btn btn-primary btn-touch no-underline">
            Create Listing
          </Link>
        </div>
      ) : (
        <div className="min-h-0 grow overflow-y-auto pb-[58px]">
          {drafts.map((d) => {
            const processing = d.status === "processing";
            // Only phase 1 blocks — after it lands the draft is workable and
            // the specifics (phase 2) fill in behind you.
            const waitingOnPhotos = d.batchPhase === 1;
            const fillingSpecifics = d.batchPhase === 2;
            const isError = d.status === "error";
            const cond = CONDITION_MAP[d.condition]?.label || d.condition || "";
            const created = `Created ${formatDate(d.createdAt || d.updatedAt)}`;
            const body = (
              <>
                <span className="rthumb">
                  {d.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(d.thumbnailUrl, 128)} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 grow">
                  <span className="rtitle">{d.title || "Untitled"}</span>
                  <span className="rmeta">
                    {processing && (
                      <span className="pill pill-busy mt-px">
                        <Spinner className="size-[11px]" />
                        Processing
                      </span>
                    )}
                    {(waitingOnPhotos || fillingSpecifics) && (
                      // Waiting on Anthropic's queue — which phase, how long.
                      <span className="pill pill-busy mt-px">
                        <Spinner className="size-[11px]" />
                        Phase {d.batchPhase} · {waitedFor(d.batchAt)}
                      </span>
                    )}
                    {/* Only once it's out of the queue — while a phase is
                        running, the phase is the whole story. */}
                    {d.readyBy === "batch" && !isError && !fillingSpecifics && (
                      <span className="pill pill-skip mt-px">by Batch</span>
                    )}
                    {d.readyBy === "force" && !isError && <span className="pill pill-err mt-px">by Force</span>}
                    {isError && <span className="pill pill-err mt-px">Error</span>}
                    {d.skipped && !processing && <span className="pill pill-skip mt-px">Skipped</span>}
                    {cond && !processing && !isError && !waitingOnPhotos && !fillingSpecifics && (
                      <>
                        <span className="rmeta-cond">{cond}</span>
                        <span className="rmeta-date" aria-hidden="true">
                          ·
                        </span>
                      </>
                    )}
                    {/* While it's in the queue, the wait matters and the
                        created date doesn't — and the row needs the room
                        for the Analyze now button. */}
                    {!waitingOnPhotos && !fillingSpecifics && (
                      <span className="rmeta-date">{created}</span>
                    )}
                  </span>
                  {isError && d.errorMessage && <span className="rmeta-err">{d.errorMessage}</span>}
                </span>
              </>
            );
            return (
              <div key={d.id} className="lrow">
                {processing || waitingOnPhotos ? (
                  // Still being written, or its photos are still in the
                  // queue — nothing to open yet. It can be pulled out below.
                  <div className="rowmain rowmain-off">{body}</div>
                ) : (
                  <button
                    type="button"
                    className="rowmain"
                    onClick={() => router.push(`/generate?draft=${encodeURIComponent(d.id)}`)}
                  >
                    {body}
                  </button>
                )}
                {(waitingOnPhotos || fillingSpecifics) && (
                  <button
                    type="button"
                    className="btn btn-sm mr-1.5 shrink-0 self-center"
                    disabled={forcing === d.id}
                    onClick={() => forceNow(d.id)}
                    title={
                      fillingSpecifics
                        ? "Fill the item specifics now instead of waiting"
                        : "Analyze this draft now instead of waiting"
                    }
                  >
                    {forcing === d.id ? <Spinner className="size-3" /> : null}
                    {fillingSpecifics ? "Finish now" : "Analyze now"}
                  </button>
                )}
                <button
                  type="button"
                  className="rdel"
                  aria-label={`Delete draft ${d.title || ""}`}
                  disabled={deleting === d.id}
                  onClick={() => setConfirmFor(d.id)}
                >
                  {deleting === d.id ? <Spinner className="size-[18px]" /> : <TrashIcon className="size-[18px]" />}
                </button>
              </div>
            );
          })}
          <p className="hint px-3.5 pb-[18px] pt-3.5">
            Oldest first, by the date each draft was created. The list refreshes when you open this
            page and when you tap Refresh — never on a timer.
          </p>
        </div>
      )}

      <Dialog
        open={!!confirmFor}
        onCancel={() => setConfirmFor(null)}
        title="Delete this draft?"
        touch
        actions={
          <>
            <button type="button" className="btn btn-touch flex-1" onClick={() => setConfirmFor(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-touch flex-1 font-semibold"
              onClick={() => handleDelete(confirmFor)}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="hint mt-[7px]">This cannot be undone.</p>
      </Dialog>
    </div>
  );
}
