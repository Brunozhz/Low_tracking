import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { parseTrackingParams } from "@/lib/tracking/parser";

function buildRedirectUrl(destination: string, incoming: URLSearchParams) {
  const target = new URL(destination);

  for (const [key, value] of incoming.entries()) {
    if (!target.searchParams.has(key)) {
      target.searchParams.set(key, value);
    }
  }

  return target.toString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const link = await db.trackingLink.findUnique({
    where: { slug },
    include: {
      project: true,
    },
  });

  if (!link || link.status !== "ACTIVE") {
    return new NextResponse("Link não encontrado", { status: 404 });
  }

  const url = new URL(request.url);
  const tracking = parseTrackingParams(url.searchParams);
  const redirectUrl = buildRedirectUrl(link.finalUrl, url.searchParams);

  if (env.TRACKING_MODE === "redirect_only") {
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  const visitorIdCookie = request.headers.get("cookie")?.match(/ltk_vid=([^;]+)/)?.[1] ?? nanoid(16);
  const sessionKeyCookie = request.headers.get("cookie")?.match(/ltk_sid=([^;]+)/)?.[1] ?? nanoid(16);

  const response = NextResponse.redirect(redirectUrl, { status: 302 });
  response.cookies.set("ltk_vid", visitorIdCookie, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  response.cookies.set("ltk_sid", sessionKeyCookie, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  if (env.TRACKING_MODE === "full") {
    void (async () => {
      try {
        const visitor = await db.visitor.upsert({
          where: {
            projectId_anonymousId: {
              projectId: link.projectId,
              anonymousId: visitorIdCookie,
            },
          },
          update: {
            lastSeenAt: new Date(),
          },
          create: {
            workspaceId: link.workspaceId,
            projectId: link.projectId,
            anonymousId: visitorIdCookie,
          },
        });

        const session = await db.visitorSession.upsert({
          where: {
            projectId_sessionKey: {
              projectId: link.projectId,
              sessionKey: sessionKeyCookie,
            },
          },
          update: {
            endedAt: new Date(),
            utmSource: tracking.utmSource,
            utmMedium: tracking.utmMedium,
            utmCampaign: tracking.utmCampaign,
            campaignId: tracking.campaignId,
            adsetId: tracking.adsetId,
            adId: tracking.adId,
            creativeId: tracking.creativeId,
            clickId: tracking.clickId,
            fbclid: tracking.fbclid,
            gclid: tracking.gclid,
          },
          create: {
            workspaceId: link.workspaceId,
            projectId: link.projectId,
            visitorId: visitor.id,
            sessionKey: sessionKeyCookie,
            landingUrl: redirectUrl,
            utmSource: tracking.utmSource,
            utmMedium: tracking.utmMedium,
            utmCampaign: tracking.utmCampaign,
            utmContent: tracking.utmContent,
            utmTerm: tracking.utmTerm,
            campaignId: tracking.campaignId,
            adsetId: tracking.adsetId,
            adId: tracking.adId,
            creativeId: tracking.creativeId,
            clickId: tracking.clickId,
            fbclid: tracking.fbclid,
            gclid: tracking.gclid,
          },
        });

        await db.linkClick.create({
          data: {
            workspaceId: link.workspaceId,
            projectId: link.projectId,
            linkId: link.id,
            visitorId: visitor.id,
            visitorSessionId: session.id,
            referrer: request.headers.get("referer"),
            userAgent: request.headers.get("user-agent"),
            fbclid: tracking.fbclid,
            gclid: tracking.gclid,
            queryParams: Object.fromEntries(url.searchParams.entries()),
          },
        });
      } catch (error) {
        logger.error(
          { error, slug: link.slug, projectId: link.projectId },
          "Falha de tracking em redirect (fail-open aplicado)",
        );
      }
    })();
  }

  return response;
}
