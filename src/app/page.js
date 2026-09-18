import { redirect } from "next/navigation";

// There is no Home screen: the site's front page opens Create Listing.
export default function Home() {
  redirect("/generate");
}
