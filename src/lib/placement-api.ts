import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  Application,
  Company,
  JobWithCompany,
  Me,
  NotificationRow,
  Profile,
  RecruiterApplication,
} from "./types";

// ---------- protected reads ----------

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Me> => {
    const { supabase, userId } = context;
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
    const roles = ((rolesRes.data ?? []) as { role: Me["roles"][number] }[]).map((r) => r.role);
    const primaryRole = roles.includes("admin")
      ? "admin"
      : roles.includes("recruiter")
        ? "recruiter"
        : "student";
    return { userId, roles, primaryRole, profile: (profileRes.data ?? null) as Profile | null };
  });

export const getStudentData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Application[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("applications")
      .select("*, job:jobs(*, company:companies(*)), interviews(*)")
      .eq("student_id", userId)
      .order("applied_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Application[];
  });

export const getRecruiterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const me = await getMe();

    const { data: jobs, error: jobsErr } = await supabase
      .from("jobs")
      .select("*, company:companies(*)")
      .order("created_at", { ascending: false });
    if (jobsErr) throw new Error(jobsErr.message);

    const visibleJobs =
      me.primaryRole === "admin"
        ? ((jobs ?? []) as unknown as JobWithCompany[])
        : ((jobs ?? []).filter((j) => j.posted_by === userId) as unknown as JobWithCompany[]);

    const jobIds = visibleJobs.map((j) => j.id);
    const { data: apps, error: appsErr } = jobIds.length
      ? await supabase
          .from("applications")
          .select("*, job:jobs(*, company:companies(*)), student:profiles(*), interviews(*)")
          .in("job_id", jobIds)
          .order("applied_at", { ascending: false })
      : { data: [], error: null };
    if (appsErr) throw new Error(appsErr!.message);

    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("*")
      .order("name");
    if (compErr) throw new Error(compErr.message);

    return {
      jobs: visibleJobs,
      applications: (apps ?? []) as unknown as RecruiterApplication[],
      companies: (companies ?? []) as unknown as Company[],
    };
  });

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [appsRes, jobsRes, companiesRes, profilesRes] = await Promise.all([
      supabase
        .from("applications")
        .select("*, job:jobs(*, company:companies(*)), student:profiles(*), interviews(*)")
        .order("applied_at", { ascending: false }),
      supabase.from("jobs").select("*, company:companies(*)").order("created_at", { ascending: false }),
      supabase.from("companies").select("*").order("name"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    ]);
    for (const r of [appsRes, jobsRes, companiesRes, profilesRes]) {
      if (r.error) throw new Error(r.error.message);
    }
    const apps = (appsRes.data ?? []) as unknown as RecruiterApplication[];
    const jobs = (jobsRes.data ?? []) as unknown as JobWithCompany[];
    const companies = (companiesRes.data ?? []) as unknown as Company[];
    const profiles = (profilesRes.data ?? []) as unknown as Profile[];

    const byStatus = apps.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      stats: {
        totalApplications: apps.length,
        byStatus,
        openJobs: jobs.filter((j) => j.status === "open").length,
        closedJobs: jobs.filter((j) => j.status === "closed").length,
        totalJobs: jobs.length,
        verifiedCompanies: companies.filter((c) => c.verified).length,
        totalCompanies: companies.length,
        students: profiles.filter((p) => p.roll_no != null).length,
        recruiters: profiles.filter((p) => p.company_id != null).length,
        people: profiles.length,
      },
      applications: apps,
      jobs,
      companies,
      profiles,
    };
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationRow[]> => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationRow[];
  });

// ---------- mutations ----------

function friendlyApplyError(message: string): string {
  if (message.includes("row-level security")) {
    return "You don't meet this role's eligibility criteria (branch, CGPA, graduation year, or the deadline may have passed).";
  }
  return message;
}

export const applyToJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid(), coverLetter: z.string().max(4000).optional() }).parse(input))
  .handler(async ({ context, input }) => {
    const { error } = await context.supabase.from("applications").insert({
      job_id: input.jobId,
      student_id: context.userId,
      cover_letter: input.coverLetter?.trim() || null,
      status: "applied",
    });
    if (error) throw new Error(friendlyApplyError(error.message));
    return { ok: true as const };
  });

