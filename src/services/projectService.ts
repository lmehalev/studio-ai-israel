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

/** Helper to get category from project content JSON */
export function getProjectCategory(p: ProjectRow): string | null {
  return (p.content as any)?.category || null;
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

// Use rpc or raw fetch for tables not yet in generated types
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function query<T>(table: string, options?: {
  select?: string;
  filter?: Record<string, any>;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
}): Promise<T> {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set('select', options?.select || '*');
  
  if (options?.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      url.searchParams.set(key, `eq.${value}`);
    }
  }
  if (options?.order) {
    url.searchParams.set('order', `${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`);
  }

  const headers: Record<string, string> = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };
  if (options?.single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `שגיאה בטעינת ${table}`);
  }
  return res.json();
}

async function insert<T>(table: string, data: Record<string, any>): Promise<T> {
  const url = `${supabaseUrl}/rest/v1/${table}?select=*`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `שגיאה בהוספת נתונים ל-${table}`);
  }
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

async function update<T>(table: string, id: string, data: Record<string, any>): Promise<T> {
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}&select=*`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `שגיאה בעדכון ${table}`);
  }
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

async function remove(table: string, id: string): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `שגיאה במחיקת ${table}`);
  }
}

export const projectService = {
  async getAll(): Promise<ProjectRow[]> {
    return query<ProjectRow[]>('projects', { order: { column: 'created_at', ascending: false } });
  },

  async getById(id: string): Promise<ProjectRow | null> {
    try {
      return await query<ProjectRow>('projects', { filter: { id }, single: true });
    } catch {
      return null;
    }
  },

  async create(project: Partial<ProjectRow>): Promise<ProjectRow> {
    const created = await insert<ProjectRow>('projects', project);

    // Add initial timeline event and version
    await insert('project_timeline', {
      project_id: created.id,
      type: 'created',
      description: 'הפרויקט נוצר',
      status: 'טיוטה',
    });
    await insert('project_versions', {
      project_id: created.id,
      version: 1,
      changes: 'גרסה ראשונית',
      status: 'טיוטה',
    });

    return created;
  },

  async update(id: string, updates: Partial<ProjectRow>): Promise<ProjectRow> {
    return update<ProjectRow>('projects', id, updates);
  },

  async delete(id: string): Promise<void> {
    return remove('projects', id);
  },

  async getOutputs(projectId: string): Promise<ProjectOutputRow[]> {
    return query<ProjectOutputRow[]>('project_outputs', {
      filter: { project_id: projectId },
      order: { column: 'created_at', ascending: false },
    });
  },

  async getTimeline(projectId: string): Promise<TimelineRow[]> {
    return query<TimelineRow[]>('project_timeline', {
      filter: { project_id: projectId },
      order: { column: 'timestamp', ascending: false },
    });
  },

  async getVersions(projectId: string): Promise<VersionRow[]> {
    return query<VersionRow[]>('project_versions', {
      filter: { project_id: projectId },
      order: { column: 'version', ascending: false },
    });
  },

  async addOutput(projectId: string, output: Partial<ProjectOutputRow>): Promise<ProjectOutputRow> {
    return insert<ProjectOutputRow>('project_outputs', {
      project_id: projectId,
      name: output.name || 'תוצר חדש',
      description: output.description || null,
      status: 'הושלם',
      video_url: output.video_url || null,
      thumbnail_url: output.thumbnail_url || null,
      prompt: output.prompt || null,
      provider: output.provider || null,
    });
  },

  async findOrCreateByBrand(brandId: string, brandName: string, category?: string): Promise<ProjectRow> {
    // Try to find existing project for this brand + category
    const all = await query<ProjectRow[]>('projects', {
      filter: { brand_id: brandId },
      order: { column: 'created_at', ascending: false },
    });
    const match = category
      ? all.find(p => getProjectCategory(p) === category)
      : all[0];
    if (match) return match;
    // Create new project for this brand + category
    return projectService.create({
      name: category ? `${brandName} — ${category}` : brandName,
      brand_id: brandId,
      content: category ? { category } : {},
    });
  },
};
