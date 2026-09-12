import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://earngpt.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // `/api/media/` is carved back out of the `/api` block below, and it is
        // not an oversight. Post images are stored as `/api/media/<key>` (the
        // bucket is private and 403s directly — see the media proxy), so that is
        // the path a shared post's `og:image` points at. Facebook's and
        // LinkedIn's unfurlers DO honour robots.txt when fetching og:image, so
        // a blanket `/api` disallow means every shared post with a photo
        // unfurls with no picture. An ordering rule does the work: the longer,
        // more specific `allow` wins over the shorter `disallow`.
        allow: ["/", "/api/media/"],
        // Keep private/authed + admin surfaces out of the index.
        disallow: ["/admin", "/api", "/wallet", "/withdrawal", "/settings", "/no-access"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
