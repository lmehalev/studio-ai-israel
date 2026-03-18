import { supabase } from '@/integrations/supabase/client';

export interface AvatarFolder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Use raw client to avoid type constraints since avatar_folders table is new
const db = supabase as any;

export const avatarFolderService = {
  async list(): Promise<AvatarFolder[]> {
    const { data, error } = await db
      .from('avatar_folders')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(name: string): Promise<AvatarFolder> {
    const { data, error } = await db
      .from('avatar_folders')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async rename(id: string, name: string): Promise<AvatarFolder> {
    const { data, error } = await db
      .from('avatar_folders')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    // First unfile all avatars in this folder (set folder_id to null)
    await db
      .from('avatars')
      .update({ folder_id: null })
      .eq('folder_id', id);
    // Then delete folder
    const { error } = await db
      .from('avatar_folders')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async moveAvatar(avatarId: string, folderId: string | null): Promise<void> {
    const { error } = await db
      .from('avatars')
      .update({ folder_id: folderId })
      .eq('id', avatarId);
    if (error) throw error;
  },

  async moveAvatarsBulk(avatarIds: string[], folderId: string | null): Promise<void> {
    const { error } = await db
      .from('avatars')
      .update({ folder_id: folderId })
      .in('id', avatarIds);
    if (error) throw error;
  },
};