export const withdrawApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid() }).parse(input))
  .handler(async ({ context, input }) => {
    const { error } = await context.supabase.from("applications").delete().eq("id", input.applicationId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        status: z.enum(["applied", "shortlisted", "interviewing", "selected", "rejected"]),
        finalPackage: z.number().nonnegative().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, input }) => {
    const patch: Record<string, unknown> = { status: input.status };
    if (input.status === "selected") patch.final_package = input.finalPackage ?? null;
    if (input.status !== "selected") patch.final_package = null;
    const { error } = await context.supabase
      .from("applications")
      .update(patch)
      .eq("id", input.applicationId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const scheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        round: z.string().min(1),
        mode: z.enum(["online", "onsite"]),
        scheduledAt: z.string().min(1),
        location: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, input }) => {
    const { error } = await context.supabase.from("interviews").insert({
      application_id: input.applicationId,
      round: input.round,
      mode: input.mode,
      scheduled_at: new Date(input.scheduledAt).toISOString(),
      location: input.location?.trim() || (input.mode === "online" ? "Online (link shared later)" : "Venue TBA"),
      status: "scheduled",
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        interviewId: z.string().uuid(),
        status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
        feedback: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, input }) => {
    const patch: Record<string, unknown> = {};
    if (input.status) patch.status = input.status;
    if (input.feedback !== undefined) patch.feedback = input.feedback;
    const { error } = await context.supabase.from("interviews").update(patch).eq("id", input.interviewId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const upsertJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        companyId: z.string().uuid(),
        title: z.string().min(2),
        jobType: z.enum(["full-time", "internship"]),
        workMode: z.enum(["onsite", "hybrid", "remote"]),
        location: z.string().optional(),
        description: z.string().optional(),
        openings: z.number().int().positive(),
        ctcMin: z.number().nonnegative().optional(),
        ctcMax: z.number().nonnegative().optional(),
        stipend: z.number().nonnegative().optional(),
        minCgpa: z.number().min(0).max(10).optional(),
        eligibleBranches: z.array(z.string()).default([]),
        minGradYear: z.number().int().optional(),
        maxGradYear: z.number().int().optional(),
        deadline: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, input }) => {
    const row = {
      company_id: input.companyId,
      title: input.title,
      job_type: input.jobType,
      work_mode: input.workMode,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      openings: input.openings,
      ctc_min: input.ctcMin ?? null,
      ctc_max: input.ctcMax ?? null,
      stipend: input.stipend ?? null,
      min_cgpa: input.minCgpa ?? null,
      eligible_branches: input.eligibleBranches,
      min_grad_year: input.minGradYear ?? null,
      max_grad_year: input.maxGradYear ?? null,
      deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
    };
    if (input.id) {
      const { error } = await context.supabase.from("jobs").update(row).eq("id", input.id);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { error } = await context.supabase.from("jobs").insert({ ...row, posted_by: context.userId, status: "open" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid(), status: z.enum(["open", "closed"]) }).parse(input))
  .handler(async ({ context, input }) => {
    const { error } = await context.supabase.from("jobs").update({ status: input.status }).eq("id", input.jobId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ context, input }) => {
    const { error } = await context.supabase.from("jobs").delete().eq("id", input.jobId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2),
        industry: z.string().optional(),
        website: z.string().optional(),
        about: z.string().optional(),
        logoEmoji: z.string().max(8).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, input }) => {
    const row = {
      name: input.name.trim(),
      industry: input.industry?.trim() || null,
      website: input.website?.trim() || null,
      about: input.about?.trim() || null,
      logo_emoji: input.logoEmoji?.trim() || "🏢",
    };
    if (input.id) {
      const { error } = await context.supabase.from("companies").update(row).eq("id", input.id);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const { data, error } = await context.supabase
      .from("companies")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // link the recruiter to the new company
    await context.supabase.from("profiles").update({ company_id: data.id }).eq("id", context.userId);
    return { ok: true as const, companyId: data.id as string };
  });

export const verifyCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: z.string().uuid(), verified: z.boolean() }).parse(input))
  .handler(async ({ context, input }) => {
    const { error } = await context.supabase.from("companies").update({ verified: input.verified }).eq("id", input.companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().min(2).optional(),
        branch: z.string().optional(),
        cgpa: z.number().min(0).max(10).optional(),
        graduationYear: z.number().int().optional(),
        rollNo: z.string().optional(),
        phone: z.string().optional(),
        bio: z.string().max(600).optional(),
        resumeUrl: z.string().optional(),
        companyId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, input }) => {
    const patch: Record<string, unknown> = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName.trim();
    if (input.branch !== undefined) patch.branch = input.branch || null;
    if (input.cgpa !== undefined) patch.cgpa = input.cgpa;
    if (input.graduationYear !== undefined) patch.graduation_year = input.graduationYear;
    if (input.rollNo !== undefined) patch.roll_no = input.rollNo || null;
    if (input.phone !== undefined) patch.phone = input.phone || null;
    if (input.bio !== undefined) patch.bio = input.bio || null;
    if (input.resumeUrl !== undefined) patch.resume_url = input.resumeUrl || null;
    if (input.companyId !== undefined) patch.company_id = input.companyId;
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", context.userId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
