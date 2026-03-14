import {
  Avatar, Project, Template, Provider, BrandSettings,
  Notification, ActivityLog, GenerationJob,
} from '@/types';

// ====== Avatars (ריק - המשתמש יוסיף בעצמו) ======
export const mockAvatars: Avatar[] = [];

// ====== Projects (ריק - המשתמש ייצור בעצמו) ======
export const mockProjects: Project[] = [];

// ====== Templates ======
export const mockTemplates: Template[] = [
  {
    id: 'tpl-1', name: 'סרטון מוצר קלאסי', description: 'תבנית אוניברסלית לסרטוני מוצר עם מבנה משכנע',
    category: 'סרטון מוצר', targetAudience: 'כל קהל', hook: 'שאלה מפתיעה או עובדה מטלטלת',
    problem: 'הצגת הכאב של הלקוח', solution: 'הצגת המוצר כפתרון', proof: 'עדויות, מספרים, תוצאות',
    offer: 'הצעה ברורה ואטרקטיבית', cta: 'קריאה לפעולה ישירה', visualStyle: 'נקי ומקצועי',
    speakingStyle: 'משכנע', subtitleStyle: 'מודרני', recommendedFormat: '9:16',
    recommendedLength: '30 שניות', tags: ['מוצר', 'שיווק', 'קלאסי'], usageCount: 0,
  },
  {
    id: 'tpl-2', name: 'UGC אותנטי', description: 'תבנית לסרטוני UGC שנראים טבעיים ואמינים',
    category: 'סרטון UGC', targetAudience: 'צעירים 18-35', hook: 'אני חייב/ת לספר לכם על...',
    problem: 'חוויה אישית עם הבעיה', solution: 'איך המוצר שינה את המצב', proof: 'הדגמה חיה',
    offer: 'קוד הנחה ייחודי', cta: 'לינק בביו', visualStyle: 'ביתי ואותנטי',
    speakingStyle: 'חברי', subtitleStyle: 'בולט', recommendedFormat: '9:16',
    recommendedLength: '20 שניות', tags: ['UGC', 'אותנטי'], usageCount: 0,
  },
  {
    id: 'tpl-3', name: 'מסר מהמייסד', description: 'סרטון בו המייסד/ת מדבר/ת ישירות ללקוחות',
    category: 'סרטון מסר ממייסד', targetAudience: 'לקוחות קיימים ופוטנציאליים',
    hook: 'סיפור אישי או שאלה', problem: 'למה הקמתי את החברה', solution: 'החזון שלנו',
    proof: 'מספרים והישגים', offer: 'הזמנה להצטרף למסע', cta: 'בואו תהיו חלק',
    visualStyle: 'מקצועי אך אישי', speakingStyle: 'אישי ומעורר השראה', subtitleStyle: 'אלגנטי',
    recommendedFormat: '16:9', recommendedLength: '45 שניות', tags: ['מייסד', 'סיפור'], usageCount: 0,
  },
  {
    id: 'tpl-4', name: 'סרטון מכירה אגרסיבי', description: 'תבנית לסרטוני מכירה ישירים עם CTA חזק',
    category: 'סרטון מכירה', targetAudience: 'קהל חם', hook: 'הזדמנות שלא חוזרת',
    problem: 'מה תפסידו אם לא תפעלו עכשיו', solution: 'הצעת ערך ברורה', proof: 'תוצאות מוכחות',
    offer: 'מבצע מוגבל בזמן', cta: 'הזמינו עכשיו לפני שנגמר', visualStyle: 'דינמי ובולט',
    speakingStyle: 'ישיר ואנרגטי', subtitleStyle: 'גדול ובולט', recommendedFormat: '9:16',
    recommendedLength: '25 שניות', tags: ['מכירה', 'CTA', 'מבצע'], usageCount: 0,
  },
  {
    id: 'tpl-5', name: 'הדרכה קצרה', description: 'תבנית להדרכות ותוכן חינוכי קצר',
    category: 'סרטון הדרכה', targetAudience: 'כל קהל', hook: '3 דברים שאתם חייבים לדעת על...',
    problem: 'חוסר ידע בנושא', solution: 'טיפים ומידע מועיל', proof: 'דוגמאות מעשיות',
    offer: 'עוד תוכן בערוץ', cta: 'עקבו לעוד טיפים', visualStyle: 'נקי ומסודר',
    speakingStyle: 'חינוכי ונגיש', subtitleStyle: 'ברור', recommendedFormat: '9:16',
    recommendedLength: '30 שניות', tags: ['הדרכה', 'טיפים', 'חינוכי'], usageCount: 0,
  },
  {
    id: 'tpl-6', name: 'עדות לקוח מרגשת', description: 'תבנית לסרטוני עדות לקוח מרגשים ואותנטיים',
    category: 'סרטון עדות לקוח', targetAudience: 'קהל קר-חם', hook: 'לפני X חודשים הייתי ב...',
    problem: 'סיפור המצב הקודם', solution: 'איך המוצר/שירות עזר', proof: 'תוצאות מדידות',
    offer: 'הצטרפו גם אתם', cta: 'הקליקו לפרטים', visualStyle: 'אישי ואינטימי',
    speakingStyle: 'כנה ומרגש', subtitleStyle: 'נקי', recommendedFormat: '1:1',
    recommendedLength: '40 שניות', tags: ['עדות', 'לקוח', 'אותנטי'], usageCount: 0,
  },
  {
    id: 'tpl-7', name: 'טיזר מותגי', description: 'סרטון טיזר קצר ומסקרן למותג',
    category: 'סרטון טיזר', targetAudience: 'קהל רחב', hook: 'משהו גדול מגיע...',
    problem: '', solution: '', proof: '', offer: 'בקרוב', cta: 'הישארו מעודכנים',
    visualStyle: 'סינמטי', speakingStyle: 'מסתורי', subtitleStyle: 'מינימלי',
    recommendedFormat: '9:16', recommendedLength: '10 שניות', tags: ['טיזר', 'מותג'], usageCount: 0,
  },
  {
    id: 'tpl-8', name: 'סרטון פרימיום למותג', description: 'תבנית יוקרתית למותגי פרימיום',
    category: 'סרטון פרימיום למותג', targetAudience: 'קהל פרימיום', hook: 'ערכים ומסרים גבוהים',
    problem: '', solution: 'חוויה יוקרתית', proof: 'איכות ללא פשרות', offer: 'חוויית פרימיום',
    cta: 'גלו את הקולקציה', visualStyle: 'סינמטי ויוקרתי', speakingStyle: 'מלוטש ואלגנטי',
    subtitleStyle: 'דק ואלגנטי', recommendedFormat: '16:9', recommendedLength: '30 שניות',
    tags: ['פרימיום', 'יוקרה', 'מותג'], usageCount: 0,
  },
];

