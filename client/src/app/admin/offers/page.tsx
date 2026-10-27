"use client";

import { PromotionCoursesPage } from "@/components/admin/promotions/PromotionParts";

/** "Buy one, get more free", course by course — every paid course, each opening its offer. */
export default function AdminOffersPage() {
    return <PromotionCoursesPage kind="offer" />;
}
