import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserCircle, Plus, Trash2, X, Loader2, Download, Sparkles, Save, RefreshCw, Wand2, FolderOpen, Camera, MessageSquare, Shield, ShieldOff, Columns2, AlertTriangle, Star, StarOff, FolderPlus, Pencil, FolderX, Check, GripVertical, MoveRight } from 'lucide-react';
import { toast } from 'sonner';
import { FileUploadZone } from '@/components/FileUploadZone';
import { avatarGenService, avatarDbService, imageService, storageService } from '@/services/creativeService';
import { supabase } from '@/integrations/supabase/client';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import { StoragePicker } from '@/components/StoragePicker';
import { CameraCaptureButton } from '@/components/CameraCaptureButton';
import { avatarFolderService, type AvatarFolder } from '@/services/avatarFolderService';

const MAX_PHOTOS = 7;

interface SavedAvatar {
  id: string;
  name: string;
  image_url: string;
  style: string;
  source_photos: string[];
  created_at: string;
  folder_id?: string | null;
}

const STYLE_OPTIONS = [
  { value: 'professional headshot', label: '📷 פורטרט מקצועי', desc: 'תמונת פנים ריאליסטית, תאורה נקייה, רקע ניטרלי' },
  { value: 'cartoon pixar style 3d animated character', label: '🎬 פיקסאר / 3D', desc: 'דמות תלת-ממדית בסגנון פיקסאר' },
  { value: 'disney hand-drawn classic animation style', label: '🏰 דיסני קלאסי', desc: 'ציור יד בסגנון דיסני קלאסי' },
  { value: 'anime manga japanese animation style', label: '🎌 אנימה / מנגה', desc: 'סגנון אנימציה יפנית' },
  { value: 'comic book graphic novel superhero style', label: '💥 קומיקס / גרפיק נובל', desc: 'סגנון קומיקס מערבי' },
  { value: 'watercolor artistic painting portrait', label: '🎨 ציור בצבעי מים', desc: 'ציור אמנותי באקוורל' },
  { value: 'pop art andy warhol bold colors', label: '🟡 פופ ארט', desc: 'צבעים נועזים בסגנון וורהול' },
  { value: 'classical oil painting renaissance portrait', label: '🖼️ ציור שמן קלאסי', desc: 'פורטרט בסגנון רנסנס' },
  { value: 'caricature style portrait', label: '✏️ קריקטורה', desc: 'קריקטורה עם הגזמה קלה' },
  { value: 'minimalist line art vector illustration', label: '〰️ קו מינימליסטי', desc: 'איור וקטורי נקי ומינימלי' },
  { value: 'retro vintage poster style portrait', label: '📻 רטרו / וינטג\'', desc: 'סגנון פוסטר רטרו עם גוונים חמים' },
  { value: 'cyberpunk neon futuristic portrait', label: '🌃 סייברפאנק', desc: 'תאורת ניאון ואסתטיקה עתידנית' },
  { value: 'chibi sticker cute style', label: '🧸 צ\'יבי / סטיקר', desc: 'סגנון חמוד עם ראש גדול לסטיקרים' },
];

const EXPRESSION_OPTIONS = [
  { value: 'neutral', label: '😐 טבעי', desc: 'הבעת פנים טבעית ורגועה' },
  { value: 'smile', label: '🙂 חיוך עדין', desc: 'חיוך קל וחם' },
  { value: 'big_smile', label: '😄 חיוך רחב', desc: 'חיוך גדול ושמח' },
  { value: 'serious', label: '😤 רציני', desc: 'מבט רציני ובטוח' },
  { value: 'friendly', label: '😊 ידידותי', desc: 'הבעה חמה ונגישה' },
  { value: 'thinking', label: '🤔 מהרהר', desc: 'מבט מחשבתי, הטיית ראש קלה' },
];

type CreationMode = 'photo' | 'prompt';
type FolderFilter = 'all' | 'unfiled' | string; // string = folder id

