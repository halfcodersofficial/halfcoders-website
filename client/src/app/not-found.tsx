import { ArrowRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/shared/Footer";
import MissingPath from "@/components/shared/MissingPath";
import Navbar from "@/components/shared/Navbar";
import EditorWindow from "@/components/site/EditorWindow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Next marks a 404 response noindex itself.
export const metadata: Metadata = { title: "Page not found" };

/**
 * Every unmatched address, and every `notFound()`. It renders outside the
 * (public) layout, so it brings the site's header and footer itself. The
 * missing page as a failed `cd` in a terminal, a big `404` under it, then a
 * search and the ways back.
 */
export default function NotFound() {
    return (
        <div className="flex min-h-dvh flex-col">
            <Navbar />
            <main className="container-page flex flex-1 flex-col items-center justify-center py-16 sm:py-24">
                <EditorWindow tabs={[{ name: "terminal.sh", label: "Terminal", active: true }]} className="w-full max-w-2xl">
                    <div className="space-y-1 px-5 py-5 font-mono text-[0.8rem] leading-6 sm:px-6">
                        <MissingPath />
                        <p className="pt-6 text-6xl font-semibold leading-none text-editor-fg sm:text-7xl">404</p>
                        <p className="text-syn-comment">{"// page not found"}</p>
                    </div>
                </EditorWindow>

                <h1 className="mt-10 text-center text-h2">এই পেজটা খুঁজে পাওয়া গেল না</h1>
                <p className="mt-3 max-w-md text-center text-muted-foreground" lang="bn">
                    লিংকটা হয়তো পুরনো, বা পেজটা সরানো হয়েছে। নিচে কোর্স খুঁজুন, অথবা শুরু থেকে আবার যান।
                </p>

                <form action="/courses" method="get" role="search" className="mt-8 flex w-full max-w-md items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input type="search" name="searchTerm" placeholder="Search courses…" aria-label="Search courses" className="h-12 bg-card pl-9 font-mono sm:h-12" />
                    </div>
                    <Button type="submit" size="lg" variant="brand">
                        Search
                    </Button>
                </form>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button asChild variant="outline">
                        <Link href="/courses">
                            All courses <ArrowRight />
                        </Link>
                    </Button>
                    <Button asChild variant="ghost">
                        <Link href="/home">Home</Link>
                    </Button>
                </div>

                <p className="mt-10 text-center text-sm text-muted-foreground">
                    Half Coders-এর কোনো লিংক থেকে এখানে এসেছেন?{" "}
                    <Link href="/contact" className="font-semibold text-primary hover:underline">
                        আমাদের জানান
                    </Link>
                    , ঠিক করে দেব।
                </p>
            </main>
            <Footer />
        </div>
    );
}
