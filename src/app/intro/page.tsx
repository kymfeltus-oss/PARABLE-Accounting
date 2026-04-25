import { redirect } from "next/navigation";

/** Brand flash lives on `/`; keep `/intro` for bookmarks. */
export default function IntroRedirectPage() {
  redirect("/");
}
