import type { Metadata } from "next";

import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SITE_NAME } from "@/lib/site";

/**
 * The public landing page.
 *
 * A Server Component with no dynamic inputs: no session, no database, no
 * `searchParams`. That keeps `/` statically renderable, which is what lets it be
 * served identically to signed-out and signed-in visitors and to crawlers.
 */

const TITLE = `${SITE_NAME} — organise your tasks, focus on what matters`;

const DESCRIPTION =
  "Kairos is a free, open-source task manager that organises work by category and date, with subtasks, drag and drop, statistics and JSON backups. Every account gets its own private workspace.";

export const metadata: Metadata = {
  // `absolute` because the root layout applies a "%s · Kairos" template, which
  // would otherwise turn this sentence into "… — organise… · Kairos".
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  // "summary" rather than "summary_large_image": there is no social image, and
  // asking for a large card without one just produces an empty frame.
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Faq />
      <FinalCta />
    </>
  );
}
