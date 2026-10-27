"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import Link from "next/link";
import BundleCard from "@/components/shared/BundleCard";
import { CourseCardSkeleton } from "@/components/shared/CourseCard";
import { CARD_GRID } from "@/components/site/CardGrid";
import EmptyState from "@/components/site/EmptyState";
import PageHeader from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { catalogueService } from "@/services";

/**
 * The bundles on sale, priced for whoever is looking — someone who already
 * owns part of a bundle sees what the rest costs them. Asked of the API in the
 * browser for that reason.
 */
export default function BundleList() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["bundles"],
        queryFn: catalogueService.bundles,
        staleTime: 60_000,
    });

    return (
        <>
            <PageHeader
                eyebrow={<span lang="bn">কোর্স বান্ডেল</span>}
                title={<span lang="bn">কয়েকটা কোর্স, এক প্যাকেজে</span>}
                description={
                    <span lang="bn">
                        বান্ডেলে কয়েকটা কোর্স একসাথে — আলাদা কিনলে যা লাগত তার চেয়ে কম দামে, পেমেন্ট একবারেই। কোনো কোর্স আগেই কেনা থাকলে শুধু বাকিগুলোর দাম দেবেন।
                    </span>
                }
            />

            <section className="container-page py-10 sm:py-14">
                {isLoading ? (
                    <div className={CARD_GRID}>
                        {Array.from({ length: 4 }).map((_, index) => (
                            <CourseCardSkeleton key={index} />
                        ))}
                    </div>
                ) : isError ? (
                    <EmptyState
                        icon={Layers}
                        title={<span lang="bn">বান্ডেলের লিস্ট আনা গেল না</span>}
                        description={<span lang="bn">ইন্টারনেট সংযোগ দেখে একটু পরে আবার চেষ্টা করুন।</span>}
                        action={
                            <Button variant="outline" onClick={() => void refetch()}>
                                Retry
                            </Button>
                        }
                    />
                ) : !data?.length ? (
                    <EmptyState
                        icon={Layers}
                        title={<span lang="bn">এই মুহূর্তে কোনো বান্ডেল নেই</span>}
                        description={<span lang="bn">নতুন বান্ডেল এলেই এখানে দেখা যাবে। ততক্ষণ আলাদা কোর্সগুলো দেখে নিন।</span>}
                        action={
                            <Button asChild variant="outline">
                                <Link href="/courses">Browse courses</Link>
                            </Button>
                        }
                    />
                ) : (
                    <ul className={CARD_GRID}>
                        {data.map((bundle) => (
                            <li key={bundle.id} className="flex">
                                <BundleCard bundle={bundle} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
