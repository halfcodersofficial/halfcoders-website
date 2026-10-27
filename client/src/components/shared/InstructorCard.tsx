import { Github, Globe, Linkedin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { UserSummary } from "@/types/domain.types";

const MENTOR_ROLE: Record<string, { bn: string }> = {
    LEAD: { bn: "লিড মেন্টর" },
    CO_MENTOR: { bn: "কো-মেন্টর" },
    SUPPORT: { bn: "সাপোর্ট মেন্টর" },
};

/**
 * A mentor as a contributor card: a strip naming their role on the course,
 * then the photo, name, designation and experience, a few lines of
 * bio, what they know as tags, and their profiles. Sized by its own width —
 * two to a row, side by side where there's room, stacked where there isn't.
 */
export default function InstructorCard({ mentor, role }: { mentor: UserSummary; role?: string }) {
    const profile = mentor.mentorProfile;
    const expertise = profile?.expertise ?? [];
    const roleMeta = role ? MENTOR_ROLE[role] : undefined;
    const socials = [
        { href: profile?.linkedinUrl, icon: Linkedin, label: "LinkedIn" },
        { href: profile?.githubUrl, icon: Github, label: "GitHub" },
        { href: profile?.websiteUrl, icon: Globe, label: "Website" },
    ].filter((link): link is typeof link & { href: string } => Boolean(link.href));

    return (
        <article className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-card transition-colors hover:border-primary/40">
            <p className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2 text-xs font-semibold text-primary">
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                {roleMeta?.bn ?? "মেন্টর"}
            </p>

            <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-center gap-4">
                    <Avatar src={mentor.image} name={mentor.name} size={64} className="shrink-0 rounded-md" />
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold leading-snug">{mentor.name}</h3>
                        {profile?.designation && <p className="mt-0.5 text-sm font-medium text-syn-func">{profile.designation}</p>}
                        {profile?.experience && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                অভিজ্ঞতা: <span className="font-semibold text-foreground">{profile.experience}</span>
                            </p>
                        )}
                    </div>
                </div>

                {mentor.bio && <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{mentor.bio}</p>}

                {expertise.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                        {expertise.slice(0, 6).map((skill) => (
                            <li key={skill} className="rounded-sm border border-border bg-surface px-2 py-0.5 font-mono text-[0.7rem] text-foreground/80">
                                {skill}
                            </li>
                        ))}
                    </ul>
                )}

                {socials.length > 0 && (
                    <div className="mt-auto flex gap-2 border-t border-border pt-4">
                        {socials.map(({ href, icon: Icon, label }) => (
                            <a
                                key={label}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${mentor.name} — ${label}`}
                                title={label}
                                className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                                <Icon className="size-4" />
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}
