import { redirect } from "next/navigation";

// The Listed report moved into the Hold tab.
export default function ListedPage() {
  redirect("/on-hold");
}
