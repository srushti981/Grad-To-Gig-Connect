import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { scheduleInterview, updateApplicationStatus, updateInterview, upsertJob } from "@/lib/placement-api";
import { APP_STATUSES, BRANCHES, INTERVIEW_ROUNDS, STATUS_LABELS, formatPackage, type Company, type JobWithCompany, type RecruiterApplication } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatusBadge } from "./status-badge";

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function ApplicantsTable({ apps }: { apps: RecruiterApplication[] }) {
  const refresh = useRefresh();
  const [interviewFor, setInterviewFor] = useState<RecruiterApplication | null>(null);
  const [selectFor, setSelectFor] = useState<RecruiterApplication | null>(null);
  const status = useMutation({
    mutationFn: (v: { applicationId: string; status: (typeof APP_STATUSES)[number]; finalPackage?: number }) => updateApplicationStatus({ data: v }),
    onSuccess: () => { toast.success("Status updated — the student has been notified"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const iv = useMutation({
    mutationFn: (v: { interviewId: string; status: "completed" | "cancelled" }) => updateInterview({ data: v }),
    onSuccess: () => { toast.success("Interview updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (apps.length === 0) return <EmptyState title="No applicants yet" text="Applications will appear here as students apply." />;
  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Role</TableHead><TableHead>Academics</TableHead><TableHead>Interviews</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {apps.map((a) => (
              <TableRow key={a.id}>
                <TableCell><p className="font-medium">{a.student?.full_name}</p><p className="text-xs text-muted-foreground">{a.student?.email}</p>
                  {a.student?.resume_url && <a href={a.student.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Resume <ExternalLink className="h-3 w-3" /></a>}</TableCell>
                <TableCell><p className="text-sm">{a.job?.title}</p><p className="text-xs text-muted-foreground">{a.job?.company?.name}</p></TableCell>
                <TableCell className="text-sm">{a.student?.branch ?? "—"} · {a.student?.cgpa ?? "—"} CGPA<p className="text-xs text-muted-foreground">Batch {a.student?.graduation_year ?? "—"}</p></TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {a.interviews.map((i) => (
                      <div key={i.id} className="flex items-center gap-1 text-xs">
                        <StatusBadge status={i.status} /><span>{i.round} · {new Date(i.scheduled_at).toLocaleDateString()}</span>
                        {i.status === "scheduled" && <>
                          <button className="text-success hover:underline" onClick={() => iv.mutate({ interviewId: i.id, status: "completed" })}>Done</button>
                          <button className="text-muted-foreground hover:underline" onClick={() => iv.mutate({ interviewId: i.id, status: "cancelled" })}>Cancel</button>
                        </>}
                      </div>
                    ))}
                    {a.interviews.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={a.status} onValueChange={(v) => v === "selected" ? setSelectFor(a) : status.mutate({ applicationId: a.id, status: v as never })}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{APP_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                  {a.status === "selected" && <p className="mt-1 text-xs font-semibold text-success">{formatPackage(a.final_package)}</p>}
                </TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setInterviewFor(a)}><CalendarPlus />Interview</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InterviewDialog app={interviewFor} onClose={() => setInterviewFor(null)} />
      <SelectDialog app={selectFor} onClose={() => setSelectFor(null)} onConfirm={(pkg) => { status.mutate({ applicationId: selectFor!.id, status: "selected", finalPackage: pkg }); setSelectFor(null); }} />
    </>
  );
}

function SelectDialog({ app, onClose, onConfirm }: { app: RecruiterApplication | null; onClose: () => void; onConfirm: (pkg: number) => void }) {
  const [lpa, setLpa] = useState("");
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Select {app?.student?.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="lpa">Final package (LPA)</Label><Input id="lpa" type="number" step="0.1" min="0" value={lpa} onChange={(e) => setLpa(e.target.value)} placeholder="e.g. 18" /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!lpa} onClick={() => onConfirm(Number(lpa) * 100000)}>Confirm selection</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InterviewDialog({ app, onClose }: { app: RecruiterApplication | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [f, setF] = useState({ round: "Technical Round 1", mode: "online" as "online" | "onsite", scheduledAt: "", location: "" });
  const m = useMutation({
    mutationFn: () => scheduleInterview({ data: { applicationId: app!.id, ...f } }),
    onSuccess: async () => {
      if (app && ["applied", "shortlisted"].includes(app.status)) await updateApplicationStatus({ data: { applicationId: app.id, status: "interviewing" } });
      toast.success("Interview scheduled — student notified"); refresh(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule interview · {app?.student?.full_name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5"><Label>Round</Label><Select value={f.round} onValueChange={(v) => setF({ ...f, round: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INTERVIEW_ROUNDS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Mode</Label><Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v as never })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="onsite">On-site</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="when">Date & time</Label><Input id="when" type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="loc">{f.mode === "online" ? "Meeting link" : "Venue"}</Label><Input id="loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.scheduledAt || m.isPending} onClick={() => m.mutate()}>Schedule</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function JobFormDialog({ open, onClose, companies, job }: { open: boolean; onClose: () => void; companies: Company[]; job?: JobWithCompany | null }) {
  const refresh = useRefresh();
  const init = () => ({
    companyId: job?.company_id ?? companies[0]?.id ?? "", title: job?.title ?? "", jobType: (job?.job_type ?? "full-time") as "full-time" | "internship",
    workMode: (job?.work_mode ?? "onsite") as "onsite" | "hybrid" | "remote", location: job?.location ?? "", description: job?.description ?? "",
    openings: String(job?.openings ?? 1), ctcMin: job?.ctc_min?.toString() ?? "", ctcMax: job?.ctc_max?.toString() ?? "", stipend: job?.stipend?.toString() ?? "",
    minCgpa: job?.min_cgpa?.toString() ?? "", branches: job?.eligible_branches ?? [], minGradYear: job?.min_grad_year?.toString() ?? "", maxGradYear: job?.max_grad_year?.toString() ?? "",
    deadline: job?.deadline ? job.deadline.slice(0, 10) : "",
  });
  const [f, setF] = useState(init);
  const [lastJob, setLastJob] = useState(job);
  if (job !== lastJob) { setLastJob(job); setF(init()); }
  const num = (s: string) => (s === "" ? undefined : Number(s));
  const m = useMutation({
    mutationFn: () => upsertJob({ data: Object.fromEntries(Object.entries({
      id: job?.id, companyId: f.companyId, title: f.title, jobType: f.jobType, workMode: f.workMode, location: f.location, description: f.description,
      openings: Number(f.openings) || 1, ctcMin: num(f.ctcMin), ctcMax: num(f.ctcMax), stipend: num(f.stipend), minCgpa: num(f.minCgpa),
      eligibleBranches: f.branches, minGradYear: num(f.minGradYear), maxGradYear: num(f.maxGradYear), deadline: f.deadline || undefined,
    }).filter(([, v]) => v !== undefined)) as never }),
    onSuccess: () => { toast.success(job ? "Job updated" : "Job posted! Students can now apply."); refresh(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const inp = (k: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5"><Label htmlFor={`j-${k}`}>{label}</Label><Input id={`j-${k}`} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">{job ? "Edit job" : "Post a new job"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Company</Label><Select value={f.companyId} onValueChange={(v) => setF({ ...f, companyId: v })}><SelectTrigger><SelectValue placeholder="Choose company" /></SelectTrigger><SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.logo_emoji} {c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="sm:col-span-2">{inp("title", "Role title")}</div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={f.jobType} onValueChange={(v) => setF({ ...f, jobType: v as never })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full-time">Full-time</SelectItem><SelectItem value="internship">Internship</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Work mode</Label><Select value={f.workMode} onValueChange={(v) => setF({ ...f, workMode: v as never })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="onsite">On-site</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem><SelectItem value="remote">Remote</SelectItem></SelectContent></Select></div>
          {inp("location", "Location")}{inp("openings", "Openings", { type: "number", min: 1 })}
          {inp("ctcMin", "CTC min (LPA)", { type: "number", step: "0.1" })}{inp("ctcMax", "CTC max (LPA)", { type: "number", step: "0.1" })}
          {inp("stipend", "Stipend (₹/month)", { type: "number" })}{inp("deadline", "Application deadline", { type: "date" })}
          {inp("minCgpa", "Minimum CGPA", { type: "number", step: "0.1", min: 0, max: 10 })}
          <div className="grid grid-cols-2 gap-2">{inp("minGradYear", "Batch from", { type: "number" })}{inp("maxGradYear", "Batch to", { type: "number" })}</div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Eligible branches (none = all)</Label>
            <div className="flex flex-wrap gap-1.5">{BRANCHES.map((b) => { const on = f.branches.includes(b); return (
              <button type="button" key={b} onClick={() => setF({ ...f, branches: on ? f.branches.filter((x) => x !== b) : [...f.branches, b] })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{b}</button>); })}</div>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="j-desc">Description</Label><Textarea id="j-desc" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={f.title.length < 2 || !f.companyId || m.isPending} onClick={() => m.mutate()}>{job ? "Save changes" : "Post job"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
