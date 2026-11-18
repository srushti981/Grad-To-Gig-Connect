import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { meQuery } from "@/lib/queries";
import { updateProfile } from "@/lib/placement-api";
import { BRANCHES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your profile — Placement Cell" }, { name: "description", content: "Keep your academic details up to date for eligibility checks." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: me } = useSuspenseQuery(meQuery);
  const p = me.profile;
  const isStudent = me.primaryRole === "student";
  const qc = useQueryClient();
  const [f, setF] = useState({
    fullName: p?.full_name ?? "", phone: p?.phone ?? "", rollNo: p?.roll_no ?? "", branch: p?.branch ?? "",
    cgpa: p?.cgpa?.toString() ?? "", graduationYear: p?.graduation_year?.toString() ?? "", resumeUrl: p?.resume_url ?? "", bio: p?.bio ?? "",
  });
  const save = useMutation({
    mutationFn: () => updateProfile({ data: {
      fullName: f.fullName, phone: f.phone, bio: f.bio,
      ...(isStudent ? {
        rollNo: f.rollNo, branch: f.branch, resumeUrl: f.resumeUrl,
        ...(f.cgpa ? { cgpa: Number(f.cgpa) } : {}),
        ...(f.graduationYear ? { graduationYear: Number(f.graduationYear) } : {}),
      } : {}),
    } }),
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const field = (k: keyof typeof f, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5"><Label htmlFor={k}>{label}</Label><Input id={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></div>
  );
  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow text-gold">Your account</p>
      <h1 className="mt-1 text-3xl font-semibold">Profile</h1>
      <p className="mt-1 text-muted-foreground">{p?.email}{isStudent && " — your branch, CGPA and batch decide which roles you can apply to."}</p>
      <form className="mt-6 grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {field("fullName", "Full name", { required: true })}
        {field("phone", "Phone")}
        {isStudent && <>
          {field("rollNo", "Roll number")}
          <div className="space-y-1.5"><Label>Branch</Label>
            <Select value={f.branch} onValueChange={(v) => setF({ ...f, branch: v })}><SelectTrigger><SelectValue placeholder="Choose branch" /></SelectTrigger>
              <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
          </div>
          {field("cgpa", "CGPA (out of 10)", { type: "number", step: "0.01", min: 0, max: 10 })}
          {field("graduationYear", "Graduation year", { type: "number", min: 2020, max: 2035 })}
          <div className="sm:col-span-2">{field("resumeUrl", "Resume link", { placeholder: "https://drive.google.com/…" })}</div>
        </>}
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="bio">About you</Label><Textarea id="bio" rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <div className="sm:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button></div>
      </form>
    </div>
  );
}
