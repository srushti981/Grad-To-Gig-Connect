import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BadgeCheck, BriefcaseBusiness, Building2, GraduationCap, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { adminDataQuery } from "@/lib/queries";
import { verifyCompany } from "@/lib/placement-api";
import { APP_STATUSES, STATUS_LABELS, formatPackage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "./status-badge";
import { ApplicantsTable } from "./hiring-tools";
import { JobsManager } from "./recruiter-dashboard";

export function AdminDashboard() {
  const { data } = useSuspenseQuery(adminDataQuery);
  const qc = useQueryClient();
  const verify = useMutation({
    mutationFn: (v: { companyId: string; verified: boolean }) => verifyCompany({ data: v }),
    onSuccess: () => { toast.success("Company updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = data.stats;
  const selected = data.applications.filter((a) => a.status === "selected");
  const placedStudents = new Set(selected.map((a) => a.student_id)).size;
  const avg = selected.length ? selected.reduce((t, a) => t + (a.final_package ?? 0), 0) / selected.length : null;
  const max = Math.max(1, ...Object.values(s.byStatus));

  return (
    <div className="space-y-8">
      <div><p className="eyebrow text-gold">Placement office</p><h1 className="mt-1 text-3xl font-semibold md:text-4xl">Season overview</h1></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={s.totalApplications} icon={Users} />
        <StatCard label="Open jobs" value={s.openJobs} hint={`${s.totalJobs} total`} icon={BriefcaseBusiness} />
        <StatCard label="Students placed" value={placedStudents} hint={`of ${s.students} registered`} icon={GraduationCap} />
        <StatCard label="Average package" value={formatPackage(avg)} hint={`${s.verifiedCompanies}/${s.totalCompanies} companies verified`} icon={Trophy} />
      </div>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Recruitment funnel</h2>
        <div className="mt-4 space-y-3">
          {APP_STATUSES.map((st) => (
            <div key={st} className="flex items-center gap-3">
              <span className="w-28 text-sm text-muted-foreground">{STATUS_LABELS[st]}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${st === "rejected" ? "bg-destructive/60" : st === "selected" ? "bg-success" : "bg-primary"}`} style={{ width: `${((s.byStatus[st] ?? 0) / max) * 100}%` }} /></div>
              <span className="w-8 text-right text-sm font-semibold">{s.byStatus[st] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>
      <Tabs defaultValue="apps">
        <TabsList><TabsTrigger value="apps">All applications</TabsTrigger><TabsTrigger value="companies">Companies</TabsTrigger><TabsTrigger value="jobs">Jobs</TabsTrigger></TabsList>
        <TabsContent value="apps" className="mt-4"><ApplicantsTable apps={data.applications} /></TabsContent>
        <TabsContent value="companies" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.companies.map((c) => (
              <div key={c.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3"><span className="text-2xl">{c.logo_emoji}</span><div className="flex-1"><p className="flex items-center gap-1 font-semibold">{c.name}{c.verified && <BadgeCheck className="h-4 w-4 text-success" />}</p><p className="text-xs text-muted-foreground">{c.industry ?? "—"}</p></div><Building2 className="h-4 w-4 text-muted-foreground" /></div>
                <Button size="sm" className="mt-3" variant={c.verified ? "outline" : "default"} onClick={() => verify.mutate({ companyId: c.id, verified: !c.verified })}>{c.verified ? "Revoke verification" : "Verify company"}</Button>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="jobs" className="mt-4"><JobsManager jobs={data.jobs} companies={data.companies} /></TabsContent>
      </Tabs>
    </div>
  );
}
