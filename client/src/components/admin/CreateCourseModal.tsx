"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CalendarRange, Check, Crop, FileText, ImagePlus, Library, Plus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useFileDrop, validatePdfFile } from "@/components/admin/usePdfDrop";
import { CourseClassBadges, deliveryChoices, modeChoices, phaseChoices, pricingChoices } from "@/components/shared/CourseClassification";
import { Button } from "@/components/ui/button";
import { ChoiceCards, type Choice } from "@/components/ui/choice-cards";
import { FormField, RequiredLegend } from "@/components/ui/form";
import { ImageCropModal } from "@/components/ui/image-crop";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Modal,
    ModalBody,
    ModalDescription,
    ModalFooter,
    modalFormClass,
    ModalHeader,
    ModalSteps,
    ModalTitle,
} from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { NotProvided, ReviewRow, ReviewSection } from "@/components/ui/review";
import { useStepFlow } from "@/hooks/useStepFlow";
import { useZodForm } from "@/hooks/useZodForm";
import {
    COURSE_IMAGE_ACCEPT,
    COURSE_IMAGE_ASPECT,
    COURSE_IMAGE_WIDTH,
    MAX_COURSE_IMAGES,
    validateCourseImage,
} from "@/lib/courseImages";
import { COURSE_DELIVERIES, COURSE_MODES, COURSE_PHASES, COURSE_PRICINGS, DELIVERY_META, hasVenue, MODE_META, PHASE_META } from "@/lib/courseClassification";
import { getApiErrorMessage } from "@/lib/httpClient";
import { cn, formatBDT } from "@/lib/utils";
import { numericField, textField } from "@/lib/validation";
import { adminService } from "@/services/admin";
import { curriculumAuthoring } from "@/services/curriculum";

const MAX_PRICE = 10_000_000;

const COURSE_TYPES: (Choice & { label: string; summary: string })[] = [
    {
        value: "BOOTCAMP",
        label: "Bootcamp",
        summary: "Bootcamp — real-time outline",
        description: "A dated outline, with lessons released on a schedule.",
        icon: CalendarRange,
    },
    {
        value: "TRADITIONAL",
        label: "Traditional",
        summary: "Traditional — self-paced syllabus",
        description: "Self-paced: no scheduling, just publish or unpublish.",
        icon: Library,
    },
];

/**
 * Creating a course asks for what the API can't default — a title, a
 * description and the three classifications (status, free or paid, how the
 * classes are delivered), none of them preselected so each is a deliberate
 * choice — plus the course type. Everything else about pricing, media, page
 * copy, mentors and the timetable lives in the editor it lands on next; all of
 * these can be changed there later.
 */
const createSchema = z
    .object({
        title: textField({ label: "Title", min: 3, max: 160 }),
        categoryId: z.string(),
        description: textField({ label: "Description", min: 20 }),
        phase: z.enum(COURSE_PHASES, "Choose the course status"),
        pricing: z.enum(COURSE_PRICINGS, "Choose free or paid"),
        // Checked below, and only for a paid course — a free one is ৳0.
        price: z.string(),
        delivery: z.enum(COURSE_DELIVERIES, "Choose how the classes are delivered"),
        mode: z.enum(COURSE_MODES, "Choose online, offline or both"),
        venue: z.string().trim().max(200, "Keep the venue under 200 characters"),
        courseType: z.enum(["BOOTCAMP", "TRADITIONAL"]),
    })
    .superRefine((data, ctx) => {
        if (data.pricing !== "PAID") return;
        numericField({ label: "Price", min: 1, max: MAX_PRICE })
            .safeParse(data.price)
            .error?.issues.forEach((issue) => ctx.addIssue({ code: "custom", path: ["price"], message: issue.message }));
    });

type CreateValues = {
    title: string;
    categoryId: string;
    description: string;
    phase: string;
    pricing: string;
    price: string;
    delivery: string;
    mode: string;
    venue: string;
    courseType: string;
};

const EMPTY: CreateValues = {
    title: "", categoryId: "", description: "",
    phase: "", pricing: "", price: "", delivery: "", mode: "", venue: "",
    courseType: "BOOTCAMP",
};

const STEPS: { label: string; description: string; fields: (keyof CreateValues)[] }[] = [
    {
        label: "Basics",
        description: "Saved as a draft. You'll land in the editor to add the rest.",
        fields: ["title", "categoryId", "description"],
    },
    {
        label: "Classify",
        description: "Where the course stands, what it costs, how it's taught and where. Students see all of it; each can change later.",
        fields: ["phase", "pricing", "price", "delivery", "mode", "venue", "courseType"],
    },
    {
        label: "Files",
        description: "The last things a draft needs: its curriculum PDF and a thumbnail.",
        // Files aren't form fields — this step is gated on them instead.
        fields: [],
    },
];

