// Shared DTO types and constants for the campus recruitment portal.

export type Company = {
  id: string;
  name: string;
  industry: string | null;
  logo_emoji: string | null;
  website: string | null;
  about: string | null;
  verified: boolean;
  created_at: string;
  created_by: string | null;
};

export type Job = {
  id: string;
  company_id: string;
  created_at: string;
  ctc_max: number | null;
  ctc_min: number | null;
  deadline: string | null;
  description: string | null;
  eligible_branches: string[];
  job_type: string;
  location: string | null;
  max_grad_year: number | null;
  min_grad_year: number | null;
  min_cgpa: number | null;
  openings: number;
  posted_by: string | null;
  status: string;
  stipend: number | null;
  title: string;
  work_mode: string;
};

export type JobWithCompany = Job & { company: Company | null };

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  branch: string | null;
  cgpa: number | null;
  graduation_year: number | null;
  roll_no: string | null;
  phone: string | null;
  bio: string | null;
  resume_url: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Interview = {
  id: string;
  application_id: string;
  round: string;
  mode: string;
  scheduled_at: string;
  location: string | null;
  status: string;
  feedback: string | null;
  created_by: string | null;
  created_at: string;
};

export type Application = {
  id: string;
  job_id: string;
  student_id: string;
  status: string;
  cover_letter: string | null;
  final_package: number | null;
  applied_at: string;
  updated_at: string;
  job: JobWithCompany | null;
  interviews: Interview[];
};

export type RecruiterApplication = Application & {
  student: Profile | null;
};

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export type Me = {
  userId: string;
  roles: ("student" | "recruiter" | "admin")[];
  primaryRole: "student" | "recruiter" | "admin";
  profile: Profile | null;
};

export const APP_STATUSES = [
  "applied",
  "shortlisted",
  "interviewing",
  "selected",
  "rejected",
] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interviewing: "Interviewing",
  selected: "Selected",
  rejected: "Not selected",
};

export const STATUS_CLASSES: Record<string, string> = {
  applied: "bg-info/10 text-info border-info/25",
  shortlisted: "bg-warning/10 text-warning border-warning/30",
  interviewing: "bg-gold/10 text-gold border-gold/30",
  selected: "bg-success/10 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/25",
  open: "bg-success/10 text-success border-success/30",
  closed: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-info/10 text-info border-info/25",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export const JOB_TYPES = ["full-time", "internship"] as const;
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const INTERVIEW_MODES = ["online", "onsite"] as const;
export const INTERVIEW_ROUNDS = [
  "Aptitude Round",
  "Technical Round 1",
  "Technical Round 2",
  "HR Round",
  "Final Interview",
] as const;

export const BRANCHES = [
  "CSE",
  "IT",
  "AI-ML",
  "ECE",
  "EEE",
  "Mechatronics",
  "Aerospace",
  "Mathematics",
  "Statistics",
];

export function formatCompensation(job: Job): string {
  const parts: string[] = [];
  if (job.ctc_min != null && job.ctc_max != null) {
    parts.push(
      job.ctc_min === job.ctc_max
        ? `₹${job.ctc_min} LPA`
        : `₹${job.ctc_min}–${job.ctc_max} LPA`,
    );
  } else if (job.ctc_min != null) {
    parts.push(`₹${job.ctc_min}+ LPA`);
  } else if (job.ctc_max != null) {
    parts.push(`up to ₹${job.ctc_max} LPA`);
  }
  if (job.stipend != null) {
    parts.push(
      job.stipend >= 100000
        ? `₹${(job.stipend / 100000).toFixed(1).replace(/\.0$/, "")} LPA stipend`
        : `₹${job.stipend.toLocaleString("en-IN")}/mo stipend`,
    );
  }
  return parts.join(" · ") || "Compensation on discussion";
}

export function formatPackage(pkg: number | null): string {
  if (pkg == null) return "—";
  return pkg >= 100000 ? `₹${(pkg / 100000).toFixed(1).replace(/\.0$/, "")} LPA` : `₹${pkg.toLocaleString("en-IN")}`;
}

export function titleCase(s: string): string {
  return s
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
