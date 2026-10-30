import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { type StaffArea, staffCourseRoutes } from "@/lib/staffRoutes";

/**
 * What the Module Manager and the Outline Maker show for an upcoming course,
 * which has no modules and no running outline yet — in place of an editor
 * whose every add the API would refuse. Says when it opens and, for an
 * admin, where to open it.
 */
export default function CurriculumClosedNotice({
    tool,
    area,
    courseId,
}: {
    tool: "Module Manager" | "Outline Maker";
    area: StaffArea;
    courseId: string;
}) {
    const routes = staffCourseRoutes(area, courseId);

    return (
        <div className="w-full space-y-6">
            {/* In the mentor console the course's own tab bar does this. */}
            {area === "admin" && <BackButton href={routes.courses} label="All courses" />}
            <section className="mx-auto max-w-xl rounded-card border border-dashed border-border bg-card px-6 py-12 text-center animate-in fade-in duration-500 motion-reduce:animate-none">
                <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-md border border-border bg-primary/10 text-primary">
                    <CalendarClock className="size-6" />
                </span>
                <h1 className="mt-5 text-balance text-xl font-semibold">The {tool} opens when the course starts</h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    This is an upcoming course, so it has no modules and no running outline yet.{" "}
                    {area === "admin"
                        ? "Move it to Present on its Catalogue page once classes begin."
                        : "An admin moves it to Present once classes begin."}
                </p>
                {area === "admin" && (
                    <Button asChild className="mt-6">
                        <Link href={routes.overview}>Open course settings</Link>
                    </Button>
                )}
            </section>
        </div>
    );
}
