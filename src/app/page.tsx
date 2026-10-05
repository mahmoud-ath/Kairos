import { redirect } from "next/navigation";

/** Kairos opens on Today. */
export default function HomePage() {
  redirect("/today");
}
