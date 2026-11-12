import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site";

/**
 * The social card.
 *
 * Next serves this file at `/opengraph-image` and points `og:image` and
 * `twitter:image` at it with an absolute URL built from `metadataBase`
 * (`NEXT_PUBLIC_APP_URL`). It is generated rather than committed as a PNG so the
 * text cannot drift away from the landing page's own headline.
 *
 * Satori, the renderer behind `ImageResponse`, implements a subset of CSS: every
 * element with more than one child needs an explicit `display: "flex"`, and no
 * Tailwind classes exist here — inline styles only.
 */
export const alt = `${SITE_NAME} — organise your tasks, focus on what matters`;

/** The 1200×630 ratio that X, LinkedIn, Slack and Discord all crop to. */
export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // The brand green, bloomed into the app's dark canvas.
          background: "linear-gradient(135deg, #0d1a12 0%, #14261a 58%, #1f1f1f 100%)",
          color: "#ffffff",
          padding: "76px 84px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 68,
              height: 68,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "#22c55e",
              color: "#08130c",
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", fontSize: 78, fontWeight: 700, lineHeight: 1.1 }}>
            Organise your tasks.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.1,
              color: "#4ade80",
            }}
          >
            Focus on what matters.
          </div>
          <div style={{ display: "flex", fontSize: 32, lineHeight: 1.45, color: "#b9c6bd" }}>
            Categories, dates, subtasks, habits and statistics — free, open source and
            self-hosted.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#8fa397" }}>
          Task manager &amp; habit tracker · MIT licensed
        </div>
      </div>
    ),
    size,
  );
}
