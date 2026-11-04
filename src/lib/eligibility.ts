// Pure eligibility engine — mirrors the database's insert policy for
// applications ("Eligible students apply to open jobs"). Used to show
// eligibility up-front on job pages; the database enforces the same rule
// authoritatively on every apply attempt.
import type { Job, Profile } from "./types";

export type EligibilityCheck = {
  label: string;
  ok: boolean;
  detail?: string;
};

export type EligibilityResult = {
  eligible: boolean;
  checks: EligibilityCheck[];
};

export function checkEligibility(
  job: Job,
  profile: Pick<Profile, "branch" | "cgpa" | "graduation_year"> | null,
): EligibilityResult {
  const checks: EligibilityCheck[] = [];
  const hasProfile = !!profile;

  checks.push({
    label: "Role is open",
    ok: job.status === "open",
    detail: job.status === "open" ? undefined : "This posting is closed.",
  });

  if (job.deadline) {
    const ok = new Date(job.deadline).getTime() > Date.now();
    checks.push({
      label: "Before the deadline",
      ok,
      detail: ok ? undefined : "Applications closed.",
    });
  }

  if (job.eligible_branches && job.eligible_branches.length > 0) {
    const ok = hasProfile && !!profile!.branch && job.eligible_branches.includes(profile!.branch);
    checks.push({
      label: `Branch: ${job.eligible_branches.join(", ")}`,
      ok,
      detail: hasProfile && !ok ? `Your branch (${profile!.branch ?? "not set"}) isn't eligible.` : undefined,
    });
  }

  if (job.min_cgpa != null) {
    const ok = hasProfile && profile!.cgpa != null && profile!.cgpa >= job.min_cgpa;
    checks.push({
      label: `Minimum CGPA ${job.min_cgpa}`,
      ok,
      detail: hasProfile && !ok ? `Your CGPA (${profile!.cgpa ?? "not set"}) is below the cutoff.` : undefined,
    });
  }

  if (job.min_grad_year != null) {
    const ok = hasProfile && profile!.graduation_year != null && profile!.graduation_year >= job.min_grad_year;
    checks.push({
      label: `Graduating ${job.min_grad_year} or later`,
      ok,
      detail: hasProfile && !ok ? `Graduation year (${profile!.graduation_year ?? "not set"}) is too early.` : undefined,
    });
  }

  if (job.max_grad_year != null) {
    const ok = hasProfile && profile!.graduation_year != null && profile!.graduation_year <= job.max_grad_year;
    checks.push({
      label: `Graduating ${job.max_grad_year} or earlier`,
      ok,
      detail: hasProfile && !ok ? `Graduation year (${profile!.graduation_year ?? "not set"}) is too late.` : undefined,
    });
  }

  return { eligible: checks.every((c) => c.ok), checks };
}
