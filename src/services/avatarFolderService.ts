import { supabase } from '@/integrations/supabase/client';

export interface AvatarFolder {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Use raw client to avoid type constraints since avatar_folders table is new
const db = supabase as any;

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('לא מחובר — נדרשת התחברות');
  return user.id;
}

export const avatarFolderService = {
  async list(): Promise<AvatarFolder[]> {
    const userId = await getUserId();
    const { data, error } = await db
      .from('avatar_folders')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(name: string): Promise<AvatarFolder> {
    const userId = await getUserId();
    const { data, error } = await db
      .from('avatar_folders')
      .insert({ name, user_id: userId })
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
    await db
      .from('avatars')
      .update({ folder_id: null })
      .eq('folder_id', id);
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
