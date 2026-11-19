import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarDays, Pencil, Plus, Trash2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { meQuery, recruiterDataQuery } from "@/lib/queries";
import { deleteJob, saveCompany, setJobStatus } from "@/lib/placement-api";
import { formatCompensation, type JobWithCompany } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, StatCard, StatusBadge } from "./status-badge";
import { ApplicantsTable, JobFormDialog } from "./hiring-tools";

export function JobsManager({ jobs, companies, allowCreate = true }: { jobs: JobWithCompany[]; companies: import("@/lib/types").Company[]; allowCreate?: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<JobWithCompany | null>(null);
  const [creating, setCreating] = useState(false);
  const toggle = useMutation({
    mutationFn: (j: JobWithCompany) => setJobStatus({ data: { jobId: j.id, status: j.status === "open" ? "closed" : "open" } }),
    onSuccess: () => { toast.success("Job status updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteJob({ data: { jobId: id } }),
    onSuccess: () => { toast.success("Job deleted"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message.includes("foreign key") ? "This job has applications — close it instead of deleting." : e.message),
  });
  return (
    <div className="space-y-3">
      {allowCreate && <Button onClick={() => setCreating(true)} disabled={companies.length === 0}><Plus />Post a job</Button>}
      {jobs.length === 0 ? <EmptyState title="No jobs yet" text="Post your first role to start receiving applications." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">{j.title}</p><p className="text-sm text-muted-foreground">{j.company?.logo_emoji} {j.company?.name} · {formatCompensation(j)}</p></div>
                <StatusBadge status={j.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(j)}><Pencil />Edit</Button>
                <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(j)}>{j.status === "open" ? "Close" : "Reopen"}</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Delete "${j.title}"?`)) del.mutate(j.id); }}><Trash2 />Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <JobFormDialog open={creating || !!editing} job={editing} companies={companies} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

export function RecruiterDashboard() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data } = useSuspenseQuery(recruiterDataQuery);
  const [companyOpen, setCompanyOpen] = useState(false);
  const myCompanies = data.companies.filter((c) => c.id === me.profile?.company_id || c.created_by === me.userId);
  const usable = myCompanies.length ? myCompanies : data.companies;
  const interviews = data.applications.flatMap((a) => a.interviews).filter((i) => i.status === "scheduled").length;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow text-gold">Recruiter workspace</p><h1 className="mt-1 text-3xl font-semibold md:text-4xl">{myCompanies[0]?.name ?? "Your hiring drive"}</h1></div>
        <Button variant="outline" onClick={() => setCompanyOpen(true)}><Plus />Add company</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open jobs" value={data.jobs.filter((j) => j.status === "open").length} icon={BriefcaseBusiness} />
        <StatCard label="Applicants" value={data.applications.length} icon={Users} />
        <StatCard label="Interviews scheduled" value={interviews} icon={CalendarDays} />
        <StatCard label="Selected" value={data.applications.filter((a) => a.status === "selected").length} icon={Trophy} />
      </div>
      <Tabs defaultValue="applicants">
        <TabsList><TabsTrigger value="applicants">Applicants</TabsTrigger><TabsTrigger value="jobs">My jobs</TabsTrigger></TabsList>
        <TabsContent value="applicants" className="mt-4"><ApplicantsTable apps={data.applications} /></TabsContent>
        <TabsContent value="jobs" className="mt-4"><JobsManager jobs={data.jobs} companies={usable} /></TabsContent>
      </Tabs>
      <CompanyDialog open={companyOpen} onClose={() => setCompanyOpen(false)} />
    </div>
  );
}

function CompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", industry: "", website: "", about: "", logoEmoji: "🏢" });
  const m = useMutation({
    mutationFn: () => saveCompany({ data: f }),
    onSuccess: () => { toast.success("Company added — awaiting verification by the placement office"); qc.invalidateQueries(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add your company</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div className="space-y-1.5"><Label htmlFor="c-emoji">Logo</Label><Input id="c-emoji" value={f.logoEmoji} onChange={(e) => setF({ ...f, logoEmoji: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="c-ind">Industry</Label><Input id="c-ind" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="c-web">Website</Label><Input id="c-web" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="c-about">About</Label><Textarea id="c-about" value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={f.name.length < 2 || m.isPending} onClick={() => m.mutate()}>Save company</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
