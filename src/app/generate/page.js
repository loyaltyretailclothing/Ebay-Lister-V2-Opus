"use client";

import useListingEditor from "@/hooks/useListingEditor";
import useWide from "@/hooks/useWide";
import DesktopCreate from "@/components/create/DesktopCreate";
import PhoneCreate from "@/components/create/PhoneCreate";

// Big windows (1280px+) get the desktop layout; everything smaller gets the
// phone layout. The layout is chosen when the page opens and doesn't flip
// while you work (refresh to switch), so the form is never torn down and
// rebuilt mid-listing.
export default function CreateListingPage() {
  const editor = useListingEditor();
  const wide = useWide();

  if (wide === null) return null;
  return wide ? <DesktopCreate editor={editor} /> : <PhoneCreate editor={editor} />;
}