// ====== Providers (מוכנים לחיבור) ======
export const mockProviders: Provider[] = [
  {
    id: 'prov-1', name: 'ספק אווטארים', type: 'אווטארים', description: 'ספק ליצירת אווטארים מתמונות',
    status: 'לא מחובר', apiKey: '', baseUrl: '', createEndpoint: '', statusEndpoint: '',
    downloadEndpoint: '', modelName: '', webhookUrl: '', timeout: 30000, retryPolicy: 3,
    isEnabled: false, priority: 1, fallbackOrder: 1, notes: '',
    lastUsed: '', successRate: 0, avgResponseTime: 0,
  },
  {
    id: 'prov-2', name: 'ספק וידאו', type: 'וידאו', description: 'ספק ליצירת סרטונים באמצעות AI',
    status: 'לא מחובר', apiKey: '', baseUrl: '', createEndpoint: '', statusEndpoint: '',
    downloadEndpoint: '', modelName: '', webhookUrl: '', timeout: 60000, retryPolicy: 2,
    isEnabled: false, priority: 1, fallbackOrder: 1, notes: '',
    lastUsed: '', successRate: 0, avgResponseTime: 0,
  },
  {
    id: 'prov-3', name: 'ספק קול', type: 'קול', description: 'ספק ליצירת קול AI',
    status: 'לא מחובר', apiKey: '', baseUrl: '', createEndpoint: '', statusEndpoint: '',
    downloadEndpoint: '', modelName: '', webhookUrl: '', timeout: 15000, retryPolicy: 3,
    isEnabled: false, priority: 1, fallbackOrder: 1, notes: '',
    lastUsed: '', successRate: 0, avgResponseTime: 0,
  },
  {
    id: 'prov-4', name: 'ספק כתוביות', type: 'כתוביות', description: 'ספק כתוביות אוטומטיות',
    status: 'לא מחובר', apiKey: '', baseUrl: '', createEndpoint: '', statusEndpoint: '',
    downloadEndpoint: '', modelName: '', webhookUrl: '', timeout: 10000, retryPolicy: 2,
    isEnabled: false, priority: 1, fallbackOrder: 1, notes: '',
    lastUsed: '', successRate: 0, avgResponseTime: 0,
  },
  {
    id: 'prov-5', name: 'ספק אחסון', type: 'אחסון', description: 'ספק אחסון קבצים',
    status: 'לא מחובר', apiKey: '', baseUrl: '', createEndpoint: '', statusEndpoint: '',
    downloadEndpoint: '', modelName: '', webhookUrl: '', timeout: 30000, retryPolicy: 2,
    isEnabled: false, priority: 1, fallbackOrder: 1, notes: '',
    lastUsed: '', successRate: 0, avgResponseTime: 0,
  },
  {
    id: 'prov-6', name: 'ספק Webhook', type: 'webhook', description: 'ספק webhooks ואוטומציות',
    status: 'לא מחובר', apiKey: '', baseUrl: '', createEndpoint: '', statusEndpoint: '',
    downloadEndpoint: '', modelName: '', webhookUrl: '', timeout: 5000, retryPolicy: 1,
    isEnabled: false, priority: 1, fallbackOrder: 1, notes: '',
    lastUsed: '', successRate: 0, avgResponseTime: 0,
  },
];

// ====== Notifications (ריק) ======
export const mockNotifications: Notification[] = [];

// ====== Activity Logs (ריק) ======
export const mockActivityLogs: ActivityLog[] = [];

// ====== Jobs (ריק) ======
export const mockJobs: GenerationJob[] = [];

// ====== Brand Settings (ברירת מחדל ריקה) ======
export const mockBrandSettings: BrandSettings = {
  name: '',
  slogan: '',
  description: '',
  tone: '',
  languageStyle: 'עברית',
  targetAudience: '',
  keyMessages: [],
  forbiddenMessages: [],
  preferredWords: [],
  forbiddenWords: [],
  defaultCta: '',
  colors: [],
  logoUrl: '',
  subtitleStyle: '',
  introStyle: '',
  outroStyle: '',
  editStyle: '',
  contentStructure: '',
};
