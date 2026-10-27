"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/httpClient";
import { conceptualAuthoring } from "@/services/conceptual";
import type { Filed } from "./recordingState";

/** The one-click fix for a recording students can't see, in words. */
export const publishLabel = ({ recording, topic }: Filed) =>
    !recording.isPublished && !topic.isPublished ? "Publish with topic" : !topic.isPublished ? "Publish topic" : "Publish";

/**
 * Makes a recording live — publishing it, its topic, or both, whatever it's
 * missing — or hides it again. The recording goes first and the topic last,
 * so the API's single announcement covers everything newly live in the topic.
 */
export function usePublishRecording() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ filed, hide = false }: { filed: Filed; hide?: boolean }) => {
            const { recording, topic } = filed;
            if (hide) {
                await conceptualAuthoring.updateRecording(recording.id, { isPublished: false });
                return "hidden" as const;
            }
            if (!recording.isPublished) await conceptualAuthoring.updateRecording(recording.id, { isPublished: true });
            if (!topic.isPublished) await conceptualAuthoring.updateTopic(topic.id, { isPublished: true });
            return "live" as const;
        },
        onSuccess: async (result) => {
            // Both this page's queries and the course's own manager live under it.
            await queryClient.invalidateQueries({ queryKey: ["conceptual"] });
            toast.success(result === "live" ? "Live — students are being told." : "Hidden from students.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't update that recording.")),
    });
}
