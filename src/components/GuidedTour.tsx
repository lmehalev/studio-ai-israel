import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_KEY = 'studio_guided_tour_v3_seen';

const tourSteps: Step[] = [
  {
    target: 'body',
    placement: 'center',
    disableBeacon: true,
    content: '',
    data: {
      title: '🚀 ברוכים הבאים לסטודיו AI',
      description: 'המערכת המתקדמת בישראל ליצירת קריאייטיב — תמונות, סרטונים, דיבוב, תסריטים וכתוביות. בואו נעבור יחד על כל הכלים!',
      emoji: '🎬',
    },
  },
  {
    target: '[data-tour="brand-selector"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '🏢 ניהול חברות ומותגים',
      description: 'הוסף את כל החברות שלך. לכל חברה הגדר טון דיבור, קהל יעד, תחום פעילות ומחלקות. ה-AI יתאים את כל התוכן אוטומטית למותג שבחרת.',
      tip: 'לחץ "הוסף חברה" כדי להתחיל',
    },
  },
  {
    target: '[data-tour="tab-image"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '🖼️ יצירת תמונות AI',
      description: 'תאר את התמונה שאתה רוצה בעברית וה-AI ייצור תמונה מקצועית. הצבעים והסגנון מותאמים אוטומטית למותג שבחרת.',
      tip: 'ככל שהתיאור מפורט יותר — התוצאה טובה יותר!',
    },
  },
  {
    target: '[data-tour="tab-edit"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '✨ עריכת תמונות עם AI',
      description: 'הדבק קישור לתמונה קיימת ותאר מה לשנות — רקע, צבעים, טקסט, סגנון. ה-AI יערוך בדיוק מה שביקשת.',
      tip: 'אפשר גם לערוך תמונות שיצרת בטאב הקודם!',
    },
  },
  {
    target: '[data-tour="tab-video"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '🎥 וידאו AI (RunwayML)',
      description: 'צור סרטונים מדהימים מתמונה או טקסט! בחר מצב — תמונה לוידאו או טקסט לוידאו — ו-RunwayML ייצור אנימציה מקצועית.',
      tip: 'מצוין לסרטוני מוצר, רילס, ותוכן שיווקי עם תנועה',
    },
  },
  {
    target: '[data-tour="tab-avatar"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '🎬 אווטאר מדבר (HeyGen)',
      description: 'תן תמונת פנים חזיתית, כתוב מה הדמות תגיד ובחר קול. תוך 30-60 שניות יהיה לך סרטון עם דמות שמדברת בעברית!',
      tip: 'תמונה חזיתית ברורה נותנת את התוצאות הכי טובות',
    },
  },
  {
    target: '[data-tour="tab-voice"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '🎙️ דיבוב בעברית',
      description: 'הפוך כל טקסט לדיבור מקצועי בעברית. 4 קולות שונים — גבריים ונשיים. הורד MP3 או הקשב ישירות.',
      tip: 'השתמש בתסריטים מהטאב "תסריט" — כתוב → דבב → שתף',
    },
  },
  {
    target: '[data-tour="tab-script"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '📝 כתיבת תסריטים עם AI',
      description: 'תאר את המוצר שלך — ה-AI יכתוב תסריט מובנה עם פתיח, גוף, וקריאה לפעולה. אפשר להעביר ישירות לדיבוב או לאווטאר!',
      tip: 'הזרימה הכי חזקה: תסריט → דיבוב → אווטאר מדבר 🔥',
    },
  },
  {
    target: '[data-tour="tab-subtitles"]',
    placement: 'bottom',
    disableBeacon: true,
    content: '',
    data: {
      title: '💬 כתוביות אוטומטיות',
      description: 'העלה סרטון מוכן וקבל כתוביות אוטומטיות בעברית. ערוך את הטקסט והתזמון, והורד קובץ SRT מוכן.',
      tip: 'כתוביות מגדילות צפיות בסרטוני יוטיוב, רילס ופוסטים!',
    },
  },
  {
    target: '[data-tour="prompt-area"]',
    placement: 'top',
    disableBeacon: true,
    content: '',
    data: {
      title: '✍️ אזור היצירה',
      description: 'כאן כותבים את הפרומפט — תיאור, טקסט לדיבוב, או תסריט. ה-AI ייקח את מה שכתבת וייצור תוכן מקצועי מותאם למותג.',
      tip: 'אפשר לכתוב בעברית חופשית — ה-AI מבין הכל!',
    },
  },
  {
    target: '[data-tour="generate-btn"]',
    placement: 'top',
    disableBeacon: true,
    content: '',
    data: {
      title: '🚀 כפתור היצירה',
      description: 'לחץ כאן כדי להפעיל את ה-AI! התוצאה תופיע מיד למטה — תמונה, סרטון, קובץ שמע או תסריט.',
      tip: 'אחרי היצירה אפשר להוריד, להעתיק או לשלוח ישירות',
    },
  },
];

function CustomTooltip({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  size,
  isLastStep,
}: TooltipRenderProps) {
  const data = (step as any).data || {};
  const progress = ((index + 1) / size) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      {...tooltipProps}
      className="bg-card border-2 border-primary/30 rounded-2xl shadow-2xl max-w-sm overflow-hidden"
      dir="rtl"
    >
      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <motion.div
          className="h-full bg-gradient-to-l from-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="p-5">
        {/* Step counter */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {index + 1} מתוך {size}
          </span>
          <button
            {...closeProps}
            className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg font-rubik font-bold text-foreground mb-2"
        >
          {data.title}
        </motion.h3>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground leading-relaxed mb-3"
        >
          {data.description}
        </motion.p>

        {/* Tip */}
        {data.tip && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 flex items-start gap-2 mb-4"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary leading-relaxed">{data.tip}</p>
          </motion.div>
        )}

        {/* Navigation dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {Array.from({ length: size }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all duration-300',
                i === index
                  ? 'w-6 h-2 bg-primary'
                  : i < index
                  ? 'w-2 h-2 bg-primary/40'
                  : 'w-2 h-2 bg-muted-foreground/20'
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between gap-2">
          {index > 0 ? (
            <button
              {...backProps}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" /> הקודם
            </button>
          ) : (
            <div />
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            {...primaryProps}
            className={cn(
              'px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all gradient-gold text-primary-foreground shadow-lg'
            )}
          >
            {isLastStep ? (
              <>🚀 בואו נתחיל!</>
            ) : (
              <>הבא <ChevronLeft className="w-4 h-4" /></>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export function GuidedTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) {
      // Small delay to let page render
      const timer = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      localStorage.setItem(TOUR_KEY, 'true');
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      continuous
      showSkipButton={false}
      disableOverlayClose
      spotlightClicks={false}
      disableScrolling={false}
      tooltipComponent={CustomTooltip}
      callback={handleCallback}
      locale={{
        back: 'הקודם',
        close: 'סגור',
        last: 'סיום',
        next: 'הבא',
        skip: 'דלג',
      }}
      styles={{
        options: {
          zIndex: 10000,
          arrowColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.65)',
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
      floaterProps={{
        styles: {
          arrow: {
            length: 10,
            spread: 16,
          },
        },
      }}
    />
  );
}

export function OpenGuideTourButton() {
  const handleOpen = () => {
    localStorage.removeItem(TOUR_KEY);
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
