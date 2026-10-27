"use client";

import { PromotionCoursesPage } from "@/components/admin/promotions/PromotionParts";

/** Rewards for finishing a course in time, course by course — each opening its reward. */
export default function AdminRewardsPage() {
    return <PromotionCoursesPage kind="reward" />;
}
