"use client";

import {
    Briefcase,
    Check,
    ExternalLink,
    GraduationCap,
    Handshake,
    Home,
    Info,
    Link2,
    MessageSquareQuote,
    Sparkles,
    Star,
    Target,
    User,
    type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { EntryChip, EntryView, durationLabel, periodLabel } from "@/components/profile/EntryView";
import { ViewField } from "@/components/profile/ViewField";
import ProgressRing from "@/components/shared/ProgressRing";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { StudentOverview } from "@/types/admin.types";
import type { ProfileSectionFlags } from "@/types/profile.types";
import { roleLabel } from "./format";

const SECTIONS: { key: keyof ProfileSectionFlags; label: string }[] = [
    { key: "myProfile", label: "Name, phone & WhatsApp" },
    { key: "additionalInfo", label: "Additional info" },
    { key: "address", label: "Address" },
    { key: "education", label: "Education" },
    { key: "importantLinks", label: "Important links" },
    { key: "skillSet", label: "Skills" },
    { key: "jobProfile", label: "Job profile" },
];

const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? null : value ? "Yes" : "No");

const place = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ") || null;

/**
 * Everything the student has put in their profile, laid out the way the
 * student's own profile pages group it — plus the account itself, and
 * anything they've said about Half Coders.
 */
