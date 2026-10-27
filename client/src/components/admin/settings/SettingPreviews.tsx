"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Lock, Play, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/admin";

/**
 * The wait a student sees, worked through for one place in the line: two
 * people ahead × the minutes per student — the same sum the support queue
 * does (`peopleAhead × slotMinutes`).
 */
export function QueueExample({ minutes }: { minutes: number | null }) {
    const ahead = 2;

    return (
        <div className="rounded-xl bg-secondary/40 p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">What a student sees</p>
            <div className="mt-3 flex items-end gap-2" aria-hidden>
                {["Serving", "Next", "You"].map((label, index) => (
                    <span key={label} className="flex flex-col items-center gap-1">
                        <span
                            className={cn(
                                "grid size-8 place-items-center rounded-full",
                                index === ahead ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
                            )}
                        >
                            <User className="size-4" />
                        </span>
                        <span className={cn("text-[0.625rem]", index === ahead ? "font-semibold text-primary" : "text-muted-foreground")}>
                            {label}
                        </span>
                    </span>
                ))}
            </div>
            <p className="mt-3 text-sm">
                {minutes ? (
                    <>
                        Third in line: <span className="font-semibold tabular-nums">about {ahead * minutes} min</span>{" "}
                        <span className="text-muted-foreground">
                            ({ahead} ahead × {minutes} min)
                        </span>
                    </>
                ) : (
                    <span className="text-muted-foreground">Enter the minutes to see the estimate.</span>
                )}
            </p>
        </div>
    );
}

/**
 * The ID the next certificate will get under the prefix being typed — asked
 * of the API, which counts per prefix and year, so it's the real next number
 * rather than an example.
 */
export function CertificatePreview({ prefix }: { prefix: string | null }) {
    const settled = useDebouncedValue(prefix, 350);
    const { data, isFetching, isError } = useQuery({
        queryKey: ["admin", "certificate-preview", settled],
        queryFn: () => adminService.certificatePreview(settled!),
        enabled: Boolean(settled),
        staleTime: 30_000,
    });

    return (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/3 p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Next certificate</p>
            <div className="mt-2 min-h-8">
                {!prefix ? (
                    <p className="text-sm text-muted-foreground">Fix the prefix to see the next ID.</p>
                ) : isError ? (
                    <p className="text-sm text-muted-foreground">Couldn&apos;t work out the next ID just now.</p>
                ) : !data || settled !== prefix ? (
                    <Skeleton className="h-8 w-56" />
                ) : (
                    <p className={cn("font-mono text-xl font-semibold tracking-wide transition-opacity sm:text-2xl", isFetching && "opacity-60")}>
                        {data.next}
                    </p>
                )}
            </div>
        </div>
    );
}

const MODULES = ["Module 1", "Module 2", "Module 3", "Module 4"];

/**
 * A student two modules in, drawn both ways: with sequential learning on,
 * everything after the module they're on is locked; off, it's all open.
 */
export function SequenceDiagram({ sequential }: { sequential: boolean }) {
    return (
        <div className="rounded-xl bg-secondary/40 p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                A student who has finished Module 1
            </p>
            <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden>
                {MODULES.map((label, index) => {
                    const done = index === 0;
                    const current = index === 1;
                    const locked = sequential && index > 1;

                    return (
                        <li
                            key={label}
                            className={cn(
                                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors duration-300",
                                done && "border-primary/30 bg-primary/5",
                                current && "border-primary bg-card font-medium",
                                !done && !current && (locked ? "border-dashed border-border text-muted-foreground" : "border-border bg-card"),
                            )}
                        >
                            {done ? (
                                <Check className="size-4 text-primary" />
                            ) : locked ? (
                                <Lock className="size-4" />
                            ) : (
                                <Play className={cn("size-4", current ? "text-primary" : "text-muted-foreground")} />
                            )}
                            {label}
                        </li>
                    );
                })}
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">
                {sequential
                    ? "Modules 3 and 4 open one at a time, as each one before them is finished."
                    : "Every published module is open — they can work in any order."}
            </p>
        </div>
    );
}
