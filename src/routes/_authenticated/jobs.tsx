import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, MapPin, Search, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { jobsQuery, meQuery, studentDataQuery } from "@/lib/queries";
import { applyToJob } from "@/lib/placement-api";
import { checkEligibility } from "@/lib/eligibility";
import { formatCompensation, titleCase, type JobWithCompany } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState, StatusBadge } from "@/components/app/status-badge";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({ meta: [{ title: "Open roles — Placement Cell" }, { name: "description", content: "Browse open campus roles and check your eligibility." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: JobsPage,
});

function JobsPage() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const { data: me } = useSuspenseQuery(meQuery);
  const isStudent = me.primaryRole === "student";
  const { data: apps = [] } = useQuery({ ...studentDataQuery, enabled: isStudent });
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [selected, setSelected] = useState<JobWithCompany | null>(null);

  const appliedMap = useMemo(() => new Map(apps.map((a) => [a.job_id, a.status])), [apps]);
  const filtered = jobs.filter((j) => {
    const text = `${j.title} ${j.company?.name ?? ""} ${j.location ?? ""}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (type !== "all" && j.job_type !== type) return false;
    if (onlyEligible && isStudent && !checkEligibility(j, me.profile).eligible) return false;
    return true;
  });

  return (
    <div>
      <p className="eyebrow text-gold">Opportunities</p>
      <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Open roles this season</h1>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search roles, companies, cities…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="full-time">Full-time</SelectItem><SelectItem value="internship">Internship</SelectItem></SelectContent>
        </Select>
        {isStudent && <label className="flex items-center gap-2 text-sm"><Switch checked={onlyEligible} onCheckedChange={setOnlyEligible} />Only roles I'm eligible for</label>}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((j) => {
          const elig = isStudent ? checkEligibility(j, me.profile) : null;
          const status = appliedMap.get(j.id);
          return (
            <button key={j.id} onClick={() => setSelected(j)} className="group flex flex-col rounded-xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-2xl">{j.company?.logo_emoji ?? "🏢"}</span>
                  <div><p className="text-sm font-semibold">{j.company?.name}</p><p className="text-xs text-muted-foreground">{titleCase(j.job_type)} · {titleCase(j.work_mode)}</p></div>
                </div>
                {status ? <StatusBadge status={status} /> : elig && (elig.eligible ? <Badge variant="outline" className="border-success/30 text-success">Eligible</Badge> : <Badge variant="outline" className="text-muted-foreground">Not eligible</Badge>)}
              </div>
              <h3 className="mt-4 text-lg font-semibold group-hover:text-primary">{j.title}</h3>
              <p className="mt-1 text-sm font-medium text-gold">{formatCompensation(j)}</p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
                {j.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{j.location}</span>}
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{j.openings} openings</span>
                {j.deadline && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Apply by {new Date(j.deadline).toLocaleDateString()}</span>}
              </div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="mt-6"><EmptyState title="No roles match" text="Try clearing your filters." /></div>}
      <JobDialog job={selected} onClose={() => setSelected(null)} isStudent={isStudent} appliedStatus={selected ? appliedMap.get(selected.id) : undefined} />
    </div>
  );
}

function JobDialog({ job, onClose, isStudent, appliedStatus }: { job: JobWithCompany | null; onClose: () => void; isStudent: boolean; appliedStatus: string | undefined }) {
  const { data: me } = useSuspenseQuery(meQuery);
  const qc = useQueryClient();
  const [cover, setCover] = useState("");
  const apply = useMutation({
    mutationFn: () => applyToJob({ data: { jobId: job!.id, coverLetter: cover } }),
    onSuccess: () => { toast.success("Application submitted! 🎉"); setCover(""); qc.invalidateQueries({ queryKey: ["student-data"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!job) return null;
  const elig = checkEligibility(job, me.profile);
  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{job.title}</DialogTitle>
          <DialogDescription>{job.company?.logo_emoji} {job.company?.name} · {job.location ?? "Location TBA"} · {titleCase(job.work_mode)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Info label="Compensation" value={formatCompensation(job)} />
          <Info label="Openings" value={String(job.openings)} />
          <Info label="Deadline" value={job.deadline ? new Date(job.deadline).toLocaleDateString() : "Rolling"} />
        </div>
        {job.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{job.description}</p>}
        {job.company?.about && <p className="rounded-lg bg-muted p-3 text-sm"><span className="font-semibold">About {job.company.name}: </span>{job.company.about}</p>}
        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">Eligibility check</p>
          <ul className="space-y-1.5">
            {elig.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-destructive" />}
                <span>{c.label}{c.detail && <span className="block text-xs text-muted-foreground">{c.detail}</span>}</span>
              </li>
            ))}
          </ul>
        </div>
        {isStudent && !appliedStatus && elig.eligible && (
          <div className="space-y-1.5"><Label htmlFor="cover">Why are you a great fit? (optional)</Label><Textarea id="cover" rows={3} value={cover} onChange={(e) => setCover(e.target.value)} /></div>
        )}
        <DialogFooter>
          {isStudent && (appliedStatus ? <p className="flex items-center gap-2 text-sm">Your status: <StatusBadge status={appliedStatus} /></p>
            : <Button disabled={!elig.eligible || apply.isPending} onClick={() => apply.mutate()}>{elig.eligible ? (apply.isPending ? "Submitting…" : "Apply now") : "Not eligible"}</Button>)}
          {!isStudent && <Button variant="outline" onClick={onClose}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>;
}
