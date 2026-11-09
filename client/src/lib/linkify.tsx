const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

/**
 * Free text someone typed — a broadcast, an announcement, a lesson's
 * description, a support session's notes — often carries a raw URL ("Join:
 * https://meet.google.com/…"). This turns each one into a real link that
 * opens in a new tab, so leaving for a meeting or a form never takes the
 * student off their lesson. Only http(s) addresses become links.
 */
export const linkify = (text: string) =>
    text.split(URL_PATTERN).map((part, index) => {
        if (!part.startsWith("http://") && !part.startsWith("https://")) return part;

        const trailingMatch = part.match(TRAILING_PUNCTUATION);
        const trailing = trailingMatch ? trailingMatch[0] : "";
        const url = trailing ? part.slice(0, -trailing.length) : part;

        return (
            <span key={index}>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-primary underline underline-offset-2 hover:text-primary/80"
                >
                    {url}
                </a>
                {trailing}
            </span>
        );
    });