const STEP_LABELS = STEPS.map((step) => step.label);

const FILES_STEP = 2;
const PDF_INPUT_ID = "new-course-pdf";
const PDF_DROP_ID = "new-course-pdf-drop";
const THUMBNAIL_INPUT_ID = "new-course-thumbnail";

interface CreateCourseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Create a course: three steps, then a review of everything entered, where
 * any section can be reopened before the draft is created. The admin lands in
 * the course editor straight after.
 */
export default function CreateCourseModal({ open, onOpenChange }: CreateCourseModalProps) {
    return (
        <Modal open={open} onOpenChange={onOpenChange} size="lg" closeOnOutsideClick={false}>
            <CreateCourseWizard onClose={() => onOpenChange(false)} />
        </Modal>
    );
}

function CreateCourseWizard({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Three steps, then a read-only summary holding the real Create button.
    const flow = useStepFlow(STEPS.length);
    const { step } = flow;
    const stepRef = useRef<HTMLDivElement>(null);

    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfProgress, setPdfProgress] = useState(0);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const pdfProgressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    // Attaching a PDF here can't hit the upload endpoint yet — it needs a
    // courseId, which only exists after the draft is created on submit — so
    // this fills the bar client-side to gate "Create draft" on the file
    // actually being fully read/attached rather than just picked.
    const stopPdfProgress = () => {
        if (pdfProgressTimer.current) {
            clearInterval(pdfProgressTimer.current);
            pdfProgressTimer.current = null;
        }
    };

    const startPdfProgress = () => {
        stopPdfProgress();
        setPdfProgress(0);
        pdfProgressTimer.current = setInterval(() => {
            setPdfProgress((prev) => {
                const next = prev + Math.floor(Math.random() * 15) + 10;
                if (next >= 100) {
                    stopPdfProgress();
                    return 100;
                }
                return next;
            });
        }, 150);
    };

    useEffect(() => stopPdfProgress, []);

    const pdfReady = pdfFile !== null && pdfProgress >= 100;

    // The thumbnail, like the PDF, waits here until the draft exists to attach
    // it to. The picked original is kept alongside the crop so "Adjust" can
    // re-crop from the full image rather than from the crop itself.
    const [thumbnailSource, setThumbnailSource] = useState<string | null>(null);
    const [thumbnail, setThumbnail] = useState<{ image: Blob; preview: string } | null>(null);
    // What the cropper is showing — a fresh pick, or the source again.
    const [cropSource, setCropSource] = useState<string | null>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Every object URL made here, released on the way out.
    const objectUrls = useRef(new Set<string>());
    const objectUrlFor = (file: Blob) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);
        return url;
    };
    const release = (url: string | null | undefined) => {
        if (!url) return;
        URL.revokeObjectURL(url);
        objectUrls.current.delete(url);
    };
    useEffect(() => {
        const urls = objectUrls.current;
        return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }, []);

    const handleThumbnailFile = (file: File) => {
        const error = validateCourseImage(file);
        if (error) {
            toast.error(error);
            return;
        }
        setCropSource(objectUrlFor(file));
    };

    const onThumbnailCropped = (image: Blob) => {
        if (cropSource !== thumbnailSource) {
            release(thumbnailSource);
            setThumbnailSource(cropSource);
        }
        release(thumbnail?.preview);
        setThumbnail({ image, preview: objectUrlFor(image) });
        setCropSource(null);
    };

    const cancelCrop = () => {
        // A fresh pick that was never used; the source of an adjust stays.
        if (cropSource !== thumbnailSource) release(cropSource);
        setCropSource(null);
    };

    const removeThumbnail = () => {
        release(thumbnailSource);
        release(thumbnail?.preview);
        setThumbnailSource(null);
        setThumbnail(null);
    };

    const filesReady = pdfReady && thumbnail !== null;

    const { data: categories } = useQuery({
        queryKey: ["admin", "categories"],
        queryFn: adminService.categories,
        staleTime: 10 * 60_000,
    });

    const create = useMutation({
        mutationFn: async ({ values, pdf, image }: { values: z.output<typeof createSchema>; pdf: File; image: Blob }) => {
            const course = await adminService.createCourse({
                title: values.title,
                description: values.description,
                phase: values.phase,
                pricing: values.pricing,
                delivery: values.delivery,
                mode: values.mode,
                ...(hasVenue(values.mode) && values.venue && { venue: values.venue }),
                // A free course is ৳0; the API stores it so whatever it's sent.
                ...(values.pricing === "PAID" && { price: Number(values.price) }),
                categoryId: values.categoryId || undefined,
                courseType: values.courseType,
            });

            // The draft exists either way past this point — a failed upload
            // shouldn't strand the admin without the course they just named
            // and priced, so each is a warning on top of success, not a reason
            // to treat the whole thing as failed.
            const [pdfUpload, imageUpload] = await Promise.allSettled([
                adminService.uploadCurriculumPdf(course.id, pdf),
                curriculumAuthoring
                    .uploadCourseImage(course.id, image)
                    .then((url) => adminService.updateCourse(course.id, { thumbnail: url })),
            ]);
            if (pdfUpload.status === "rejected") {
                toast.error(
                    getApiErrorMessage(
                        pdfUpload.reason,
                        "Draft created, but the curriculum PDF failed to upload — upload it from the editor.",
                    ),
                );
            }
            if (imageUpload.status === "rejected") {
                toast.error(
                    getApiErrorMessage(
                        imageUpload.reason,
                        "Draft created, but the thumbnail failed to upload — add it on the editor's Course page tab.",
                    ),
                );
            }

            return { course, complete: pdfUpload.status === "fulfilled" && imageUpload.status === "fulfilled" };
        },
        onSuccess: ({ course, complete }) => {
            if (complete) {
                toast.success("Draft created with its thumbnail and curriculum PDF. Build the rest in the editor.");
            }
            void queryClient.invalidateQueries({ queryKey: ["admin"] });
            onClose();
            router.push(`/admin/courses/${course.id}`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "Couldn't create that course.")),
    });

    const handlePdfFile = (file: File) => {
        const error = validatePdfFile(file);
        if (error) {
            toast.error(error);
            return;
        }
        setPdfFile(file);
        startPdfProgress();
    };

    const removePdfFile = () => {
        stopPdfProgress();
        setPdfFile(null);
        setPdfProgress(0);
    };

    const { dragActive, dropHandlers } = useFileDrop(handlePdfFile, create.isPending);
    const thumbnailDrop = useFileDrop(handleThumbnailFile, create.isPending);

    const form = useZodForm({
        schema: createSchema,
        initialValues: EMPTY,
        onSubmit: (values) => {
            if (!pdfFile || !pdfReady || !thumbnail) return;
            create.mutate({ values, pdf: pdfFile, image: thumbnail.image });
        },
    });

    const { idFor } = form;

    // Focus follows the step: its first field, the PDF drop zone on the files
    // step, or the summary on review.
    useEffect(() => {
        if (step === STEPS.length) stepRef.current?.focus();
        else if (step === FILES_STEP) (document.getElementById(PDF_DROP_ID) ?? stepRef.current)?.focus();
        else document.getElementById(idFor(STEPS[step].fields[0]))?.focus();
    }, [step, idFor]);

    /** Reveals the step's errors and focuses the first; true when it has none. */
    const checkStep = (index: number) => {
        if (index === FILES_STEP) return filesReady;
        const { fields } = STEPS[index];
        fields.forEach((name) => form.touch(name));
        const invalid = fields.find((name) => name in form.errors);
        if (invalid) document.getElementById(idFor(invalid))?.focus();
        return !invalid;
    };

    // Next, Create draft and Confirm are all this form's submit button, so
    // Enter in a field moves forward exactly like clicking it.
    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (flow.justChanged()) return;

        if (flow.isReview) {
            // Each step was checked on the way here, but one reopened from the
            // review and then left with Back wasn't checked again.
            const invalid = STEPS.findIndex(({ fields }) => fields.some((name) => name in form.errors));
            if (invalid !== -1) {
                STEPS[invalid].fields.forEach((name) => form.touch(name));
                flow.editFromReview(invalid);
                return;
            }
            if (!filesReady) {
                flow.editFromReview(FILES_STEP);
                return;
            }
            form.submit();
            return;
        }

        if (!checkStep(step)) return;
        flow.advance();
    };

    const primary =
        flow.isReview ? (
            <>
                <Plus /> Confirm &amp; create
            </>
        ) : flow.returnToReview ? (
            <>
                <Check /> Back to review
            </>
        ) : flow.isLastStep ? (
            <>
                <Plus /> Create draft
            </>
        ) : (
            <>
                Next <ArrowRight />
            </>
        );

    const categoryName = categories?.find((category) => category.id === form.values.categoryId)?.title ?? null;

    return (
        <>
            <ModalHeader>
                <ModalTitle>{flow.isReview ? "Review and create" : "New course"}</ModalTitle>
                <ModalDescription>
                    {flow.isReview
                        ? "Check what you entered. Edit any section to change it, then confirm to create the draft."
                        : STEPS[step].description}
                </ModalDescription>
                <ModalSteps
                    steps={STEP_LABELS}
                    current={step}
                    canSelect={(index) => index < step && !create.isPending}
                    onSelect={flow.select}
                />
            </ModalHeader>

            <form className={modalFormClass} noValidate onSubmit={onSubmit}>
                <ModalBody className="sm:min-h-[min(26rem,55dvh)]">
                    <div
                        key={step}
                        ref={stepRef}
                        tabIndex={-1}
                        className={cn("space-y-5 outline-none", flow.enterClass)}
                    >
                        {step === 0 && (
                            <>
                                <RequiredLegend />

                                <FormField
                                    form={form}
                                    name="title"
                                    label="Title"
                                    required
                                    counterMax={160}
                                    hint="Becomes the public URL."
                                >
                                    <Input placeholder="MERN Stack Development" autoComplete="off" />
                                </FormField>

                                <FormField form={form} name="categoryId" label="Category" optional>
                                    <Select placeholder="No category">
                                        {categories?.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.title}
                                            </option>
                                        ))}
                                    </Select>
                                </FormField>

                                <FormField
                                    form={form}
                                    name="description"
                                    label="Description"
                                    required
                                    hint="At least 20 characters — this is what the catalogue card shows."
                                >
                                    <Textarea rows={4} />
                                </FormField>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <RequiredLegend />

                                <FormField
                                    form={form}
                                    name="phase"
                                    label="Course status"
                                    required
                                    hint="The catalogue lists present courses first, then upcoming, then previous."
                                >
                                    <ChoiceCards choices={phaseChoices()} columns={3} />
                                </FormField>

                                <FormField form={form} name="pricing" label="Free or paid" required>
                                    <ChoiceCards choices={pricingChoices()} columns={2} />
                                </FormField>

                                {form.values.pricing === "PAID" && (
                                    <FormField
                                        form={form}
                                        name="price"
                                        label="Price (৳)"
                                        required
                                        hint="A discount can be added in the editor."
                                    >
                                        <Input type="number" inputMode="numeric" min={1} max={MAX_PRICE} placeholder="e.g. 4500" />
                                    </FormField>
                                )}

                                <FormField
                                    form={form}
                                    name="delivery"
                                    label="Class delivery"
                                    required
                                    hint="Shown on the course card and the course page."
                                >
                                    <ChoiceCards choices={deliveryChoices()} columns={3} />
                                </FormField>

                                <FormField
                                    form={form}
                                    name="mode"
                                    label="Delivery mode"
                                    required
                                    hint="Online, in person at a venue, or both. Students can filter the catalogue by it."
                                >
                                    <ChoiceCards choices={modeChoices()} columns={3} />
                                </FormField>

                                {hasVenue(form.values.mode) && (
                                    <FormField form={form} name="venue" label="Venue" optional counterMax={200} hint="Shown on the course page.">
                                        <Input placeholder="e.g. Half Coders office, Banani, Dhaka" />
                                    </FormField>
                                )}

                                <FormField
                                    form={form}
                                    name="courseType"
                                    label="Course type"
                                    required
                                    hint="Changeable later in the editor."
                                >
                                    <ChoiceCards choices={COURSE_TYPES} columns={2} />
                                </FormField>
                            </>
                        )}

                        {step === FILES_STEP && (
                            <div className="grid gap-5 @xl:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor={PDF_INPUT_ID}>
                                        Curriculum PDF
                                        <span className="ml-0.5 text-destructive" aria-hidden>
                                            *
                                        </span>
                                    </Label>

                                    {pdfFile ? (
                                        <div className="space-y-2 rounded-xl border border-border p-3">
                                            <div className="flex items-center gap-3">
                                                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                                    <FileText className="size-4" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium">{pdfFile.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {fileSize(pdfFile)}
                                                        {pdfReady ? " · Ready" : ` · Uploading… ${pdfProgress}%`}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={create.isPending}
                                                    onClick={removePdfFile}
                                                >
                                                    <X /> Remove
                                                </Button>
                                            </div>
                                            <Progress value={pdfProgress} />
                                        </div>
                                    ) : (
                                        <div
                                            {...dropHandlers}
                                            id={PDF_DROP_ID}
                                            role="button"
                                            tabIndex={0}
                                            aria-labelledby={PDF_INPUT_ID}
                                            onClick={() => pdfInputRef.current?.click()}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    pdfInputRef.current?.click();
                                                }
                                            }}
                                            className={cn(
                                                "grid min-h-36 cursor-pointer place-content-center rounded-xl border-[1.5px] border-dashed p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                dragActive
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border-strong hover:border-primary/50 hover:bg-surface",
                                            )}
                                        >
                                            <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
                                            <p className="text-sm">
                                                <span className="font-medium text-primary">Choose a file</span> or drag
                                                and drop
                                            </p>
                                            <input
                                                id={PDF_INPUT_ID}
                                                ref={pdfInputRef}
                                                type="file"
                                                accept="application/pdf"
                                                className="hidden"
                                                onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    event.target.value = "";
                                                    if (file) handlePdfFile(file);
                                                }}
                                            />
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground">
                                        The roadmap students download from the listing page before enrolling. PDF, up
                                        to 5 MB — required to create the course.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor={THUMBNAIL_INPUT_ID}>
                                        Thumbnail
                                        <span className="ml-0.5 text-destructive" aria-hidden>
                                            *
                                        </span>
                                    </Label>

                                    {thumbnail ? (
                                        <div className="overflow-hidden rounded-xl border border-border">
                                            {/* A local blob: URL, so a plain <img> rather than the optimizer. */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={thumbnail.preview}
                                                alt="Thumbnail preview"
                                                className="aspect-video w-full border-b border-border object-cover"
                                            />
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium">16:9 · Ready</p>
                                                    <p className="text-xs text-muted-foreground">Uploads with the draft.</p>
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={create.isPending}
                                                        onClick={() => setCropSource(thumbnailSource)}
                                                    >
                                                        <Crop /> Adjust
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={create.isPending}
                                                        onClick={removeThumbnail}
                                                    >
                                                        <X /> Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            {...thumbnailDrop.dropHandlers}
                                            role="button"
                                            tabIndex={0}
                                            aria-labelledby={THUMBNAIL_INPUT_ID}
                                            onClick={() => thumbnailInputRef.current?.click()}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    thumbnailInputRef.current?.click();
                                                }
                                            }}
                                            className={cn(
                                                "grid min-h-36 cursor-pointer place-content-center rounded-xl border-[1.5px] border-dashed p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                thumbnailDrop.dragActive
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border-strong hover:border-primary/50 hover:bg-surface",
                                            )}
                                        >
                                            <ImagePlus className="mx-auto mb-2 size-6 text-muted-foreground" />
                                            <p className="text-sm">
                                                <span className="font-medium text-primary">Choose an image</span> or drag
                                                and drop
                                            </p>
                                            <input
                                                id={THUMBNAIL_INPUT_ID}
                                                ref={thumbnailInputRef}
                                                type="file"
                                                accept={COURSE_IMAGE_ACCEPT}
                                                className="hidden"
                                                onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    event.target.value = "";
                                                    if (file) handleThumbnailFile(file);
                                                }}
                                            />
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground">
                                        Shown on the course card and in the catalogue. Cropped to 16:9 — JPEG, PNG or
                                        WebP. Up to {MAX_COURSE_IMAGES - 1} more images can be added in the editor.
                                    </p>
                                </div>
                            </div>
                        )}

                        {flow.isReview && (
                            <CourseReview
                                values={form.values}
                                categoryName={categoryName}
                                pdfFile={pdfFile}
                                thumbnailPreview={thumbnail?.preview ?? null}
                                onEdit={flow.editFromReview}
                                disabled={create.isPending}
                            />
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button type="button" variant="ghost" className="sm:mr-auto" onClick={onClose}>
                        Cancel
                    </Button>
                    {step > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => flow.goTo(step - 1)}
                            disabled={create.isPending}
                        >
                            <ArrowLeft /> Back
                        </Button>
                    )}
                    <Button
                        type="submit"
                        isLoading={flow.isReview && create.isPending}
                        // Both files are required: nothing past their step
                        // goes forward until they're attached.
                        disabled={step >= FILES_STEP && !filesReady}
                    >
                        {primary}
                    </Button>
                </ModalFooter>
            </form>

            <ImageCropModal
                src={cropSource}
                aspect={COURSE_IMAGE_ASPECT}
                outputWidth={COURSE_IMAGE_WIDTH}
                title="Adjust thumbnail"
                onCancel={cancelCrop}
                onConfirm={onThumbnailCropped}
            />
        </>
    );
}

