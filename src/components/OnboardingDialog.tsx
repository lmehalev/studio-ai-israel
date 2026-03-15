import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageIcon, Mic, UserCircle, FileText, Wand2, Building2, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'studio_onboarding_seen';

interface OnboardingStep {
  title: string;
  description: string;
  icon: typeof ImageIcon;
  tips: string[];
}

const steps: OnboardingStep[] = [
  {
    title: 'ברוכים הבאים לסטודיו קריאייטיב! 🎉',
    icon: Sparkles,
    description: 'המערכת שלך ליצירת תוכן שיווקי מקצועי — תמונות, סרטונים, דיבוב ותסריטים. הכל במקום אחד, בעברית.',
    tips: [
      'כל הכלים זמינים מתפריט הטאבים בסטודיו',
      'אתה יכול ליצור תוכן לכל עסק או חברה בנפרד',
      'התוצאות ניתנות להורדה ושיתוף מיידי',
    ],
  },
  {
    title: 'ניהול חברות ומותגים 🏢',
    icon: Building2,
    description: 'הוסף את כל החברות והעסקים שלך. לכל חברה ניתן להגדיר טון דיבור, קהל יעד, תחום פעילות ומחלקות.',
    tips: [
      'לחץ "הוסף חברה" כדי ליצור מותג חדש',
      'בחר מותג לפני יצירה — ה-AI יתאים את התוכן אוטומטית',
      'ניתן להוסיף מחלקות (כמו: מכירות, יבוא, שותפים)',
      'לחץ על "כללי" כדי ליצור ללא מותג ספציפי',
    ],
  },
  {
    title: 'יצירת תמונות 🖼️',
    icon: ImageIcon,
    description: 'תאר את התמונה שאתה רוצה בעברית — ה-AI ייצור תמונה שיווקית מקצועית.',
    tips: [
      'כתוב תיאור מפורט: "באנר לפייסבוק לחברת יבוא מוצרי חשמל, רקע כחול מקצועי"',
      'אם בחרת מותג — הצבעים והסגנון יותאמו אוטומטית',
      'אפשר להוריד את התמונה או להעתיק קישור',
    ],
  },
  {
    title: 'עריכת תמונות ✨',
    icon: Wand2,
    description: 'הדבק קישור לתמונה קיימת ותאר מה לשנות — ה-AI יערוך אותה.',
    tips: [
      'הדבק URL של תמונה בשדה "קישור לתמונה מקורית"',
      'תאר מה לשנות: "שנה רקע ללבן", "הוסף טקסט בעברית"',
      'מצוין לעדכון חומרים שיווקיים קיימים',
    ],
  },
  {
    title: 'אווטאר מדבר 🎬',
    icon: UserCircle,
    description: 'צור סרטון עם דמות מדברת! תן תמונת פנים, כתוב מה הדמות תגיד, ובחר קול.',
    tips: [
      'הדבק קישור לתמונת פנים חזיתית ברורה',
      'כתוב את הטקסט שהדמות תגיד בעברית',
      'בחר קול (גברי/נשי) — הדיבוב ייוצר אוטומטית',
      'הסרטון מיוצר על ידי D-ID — ייקח כ-30-60 שניות',
    ],
  },
  {
    title: 'דיבוב בעברית 🎙️',
    icon: Mic,
    description: 'הפוך כל טקסט לדיבור מקצועי בעברית. מצוין לסרטונים, פודקאסטים ופרזנטציות.',
    tips: [
      'כתוב או הדבק את הטקסט שאתה רוצה לדבב',
      'בחר קול מהרשימה (דניאל, רייצ\'ל, בלה, אנטוני)',
      'הורד את הקובץ כ-MP3 או הקשב ישירות',
      'השתמש בתסריטים שיצרת בטאב "תסריט"',
    ],
  },
  {
    title: 'כתיבת תסריטים 📝',
    icon: FileText,
    description: 'תאר את המוצר או השירות שלך — ה-AI יכתוב תסריט שיווקי מקצועי.',
    tips: [
      'תאר בקצרה את המוצר/שירות: "שירות הערכות שווי לעסקים"',
      'ה-AI ייצר תסריט מובנה עם פתיח, גוף, וקריאה לפעולה',
      'לחץ "העבר לדיבוב" כדי להפוך את התסריט לקול',
      'לחץ "העבר לאווטאר" כדי ליצור סרטון עם דמות מדברת',
    ],
  },
];

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-rubik text-lg flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

          <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-2">
            <p className="text-xs font-semibold text-primary mb-2">💡 טיפים:</p>
            {step.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-0.5">•</span>
                <span className="text-foreground/80">{tip}</span>
              </div>
            ))}
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === currentStep ? 'bg-primary w-6' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4" /> הקודם
            </button>

            <span className="text-xs text-muted-foreground">{currentStep + 1} / {steps.length}</span>

            <button
              onClick={handleNext}
              className="gradient-gold text-primary-foreground px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-1"
            >
              {currentStep === steps.length - 1 ? 'סיימתי, בואו נתחיל!' : 'הבא'}
              {currentStep < steps.length - 1 && <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
