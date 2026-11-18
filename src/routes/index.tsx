import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, CalendarCheck2, GraduationCap, Loader2, ShieldCheck, Sparkles, Trophy, UserRound } from "lucide-react";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import heroImg from "@/assets/hero-campus.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Placement Cell — Sign in to your campus recruitment portal" },
      { name: "description", content: "Students find eligible roles, recruiters manage hiring drives, and the placement office tracks every offer — in one portal." },
      { property: "og:title", content: "Placement Cell — Campus Recruitment Portal" },
      { property: "og:description", content: "Jobs, eligibility checks, interview schedules and selection results in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const DEMOS = [
  { label: "Student", email: "aarav.sharma@campus.edu", icon: GraduationCap },
  { label: "Recruiter", email: "careers@nexovialabs.com", icon: BriefcaseBusiness },
  { label: "Admin", email: "placement.office@campus.edu", icon: ShieldCheck },
];

const FEATURES = [
  { icon: Sparkles, title: "Eligibility, instantly", text: "Branch, CGPA and batch checked before you apply." },
  { icon: CalendarCheck2, title: "Interview schedules", text: "Every round, time and venue in one timeline." },
  { icon: Trophy, title: "Selection tracking", text: "Offers and packages recorded for the placement report." },
];

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState("signin");
  const [role, setRole] = useState<"student" | "recruiter">("student");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(email: string, password: string, key: string) {
    setBusy(key);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  }

  async function signUp() {
    if (form.name.trim().length < 2) return toast.error("Please enter your full name.");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters.");
    setBusy("signup");
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: form.name.trim(), role } },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    if (data.session) return navigate({ to: "/dashboard" });
    toast.success("Check your email to confirm your account, then sign in.");
    setTab("signin");
  }

  async function oauth(provider: "google" | "lovable") {
    setBusy(provider);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(null);
      return toast.error(result.error.message ?? "Sign-in failed");
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <section className="hero-dark text-hero relative flex flex-col justify-between overflow-hidden p-8 lg:p-14">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" />
        <div className="relative flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gold/90 font-display text-lg font-bold text-primary">P</div>
          <span className="font-display text-xl font-semibold">Placement Cell</span>
        </div>
        <div className="relative my-12 max-w-xl">
          <p className="eyebrow text-gold">Campus recruitment, centralised</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
            From first application to <em className="text-gold">final offer.</em>
          </h1>
          <p className="mt-5 text-lg opacity-80">
            Students discover roles they're eligible for. Recruiters run drives end-to-end. The placement office sees every result in real time.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-gold/20 bg-background/5 p-4 backdrop-blur">
                <f.icon className="h-5 w-5 text-gold" />
                <p className="mt-3 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm opacity-70">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-sm opacity-60">© {new Date().getFullYear()} Training & Placement Office</p>
      </section>

      <section className="flex items-center justify-center bg-background p-6 md:p-12">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-semibold">Welcome</h2>
          <p className="mt-1 text-muted-foreground">Sign in or create your account to continue.</p>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Log in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); signIn(form.email, form.password, "signin"); }}>
                <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@campus.edu" /></div>
                <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={!!busy}>{busy === "signin" && <Loader2 className="animate-spin" />}Log in</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); signUp(); }}>
                <div className="grid grid-cols-2 gap-2">
                  {(["student", "recruiter"] as const).map((r) => (
                    <button type="button" key={r} onClick={() => setRole(r)}
                      className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition ${role === r ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted"}`}>
                      {r === "student" ? <GraduationCap className="h-4 w-4" /> : <BriefcaseBusiness className="h-4 w-4" />}
                      I'm a {r}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="semail">Email</Label><Input id="semail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="spw">Password</Label><Input id="spw" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={!!busy}>{busy === "signup" && <Loader2 className="animate-spin" />}Create account</Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
          <div className="grid gap-2">
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => oauth("google")}
              className="border-[#747775] bg-[#FFFFFF] text-[#1F1F1F] hover:bg-[#FFFFFF]/90 hover:text-[#1F1F1F]">
              <GoogleLogo />Continue with Google
            </Button>
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => oauth("lovable")}><LovableMark className="size-[18px]" />Continue with Lovable</Button>
          </div>

          <div className="mt-8 rounded-xl border border-dashed border-gold/40 bg-accent/40 p-4">
            <p className="eyebrow text-accent-foreground">Try a demo account</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {DEMOS.map((d) => (
                <Button key={d.label} size="sm" variant="secondary" disabled={!!busy} onClick={() => signIn(d.email, "demo1234", d.label)}>
                  {busy === d.label ? <Loader2 className="animate-spin" /> : <d.icon />}{d.label}
                </Button>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="h-3 w-3" />Password for all demo accounts: demo1234</p>
          </div>
        </div>
      </section>
    </div>
  );
}
