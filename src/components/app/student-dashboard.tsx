import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarDays, Send, Trophy } from "lucide-react";
import { toast } from "sonner";
import { meQuery, studentDataQuery } from "@/lib/queries";
import { withdrawApplication } from "@/lib/placement-api";
import { APP_STATUSES, STATUS_LABELS, formatPackage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, StatCard, StatusBadge } from "./status-badge";

export function StudentDashboard() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: apps } = useSuspenseQuery(studentDataQuery);
  const qc = useQueryClient();
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawApplication({ data: { applicationId: id } }),
    onSuccess: () => { toast.success("Application withdrawn"); qc.invalidateQueries({ queryKey: ["student-data"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const interviews = apps.flatMap((a) => a.interviews.map((i) => ({ ...i, app: a }))).filter((i) => i.status === "scheduled")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const offers = apps.filter((a) => a.status === "selected");
  const profileIncomplete = !me.profile?.branch || me.profile?.cgpa == null || !me.profile?.graduation_year;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-gold">Student dashboard</p>
        <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Hello, {me.profile?.full_name?.split(" ")[0] ?? "there"} 👋</h1>
      </div>
      {profileIncomplete && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <span>Complete your branch, CGPA and graduation year so we can check your eligibility.</span>
          <Button asChild size="sm"><Link to="/profile">Complete profile</Link></Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={apps.length} icon={Send} />
        <StatCard label="In progress" value={apps.filter((a) => ["shortlisted", "interviewing"].includes(a.status)).length} icon={BriefcaseBusiness} />
        <StatCard label="Upcoming interviews" value={interviews.length} icon={CalendarDays} />
        <StatCard label="Offers" value={offers.length} hint={offers[0] ? `Best: ${formatPackage(Math.max(...offers.map((o) => o.final_package ?? 0)))}` : undefined} icon={Trophy} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">My applications</h2><Button asChild variant="outline" size="sm"><Link to="/jobs">Browse jobs</Link></Button></div>
          {apps.length === 0 ? <div className="mt-4"><EmptyState title="No applications yet" text="Find roles you're eligible for and apply in one click." /></div> : (
            <ul className="mt-4 divide-y">
              {apps.map((a) => {
                const step = APP_STATUSES.indexOf(a.status as never);
                return (
                  <li key={a.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="font-semibold">{a.job?.title}</p><p className="text-sm text-muted-foreground">{a.job?.company?.logo_emoji} {a.job?.company?.name} · applied {new Date(a.applied_at).toLocaleDateString()}</p></div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        {a.status === "applied" && <Button size="sm" variant="ghost" disabled={withdraw.isPending} onClick={() => withdraw.mutate(a.id)}>Withdraw</Button>}
                      </div>
                    </div>
                    {a.status !== "rejected" && (
                      <div className="mt-3 flex gap-1">
                        {APP_STATUSES.slice(0, 4).map((s, i) => (
                          <div key={s} className="flex-1"><div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} /><p className="mt-1 text-[10px] text-muted-foreground">{STATUS_LABELS[s]}</p></div>
                        ))}
                      </div>
                    )}
                    {a.status === "selected" && <p className="mt-2 text-sm font-semibold text-success">🎉 Offer: {formatPackage(a.final_package)}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Interview schedule</h2>
          {interviews.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No interviews scheduled yet.</p> : (
            <ul className="mt-4 space-y-3">
              {interviews.map((i) => (
                <li key={i.id} className="rounded-lg border-l-4 border-gold bg-secondary/50 p-3">
                  <p className="text-sm font-semibold">{i.round}</p>
                  <p className="text-xs text-muted-foreground">{i.app.job?.company?.name} — {i.app.job?.title}</p>
                  <p className="mt-1 text-sm">{new Date(i.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
                  <p className="text-xs text-muted-foreground">{i.mode === "online" ? "💻" : "📍"} {i.location}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
