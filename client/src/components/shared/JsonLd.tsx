/**
 * Structured data for search engines, as a `<script type="application/ld+json">`.
 * `<` is escaped: the data carries text admins and mentors write (course
 * titles, FAQ answers), and a `</script>` in it would close the tag early and
 * turn the rest into the page's own HTML.
 */
export default function JsonLd({ data }: { data: object }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
        />
    );
}
