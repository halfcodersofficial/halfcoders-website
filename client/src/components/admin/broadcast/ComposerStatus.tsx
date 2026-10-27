import { Check } from "lucide-react";

/** What a composer just sent — kept to show in the receipt and the preview until the next one starts. */
export interface Sent<T extends { title: string }> {
    values: T;
    /** "1,248 students" — as the API counted them. */
    reach: string;
    /** "15:42". */
    at: string;
}

/** Under the send button once something has gone out: what, to how many, when. */
export function SentReceipt<T extends { title: string }>({ sent, note }: { sent: Sent<T>; note?: string }) {
    return (
        <p
            role="status"
            className="mt-5 flex items-start gap-2.5 border-t border-border pt-4 text-sm animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none"
        >
            <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" aria-hidden />
            </span>
            <span className="min-w-0">
                <span className="font-medium">Sent &ldquo;{sent.values.title}&rdquo;</span>{" "}
                <span className="text-muted-foreground">
                    to {sent.reach} at {sent.at}.{note && ` ${note}`}
                </span>
            </span>
        </p>
    );
}

/** Beside the message step's title while there's an unsent draft. */
export function DraftStatus({ onClear }: { onClear: () => void }) {
    return (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
            Draft kept on this device
            <span aria-hidden>·</span>
            <button
                type="button"
                onClick={onClear}
                className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
            >
                Clear
            </button>
        </span>
    );
}
