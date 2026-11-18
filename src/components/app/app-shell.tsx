import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Bell, BriefcaseBusiness, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, notificationsQuery } from "@/lib/queries";
import { markNotificationsRead } from "@/lib/placement-api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { titleCase } from "@/lib/types";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

export function AppShell() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: notes = [] } = useQuery({ ...notificationsQuery, refetchInterval: 30000 });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const unread = notes.filter((n) => !n.read).length;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display font-bold text-primary-foreground">P</div>
            <span className="hidden font-display text-lg font-semibold sm:inline">Placement Cell</span>
          </Link>
          <nav className="ml-4 flex items-center gap-1">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-secondary !text-foreground" }}>
                <n.icon className="h-4 w-4" /><span className="hidden md:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Popover onOpenChange={async (open) => { if (!open && unread) { await markNotificationsRead(); qc.invalidateQueries({ queryKey: ["notifications"] }); } }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                  <Bell />
                  {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <p className="border-b px-4 py-3 font-semibold">Notifications</p>
                <div className="max-h-80 overflow-y-auto">
                  {notes.length === 0 && <p className="p-4 text-sm text-muted-foreground">You're all caught up.</p>}
                  {notes.map((n) => (
                    <div key={n.id} className={`border-b px-4 py-3 text-sm last:border-0 ${n.read ? "" : "bg-accent/40"}`}>
                      <p className="font-medium">{n.title}</p>
                      {n.body && <p className="text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{me.profile?.full_name ?? "You"}</p>
              <p className="text-xs text-muted-foreground">{titleCase(me.primaryRole)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}><LogOut />Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
