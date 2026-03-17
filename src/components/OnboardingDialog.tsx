import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon, Mic, UserCircle, FileText, Wand2, Building2,
  ChevronLeft, ChevronRight, Sparkles, Upload, Subtitles,
  Rocket, ArrowRight, X, CheckCircle2, Zap, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'studio_onboarding_v2_seen';

interface OnboardingStep {
  title: string;
  subtitle: string;
  description: string;
  icon: typeof ImageIcon;
  color: string;
  features: { icon: typeof ImageIcon; text: string }[];
  tip: string;
  illustration: string;
}

const steps: OnboardingStep[] = [
  {
    title: 'ברוכים הבאים לסטודיו AI',
    subtitle: 'המערכת המתקדמת בישראל ליצירת קריאייטיב',
    icon: Rocket,
    color: 'from-primary to-accent',
    description: 'סטודיו AI הוא מרכז השליטה שלך ליצירת תוכן שיווקי מקצועי. תמונות, סרטונים, דיבוב, תסריטים וכתוביות — הכל במקום אחד, בעברית.',
    features: [
      { icon: Zap, text: 'יצירה מהירה בלחיצת כפתור' },
      { icon: Building2, text: 'ניהול חברות ומותגים' },
      { icon: Star, text: 'AI שמותאם לשפה ולסגנון שלך' },
    ],
    tip: 'המערכת לומדת את הסגנון שלך ומתאימה כל תוצר למותג שבחרת',
    illustration: '🚀',
  },
  {
    title: 'ניהול חברות ומותגים',
    subtitle: 'כל העסקים שלך במקום אחד',
    icon: Building2,
    color: 'from-blue-500 to-cyan-400',
    description: 'הוסף את כל החברות שלך. לכל חברה הגדר טון דיבור, קהל יעד, תחום פעילות ומחלקות. ה-AI יתאים את כל התוכן אוטומטית.',
    features: [
      { icon: CheckCircle2, text: 'הוסף חברה עם שם, תחום וטון דיבור' },
      { icon: CheckCircle2, text: 'צור מחלקות — מכירות, יבוא, שותפים' },
      { icon: CheckCircle2, text: 'בחר מותג לפני יצירה — הכל מותאם' },
    ],
    tip: 'לחץ "הוסף חברה" בחלק העליון של הסטודיו',
    illustration: '🏢',
  },
  {
    title: 'יצירת תמונות AI',
    subtitle: 'מטקסט לתמונה שיווקית',
    icon: ImageIcon,
    color: 'from-emerald-500 to-green-400',
    description: 'תאר את התמונה שאתה רוצה בעברית. ה-AI ייצור תמונה מקצועית מותאמת למותג שלך.',
    features: [
      { icon: CheckCircle2, text: 'כתוב תיאור מפורט בעברית' },
      { icon: CheckCircle2, text: 'הצבעים והסגנון מותאמים למותג' },
      { icon: CheckCircle2, text: 'הורד או העתק קישור בלחיצה' },
    ],
    tip: 'ככל שהתיאור מפורט יותר — התוצאה טובה יותר!',
    illustration: '🖼️',
  },
  {
    title: 'עריכת תמונות',
    subtitle: 'שנה תמונות קיימות עם AI',
    icon: Wand2,
    color: 'from-violet-500 to-purple-400',
    description: 'הדבק קישור לתמונה קיימת ותאר מה לשנות. ה-AI יערוך — רקע, צבעים, טקסט, סגנון.',
    features: [
      { icon: CheckCircle2, text: 'הדבק URL של תמונה' },
      { icon: CheckCircle2, text: 'תאר את השינוי: "שנה רקע ללבן"' },
      { icon: CheckCircle2, text: 'מצוין לעדכון חומרים קיימים' },
    ],
    tip: 'אפשר גם לערוך תמונות שיצרת בטאב הקודם',
    illustration: '✨',
  },
  {
    title: 'אווטאר מדבר',
    subtitle: 'סרטון עם דמות מדברת בעברית',
    icon: UserCircle,
    color: 'from-orange-500 to-amber-400',
    description: 'תן תמונת פנים, כתוב מה הדמות תגיד, ובחר קול. HeyGen ייצור סרטון עם דמות שמדברת את הטקסט שלך.',
    features: [
      { icon: CheckCircle2, text: 'הדבק תמונת פנים חזיתית' },
      { icon: CheckCircle2, text: 'כתוב טקסט בעברית' },
      { icon: CheckCircle2, text: 'בחר קול — גברי או נשי' },
      { icon: CheckCircle2, text: 'הסרטון מוכן תוך 30-60 שניות' },
    ],
    tip: 'תמונה חזיתית ברורה נותנת את התוצאות הכי טובות',
    illustration: '🎬',
  },
  {
    title: 'דיבוב בעברית',
    subtitle: 'טקסט → דיבור מקצועי',
    icon: Mic,
    color: 'from-rose-500 to-pink-400',
    description: 'הפוך כל טקסט לדיבור מקצועי. 4 קולות שונים בעברית — גבריים ונשיים.',
    features: [
      { icon: CheckCircle2, text: 'כתוב או הדבק טקסט' },
      { icon: CheckCircle2, text: 'בחר קול: דניאל, רייצ\'ל, בלה, אנטוני' },
      { icon: CheckCircle2, text: 'הורד MP3 או הקשב ישירות' },
    ],
    tip: 'השתמש בתסריטים מהטאב "תסריט" — כתוב → דבב → שתף',
    illustration: '🎙️',
  },
  {
    title: 'כתיבת תסריטים',
    subtitle: 'AI כותב תסריט שיווקי מקצועי',
    icon: FileText,
    color: 'from-teal-500 to-emerald-400',
    description: 'תאר את המוצר שלך — ה-AI יכתוב תסריט מובנה עם פתיח, גוף, וקריאה לפעולה.',
    features: [
      { icon: CheckCircle2, text: 'תיאור קצר → תסריט מלא' },
      { icon: CheckCircle2, text: 'לחץ "העבר לדיבוב" → קול מוכן' },
      { icon: CheckCircle2, text: 'לחץ "העבר לאווטאר" → סרטון מוכן' },
    ],
    tip: 'זה הזרימה הכי חזקה: תסריט → דיבוב → אווטאר מדבר',
    illustration: '📝',
  },
  {
    title: 'כתוביות אוטומטיות',
    subtitle: 'העלה סרטון → כתוביות בעברית',
    icon: Subtitles,
    color: 'from-indigo-500 to-blue-400',
    description: 'העלה סרטון מוכן וקבל כתוביות אוטומטיות בעברית. ערוך, עצב, והורד.',
    features: [
      { icon: CheckCircle2, text: 'העלה סרטון או גרור לאזור ההעלאה' },
      { icon: CheckCircle2, text: 'תמלול אוטומטי בעברית עם AI' },
      { icon: CheckCircle2, text: 'ערוך את הכתוביות — תיקוני טקסט ותזמון' },
      { icon: CheckCircle2, text: 'הורד קובץ SRT מוכן' },
    ],
    tip: 'מצוין לסרטוני יוטיוב, רילס ופוסטים — כתוביות מגדילות צפיות!',
    illustration: '💬',
  },
];

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) setOpen(true);
  }, []);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else handleClose();
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md" dir="rtl">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors z-10"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Header with gradient */}
          <div className={cn('px-8 pt-8 pb-6 bg-gradient-to-l', step.color)}>
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl"
              >
                {step.illustration}
              </motion.div>
              <div>
                <motion.h2
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-xl font-rubik font-bold text-white"
                >
                  {step.title}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-sm text-white/80 mt-0.5"
                >
                  {step.subtitle}
                </motion.p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-5">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-muted-foreground leading-relaxed"
            >
              {step.description}
            </motion.p>

            {/* Features list with staggered animation */}
            <div className="space-y-2.5">
              {step.features.map((feature, i) => {
                const FIcon = feature.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-2.5 border border-border/50"
                  >
                    <FIcon className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-sm">{feature.text}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* Tip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex items-start gap-2"
            >
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-primary">{step.tip}</p>
            </motion.div>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              {steps.map((s, i) => {
                const SIcon = s.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={cn(
                      'relative flex items-center justify-center w-8 h-8 rounded-lg transition-all',
                      i === currentStep
                        ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                        : i < currentStep
                        ? 'bg-success/20 text-success'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    <SIcon className="w-3.5 h-3.5" />
                    {i < currentStep && (
                      <CheckCircle2 className="absolute -top-1 -right-1 w-3 h-3 text-success" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4" /> הקודם
              </button>

              <span className="text-xs text-muted-foreground font-medium">
                {currentStep + 1} מתוך {steps.length}
              </span>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className={cn(
                  'px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all',
                  currentStep === steps.length - 1
                    ? 'gradient-gold text-primary-foreground shadow-lg'
                    : 'gradient-gold text-primary-foreground'
                )}
              >
                {currentStep === steps.length - 1 ? (
                  <>🚀 בואו נתחיל!</>
                ) : (
                  <>הבא <ChevronLeft className="w-4 h-4" /></>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Button to re-open the guide
export function OpenGuideButton() {
  const handleOpen = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    window.location.reload();
  };

  return (
    <button
      onClick={handleOpen}
      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
    >
      <Sparkles className="w-3.5 h-3.5" /> מדריך למערכת
    </button>
  );
}
