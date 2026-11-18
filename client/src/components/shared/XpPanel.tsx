"use client";

import { ClipboardCheck, Clock, FileText, Trophy, type LucideIcon } from "lucide-react";
import { Modal, ModalBody } from "@/components/ui/modal";

/** The default amounts (the API's `DEFAULT_XP_RULES`). */
const EARN_RULES: { key: string; icon: LucideIcon; points: string; title: string; blurb: string }[] = [
    {
        key: "module-on-time",
        icon: ClipboardCheck,
        points: "+2",
        title: "Finish a module within 24 hours",
        blurb: "On a bootcamp the 24 hours start when the module is released; on a self-paced course, when you start it.",
    },
    { key: "module-late", icon: Clock, points: "+1", title: "Finish a module after that", blurb: "Late still counts — just a little less." },
    {
        key: "assignment",
        icon: FileText,
        points: "+3",
        title: "Hand in an assignment by its deadline",
        blurb: "A late hand-in earns none.",
    },
];

/**
 * The header's XP badge opens this: the student's total and how XP is earned —
 * nothing more. The award-by-award history isn't shown. Half Coders' XP isn't
 * a currency, so there's nothing to spend or redeem either.
 */
export function XpPanel({ open, onOpenChange, totalXp }: { open: boolean; onOpenChange: (open: boolean) => void; totalXp: number | undefined }) {
    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <span className="inline-flex items-center gap-2">
                    <Trophy className="size-5 text-primary" /> Your XP
                </span>
            }
        >
            <div className="border-y border-border px-6 py-5 text-center">
                <p className="text-3xl font-bold tabular-nums">{(totalXp ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total XP earned</p>
            </div>

            <ModalBody>
                <p className="mb-3 text-sm font-semibold text-muted-foreground">How you earn XP</p>
                <ul className="divide-y divide-border">
                    {EARN_RULES.map(({ key, icon: Icon, points, title, blurb }) => (
                        <li key={key} className="flex items-start gap-3 py-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                <Icon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{title}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-success">{points}</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    Nothing else earns XP. Each module and assignment counts once.
                </p>
            </ModalBody>
        </Modal>
    );
}
