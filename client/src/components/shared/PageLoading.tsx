import { Skeleton } from "@/components/ui/skeleton";
import { PreparingMessage } from "./SlowServerNotice";

/**
 * The loading screen of a page rendered on the server (`loading.tsx`): a
 * skeleton of the page, and — only if it's still there after a few seconds,
 * so a quick navigation never flashes it — the "getting ready, up to two
 * minutes" note. A client page's slow load is covered by `SlowServerNotice`.
 */
export default function PageLoading({ pathname, layout }: { pathname: string; layout: "grid" | "detail" }) {
    return (
        <div className="container-page space-y-8 py-10 sm:py-14" aria-busy>
            <div
                className="mx-auto max-w-xl rounded-card border border-border bg-card px-4 py-3 shadow-card animate-in fade-in fill-mode-both duration-500 motion-reduce:animate-none"
                style={{ animationDelay: "3s" }}
            >
                <PreparingMessage pathname={pathname} />
            </div>

            {layout === "grid" ? (
                <>
                    <div className="space-y-3">
                        <Skeleton className="h-9 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="overflow-hidden rounded-card border border-border bg-card">
                                <Skeleton className="aspect-video w-full rounded-none" />
                                <div className="space-y-2.5 p-4">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="mt-4 h-9 w-28" />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
                    <div className="space-y-4">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-11 w-full max-w-2xl" />
                        <Skeleton className="h-11 w-2/3" />
                        <Skeleton className="h-4 w-full max-w-xl" />
                        <Skeleton className="h-4 w-5/6 max-w-xl" />
                        <Skeleton className="mt-6 h-64 w-full rounded-card" />
                    </div>
                    <Skeleton className="h-96 w-full rounded-card" />
                </div>
            )}
        </div>
    );
}
