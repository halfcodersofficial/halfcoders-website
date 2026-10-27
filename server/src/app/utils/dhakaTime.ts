/** "Fri 17 Oct, 9:00 pm" — as students in Bangladesh read it, whatever timezone the server runs in. */
export const dhakaWhen = (date: Date) =>
    date.toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

/** "9:00 pm", Dhaka time. */
export const dhakaClock = (date: Date) =>
    date.toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit", hour12: true });
