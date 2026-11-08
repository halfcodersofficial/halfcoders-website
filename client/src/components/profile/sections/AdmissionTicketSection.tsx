"use client";

import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import Link from "next/link";
import { AdmissionTicketCard } from "@/components/shared/AdmissionTicket";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardService } from "@/services";
import { ProfileEmptyState } from "../ProfileEmptyState";

/**
 * The admission ticket of every course that gives one, each under its
 * course's name — to save or share again any time. Which courses those are
 * comes from the "My learning" payload (`hasAdmissionTicket`, the same rule
 * the ticket itself follows), shared through its query key.
 */
export function AdmissionTicketSection() {
    const { data, isLoading } = useQuery({
        queryKey: ["dashboard", "student"],
        queryFn: dashboardService.student,
    });

    if (isLoading) {
        return <Skeleton className="h-80 rounded-card" />;
    }

    const withTicket = (data?.enrollments ?? []).filter((enrollment) => enrollment.hasAdmissionTicket);

    if (withTicket.length === 0) {
        return (
            <ProfileEmptyState
                icon={Ticket}
                title="No admission ticket yet"
                description="When you join a course that gives an admission ticket, it shows up here — ready to save or share."
                action={
                    <Button asChild variant="brand-outline" className="px-5">
                        <Link href="/dashboard">Go to my courses</Link>
                    </Button>
                }
            />
        );
    }

    return (
        <div className="space-y-5">
            {withTicket.map((enrollment) => (
                <AdmissionTicketCard key={enrollment.id} courseId={enrollment.courseId} courseTitle={enrollment.course.title} />
            ))}
        </div>
    );
}
