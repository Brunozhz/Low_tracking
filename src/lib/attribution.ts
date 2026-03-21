import { AttributionModel, ConversionStatus, EventType, type Touchpoint } from "@prisma/client";

import { db } from "@/lib/db";

export async function resolveAttributionTouches(projectId: string, visitorId: string) {
  const [firstTouch, lastTouch] = await Promise.all([
    db.touchpoint.findFirst({
      where: { projectId, visitorId },
      orderBy: { occurredAt: "asc" },
    }),
    db.touchpoint.findFirst({
      where: { projectId, visitorId },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  return { firstTouch, lastTouch };
}

export function resolveAttributedIds({
  model,
  firstTouch,
  lastTouch,
}: {
  model: AttributionModel;
  firstTouch: Touchpoint | null;
  lastTouch: Touchpoint | null;
}) {
  const chosenTouch = model === AttributionModel.FIRST_TOUCH ? firstTouch : lastTouch;

  return {
    campaignId: chosenTouch?.campaignId ?? lastTouch?.campaignId ?? firstTouch?.campaignId,
    adsetId: chosenTouch?.adsetId ?? lastTouch?.adsetId ?? firstTouch?.adsetId,
    adId: chosenTouch?.adId ?? lastTouch?.adId ?? firstTouch?.adId,
    creativeId: chosenTouch?.creativeId ?? lastTouch?.creativeId ?? firstTouch?.creativeId,
  };
}

export function conversionStatusFromEvent(type: EventType) {
  switch (type) {
    case EventType.PURCHASE_APPROVED:
      return ConversionStatus.APPROVED;
    case EventType.PURCHASE_DECLINED:
      return ConversionStatus.DECLINED;
    case EventType.REFUND:
      return ConversionStatus.REFUNDED;
    default:
      return ConversionStatus.PENDING;
  }
}

