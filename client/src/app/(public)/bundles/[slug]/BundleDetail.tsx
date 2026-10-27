"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarClock, CheckCircle2, Layers, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BundleArt, bundleSavingPercent } from "@/components/shared/BundleCard";
import { CourseDeliveryTag } from "@/components/shared/CourseClassification";
import EmptyState from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";
import { FileIcon } from "@/components/site/EditorWindow";
import { useSession } from "@/hooks/useSession";
import { getApiErrorMessage } from "@/lib/httpClient";
import { formatBDT } from "@/lib/utils";
import { bundleOrderService, catalogueService } from "@/services";
import type { PublicBundle } from "@/types/domain.types";

const bnNumber = (value: number) => value.toLocaleString("bn-BD");
const bnDate = (value: string) =>
    new Date(value).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

/** The way in: buy it, sign in to buy it, or why it can't be bought. */
function BuyButton({ bundle }: { bundle: PublicBundle }) {
    const router = useRouter();
    const { isAuthenticated, isLoading, isStudent } = useSession();
    const checkout = useMutation({
        mutationFn: () => bundleOrderService.checkout(bundle.id),
        onSuccess: (order) => {
            if (order.status === "PAID") {
                toast.success("বান্ডেলের কোর্সগুলো আপনার ড্যাশবোর্ডে চলে এসেছে।");
                router.push("/dashboard");
                return;
            }
            router.push(`/checkout/bundle/${order.id}`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "চেকআউট শুরু করা যায়নি।")),
    });

    if (bundle.quote.ownsAll) {
        return (
            <Button size="lg" variant="outline" className="w-full" disabled>
                সবগুলো কোর্স আপনার আছে
            </Button>
        );
    }
    if (!isLoading && !isAuthenticated) {
        return (
            <Button
                size="lg"
                variant="enroll"
                className="w-full"
                onClick={() => router.push(`/login?next=${encodeURIComponent(`/bundles/${bundle.slug}`)}`)}
            >
                বান্ডেলটা নিন
            </Button>
        );
    }
    if (!isLoading && !isStudent) {
        return (
            <Button size="lg" variant="outline" className="w-full" disabled>
                স্টাফ অ্যাকাউন্ট দিয়ে কেনা যায় না
            </Button>
        );
    }
    return (
        <Button
            size="lg"
            variant="enroll"
            className="w-full"
            disabled={isLoading}
            isLoading={checkout.isPending}
            onClick={() => checkout.mutate()}
        >
            <ShoppingBag /> বান্ডেলটা নিন
        </Button>
    );
}

/** The bundle's price beside buying its courses one by one — and, for someone who owns part of it, theirs. */
function PriceCard({ bundle }: { bundle: PublicBundle }) {
    const { quote } = bundle;
    const saving = bundleSavingPercent(bundle);
    const owned = quote.ownedCount > 0 && !quote.ownsAll;

    return (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            <p className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground">
                <FileIcon name="bundle.ts" /> দাম
            </p>
            <div className="p-5">
            <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">আলাদা আলাদা কিনলে</dt>
                    <dd className="font-mono tabular-nums text-muted-foreground line-through">{formatBDT(quote.combined)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">বান্ডেলে</dt>
                    <dd className="font-mono font-semibold tabular-nums">{formatBDT(quote.bundlePrice)}</dd>
                </div>
                {quote.savings > 0 && (
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">সাশ্রয়</dt>
                        <dd className="font-mono font-semibold tabular-nums text-success-ink">
                            {formatBDT(quote.savings)} ({bnNumber(saving)}%)
                        </dd>
                    </div>
                )}
            </dl>

            <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
                <span className="text-sm font-semibold">{owned ? "আপনার দাম" : "মোট"}</span>
                <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{formatBDT(quote.total)}</span>
            </div>
            {owned && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    এর {bnNumber(quote.ownedCount)}টি কোর্স আপনার আগে থেকেই আছে, তাই বাকিগুলোর অংশটুকুই দিচ্ছেন।
                </p>
            )}

            <div className="mt-5">
                <BuyButton bundle={bundle} />
            </div>
            {bundle.endsAt && (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden /> অফার চলবে {bnDate(bundle.endsAt)} পর্যন্ত
                </p>
            )}
            </div>
        </div>
    );
}

/**
 * One bundle: what's in it, each course at its own price, and the bundle's
 * price against buying them separately, with the way to buy it in one
 * checkout. Priced for the viewer, so it's fetched in the browser.
 */
