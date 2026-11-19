import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { meQuery } from "@/lib/queries";
import { StudentDashboard } from "@/components/app/student-dashboard";
import { RecruiterDashboard } from "@/components/app/recruiter-dashboard";
import { AdminDashboard } from "@/components/app/admin-dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Placement Cell" }, { name: "description", content: "Your applications, interviews and results at a glance." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useSuspenseQuery(meQuery);
  if (me.primaryRole === "admin") return <AdminDashboard />;
  if (me.primaryRole === "recruiter") return <RecruiterDashboard />;
  return <StudentDashboard />;
}