export default function AvatarsManagePage() {
  const [avatars, setAvatars] = useState<SavedAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>('photo');
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [style, setStyle] = useState('professional headshot');
  const [expression, setExpression] = useState('neutral');
  const [generating, setGenerating] = useState(false);
  const [baseAvatarId, setBaseAvatarId] = useState('');

  // Text prompt mode
  const [textPrompt, setTextPrompt] = useState('');

  // Preview & Refine state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);

  // Storage picker
  const [storagePickerOpen, setStoragePickerOpen] = useState(false);

  // Identity fidelity toggle (default ON)
  const [identityFidelity, setIdentityFidelity] = useState(true);

  // Cached face description for Pass 1 reuse
  const [cachedFaceDescription, setCachedFaceDescription] = useState<string | null>(null);

  // Cost approval gate
  const [costApprovalOpen, setCostApprovalOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // Compare variants view
  const [compareMode, setCompareMode] = useState(false);

  // Variant deletion confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'variant' | 'avatar' | 'folder'; index?: number; id?: string } | null>(null);

  // === Folder state ===
  const [folders, setFolders] = useState<AvatarFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedAvatars, setSelectedAvatars] = useState<Set<string>>(new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState<string | null>(null);
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [foldersLoaded, setFoldersLoaded] = useState(false);

  // === Draft persistence (sessionStorage) ===
  const DRAFT_KEY = 'avatar-creation-draft';

  const saveDraft = () => {
    const draft = { name, photos, style, expression, creationMode, textPrompt, baseAvatarId, previewUrl, previewHistory, refinePrompt, identityFidelity, cachedFaceDescription };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  };

  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.name) setName(d.name);
      if (d.photos?.length) setPhotos(d.photos);
      if (d.style) setStyle(d.style);
      if (d.expression) setExpression(d.expression);
      if (d.creationMode) setCreationMode(d.creationMode);
      if (d.textPrompt) setTextPrompt(d.textPrompt);
      if (d.baseAvatarId) setBaseAvatarId(d.baseAvatarId);
      if (d.previewUrl) setPreviewUrl(d.previewUrl);
      if (d.previewHistory?.length) setPreviewHistory(d.previewHistory);
      if (d.refinePrompt) setRefinePrompt(d.refinePrompt);
      if (d.identityFidelity !== undefined) setIdentityFidelity(d.identityFidelity);
      if (d.cachedFaceDescription) setCachedFaceDescription(d.cachedFaceDescription);
      setCreating(true);
    } catch {}
  };

  const clearDraft = () => {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
  };

  // Auto-save draft whenever creation state changes
  useEffect(() => {
    if (creating) saveDraft();
  }, [name, photos, style, expression, creationMode, textPrompt, baseAvatarId, previewUrl, previewHistory, refinePrompt, creating, identityFidelity, cachedFaceDescription]);

  useEffect(() => { loadAvatars(); loadFolders(); loadDraft(); }, []);

  useEffect(() => {
    setPhotos((prev) => {
      if (!baseAvatarId) return prev.slice(0, MAX_PHOTOS);
      const selectedBase = avatars.find((a) => a.id === baseAvatarId);
      if (!selectedBase) return prev.slice(0, MAX_PHOTOS);
      const baseRefs = [selectedBase.image_url, ...(selectedBase.source_photos ?? [])];
      const merged = Array.from(new Set([...baseRefs, ...prev])).slice(0, MAX_PHOTOS);
      return merged.filter((url) => !baseRefs.includes(url));
    });
  }, [baseAvatarId, avatars]);

  const loadAvatars = async () => {
    try {
      const list = await avatarDbService.list();
      // Also fetch folder_id from raw query
      const db = supabase as any;
      const { data } = await db.from('avatars').select('id, folder_id');
      const folderMap: Record<string, string | null> = {};
      if (data) data.forEach((r: any) => { folderMap[r.id] = r.folder_id; });
      setAvatars(list.map((a: any) => ({ ...a, folder_id: folderMap[a.id] ?? null })));
    }
    catch (e) { console.error('Failed to load avatars:', e); }
    finally { setLoading(false); }
  };

  const loadFolders = async () => {
    try {
      const list = await avatarFolderService.list();
      setFolders(list);
      setFoldersLoaded(true);
    } catch (e) {
      console.error('Failed to load folders (table may not exist yet):', e);
      setFoldersLoaded(true);
    }
  };

  const selectedBaseAvatar = avatars.find((a) => a.id === baseAvatarId);
  const baseReferences = selectedBaseAvatar ? [selectedBaseAvatar.image_url, ...(selectedBaseAvatar.source_photos ?? [])] : [];
  const mergedReferencePreview = Array.from(new Set([...baseReferences, ...photos])).slice(0, MAX_PHOTOS);
  const remainingPhotoSlots = Math.max(0, MAX_PHOTOS - mergedReferencePreview.length);

  // === Folder management ===
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const folder = await avatarFolderService.create(newFolderName.trim());
      setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      setCreatingFolder(false);
      toast.success(`תיקייה "${folder.name}" נוצרה`);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה ביצירת תיקייה');
    }
  };

  const handleRenameFolder = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      const updated = await avatarFolderService.rename(id, renameValue.trim());
      setFolders(prev => prev.map(f => f.id === id ? updated : f));
      setRenamingFolder(null);
      setRenameValue('');
      toast.success('שם התיקייה עודכן');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשינוי שם');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await avatarFolderService.remove(id);
      setFolders(prev => prev.filter(f => f.id !== id));
      // Update avatars that were in this folder
      setAvatars(prev => prev.map(a => a.folder_id === id ? { ...a, folder_id: null } : a));
      if (folderFilter === id) setFolderFilter('all');
      toast.success('התיקייה נמחקה — האווטארים הועברו ל"ללא תיקייה"');
    } catch (e: any) {
      toast.error(e.message || 'שגיאה במחיקת תיקייה');
    }
  };

  const handleMoveAvatar = async (avatarId: string, folderId: string | null) => {
    try {
      await avatarFolderService.moveAvatar(avatarId, folderId);
      setAvatars(prev => prev.map(a => a.id === avatarId ? { ...a, folder_id: folderId } : a));
      const folderName = folderId ? folders.find(f => f.id === folderId)?.name : 'ללא תיקייה';
      toast.success(`אווטאר הועבר ל"${folderName}"`);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהעברת אווטאר');
    }
  };

  const handleBulkMove = async (folderId: string | null) => {
    if (selectedAvatars.size === 0) return;
    try {
      const ids = Array.from(selectedAvatars);
      await avatarFolderService.moveAvatarsBulk(ids, folderId);
      setAvatars(prev => prev.map(a => ids.includes(a.id) ? { ...a, folder_id: folderId } : a));
      const folderName = folderId ? folders.find(f => f.id === folderId)?.name : 'ללא תיקייה';
      toast.success(`${ids.length} אווטארים הועברו ל"${folderName}"`);
      setSelectedAvatars(new Set());
      setShowBulkMove(false);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בהעברה');
    }
  };

  const toggleSelectAvatar = (id: string) => {
    setSelectedAvatars(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, avatarId: string) => {
    e.dataTransfer.setData('avatar-id', avatarId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolder(null);
    const avatarId = e.dataTransfer.getData('avatar-id');
    if (avatarId) handleMoveAvatar(avatarId, folderId);
  };

  // Filtered avatars
  const filteredAvatars = avatars.filter(a => {
    if (folderFilter === 'all') return true;
    if (folderFilter === 'unfiled') return !a.folder_id;
    return a.folder_id === folderFilter;
  });

  const getFolderCount = (folderId: string) => avatars.filter(a => a.folder_id === folderId).length;
  const unfiledCount = avatars.filter(a => !a.folder_id).length;

  // Cost estimation
  const getEstimatedCost = (isExpressionOnly: boolean) => {
    if (creationMode === 'prompt') return { passes: 'Pass 2 בלבד (Gemini Image)', cost: 'נמוך', calls: 1 };
    if (isExpressionOnly && cachedFaceDescription) return { passes: 'Pass 2 בלבד (שימוש חוזר ב-Pass 1)', cost: 'נמוך', calls: 1 };
    const isStyledNonRealistic = style !== 'professional headshot';
    if (isStyledNonRealistic && identityFidelity) {
      return { passes: 'Pass 1 (ניתוח) + Pass 2 (עוגן) + Pass 3 (סגנון)', cost: 'בינוני-גבוה', calls: 3 };
    }
    return { passes: 'Pass 1 (ניתוח פנים) + Pass 2 (יצירה)', cost: 'בינוני', calls: 2 };
  };

  // Show cost approval before generation
  const requestApproval = (action: () => void) => {
    pendingActionRef.current = action;
    setCostApprovalOpen(true);
  };

  const confirmCostApproval = () => {
    setCostApprovalOpen(false);
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
  };

  // Generate from photos
  const executeGeneration = async (expressionOnly = false) => {
    if (!name.trim()) { toast.error('יש להזין שם לאווטאר'); return; }
    if (creationMode === 'photo' && mergedReferencePreview.length < 1) {
      toast.error('יש להעלות לפחות תמונה אחת'); return;
    }
    if (creationMode === 'prompt' && !textPrompt.trim()) {
      toast.error('יש להזין תיאור לדמות'); return;
    }

    setGenerating(true);
    try {
      if (creationMode === 'prompt') {
        const styleLabel = STYLE_OPTIONS.find(s => s.value === style)?.desc || style;
        const expLabel = EXPRESSION_OPTIONS.find(e => e.value === expression)?.desc || expression;
        const fullPrompt = `Create a portrait/avatar of a character: ${textPrompt}. Style: ${styleLabel}. Expression: ${expLabel}. High quality, detailed face, centered composition, clean background.`;
        const result = await imageService.generate(fullPrompt);
        if (!result.imageUrl) { toast.error('לא התקבלה תמונה מהמודל. נסה שוב או שנה סגנון.'); return; }
        setPreviewUrl(result.imageUrl);
        setPreviewHistory(prev => [...prev, result.imageUrl]);
        toast.success('האווטאר נוצר!');
      } else {
        const useCache = expressionOnly && !!cachedFaceDescription;
        const result = await avatarGenService.generate(mergedReferencePreview, style, {
          baseAvatarUrl: selectedBaseAvatar?.image_url,
          strictIdentity: identityFidelity || mergedReferencePreview.length >= 3,
          expression,
          skipAnalysis: useCache,
          cachedFaceDescription: useCache ? cachedFaceDescription! : undefined,
        });
        if (!result.imageUrl) {
          toast.error('לא התקבלה תמונה מהמודל. ודא שתמונות הרפרנס תקינות ונסה שוב.');
          return;
        }
        if (result.identityDrift) {
          toast.warning('⚠️ סטייה בזהות — התוצר עלול שלא להיראות כמו האדם המקורי. מומלץ לייצר מחדש עם הגדרות חזקות יותר.', { duration: 8000 });
        }
        if (result.faceDescription) {
          setCachedFaceDescription(result.faceDescription);
        }
        setPreviewUrl(result.imageUrl);
        setPreviewHistory(prev => [...prev, result.imageUrl]);
        toast.success(useCache ? 'הבעה חדשה נוצרה (ניתוח פנים מהמטמון)' : 'האווטאר נוצר!');
      }
    } catch (e: any) {
      console.error('Avatar generation error:', e);
      toast.error(e.message || 'שגיאה ביצירת אווטאר — נסה שוב');
    }
    finally { setGenerating(false); }
  };

  const handleGenerate = () => {
    requestApproval(() => executeGeneration(false));
  };

  const handleRegenerateExpressionOnly = () => {
    if (!cachedFaceDescription) {
      requestApproval(() => executeGeneration(false));
    } else {
      requestApproval(() => executeGeneration(true));
    }
  };

  const handleRefine = async () => {
    if (!refinePrompt.trim() || !previewUrl) return;
    setRefining(true);
    try {
      const result = await imageService.edit(
        `${refinePrompt}. CRITICAL: Keep the same person's face — identical facial features, skin tone, facial hair, and proportions. Only apply the requested changes.`,
        previewUrl
      );
      if (!result.imageUrl) { toast.error('לא התקבלה תמונה'); return; }
      setPreviewUrl(result.imageUrl);
      setPreviewHistory(prev => [...prev, result.imageUrl]);
      setRefinePrompt('');
      toast.success('התמונה עודכנה!');
    } catch (e: any) { toast.error(e.message); }
    finally { setRefining(false); }
  };

  const handleRegenerate = () => {
    requestApproval(() => {
      setPreviewUrl(null);
      setCachedFaceDescription(null);
      executeGeneration(false);
    });
  };

  const handleSave = async () => {
    if (!previewUrl) return;
    setSaving(true);
    try {
      let finalImageUrl = previewUrl;
      if (finalImageUrl.startsWith('data:image/')) {
        const res = await fetch(finalImageUrl);
        const blob = await res.blob();
        const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
        finalImageUrl = await storageService.upload(file);
      }
      const saved = await avatarDbService.save(name, finalImageUrl, style, mergedReferencePreview);
      setAvatars((prev) => [{ ...saved, folder_id: null }, ...prev]);
      resetForm();
      toast.success('האווטאר נשמר בהצלחה!');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setCreating(false);
    setName(''); setPhotos([]); setStyle('professional headshot'); setExpression('neutral');
    setBaseAvatarId(''); setPreviewUrl(null); setPreviewHistory([]); setRefinePrompt('');
    setTextPrompt(''); setCreationMode('photo');
    setIdentityFidelity(true); setCachedFaceDescription(null); setCompareMode(false);
    clearDraft();
  };

  const handleBackToEdit = () => {
    setPreviewUrl(null);
    setCompareMode(false);
  };

  // === Variant management ===
  const handleDeleteVariant = (index: number) => {
    setDeleteConfirm({ type: 'variant', index });
  };

  const handleSetPrimary = (index: number) => {
    const selectedUrl = previewHistory[index];
    setPreviewUrl(selectedUrl);
    toast.success('הגרסה נבחרה כראשית');
  };

  const handleKeepOnlyThis = (index: number) => {
    const selectedUrl = previewHistory[index];
    if (index === 0) {
      setPreviewHistory([selectedUrl]);
    } else {
      setPreviewHistory([previewHistory[0], selectedUrl]);
    }
    setPreviewUrl(selectedUrl);
    toast.success('כל הגרסאות האחרות הוסרו — נותרו המקור והגרסה הנבחרת');
  };

  const confirmDeleteVariant = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'variant' && deleteConfirm.index !== undefined) {
      const idx = deleteConfirm.index;
      if (idx === 0 && previewHistory.length > 1) {
        toast.error('לא ניתן למחוק את גרסת המקור כשיש גרסאות נוספות');
        setDeleteConfirm(null);
        return;
      }
      const removedUrl = previewHistory[idx];
      const newHistory = previewHistory.filter((_, i) => i !== idx);
      setPreviewHistory(newHistory);
      if (previewUrl === removedUrl) {
        setPreviewUrl(newHistory.length > 0 ? newHistory[newHistory.length - 1] : null);
      }
      const match = removedUrl.match(/\/media\/(.+)$/);
      if (match) {
        supabase.storage.from('media').remove([match[1]]).catch(() => {});
      }
      toast.success('הגרסה הוסרה');
    } else if (deleteConfirm.type === 'avatar' && deleteConfirm.id) {
      handleDeleteAvatar(deleteConfirm.id);
    } else if (deleteConfirm.type === 'folder' && deleteConfirm.id) {
      handleDeleteFolder(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const handleDeleteAvatar = async (id: string) => {
    try {
      const avatar = avatars.find(a => a.id === id);
      await avatarDbService.remove(id);
      if (avatar?.image_url) {
        const match = avatar.image_url.match(/\/media\/(.+)$/);
        if (match) {
          await supabase.storage.from('media').remove([match[1]]);
        }
      }
      setAvatars((prev) => prev.filter((a) => a.id !== id));
      setSelectedAvatars(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('האווטאר הוסר');
    } catch (e: any) { toast.error(e.message); }
  };

  const startVariationFromAvatar = (avatar: SavedAvatar) => {
    setCreating(true);
    setCreationMode('photo');
    setBaseAvatarId(avatar.id);
    setName(`${avatar.name} - וריאציה`);
    setStyle('disney hand-drawn classic animation style');
    setExpression('neutral');
    setPhotos([]);
    setPreviewUrl(null); setPreviewHistory([]); setRefinePrompt('');
    setIdentityFidelity(true); setCachedFaceDescription(null); setCompareMode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedStyleObj = STYLE_OPTIONS.find((s) => s.value === style);
  const selectedExpressionObj = EXPRESSION_OPTIONS.find((e) => e.value === expression);

  const addPhotoFromStorage = (urls: string[]) => {
    setPhotos(prev => {
      const merged = Array.from(new Set([...baseReferences, ...prev, ...urls])).slice(0, MAX_PHOTOS);
      return merged.filter(item => !baseReferences.includes(item));
    });
  };

  const addPhotoFromCamera = (url: string) => {
    setPhotos(prev => {
      const merged = Array.from(new Set([...baseReferences, ...prev, url])).slice(0, MAX_PHOTOS);
      return merged.filter(item => !baseReferences.includes(item));
    });
  };

  const canGenerate = creationMode === 'prompt'
    ? name.trim() && textPrompt.trim()
    : name.trim() && mergedReferencePreview.length >= 1;

  const costEstimate = getEstimatedCost(false);
  const expressionOnlyCost = getEstimatedCost(true);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-rubik font-bold flex items-center gap-2">
              <UserCircle className="w-6 h-6 text-primary" />
              אווטארים
            </h1>
            <p className="text-muted-foreground text-sm mt-1">צור ונהל אווטארים לשימוש בסרטונים ותמונות</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedAvatars.size > 0 && (
              <button onClick={() => setShowBulkMove(true)} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
                <MoveRight className="w-4 h-4" /> העבר {selectedAvatars.size} נבחרים
              </button>
            )}
            <button onClick={() => setCreatingFolder(true)} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4" /> צור תיקייה
            </button>
            <button onClick={() => setCreating(true)} className="gradient-gold text-primary-foreground px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> צור אווטאר חדש
            </button>
          </div>
        </div>

        {/* Create folder inline */}
        {creatingFolder && (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <FolderPlus className="w-5 h-5 text-primary flex-shrink-0" />
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
              placeholder="שם התיקייה..."
              autoFocus
              dir="rtl"
              className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="px-3 py-2 gradient-gold text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50">
              צור
            </button>
            <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }} className="p-2 hover:bg-muted rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Folder tabs / filter bar */}
        {(folders.length > 0 || foldersLoaded) && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFolderFilter('all')}
              onDragOver={e => e.preventDefault()}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${folderFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
            >
              הכל ({avatars.length})
            </button>
            <button
              onClick={() => setFolderFilter('unfiled')}
              onDragOver={e => handleDragOver(e, null)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${folderFilter === 'unfiled' ? 'bg-primary text-primary-foreground' : dragOverFolder === null && dragOverFolder !== false ? 'bg-muted/50 text-muted-foreground hover:bg-muted' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
            >
              ללא תיקייה ({unfiledCount})
            </button>
            {folders.map(folder => (
              <div
                key={folder.id}
                className={`relative group/folder flex items-center gap-1 flex-shrink-0 ${dragOverFolder === folder.id ? 'ring-2 ring-primary rounded-lg' : ''}`}
                onDragOver={e => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, folder.id)}
              >
                {renamingFolder === folder.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setRenamingFolder(null); }}
                      autoFocus
                      dir="rtl"
                      className="w-24 bg-muted/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button onClick={() => handleRenameFolder(folder.id)} className="p-1 hover:bg-muted rounded">
                      <Check className="w-3 h-3 text-primary" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setFolderFilter(folder.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${folderFilter === folder.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                  >
                    <FolderOpen className="w-3 h-3" />
                    {folder.name} ({getFolderCount(folder.id)})
                  </button>
                )}
                {/* Folder context actions */}
                {renamingFolder !== folder.id && (
                  <div className="absolute -top-1 -left-1 flex gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity z-10">
                    <button onClick={() => { setRenamingFolder(folder.id); setRenameValue(folder.name); }} className="w-4 h-4 bg-muted border border-border rounded-full flex items-center justify-center" title="שנה שם">
                      <Pencil className="w-2 h-2" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'folder', id: folder.id })} className="w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center" title="מחק תיקייה">
                      <X className="w-2 h-2" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Drag hint */}
        {folders.length > 0 && !creating && avatars.length > 0 && (
          <p className="text-[10px] text-muted-foreground">💡 גרור אווטאר על תיקייה כדי להעביר אותו, או סמן כמה ולחץ "העבר"</p>
        )}

        {creating && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{previewUrl ? 'תצוגה מקדימה — בדוק, שפר או שמור' : 'אווטאר חדש'}</h3>
              <button onClick={resetForm} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ===== PREVIEW MODE ===== */}
            {previewUrl ? (
              <div className="space-y-4">
                {previewHistory.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">גרסאות ({previewHistory.length})</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {previewHistory.map((url, i) => (
                        <div key={i} className="relative flex-shrink-0 group/variant">
                          <button onClick={() => setPreviewUrl(url)}
                            className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${previewUrl === url ? 'border-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]' : 'border-border/50 opacity-60 hover:opacity-100'}`}>
                            <img src={url} alt={`גרסה ${i + 1}`} className="w-full h-full object-cover" />
                          </button>
                          <span className={`absolute -bottom-1 inset-x-0 text-center text-[8px] font-medium ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {i === 0 ? 'מקור' : `v${i + 1}`}
                          </span>
                          {(i > 0 || previewHistory.length === 1) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteVariant(i); }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover/variant:opacity-100 transition-opacity"
                              title="מחק גרסה"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {previewUrl !== url && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSetPrimary(i); }}
                              className="absolute -top-1 -left-1 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center opacity-0 group-hover/variant:opacity-100 transition-opacity"
                              title="קבע כראשי"
                            >
                              <Star className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {previewHistory.length > 2 && (
                      <button
                        onClick={() => {
                          const currentIdx = previewHistory.indexOf(previewUrl!);
                          if (currentIdx >= 0) handleKeepOnlyThis(currentIdx);
                        }}
                        className="text-[10px] text-primary hover:underline"
                      >
                        שמור רק את הגרסה הנוכחית (מחק שאר)
                      </button>
                    )}
                  </div>
                )}

                {/* Compare Variants View */}
                {compareMode && previewHistory.length > 1 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">🔍 השוואת וריאנטים — רק ההבעה השתנתה</p>
                      <button onClick={() => setCompareMode(false)} className="text-xs text-primary hover:underline">סגור השוואה</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                        <img src={previewHistory[0]} alt="גרסה 1" className="w-full aspect-square object-cover" />
                        <p className="text-center text-xs py-1.5 text-muted-foreground">מקור</p>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-primary bg-muted/30">
                        <img src={previewUrl} alt="גרסה נוכחית" className="w-full aspect-square object-cover" />
                        <p className="text-center text-xs py-1.5 text-primary font-medium">גרסה נוכחית</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
                    <img src={previewUrl} alt="תצוגה מקדימה" className="max-w-full max-h-[400px] object-contain" />
                  </div>
                )}

                {previewHistory.length > 1 && !compareMode && (
                  <button onClick={() => setCompareMode(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-xs hover:bg-muted/60 transition-colors text-muted-foreground">
                    <Columns2 className="w-3.5 h-3.5" /> השווה וריאנטים
                  </button>
                )}

                {/* Refine */}
                <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5" /> לא מרוצה? תאר מה לשנות
                    </p>
                    <VoiceDictationButton onResult={(text) => setRefinePrompt(prev => prev ? prev + ' ' + text : text)} />
                  </div>
                  <textarea
                    value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                    placeholder='למשל: "תעשה את הזקן יותר מסודר", "תחדד את הפנים", "תשנה את התאורה"'
                    rows={2}
                    dir="rtl"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={handleRefine}
                    disabled={refining || !refinePrompt.trim()}
                    className="w-full gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {refining ? 'משפר...' : 'שפר תמונה'}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleBackToEdit}
                    className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2">
                    ← חזור לעריכה
                  </button>
                  {cachedFaceDescription && creationMode === 'photo' && (
                    <button onClick={handleRegenerateExpressionOnly} disabled={generating}
                      className="flex-1 px-4 py-2.5 border border-primary/30 bg-primary/5 rounded-lg text-sm hover:bg-primary/10 flex items-center justify-center gap-2 disabled:opacity-50 text-primary">
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      💰 הבעה חדשה בלבד (Pass 2)
                    </button>
                  )}
                  <button onClick={handleRegenerate} disabled={generating}
                    className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted flex items-center justify-center gap-2 disabled:opacity-50">
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    💰 ייצר מחדש (מלא)
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'שומר...' : 'שמור אווטאר'}
                  </button>
                </div>
              </div>
            ) : (
              /* ===== CREATION FORM ===== */
              <>
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">שם האווטאר</label>
                  <div className="flex gap-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="למשל: דוברת ראשית" className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <VoiceDictationButton onResult={(text) => setName((prev) => (prev ? `${prev} ${text}` : text))} />
                  </div>
                </div>

                {/* Creation mode toggle */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">מצב יצירה</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setCreationMode('photo')}
                      className={`p-3 rounded-lg border text-sm text-right transition-all flex items-center gap-2 ${creationMode === 'photo' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-muted/30 hover:bg-muted/60'}`}>
                      <Camera className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">מתמונות</div>
                        <div className="text-[10px] text-muted-foreground">העלה תמונה אחת או יותר</div>
                      </div>
                    </button>
                    <button onClick={() => setCreationMode('prompt')}
                      className={`p-3 rounded-lg border text-sm text-right transition-all flex items-center gap-2 ${creationMode === 'prompt' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-muted/30 hover:bg-muted/60'}`}>
                      <MessageSquare className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">מתיאור טקסט</div>
                        <div className="text-[10px] text-muted-foreground">תאר דמות ו-AI ייצור אותה</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Text prompt mode */}
                {creationMode === 'prompt' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted-foreground">תאר את הדמות</label>
                      <VoiceDictationButton onResult={(text) => setTextPrompt(prev => prev ? prev + ' ' + text : text)} />
                    </div>
                    <textarea
                      value={textPrompt}
                      onChange={e => setTextPrompt(e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                      rows={3}
                      dir="rtl"
                      placeholder='למשל: "אישה בת 30, שיער חום ארוך, עיניים ירוקות, חיוך חם, לובשת חולצה לבנה"'
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                )}

                {/* Photo mode - base avatar */}
                {creationMode === 'photo' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">שכפול מאווטאר קיים (אופציונלי)</label>
                    <select value={baseAvatarId} onChange={(e) => setBaseAvatarId(e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="">ללא שכפול - אעלה תמונות ידנית</option>
                      {avatars.map((avatar) => (<option key={avatar.id} value={avatar.id}>{avatar.name}</option>))}
                    </select>
                    {selectedBaseAvatar && (
                      <p className="text-xs text-primary mt-2">🔁 בסיס נבחר: {selectedBaseAvatar.name} — המערכת תשתמש אוטומטית בתמונות המקור שלו.</p>
                    )}
                  </div>
                )}

                {/* Identity Fidelity Toggle */}
                {creationMode === 'photo' && (
                  <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${identityFidelity ? 'border-primary/40 bg-primary/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
                    <div className="flex items-center gap-2">
                      {identityFidelity ? <Shield className="w-4 h-4 text-primary" /> : <ShieldOff className="w-4 h-4 text-amber-400" />}
                      <div>
                        <p className="text-sm font-medium">{identityFidelity ? '🔒 דיוק זהות מוגבר' : '🎨 סגנון חופשי'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {identityFidelity ? 'עדיפות לשימור זהות — רק הבעה/מוד ישתנו' : 'אפשרות לסטיילינג חופשי יותר — עלול לשנות מראה'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIdentityFidelity(!identityFidelity)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${identityFidelity ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${identityFidelity ? 'left-0.5' : 'left-[22px]'}`} />
                    </button>
                  </div>
                )}

                {creationMode === 'photo' && !identityFidelity && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>⚠️ מצב סגנון חופשי פעיל — התוצר עלול להיראות שונה מהאדם המקורי. מומלץ להשאיר את דיוק הזהות מופעל אלא אם רוצים אפקט אמנותי מכוון.</p>
                  </div>
                )}

                {/* Style */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">סגנון עיצוב</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {STYLE_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => setStyle(opt.value)}
                        className={`text-right p-2.5 rounded-lg border text-xs transition-all ${style === opt.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-muted/30 hover:bg-muted/60'}`}>
                        <div className="font-semibold mb-0.5">{opt.label}</div>
                        <div className="text-muted-foreground text-[10px] leading-tight">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expression */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">הבעת פנים</label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {EXPRESSION_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => setExpression(opt.value)}
                        className={`text-center p-2.5 rounded-lg border text-xs transition-all ${expression === opt.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-muted/30 hover:bg-muted/60'}`}>
                        <div className="font-semibold mb-0.5">{opt.label}</div>
                        <div className="text-muted-foreground text-[10px] leading-tight">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photos section */}
                {creationMode === 'photo' && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      תמונות רפרנס ({mergedReferencePreview.length}/{MAX_PHOTOS}) — מינימום 1, מומלץ 3-7 לדיוק גבוה
                    </label>
                    {selectedBaseAvatar && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-primary/40">
                          <img src={selectedBaseAvatar.image_url} alt={selectedBaseAvatar.name} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-background/80 text-foreground py-0.5">בסיס</div>
                        </div>
                      </div>
                    )}
                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {photos.map((url, i) => (
                          <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                            <img src={url} alt={`ref ${i + 1}`} className="w-full h-full object-cover" />
                            <button onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {remainingPhotoSlots > 0 && (
                      <div className="space-y-2">
                        <FileUploadZone accept="image/*" multiple label="העלה תמונות מהמחשב" hint={`JPG, PNG — נשארו ${remainingPhotoSlots} מקומות`}
                          onUploaded={(url) => { if (!url) return; addPhotoFromCamera(url); }}
                          onMultipleUploaded={(urls) => addPhotoFromStorage(urls)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStoragePickerOpen(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm hover:bg-muted/60 transition-colors"
                          >
                            <FolderOpen className="w-4 h-4 text-primary" />
                            בחר מהאחסון
                          </button>
                          <CameraCaptureButton
                            onCaptured={addPhotoFromCamera}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm hover:bg-muted/60 transition-colors"
                          />
                        </div>
                      </div>
                    )}
                    {remainingPhotoSlots === 0 && (
                      <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">הגעת למקסימום {MAX_PHOTOS} תמונות רפרנס.</div>
                    )}
                    {mergedReferencePreview.length >= 1 && mergedReferencePreview.length < 3 && (
                      <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-2">
                        💡 יש {mergedReferencePreview.length} תמונ{mergedReferencePreview.length === 1 ? 'ה' : 'ות'}. ניתן ליצור, אך מומלץ 3+ תמונות לדיוק גבוה יותר.
                      </div>
                    )}
                  </div>
                )}

                {/* Summary + Cost Estimate */}
                {selectedStyleObj && (
                  <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                    <div><span className="font-semibold text-foreground">{selectedStyleObj.label}</span> — {selectedStyleObj.desc}</div>
                    <div><span className="font-semibold text-foreground">{selectedExpressionObj?.label}</span> — {selectedExpressionObj?.desc}</div>
                    {creationMode === 'photo' && identityFidelity && (
                      <div className="text-primary">🔒 דיוק זהות פעיל — המערכת תקבע פנים לפי כל תמונות הרפרנס</div>
                    )}
                    {creationMode === 'prompt' && (
                      <div className="text-primary">✨ יצירה מתיאור טקסט — המערכת תייצר דמות חדשה לפי התיאור שלך</div>
                    )}
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="font-medium text-foreground">💰 עלות משוערת:</p>
                      <p>{costEstimate.passes} — {costEstimate.calls} קריאות Gemini — רמת עלות: {costEstimate.cost}</p>
                    </div>
                  </div>
                )}

                <button onClick={handleGenerate} disabled={generating || !canGenerate} className="w-full gradient-gold text-primary-foreground py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCircle className="w-4 h-4" />}
                  {generating ? 'מייצר אווטאר...' : '💰 צור אווטאר'}
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin opacity-30" />
            <p className="text-sm">טוען אווטארים...</p>
          </div>
        ) : filteredAvatars.length === 0 && !creating ? (
          <div className="text-center py-16 text-muted-foreground">
            <UserCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">
              {folderFilter === 'all' ? 'אין אווטארים עדיין' : folderFilter === 'unfiled' ? 'אין אווטארים ללא תיקייה' : 'אין אווטארים בתיקייה זו'}
            </p>
            <p className="text-sm mt-1">
              {folderFilter === 'all' ? 'צור אווטאר ראשון כדי להשתמש בו בסרטונים' : 'גרור אווטארים לכאן או השתמש ב"העבר"'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAvatars.map((avatar) => {
              const isSelected = selectedAvatars.has(avatar.id);
              const folderName = avatar.folder_id ? folders.find(f => f.id === avatar.folder_id)?.name : null;
              return (
                <div
                  key={avatar.id}
                  draggable
                  onDragStart={e => handleDragStart(e, avatar.id)}
                  className={`bg-card border rounded-xl overflow-hidden group relative cursor-grab active:cursor-grabbing transition-all ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                >
                  {/* Selection checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelectAvatar(avatar.id); }}
                    className={`absolute top-2 right-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border/60 bg-background/60 opacity-0 group-hover:opacity-100'}`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="aspect-square">
                    <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm">{avatar.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{STYLE_OPTIONS.find((s) => s.value === avatar.style)?.label || avatar.style}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground">{new Date(avatar.created_at).toLocaleDateString('he-IL')}</p>
                      {folderName && (
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <FolderOpen className="w-2.5 h-2.5" /> {folderName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startVariationFromAvatar(avatar)} className="w-7 h-7 bg-accent text-accent-foreground rounded-full flex items-center justify-center" title="צור וריאציה">
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={async () => { try { const res = await fetch(avatar.image_url); const blob = await res.blob(); const blobUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = blobUrl; link.download = `${avatar.name}-avatar.${avatar.image_url.includes('.png') ? 'png' : 'jpg'}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(blobUrl); toast.success('ההורדה החלה'); } catch { window.open(avatar.image_url, '_blank'); } }} className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center" title="הורד">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'avatar', id: avatar.id })} className="w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center" title="מחק">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Storage picker dialog */}
      <StoragePicker
        open={storagePickerOpen}
        onClose={() => setStoragePickerOpen(false)}
        onSelect={addPhotoFromStorage}
        accept="image/*"
        multiple
      />

      {/* Bulk move dialog */}
      {showBulkMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" dir="rtl">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MoveRight className="w-5 h-5 text-primary" />
              העברת {selectedAvatars.size} אווטארים
            </h3>
            <p className="text-sm text-muted-foreground">בחר תיקייה יעד:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <button onClick={() => handleBulkMove(null)}
                className="w-full text-right px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm">
                📂 ללא תיקייה
              </button>
              {folders.map(f => (
                <button key={f.id} onClick={() => handleBulkMove(f.id)}
                  className="w-full text-right px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-primary" /> {f.name} ({getFolderCount(f.id)})
                </button>
              ))}
            </div>
            <button onClick={() => { setShowBulkMove(false); setSelectedAvatars(new Set()); }}
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" dir="rtl">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {deleteConfirm.type === 'avatar' ? 'מחיקת אווטאר' : deleteConfirm.type === 'folder' ? 'מחיקת תיקייה' : 'מחיקת גרסה'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {deleteConfirm.type === 'avatar'
                ? 'האווטאר, כולל התמונה שנוצרה, יימחק לצמיתות. תמונות הרפרנס לא יימחקו.'
                : deleteConfirm.type === 'folder'
                ? 'התיקייה תימחק. האווטארים שבתוכה יועברו ל"ללא תיקייה" ולא יימחקו.'
                : 'הגרסה תימחק מהרשימה ומהאחסון. לא ניתן לשחזר.'
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                ביטול
              </button>
              <button onClick={confirmDeleteVariant}
                className="flex-1 bg-destructive text-destructive-foreground px-4 py-2.5 rounded-lg font-semibold text-sm">
                🗑️ מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cost Approval Dialog */}
      {costApprovalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 space-y-4" dir="rtl">
            <h3 className="font-semibold text-lg flex items-center gap-2">💰 אישור יצירת אווטאר</h3>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm space-y-2">
              <p><span className="font-medium">ספק:</span> Lovable AI (Gemini)</p>
              <p><span className="font-medium">שלבים:</span> {costEstimate.passes}</p>
              <p><span className="font-medium">קריאות:</span> {costEstimate.calls}</p>
              <p><span className="font-medium">רמת עלות:</span> {costEstimate.cost}</p>
              {identityFidelity && <p className="text-primary text-xs">🔒 מצב דיוק זהות פעיל</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setCostApprovalOpen(false); pendingActionRef.current = null; }}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                ביטול
              </button>
              <button onClick={confirmCostApproval}
                className="flex-1 gradient-gold text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm">
                ✅ אשר ויצר
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