export default function BundleDetail({ slug }: { slug: string }) {
    const { data: bundle, isLoading, isError } = useQuery({
        queryKey: ["bundle", slug],
        queryFn: () => catalogueService.bundle(slug),
    });

    if (isLoading) {
        return (
            <>
                <div className="editor border-b border-editor-line">
                    <div className="container-page space-y-4 py-12">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-9 w-3/4" />
                        <SkeletonLines lines={2} className="max-w-xl" />
                    </div>
                </div>
                <div className="container-page grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-3">
                        {Array.from({ length: 3 }, (_, index) => (
                            <Skeleton key={index} className="h-24 rounded-card" />
                        ))}
                    </div>
                    <Skeleton className="h-80 rounded-card" />
                </div>
            </>
        );
    }

    if (isError || !bundle) {
        return (
            <div className="container-page py-16">
                <EmptyState
                    icon={Layers}
                    title={<span lang="bn">এই বান্ডেলটা এখন পাওয়া যাচ্ছে না</span>}
                    description={<span lang="bn">অফারের সময় হয়তো শেষ, বা এটা বন্ধ করা হয়েছে। অন্য বান্ডেলগুলো দেখে নিন।</span>}
                    action={
                        <Button asChild variant="outline">
                            <Link href="/bundles">All bundles</Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    return (
        <div lang="bn">
            <header data-nav-tone="dark" className="editor relative overflow-hidden border-b border-editor-line">
                <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
                <div className="relative border-b border-editor-line bg-editor-panel">
                    <nav aria-label="Breadcrumb" className="container-page flex items-center gap-1.5 py-2 text-xs text-editor-muted">
                        <Link href="/home" className="shrink-0 hover:text-editor-fg">Home</Link>
                        <span aria-hidden>/</span>
                        <Link href="/bundles" className="shrink-0 hover:text-editor-fg">Bundles</Link>
                        <span aria-hidden>/</span>
                        <span aria-current="page" className="flex min-w-0 items-center gap-1.5 text-editor-fg">
                            <FileIcon name="bundle/" /> <span className="truncate">{bundle.title}</span>
                        </span>
                    </nav>
                </div>
                <div className="container-page relative grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
                    <div className="max-w-2xl">
                        <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-syn-keyword">
                            <Layers className="size-4" aria-hidden /> কোর্স বান্ডেল · {bnNumber(bundle.courses.length)}টি কোর্স
                        </p>
                        <h1 className="text-h1 text-balance">{bundle.title}</h1>
                        {bundle.description && <p className="mt-4 text-lead text-editor-muted">{bundle.description}</p>}
                    </div>
                    <BundleArt bundle={bundle} sizes="(max-width: 1024px) 50vw, 11rem" className="rounded-panel border border-editor-line" />
                </div>
            </header>

            <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
                <section aria-labelledby="bundle-courses" className="min-w-0">
                    <h2 id="bundle-courses" className="flex items-center gap-3 border-b border-border pb-3 text-h3">
                        <span aria-hidden className="h-6 w-1 rounded-full bg-primary" />
                        বান্ডেলের কোর্সগুলো
                    </h2>
                    <ul className="mt-6 space-y-4">
                        {bundle.courses.map((course) => {
                            const price = course.discountPrice ?? course.price;
                            return (
                                <li key={course.id}>
                                    <Link
                                        href={`/courses/${course.slug}`}
                                        className="group flex gap-4 rounded-card border border-border bg-card p-3 transition-colors hover:border-primary/50"
                                    >
                                        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-secondary sm:w-40">
                                            <SafeImage
                                                src={course.thumbnail}
                                                alt=""
                                                fill
                                                sizes="160px"
                                                className="object-cover"
                                                fallback={<BookOpen className="size-6 text-muted-foreground" />}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1 py-1">
                                            {course.category && <p className="text-xs font-medium text-syn-keyword">{course.category.title}</p>}
                                            <p className="mt-0.5 font-semibold leading-snug group-hover:text-primary">{course.title}</p>
                                            <CourseDeliveryTag delivery={course.delivery} mode={course.mode} className="mt-2" />
                                        </div>
                                        <div className="shrink-0 py-1 text-right">
                                            {course.owned ? (
                                                <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-2 py-1 font-mono text-xs font-semibold text-success-ink">
                                                    <CheckCircle2 className="size-3.5" aria-hidden /> আপনার আছে
                                                </span>
                                            ) : (
                                                <span className="font-mono text-sm font-semibold tabular-nums">{price > 0 ? formatBDT(price) : "Free"}</span>
                                            )}
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <aside className="lg:sticky lg:top-24 lg:self-start">
                    <PriceCard bundle={bundle} />
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                        পেমেন্ট একবারেই। আমাদের টিম যাচাই করলেই প্রতিটা কোর্স আলাদা করে আপনার ড্যাশবোর্ডে চলে আসবে, প্রতিটার রসিদও পাবেন।
                    </p>
                </aside>
            </div>
        </div>
    );
}
