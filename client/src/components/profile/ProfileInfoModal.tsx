"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { Modal, ModalBody } from "@/components/ui/modal";

const POINTS = [
    "তোমার প্রোফাইলের সবগুলো সেকশন খুব মনোযোগ দিয়ে চেক করে নাও।",
    "সব তথ্য অবশ্যই সঠিক হতে হবে — কোনো অসামঞ্জস্যতা পাওয়া গেলে তোমার প্রোফাইল রিক্রুটারদের কাছে দেখানো হবে না।",
    "কোর্স শেষ করার পর প্রোফাইলের সবগুলো তথ্য পূরণ করে ফেলো, যাতে প্লেসমেন্ট পোর্টালে আবেদন করতে পারো। প্রোফাইল ১০০% সম্পূর্ণ হলে এবং কোর্স শেষ হলেই আবেদনের অপশনটি চালু হবে।",
    "তোমার প্রোফাইল জমা দেওয়ার পর, আমাদের প্লেসমেন্ট টিম সেটি পর্যালোচনা করে উপযুক্ত সুযোগের বিষয়ে যোগাযোগ করবে।",
    "কোনো আইটি-সংক্রান্ত কাজের পূর্ব-অভিজ্ঞতা থাকলে, তা অবশ্যই Job Experience সেকশনে যুক্ত করো — এটি তোমার প্লেসমেন্ট প্রোফাইলকে আরও শক্তিশালী করবে।",
];

/**
 * The small "(i)" info button next to the avatar, opening a popup that
 * explains what a complete profile is for — the same affordance the
 * Programming Hero reference shows next to its avatar, reworded in our own
 * voice rather than copied.
 */
export function ProfileInfoModal() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Profile update information"
                className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-card/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-primary"
            >
                <Info className="size-4" />
            </button>

            <Modal open={open} onOpenChange={setOpen} title="Profile Update Information">
                <ModalBody>
                    <ol lang="bn" className="divide-y divide-border">
                        {POINTS.map((point, index) => (
                            <li key={index} className="flex gap-3 py-3 text-sm leading-relaxed text-foreground/85 first:pt-0 last:pb-0">
                                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                                    {index + 1}
                                </span>
                                <span>{point}</span>
                            </li>
                        ))}
                    </ol>
                </ModalBody>
            </Modal>
        </>
    );
}