const fileSize = (file: File) => `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

interface CourseReviewProps {
    values: CreateValues;
    categoryName: string | null;
    pdfFile: File | null;
    thumbnailPreview: string | null;
    onEdit: (step: number) => void;
    disabled: boolean;
}

/** Everything entered, as it will be saved, with a way back into each step. */
function CourseReview({ values, categoryName, pdfFile, thumbnailPreview, onEdit, disabled }: CourseReviewProps) {
    const title = values.title.trim();
    const price = values.pricing === "PAID" ? Number(values.price) : 0;
    const courseType = COURSE_TYPES.find((option) => option.value === values.courseType)?.summary ?? values.courseType;
    const phase = PHASE_META[values.phase as keyof typeof PHASE_META];
    const delivery = DELIVERY_META[values.delivery as keyof typeof DELIVERY_META];
    const mode = MODE_META[values.mode as keyof typeof MODE_META];

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/70 p-3 @md:flex-row @md:items-center">
                {thumbnailPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnailPreview} alt="" className="aspect-video w-full shrink-0 rounded-lg border border-border object-cover @md:w-44" />
                ) : (
                    <span className="grid aspect-video w-full shrink-0 place-items-center rounded-lg bg-primary/10 text-primary @md:w-44">
                        <BookOpen className="size-6" />
                    </span>
                )}
                <div className="min-w-0 space-y-1.5">
                    <p className="line-clamp-2 font-semibold leading-snug">{title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                        Draft{categoryName ? ` · ${categoryName}` : ""}
                    </p>
                    {phase && delivery && (
                        <CourseClassBadges
                            phase={values.phase as keyof typeof PHASE_META}
                            delivery={values.delivery as keyof typeof DELIVERY_META}
                            mode={mode ? (values.mode as keyof typeof MODE_META) : undefined}
                            pricing={values.pricing === "FREE" ? "FREE" : "PAID"}
                        />
                    )}
                </div>
            </div>

            <ReviewSection title="Basics" onEdit={() => onEdit(0)} disabled={disabled}>
                <dl className="space-y-2.5">
                    <ReviewRow label="Title">{title}</ReviewRow>
                    <ReviewRow label="Category">{categoryName ?? <NotProvided>No category</NotProvided>}</ReviewRow>
                    <ReviewRow label="Description">
                        <span className="whitespace-pre-line">{values.description.trim()}</span>
                    </ReviewRow>
                </dl>
            </ReviewSection>

            <ReviewSection title="Classification" onEdit={() => onEdit(1)} disabled={disabled}>
                <dl className="space-y-2.5">
                    <ReviewRow label="Status">{phase?.admin ?? <NotProvided />}</ReviewRow>
                    <ReviewRow label="Price">
                        {values.pricing === "FREE" ? <span className="font-medium text-success">Free</span> : formatBDT(price)}
                    </ReviewRow>
                    <ReviewRow label="Class delivery">{delivery?.label ?? <NotProvided />}</ReviewRow>
                    <ReviewRow label="Delivery mode">
                        {mode ? `${mode.label}${hasVenue(values.mode) && values.venue.trim() ? ` · ${values.venue.trim()}` : ""}` : <NotProvided />}
                    </ReviewRow>
                    <ReviewRow label="Course type">{courseType}</ReviewRow>
                </dl>
            </ReviewSection>

            <ReviewSection title="Files" onEdit={() => onEdit(FILES_STEP)} disabled={disabled}>
                <dl className="space-y-2.5">
                    <ReviewRow label="Curriculum PDF">
                        {pdfFile ? (
                            <span className="flex min-w-0 items-center gap-2">
                                <FileText className="size-4 shrink-0 text-primary" />
                                <span className="truncate">{pdfFile.name}</span>
                                <span className="shrink-0 text-muted-foreground">{fileSize(pdfFile)}</span>
                            </span>
                        ) : (
                            <NotProvided />
                        )}
                    </ReviewRow>
                    <ReviewRow label="Thumbnail">
                        {thumbnailPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={thumbnailPreview}
                                alt="Thumbnail"
                                className="aspect-video w-40 rounded-md border border-border object-cover"
                            />
                        ) : (
                            <NotProvided />
                        )}
                    </ReviewRow>
                </dl>
            </ReviewSection>
        </div>
    );
}
