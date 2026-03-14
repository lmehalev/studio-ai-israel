// ====== Core Types ======

export type AvatarRole = 'בעל עסק' | 'יוצר תוכן' | 'איש מכירות' | 'מומחה' | 'פרזנטור' | 'משפיען' | 'אחר';
export type VideoType = 'אווטאר מדבר' | 'פרומפט חופשי' | 'תסריט' | 'מוצר' | 'UGC' | 'מכירה' | 'תוכן אישי' | 'הדרכה' | 'עדות לקוח' | 'רילס';
export type AspectRatio = '9:16' | '1:1' | '16:9';
export type JobStatus = 'טיוטה' | 'מוכן לשליחה' | 'ממתין' | 'בעיבוד' | 'הושלם' | 'נכשל' | 'בוטל' | 'בארכיון';
export type ProviderType = 'אווטארים' | 'וידאו' | 'קול' | 'כתוביות' | 'אחסון' | 'webhook';
export type ConnectionStatus = 'מחובר' | 'לא מחובר' | 'שגיאה' | 'בבדיקה';

export interface Avatar {
  id: string;
  name: string;
  description: string;
  language: string;
  role: AvatarRole;
  speakingStyle: string;
  tone: string;
  notes: string;
  tags: string[];
  imageUrl: string;
  images: MediaAsset[];
  videos: MediaAsset[];
  status: 'מוכן' | 'טיוטה' | 'בהכנה';
  qualityScore: number;
  createdAt: string;
  updatedAt: string;
  externalId?: string;
  defaultProvider?: string;
  providerMappings: ProviderMapping[];
  projectCount: number;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  angle?: string;
  uploadedAt: string;
}

export interface ProviderMapping {
  providerId: string;
  providerName: string;
  externalAvatarId: string;
  lastSync: string;
  status: ConnectionStatus;
}

export interface Project {
  id: string;
  name: string;
  internalTitle: string;
  avatarId: string;
  avatarName: string;
  videoType: VideoType;
  status: JobStatus;
  provider: string;
  aspectRatio: AspectRatio;
  createdAt: string;
  updatedAt: string;
  outputCount: number;
  currentVersion: number;
  tags: string[];
  script: string;
  prompt: string;
  enhancedPrompt: string;
  scenes: Scene[];
  content: ProjectContent;
  advancedSettings: AdvancedSettings;
  outputs: Output[];
  timeline: TimelineEvent[];
  versions: ProjectVersion[];
}

export interface ProjectContent {
  whatToSay: string;
  description: string;
  visualDescription: string;
  shotDescription: string;
  productDescription: string;
  productBenefits: string;
  targetAudience: string;
  painPoint: string;
  solution: string;
  valueProposition: string;
  socialProof: string;
  offer: string;
  cta: string;
  speakingStyle: string;
  filmStyle: string;
  editStyle: string;
  mood: string;
  keywords: string[];
  forbiddenWords: string[];
  forbiddenVisuals: string[];
  importantNotes: string;
  systemNotes: string;
}

export interface Scene {
  id: string;
  order: number;
  title: string;
  spokenText: string;
  visualDescription: string;
  duration: number;
  shotType: string;
  cameraMovement: string;
  effects: string;
  ctaPlacement: string;
  notes: string;
}

export interface AdvancedSettings {
  aspectRatio: AspectRatio;
  videoLength: number;
  language: string;
  voiceType: string;
  energyLevel: string;
  formalityLevel: string;
  speechRate: string;
  subtitleStyle: string;
  subtitleColors: string;
  titleStyle: string;
  backgroundType: string;
  music: boolean;
  musicStyle: string;
  logo: boolean;
  logoPosition: string;
  brandColors: string[];
  ctaType: string;
  autoIntro: boolean;
  autoOutro: boolean;
  variationsCount: number;
  preferredProvider: string;
  fallbackProvider: string;
  saveAsTemplate: boolean;
  technicalNotes: string;
}

export interface Output {
  id: string;
  projectId: string;
  name: string;
  avatarName: string;
  description: string;
  status: JobStatus;
  provider: string;
  createdAt: string;
  aspectRatio: AspectRatio;
  estimatedLength: string;
  script: string;
  prompt: string;
  videoUrl?: string;
  thumbnailUrl?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  status: JobStatus;
}

export interface ProjectVersion {
  id: string;
  version: number;
  createdAt: string;
  changes: string;
  status: JobStatus;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  targetAudience: string;
  hook: string;
  problem: string;
  solution: string;
  proof: string;
  offer: string;
  cta: string;
  visualStyle: string;
  speakingStyle: string;
  subtitleStyle: string;
  recommendedFormat: AspectRatio;
  recommendedLength: string;
  tags: string[];
  usageCount: number;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  description: string;
  status: ConnectionStatus;
  apiKey: string;
  baseUrl: string;
  createEndpoint: string;
  statusEndpoint: string;
  downloadEndpoint: string;
  modelName: string;
  webhookUrl: string;
  timeout: number;
  retryPolicy: number;
  isEnabled: boolean;
  priority: number;
  fallbackOrder: number;
  notes: string;
  lastUsed: string;
  successRate: number;
  avgResponseTime: number;
}

export interface BrandSettings {
  name: string;
  slogan: string;
  description: string;
  tone: string;
  languageStyle: string;
  targetAudience: string;
  keyMessages: string[];
  forbiddenMessages: string[];
  preferredWords: string[];
  forbiddenWords: string[];
  defaultCta: string;
  colors: string[];
  logoUrl: string;
  subtitleStyle: string;
  introStyle: string;
  outroStyle: string;
  editStyle: string;
  contentStructure: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  entityType: string;
  entityId: string;
}

export interface GenerationJob {
  id: string;
  projectId: string;
  projectName: string;
  status: JobStatus;
  progress: number;
  provider: string;
  createdAt: string;
  updatedAt: string;
  estimatedTime: string;
  logs: string[];
}
