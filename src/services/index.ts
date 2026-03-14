// Service abstraction layer - replace mock implementations with real API calls
import { Avatar, Project, Template, Provider, BrandSettings, Notification, GenerationJob, Output } from '@/types';
import { mockAvatars, mockProjects, mockTemplates, mockProviders, mockBrandSettings, mockNotifications, mockJobs } from '@/data/mockData';

// Simulated async delay
const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

// ====== Avatar Service ======
export const avatarService = {
  getAll: async (): Promise<Avatar[]> => { await delay(300); return [...mockAvatars]; },
  getById: async (id: string): Promise<Avatar | undefined> => { await delay(200); return mockAvatars.find(a => a.id === id); },
  create: async (data: Partial<Avatar>): Promise<Avatar> => {
    await delay(800);
    const newAvatar: Avatar = {
      id: `av-${Date.now()}`, name: data.name || '', description: data.description || '',
      language: data.language || 'עברית', role: data.role || 'אחר', speakingStyle: data.speakingStyle || '',
      tone: data.tone || '', notes: data.notes || '', tags: data.tags || [], imageUrl: '',
      images: [], videos: [], status: 'טיוטה', qualityScore: 0, createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), providerMappings: [], projectCount: 0,
    };
    return newAvatar;
  },
  update: async (id: string, data: Partial<Avatar>): Promise<Avatar> => { await delay(500); return { ...mockAvatars[0], ...data, id }; },
  delete: async (_id: string): Promise<void> => { await delay(300); },
};

// ====== Project Service ======
export const projectService = {
  getAll: async (): Promise<Project[]> => { await delay(300); return [...mockProjects]; },
  getById: async (id: string): Promise<Project | undefined> => { await delay(200); return mockProjects.find(p => p.id === id); },
  create: async (data: Partial<Project>): Promise<Project> => { await delay(1000); return { ...mockProjects[0], ...data, id: `proj-${Date.now()}` }; },
  update: async (id: string, data: Partial<Project>): Promise<Project> => { await delay(500); return { ...mockProjects[0], ...data, id }; },
  delete: async (_id: string): Promise<void> => { await delay(300); },
};

// ====== Template Service ======
export const templateService = {
  getAll: async (): Promise<Template[]> => { await delay(300); return [...mockTemplates]; },
  getById: async (id: string): Promise<Template | undefined> => { await delay(200); return mockTemplates.find(t => t.id === id); },
};

// ====== Provider Service ======
export const providerService = {
  getAll: async (): Promise<Provider[]> => { await delay(300); return [...mockProviders]; },
  getById: async (id: string): Promise<Provider | undefined> => { await delay(200); return mockProviders.find(p => p.id === id); },
  testConnection: async (_id: string): Promise<{ success: boolean; message: string }> => {
    await delay(1500);
    return { success: Math.random() > 0.3, message: 'החיבור נבדק בהצלחה' };
  },
  update: async (id: string, data: Partial<Provider>): Promise<Provider> => { await delay(500); return { ...mockProviders[0], ...data, id }; },
};

// ====== Brand Service ======
export const brandService = {
  get: async (): Promise<BrandSettings> => { await delay(200); return { ...mockBrandSettings }; },
  update: async (data: Partial<BrandSettings>): Promise<BrandSettings> => { await delay(500); return { ...mockBrandSettings, ...data }; },
};

// ====== Notification Service ======
export const notificationService = {
  getAll: async (): Promise<Notification[]> => { await delay(200); return [...mockNotifications]; },
};

// ====== Job Service ======
export const jobService = {
  getAll: async (): Promise<GenerationJob[]> => { await delay(300); return [...mockJobs]; },
  getById: async (id: string): Promise<GenerationJob | undefined> => { await delay(200); return mockJobs.find(j => j.id === id); },
};

// ====== Video Generation Service (Provider-Agnostic) ======
export const videoGenerationService = {
  generate: async (_projectId: string): Promise<{ jobId: string }> => {
    await delay(1000);
    return { jobId: `job-${Date.now()}` };
  },
  getStatus: async (_jobId: string): Promise<{ status: string; progress: number }> => {
    await delay(300);
    return { status: 'בעיבוד', progress: Math.floor(Math.random() * 100) };
  },
};

// ====== Prompt Service ======
export const promptService = {
  enhance: async (text: string): Promise<{ enhanced: string; variations: string[] }> => {
    await delay(1200);
    return {
      enhanced: `גרסה משופרת: ${text}\n\nהוק: פתיח חזק שתופס תשומת לב\nגוף: הצגת הבעיה והפתרון בצורה ברורה\nCTA: קריאה לפעולה משכנעת`,
      variations: [
        `גרסת מכירה: ${text} - עם דגש על המרה ו-CTA חזק`,
        `גרסת UGC: ${text} - בסגנון אותנטי ואישי`,
        `גרסת תוכן: ${text} - עם ערך מוסף ותובנות`,
      ],
    };
  },
};