export function StudentProfileTab({ data }: { data: StudentOverview }) {
    const { student, profile } = data;
    const info = profile.additionalInfo;
    const address = profile.address;
    const education = profile.education;
    const links = profile.links;
    const job = profile.jobProfile;

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-6 xl:order-1">
                <Section icon={User} title="Account">
                    <Fields>
                        <ViewField label="Full name" value={student.name} />
                        <ViewField label="Student ID" value={student.studentId && <span className="font-mono">{student.studentId}</span>} />
                        <ViewField
                            label="Email"
                            value={
                                student.email && (
                                    <Verified ok={student.emailVerified}>{student.email}</Verified>
                                )
                            }
                        />
                        <ViewField
                            label="Phone"
                            value={student.phone && <Verified ok={student.phoneVerified}>{student.phone}</Verified>}
                        />
                        <ViewField label="WhatsApp" value={student.whatsapp} />
                        <ViewField label="Role" value={`${roleLabel(student.role)} on Half Coders`} />
                        <ViewField label="Joined Half Coders" value={formatDate(student.createdAt)} />
                        <ViewField
                            label="Account"
                            value={
                                <>
                                    {student.accountStatus === "ACTIVE" ? "Active" : student.accountStatus.toLowerCase()}
                                    {student.accountCreatedAt && (
                                        <span className="font-normal text-muted-foreground"> · since {formatDate(student.accountCreatedAt)}</span>
                                    )}
                                </>
                            }
                        />
                    </Fields>
                    {(student.bio || student.address) && (
                        <Fields>
                            {student.bio && <ViewField label="Bio" value={<span className="whitespace-pre-line">{student.bio}</span>} />}
                            {student.address && <ViewField label="Address on account" value={student.address} />}
                        </Fields>
                    )}
                </Section>

                <Section icon={Info} title="Additional info">
                    <Fields>
                        <ViewField label="Gender" value={info?.gender === "MALE" ? "Male" : info?.gender === "FEMALE" ? "Female" : null} />
                        <ViewField label="Age range" value={info?.ageRange} />
                        <ViewField label="Main device" value={info?.primaryDeviceType} />
                        <ViewField label="Internet" value={info?.internetType} />
                        <ViewField label="Years of experience" value={info?.yearsOfExperience} />
                        <ViewField label="Current role" value={info?.employmentRole} />
                        <ViewField label="Lives in a" value={info?.areaType} />
                    </Fields>
                </Section>

                <Section icon={Home} title="Address">
                    <Fields>
                        <ViewField
                            label="Present address"
                            value={place(address?.presentStreetAddress, address?.presentDistrict, address?.presentCountry)}
                        />
                        <ViewField
                            label="Permanent address"
                            value={
                                address?.sameAsPresent
                                    ? "Same as present"
                                    : place(address?.permanentStreetAddress, address?.permanentDistrict, address?.permanentCountry)
                            }
                        />
                    </Fields>
                </Section>

                <Section icon={GraduationCap} title="Education">
                    <Fields>
                        <ViewField label="Level" value={education?.level} />
                        <ViewField label="Exam / degree" value={education?.examTitle} />
                        <ViewField label="Institution" value={education?.institutionName} />
                        <ViewField
                            label={education?.isCurrentlyStudying ? "Currently in" : "Passing year"}
                            value={education?.isCurrentlyStudying ? education.currentYear ?? "Studying" : education?.passingYear}
                        />
                        <ViewField label="CSE student" value={yesNo(education?.isCseStudent)} />
                    </Fields>
                </Section>

                <Section icon={Link2} title="Important links">
                    <Fields>
                        <ViewField label="CV" value={externalLink(links?.cvUrl)} />
                        <ViewField label="GitHub" value={externalLink(links?.githubUrl)} />
                        <ViewField label="Portfolio" value={externalLink(links?.portfolioUrl)} />
                        <ViewField label="LinkedIn" value={externalLink(links?.linkedinUrl)} />
                        <ViewField label="Professional photo" value={externalLink(links?.profileImageUrl)} />
                    </Fields>
                    {profile.projects.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Projects · {profile.projects.length}
                            </p>
                            <ul className="grid gap-3 sm:grid-cols-2">
                                {profile.projects.map((project) => (
                                    <li key={project.id} className="rounded-xl border border-border px-4 py-3">
                                        <a
                                            href={project.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 font-medium hover:underline"
                                        >
                                            <span className="truncate">{project.title}</span>
                                            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                        </a>
                                        {project.description && (
                                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Section>

                <Section icon={Sparkles} title="Skills" count={profile.skills.length}>
                    {profile.skills.length === 0 ? (
                        <Empty>No skills added.</Empty>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {profile.skills.map((skill) => (
                                <li key={skill.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                                    <span className="font-medium">{skill.name}</span>
                                    {skill.yearsOfExperience && (
                                        <span className="text-muted-foreground"> · {skill.yearsOfExperience} yr</span>
                                    )}
                                    {skill.projectLink && (
                                        <a
                                            href={skill.projectLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                        >
                                            project <ExternalLink className="size-3" aria-hidden />
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>

                <Section icon={Target} title="Job profile">
                    <Fields>
                        <ViewField label="Looking for a job" value={yesNo(job?.wantsJob)} />
                        <ViewField label="Job type" value={job?.jobType} />
                        <ViewField label="Works" value={job?.jobPreference} />
                        <ViewField label="Would work abroad" value={yesNo(job?.wantsJobOutsideBangladesh)} />
                        <ViewField label="Has job experience" value={yesNo(job?.hasJobExperience)} />
                    </Fields>
                </Section>

                <Section icon={Briefcase} title="Job experience" count={profile.jobExperiences.length}>
                    {profile.jobExperiences.length === 0 ? (
                        <Empty>No job experience added.</Empty>
                    ) : (
                        <ul className="divide-y divide-border">
                            {profile.jobExperiences.map((entry) => {
                                const duration = durationLabel(entry.startDate, entry.endDate, entry.isCurrentlyWorking);
                                return (
                                    <li key={entry.id} className="py-4 first:pt-0 last:pb-0">
                                        <EntryView
                                            company={entry.companyName}
                                            title={entry.designation}
                                            active={entry.isCurrentlyWorking}
                                            chips={
                                                <>
                                                    <EntryChip>{periodLabel(entry.startDate, entry.endDate, entry.isCurrentlyWorking)}</EntryChip>
                                                    {duration && <EntryChip>{duration}</EntryChip>}
                                                    {entry.isCurrentlyWorking && <EntryChip tone="success">Current</EntryChip>}
                                                    {entry.isRelatedToIt && <EntryChip tone="primary">IT</EntryChip>}
                                                </>
                                            }
                                        >
                                            {entry.description && <p className="whitespace-pre-line">{entry.description}</p>}
                                        </EntryView>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Section>

                <Section icon={Handshake} title="Got hired" count={profile.hiredRecords.length}>
                    {profile.hiredRecords.length === 0 ? (
                        <Empty>No jobs recorded.</Empty>
                    ) : (
                        <ul className="divide-y divide-border">
                            {profile.hiredRecords.map((entry) => (
                                <li key={entry.id} className="py-4 first:pt-0 last:pb-0">
                                    <EntryView
                                        company={entry.companyName}
                                        title={entry.position}
                                        active={entry.isCurrentlyWorking}
                                        chips={
                                            <>
                                                <EntryChip>{periodLabel(entry.startDate, entry.endDate, entry.isCurrentlyWorking)}</EntryChip>
                                                {entry.jobType && <EntryChip>{entry.jobType}</EntryChip>}
                                                {place(entry.companyCity, entry.companyCountry) && (
                                                    <EntryChip>{place(entry.companyCity, entry.companyCountry)}</EntryChip>
                                                )}
                                                {entry.isCurrentlyWorking && <EntryChip tone="success">Current</EntryChip>}
                                            </>
                                        }
                                    >
                                        {entry.howGotJob && <p><span className="font-medium text-foreground">How they got it:</span> {entry.howGotJob}</p>}
                                        {entry.description && <p className="whitespace-pre-line">{entry.description}</p>}
                                        {entry.careerImpactNote && (
                                            <p className="whitespace-pre-line">
                                                <span className="font-medium text-foreground">How Half Coders helped:</span> {entry.careerImpactNote}
                                            </p>
                                        )}
                                        {entry.appointmentLetterUrl && (
                                            <a
                                                href={entry.appointmentLetterUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                            >
                                                Appointment letter <ExternalLink className="size-3.5" aria-hidden />
                                            </a>
                                        )}
                                    </EntryView>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>

                <Section icon={MessageSquareQuote} title="Course requests" count={profile.courseRequests.length}>
                    {profile.courseRequests.length === 0 ? (
                        <Empty>No courses requested.</Empty>
                    ) : (
                        <ul className="divide-y divide-border">
                            {profile.courseRequests.map((request) => (
                                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{request.courseName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {request.category ? `${request.category} · ` : ""}
                                            {formatDate(request.createdAt)}
                                        </p>
                                    </div>
                                    <Badge variant={request.status === "FULFILLED" ? "success" : request.status === "DECLINED" ? "secondary" : "default"}>
                                        {request.status.charAt(0) + request.status.slice(1).toLowerCase()}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-6 xl:order-2 xl:self-start">
                <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                        <ProgressRing value={profile.completionPercent} size={64} stroke={5}>
                            <span className="text-sm">{profile.completionPercent}%</span>
                        </ProgressRing>
                        <div>
                            <p className="font-semibold">Profile completion</p>
                            <p className="text-xs text-muted-foreground">
                                {Object.values(profile.sections).filter(Boolean).length} of {SECTIONS.length} sections done
                            </p>
                        </div>
                    </div>
                    <ul className="mt-4 space-y-2">
                        {SECTIONS.map(({ key, label }) => {
                            const done = profile.sections[key];
                            return (
                                <li key={key} className="flex items-center gap-2.5 text-sm">
                                    <span
                                        className={cn(
                                            "grid size-4.5 shrink-0 place-items-center rounded-full",
                                            done ? "bg-brand text-white" : "border border-dashed border-muted-foreground/50",
                                        )}
                                        aria-hidden
                                    >
                                        {done && <Check className="size-3" strokeWidth={3} />}
                                    </span>
                                    <span className={cn(!done && "text-muted-foreground")}>{label}</span>
                                    <span className="sr-only">{done ? "complete" : "incomplete"}</span>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {data.testimonials.length > 0 && (
                    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <p className="font-semibold">What they said about Half Coders</p>
                        <ul className="mt-3 space-y-4">
                            {data.testimonials.map((testimonial) => (
                                <li key={testimonial.id} className="space-y-1.5">
                                    <p className="flex items-center gap-0.5" aria-label={`${testimonial.rating} out of 5`}>
                                        {Array.from({ length: 5 }).map((_, index) => (
                                            <Star
                                                key={index}
                                                className={cn(
                                                    "size-3.5",
                                                    index < testimonial.rating ? "fill-warning text-warning" : "text-muted-foreground/40",
                                                )}
                                                aria-hidden
                                            />
                                        ))}
                                    </p>
                                    <blockquote className="text-sm leading-relaxed">“{testimonial.quote}”</blockquote>
                                    <p className="text-xs text-muted-foreground">
                                        {testimonial.course?.title ?? "Half Coders"} · {testimonial.isPublished ? "on the site" : "not published"}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </aside>
        </div>
    );
}

function Section({ icon: Icon, title, count, children }: { icon: LucideIcon; title: string; count?: number; children: ReactNode }) {
    return (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold">
                <Icon className="size-4 text-primary" aria-hidden />
                {title}
                {count !== undefined && count > 0 && <span className="text-sm font-normal text-muted-foreground">{count}</span>}
            </h3>
            {children}
        </section>
    );
}

function Fields({ children }: { children: ReactNode }) {
    return <dl className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{children}</dl>;
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Verified({ ok, children }: { ok: boolean; children: ReactNode }) {
    return (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="min-w-0 break-all">{children}</span>
            <span className={cn("text-xs font-normal", ok ? "text-success" : "text-muted-foreground")}>
                {ok ? "verified" : "not verified"}
            </span>
        </span>
    );
}

/** A stored link, as a link — or nothing, so the field reads "Not added yet". */
function externalLink(href: string | null | undefined) {
    if (!href) return null;
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
            <span className="truncate">{href.replace(/^https?:\/\/(www\.)?/, "")}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        </a>
    );
}
