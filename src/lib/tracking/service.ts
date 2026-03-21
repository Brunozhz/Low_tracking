import crypto from "node:crypto";

import { AttributionModel, EventSource, EventType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { conversionStatusFromEvent, resolveAttributedIds, resolveAttributionTouches } from "@/lib/attribution";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type RegisterEventInput = {
  workspaceId: string;
  projectId: string;
  visitor: {
    anonymousId: string;
    externalUserId?: string;
    fbp?: string;
    fbc?: string;
  };
  session: {
    sessionKey: string;
    landingUrl?: string;
    referrer?: string;
    userAgent?: string;
    ip?: string;
    country?: string;
    region?: string;
    city?: string;
  };
  touchpoint?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    campaignId?: string;
    adsetId?: string;
    adId?: string;
    creativeId?: string;
    clickId?: string;
    platform?: string;
    landingUrl?: string;
    referrer?: string;
  };
  event: {
    type: EventType;
    name: string;
    source?: EventSource;
    status?: string;
    occurredAt?: Date;
    value?: number;
    currency?: string;
    orderId?: string;
    dedupKey?: string;
    eventId?: string;
    externalEventId?: string;
    properties?: Record<string, unknown>;
    rawPayload?: Record<string, unknown>;
    linkId?: string;
  };
};

function hashIp(ip?: string) {
  if (!ip) {
    return undefined;
  }

  return crypto.createHash("sha256").update(`${ip}:${env.TRACKING_SALT}`).digest("hex");
}

function shouldCreateConversion(type: EventType) {
  switch (type) {
    case EventType.LEAD:
    case EventType.CHECKOUT_INITIATED:
    case EventType.PURCHASE_APPROVED:
    case EventType.PURCHASE_DECLINED:
    case EventType.UPSELL:
    case EventType.SUBSCRIPTION:
    case EventType.REFUND:
      return true;
    default:
      return false;
  }
}

export async function registerEvent(input: RegisterEventInput) {
  return db.$transaction(async (tx) => {
    const now = new Date();

    const visitor = await tx.visitor.upsert({
      where: {
        projectId_anonymousId: {
          projectId: input.projectId,
          anonymousId: input.visitor.anonymousId,
        },
      },
      update: {
        externalUserId: input.visitor.externalUserId,
        fbp: input.visitor.fbp,
        fbc: input.visitor.fbc,
        lastSeenAt: now,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        anonymousId: input.visitor.anonymousId,
        externalUserId: input.visitor.externalUserId,
        fbp: input.visitor.fbp,
        fbc: input.visitor.fbc,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });

    const session = await tx.visitorSession.upsert({
      where: {
        projectId_sessionKey: {
          projectId: input.projectId,
          sessionKey: input.session.sessionKey,
        },
      },
      update: {
        endedAt: now,
      },
      create: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        visitorId: visitor.id,
        sessionKey: input.session.sessionKey,
        startedAt: now,
        endedAt: now,
        landingUrl: input.session.landingUrl,
        referrer: input.session.referrer,
        userAgent: input.session.userAgent,
        ipHash: hashIp(input.session.ip),
        country: input.session.country,
        region: input.session.region,
        city: input.session.city,
        utmSource: input.touchpoint?.source,
        utmMedium: input.touchpoint?.medium,
        utmCampaign: input.touchpoint?.campaign,
        utmContent: input.touchpoint?.content,
        utmTerm: input.touchpoint?.term,
        campaignId: input.touchpoint?.campaignId,
        adsetId: input.touchpoint?.adsetId,
        adId: input.touchpoint?.adId,
        creativeId: input.touchpoint?.creativeId,
        clickId: input.touchpoint?.clickId,
      },
    });

    let touchpointId: string | undefined;

    if (input.touchpoint && (input.touchpoint.source || input.touchpoint.campaign || input.touchpoint.campaignId)) {
      const touchpoint = await tx.touchpoint.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          visitorId: visitor.id,
          visitorSessionId: session.id,
          source: input.touchpoint.source,
          medium: input.touchpoint.medium,
          campaign: input.touchpoint.campaign,
          content: input.touchpoint.content,
          term: input.touchpoint.term,
          campaignId: input.touchpoint.campaignId,
          adsetId: input.touchpoint.adsetId,
          adId: input.touchpoint.adId,
          creativeId: input.touchpoint.creativeId,
          clickId: input.touchpoint.clickId,
          platform: input.touchpoint.platform,
          landingUrl: input.touchpoint.landingUrl,
          referrer: input.touchpoint.referrer,
          isDirect: false,
        },
      });

      touchpointId = touchpoint.id;
    }

    const event = await tx.event.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        visitorId: visitor.id,
        visitorSessionId: session.id,
        linkId: input.event.linkId,
        touchpointId,
        type: input.event.type,
        name: input.event.name,
        source: input.event.source ?? EventSource.API,
        status: input.event.status,
        occurredAt: input.event.occurredAt ?? now,
        value: input.event.value,
        currency: input.event.currency,
        orderId: input.event.orderId,
        dedupKey: input.event.dedupKey,
        eventId: input.event.eventId,
        externalEventId: input.event.externalEventId,
        properties: input.event.properties as Prisma.InputJsonValue | undefined,
        rawPayload: input.event.rawPayload as Prisma.InputJsonValue | undefined,
      },
    });

    if (shouldCreateConversion(input.event.type)) {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { attributionModel: true, currency: true },
      });

      const { firstTouch, lastTouch } = await resolveAttributionTouches(input.projectId, visitor.id);
      const attributedIds = resolveAttributedIds({
        model: project.attributionModel ?? AttributionModel.LAST_TOUCH,
        firstTouch,
        lastTouch,
      });

      await tx.conversion.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          visitorId: visitor.id,
          eventId: event.id,
          orderId: input.event.orderId,
          occurredAt: event.occurredAt,
          currency: input.event.currency ?? project.currency,
          revenue: input.event.value ?? 0,
          status: conversionStatusFromEvent(input.event.type),
          attributionModel: project.attributionModel,
          firstTouchId: firstTouch?.id,
          lastTouchId: lastTouch?.id,
          campaignId: attributedIds.campaignId,
          adsetId: attributedIds.adsetId,
          adId: attributedIds.adId,
          creativeId: attributedIds.creativeId,
          metadata: {
            inferredFromAttributionModel: project.attributionModel,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return {
      visitorId: visitor.id,
      sessionId: session.id,
      eventId: event.id,
      touchpointId,
    };
  });
}
