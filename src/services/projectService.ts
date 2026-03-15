import { supabase } from "@/integrations/supabase/client";

export interface ProjectRow {
  id: string;
  name: string;
  avatar_id: string | null;
  avatar_name: string | null;
  video_type: string;
  status: string;
  provider: string | null;
  aspect_ratio: string;
  brand_id: string | null;
  content: Record<string, any>;
  scenes: any[];
  settings: Record<string, any>;
  script: string | null;
  prompt: string | null;
  enhanced_prompt: string | null;
  tags: string[];
  current_version: number;
  output_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectOutputRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  provider: string | null;
  aspect_ratio: string | null;
  estimated_length: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  script: string | null;
  prompt: string | null;
  created_at: string;
}

export interface TimelineRow {
  id: string;
  project_id: string;
  type: string;
  description: string;
  status: string;
  timestamp: string;
}

export interface VersionRow {
  id: string;
  project_id: string;
  version: number;
  changes: string;
  status: string;
  created_at: string;
}

export const projectService = {
  async getAll(): Promise<ProjectRow[]> {
    const { data, error } = await supabase
      .from("projects" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as any) || [];
  },

  async getById(id: string): Promise<ProjectRow | null> {
    const { data, error } = await supabase
      .from("projects" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as any;
  },

  async create(project: Partial<ProjectRow>): Promise<ProjectRow> {
    const { data, error } = await supabase
      .from("projects" as any)
      .insert(project as any)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Add initial timeline event
    await supabase.from("project_timeline" as any).insert({
      project_id: (data as any).id,
      type: "created",
      description: "הפרויקט נוצר",
      status: "טיוטה",
    } as any);

    // Add initial version
    await supabase.from("project_versions" as any).insert({
      project_id: (data as any).id,
      version: 1,
      changes: "גרסה ראשונית",
      status: "טיוטה",
    } as any);

    return data as any;
  },

  async update(id: string, updates: Partial<ProjectRow>): Promise<ProjectRow> {
    const { data, error } = await supabase
      .from("projects" as any)
      .update(updates as any)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as any;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("projects" as any)
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getOutputs(projectId: string): Promise<ProjectOutputRow[]> {
    const { data, error } = await supabase
      .from("project_outputs" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as any) || [];
  },

  async getTimeline(projectId: string): Promise<TimelineRow[]> {
    const { data, error } = await supabase
      .from("project_timeline" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("timestamp", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as any) || [];
  },

  async getVersions(projectId: string): Promise<VersionRow[]> {
    const { data, error } = await supabase
      .from("project_versions" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as any) || [];
  },
};
