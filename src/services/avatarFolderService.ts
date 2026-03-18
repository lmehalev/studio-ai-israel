import { supabase } from '@/integrations/supabase/client';

export interface AvatarFolder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const avatarFolderService = {
  async list(): Promise<AvatarFolder[]> {
    const { data, error } = await supabase
      .from('avatar_folders')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as unknown as AvatarFolder[];
  },

  async create(name: string): Promise<AvatarFolder> {
    const { data, error } = await supabase
      .from('avatar_folders')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AvatarFolder;
  },

  async rename(id: string, name: string): Promise<AvatarFolder> {
    const { data, error } = await supabase
      .from('avatar_folders')
      .update({ name })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AvatarFolder;
  },

  async remove(id: string): Promise<void> {
    // First unfile all avatars in this folder (set folder_id to null)
    await supabase
      .from('avatars')
      .update({ folder_id: null } as any)
      .eq('folder_id' as any, id);
    // Then delete folder
    const { error } = await supabase
      .from('avatar_folders')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async moveAvatar(avatarId: string, folderId: string | null): Promise<void> {
    const { error } = await supabase
      .from('avatars')
      .update({ folder_id: folderId } as any)
      .eq('id', avatarId);
    if (error) throw error;
  },

  async moveAvatarsBulk(avatarIds: string[], folderId: string | null): Promise<void> {
    const { error } = await supabase
      .from('avatars')
      .update({ folder_id: folderId } as any)
      .in('id', avatarIds);
    if (error) throw error;
  },
};
