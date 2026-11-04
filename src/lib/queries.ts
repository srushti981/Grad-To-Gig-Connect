// Client-side query options. Public reads go straight through the browser
// Supabase client (public SELECT policies); protected reads call server
// functions that carry the user's bearer token.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMe, getStudentData, getRecruiterData, getAdminData, getNotifications } from "./placement-api";
import type { Company, JobWithCompany } from "./types";

export const jobsQuery = queryOptions({
  queryKey: ["jobs", "open"],
  queryFn: async (): Promise<JobWithCompany[]> => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*, company:companies(*)")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as JobWithCompany[];
  },
});

export const companiesQuery = queryOptions({
  queryKey: ["companies"],
  queryFn: async (): Promise<Company[]> => {
    const { data, error } = await supabase.from("companies").select("*").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Company[];
  },
});

export const jobByIdQuery = (id: string) =>
  queryOptions({
    queryKey: ["job", id],
    queryFn: async (): Promise<JobWithCompany | null> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, company:companies(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as unknown as JobWithCompany | null;
    },
  });

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMe(),
});

export const studentDataQuery = queryOptions({
  queryKey: ["student-data"],
  queryFn: () => getStudentData(),
});

export const recruiterDataQuery = queryOptions({
  queryKey: ["recruiter-data"],
  queryFn: () => getRecruiterData(),
});

export const adminDataQuery = queryOptions({
  queryKey: ["admin-data"],
  queryFn: () => getAdminData(),
});

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () => getNotifications(),
});
