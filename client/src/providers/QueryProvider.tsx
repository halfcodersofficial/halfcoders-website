"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isAxiosError } from "axios";

/**
 * The client is created inside state rather than at module scope so each
 * browser session gets its own cache. A module-level client would be shared
 * across requests during SSR and leak one user's data into another's render.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60_000,
                        refetchOnWindowFocus: false,
                        retry: (failureCount, error) => {
                            // 4xx means the request was wrong, not unlucky —
                            // retrying a 401 or a 403 just delays the answer.
                            if (isAxiosError(error)) {
                                const code = error.response?.status ?? 0;
                                if (code >= 400 && code < 500) return false;
                            }
                            return failureCount < 2;
                        },
                    },
                    mutations: { retry: false },
                },
            }),
    );

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
