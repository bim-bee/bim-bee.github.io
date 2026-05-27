const RLM = '\u200F';
const ltrSpan = (text) =>
  `<span dir="ltr" style="unicode-bidi:isolate;">${text}</span>`;


// JS fallback for blog posts data. Useful when viewing over file:// where fetch may be blocked.
window.BIM_POSTS = {
  posts: [
/*
    {
      date: "2026-03-25",

      title_en: "Your NC Files May Be Wasting Beam Line Time — Here’s How to Fix It",
      excerpt_en:
        "Beam line NC/DSTV files often include redundant scribing and marking that wastes machine time. What DSTV carries, common pitfalls, and practical rules to optimize scribing and hardstamps.",

      title_he:
        "קבצי ה-" +
        ltrSpan("NC") +
        " שלך עלולים לבזבז זמן בייצור — כך מתקנים זאת",

      excerpt_he:
        "קבצי " +
        ltrSpan("NC/DSTV") +
        " כוללים לעיתים סימונים מיותרים שמבזבזים זמן מכונה. מה יש בקובץ, מה משתבש בדרך כלל, וכללים פרקטיים לצמצום סימון ולהטבעת " +
        ltrSpan("Hardstamp") +
        " בצורה נכונה.",

      tags: ["Fabrication", "Automation", "NC", "DSTV"],
      tags_he: [ltrSpan("Fabrication"), "אוטומציה", ltrSpan("NC"), ltrSpan("DSTV")],

      thumbnail: "pics/NC-Beamline-Thumb.svg",
      url: "posts/nc-files-beam-line-time.html",

      readTime_en: "8 min read",
      readTime_he: "קריאה של 8 דק׳"
    },
*/
    {            
      date: "2026-02-02",
      
      title_en: "Great Assembly Drawings: Shift From Manual Drafting to Confident Reviewing",
      excerpt_en: "How to move from manual assembly drafting to confident reviewing using clear rules and API-driven automation in Tekla.",
      
      title_he:      
        "שרטוטי הרכבה מעולים: המעבר משרטוט ידני לבקרת איכות"      
      ,      
      excerpt_he:
        "איך עוברים ממצב שבו שורפים זמן על שרטוט ידני, למצב שבו מייצרים שרטוטים עקביים ובמקום מתמקדים בבקרה ובאיכות."
      ,

      tags: ["Tekla", "Automation", "Drawings", "Quality"],
      tags_he: ["Tekla", "אוטומציה", "שרטוטים", "איכות"],

      thumbnail: "pics/Great-Assembly-Drawings.png",
      url: "posts/great-assembly-drawings.html",
      
      readTime_en: "7 min read",
      readTime_he: "קריאה של 7 דק׳"
    },
    {
      date: "2026-01-19",

      title_en: "Why Model Checking Must Happen Before Fabrication",
      excerpt_en:
        "Why disciplined model checks before drawings and fabrication protect schedules, budgets, and relationships — and how automation like BIMChecker supports detailers.",

      title_he: "למה בדיקת המודל חייבת לקרות לפני הייצור",
      excerpt_he:
        "למה בדיקות מודל מסודרות לפני שרטוטים וייצור מגנות על לוחות זמנים, תקציב והיחסים עם המפעל — ואיך אוטומציה תומכת בכל בעלי העניין.",

      tags: ["BIM", "Tekla", "Quality", "Automation"],
      tags_he: ["BIM", "Tekla", "איכות", "אוטומציה"],

      thumbnail: "pics/Model-Checking.png",
      url: "posts/model-checks-before-fabrication.html",

      readTime_en: "7 min read",
      readTime_he: "קריאה של 7 דק׳"
    },

    {            
      date: "2025-10-27",
      
      title_en: "BIM Is Not Just 3D — Why BIM Management Matters",
      excerpt_en: "BIM isn’t only 3D geometry — it’s managed information. Why BIM management matters and how automation roots it deeper.",
      
      title_he:      
        ltrSpan("BIM") +
        " הוא לא רק תלת־ממד — למה ניהול " +
        ltrSpan("BIM") +
        " חשוב"
      ,      
      excerpt_he:
        ltrSpan("BIM") +
        " זהו מאגר מידע מקיף שמלווה את הפרויקט בכל שלביו. נדגיש את החשיבות של " +
        ltrSpan("BIM") +
        " מהו ניהול נכון של המידע, ומתן גישה מדויקת לכל בעלי העניין."
      ,

      tags: ["BIM", "Management", "Automation", "Tekla"],
      tags_he: ["BIM", "ניהול", "אוטומציה", "Tekla"],

      thumbnail: "pics/BIM-Management1.jpg",
      url: "posts/bim-not-just-3d.html",
      
      readTime_en: "6 min read",
      readTime_he: "קריאה של 6 דק׳"
    },

    {
      date: "2025-11-10",

      title_en: "Fabrication Folder — Turning Modeling into Reality",
      excerpt_en: "What goes into a complete fabrication folder and how to issue it right: phases, reports, drawings, DSTV/DXF, IFC, checks, and smart locking.",

      title_he:
        "תיק הייצור — להפוך מודל למציאות",

      excerpt_he:
        "מה נכנס לתיקיית הייצור " +
        " ואיך מנפיקים אותה נכון: פאזות, דוחות, שרטוטים, " +
        ltrSpan("DSTV/DXF") +
        ", " +
        ltrSpan("IFC") +
        ", בדיקות ונעילות חכמות.",

      tags: ["Fabrication", "Tekla", "Workflow", "Quality"],
      tags_he: [
        ltrSpan("Fabrication"),
        ltrSpan("Tekla"),
        "תהליך",
        "איכות"
      ],

      thumbnail: "pics/Fab-Folder1.jpg",
      url: "posts/fabrication-folder.html",

      readTime_en: "6 min read",
      readTime_he: "קריאה של 6 דק׳"
    },
    
    {
      title: "Custom Components in Tekla — Build Once, Reuse Everywhere",
      title_en: "Custom Components in Tekla — Build Once, Reuse Everywhere",
      title_he:
        "קומפוננטים ב-" +
        ltrSpan("Tekla") +
        " — בונים פעם וממחזרים",
      date: "2025-11-24",
      excerpt: "Why custom components are essential for accurate, consistent, and future‑proof Tekla models — plus practical tips.",
      excerpt_en: "Why custom components are essential for accurate, consistent, and future‑proof Tekla models — plus practical tips.",
      excerpt_he:
      "למה קומפוננטים מותאמים חשובים למודל " +
      ltrSpan("Tekla") +
      " מדויק. דגש על כלי חשוב שממקסם יכולות — עם טיפים מעשיים.",

      tags: ["Tekla", "Components", "BIM", "Productivity"],
      tags_he: ["Tekla", "קומפוננטים", "BIM", "פרודוקטיביות"],
      thumbnail: "pics/Custom-Components5.jpg",
      url: "posts/custom-components-in-tekla.html",
      readTime: "6 min read",
      readTime_en: "6 min read",
      readTime_he: "קריאה של 6 דק׳"
    },
    {
      title: "Similar Parts — Why Accuracy Matters in Numbering",
      title_en: "Similar Parts — Why Accuracy Matters in Numbering",
      title_he: "חלקים דומים — למה הדיוק חשוב במספור",
      date: "2025-12-22",
      excerpt: "How precise modeling keeps parts sharing the same position number, saving time in drawings, fabrication, and erection.",
      excerpt_en: "How precise modeling keeps parts sharing the same position number, saving time in drawings, fabrication, and erection.",
      excerpt_he: "איך דיוק במידול מבטיח שחלקים יקבלו אותו מספר מיקום, חוסך זמן ואנרגיה בשרטוטים, בייצור ובהרכבה.",
      tags: ["Tekla", "BIM", "Quality", "Productivity"],
      tags_he: ["Tekla", "BIM", "איכות", "פרודוקטיביות"],
      thumbnail: "pics/Similar-Parts1.jpg",
      url: "posts/similar-parts-numbering-accuracy.html",
      readTime: "6 min read",
      readTime_en: "6 min read",
      readTime_he: "קריאה של 6 דק׳"
    },
    {
      title: "Stop Rebuilding Settings — Tekla Firm Folder Basics",
      title_en: "Stop Rebuilding Settings — Tekla Firm Folder Basics",
      title_he:
        "מפסיקים לבנות הכול מחדש — תיקיית " +
        ltrSpan("Firm") +
        " ב-" +
        ltrSpan("Tekla"),
      date: "2025-12-08",
      excerpt: "Centralize attributes once in a Tekla firm folder so every new project starts ready to go.",
      excerpt_en: "Centralize attributes once in a Tekla firm folder so every new project starts ready to go.",
      excerpt_he:
        "מרכזים את הסטנדרט שלך בתיקיית " +
        ltrSpan("Firm") +
        " אחת כדי שכל פרויקט חדש יתחיל מוכן.",
      tags: ["Tekla", "Standards", "BIM", "Productivity"],
      tags_he: ["Tekla", "סטנדרטים", "BIM", "פרודוקטיביות"],
      thumbnail: "pics/Firm-Folder1.png",
      url: "posts/tekla-firm-folder.html",
      readTime: "5 min read",
      readTime_en: "5 min read",
      readTime_he: "קריאה של 5 דק׳"
    },
    {
      title: "Symmetrical Railings — Importance in Detailing",
      title_en: "Symmetrical Railings — Importance in Detailing",
      title_he: "מעקות סימטריים — חשיבות בתכנון",
      date: "2026-01-05",
      excerpt: "Why symmetry in railing detailing saves time and reduces complexity in fabrication and installation.",
      excerpt_en: "Why symmetry in railing detailing saves time and reduces complexity in fabrication and installation.",
      excerpt_he: "מדוע סימטריה בתכנון חוסכת זמן ומפחיתה מורכבות בייצור ובהרכבה, בדוגמא על מעקות.",
      tags: ["Fabrication", "Tekla", "BIM"],
      tags_he: ["פבריקציה", "Tekla", "BIM"],
      thumbnail: "pics/SymmetricRailingIntro.jpg",
      url: "posts/symmetrical-railings.html",
      readTime: "4 min read",
      readTime_en: "4 min read",
      readTime_he: "קריאה של 4 דק׳"
    },

/*
There is a better post on the same subject.

    {
      title: "Automatically Dimensioning Assembly Drawings",
      title_en: "Automatically Dimensioning Assembly Drawings",
      title_he: "מידול אוטומטי של מידות שרטוטי הרכבה",
      date: "2023-11-30",
      excerpt: "Use Tekla's built-in dimensioning rules to automate assembly drawing dimensioning and reduce errors.",
      excerpt_en: "Use Tekla's built-in dimensioning rules to automate assembly drawing dimensioning and reduce errors.",
      excerpt_he: "השתמשו בכללי המידות המובנים של Tekla כדי לאוטומט מידות בשרטוטי הרכבה ולהפחית טעויות.",
      tags: ["Tekla", "Automation", "BIM"],
      tags_he: ["Tekla", "אוטומציה", "BIM"],
      thumbnail: "pics/assem_drawing_props.jpg",
      url: "posts/automatically-dimensioning-assemblies.html",
      readTime: "6 min read",
      readTime_en: "6 min read",
      readTime_he: "קריאה של 6 דק׳"
    },
*/

    
    {
      title: "Welcome to BIMblog",
      title_en: "Welcome to BIMblog",
      title_he: "ברוכים הבאים לבימבלוג",
      date: "2025-10-13",

      excerpt: "Welcome to BIMblog — an introduction and an invitation to explore practical insights on BIM processes and standards in real projects.",
      excerpt_en: "Welcome to BIMblog — an introduction and an invitation to explore practical insights on BIM processes and standards in real projects.",
      excerpt_he:
        "ברוכים הבאים ל-" +
        ltrSpan("BIMblog") +
        " — פוסט היכרות והזמנה לעיין בתובנות על תהליכים וסטנדרטים בסביבת " +
        ltrSpan("BIM") +
        " בפרויקטים אמיתיים.",

      tags: ["Fabrication", "Tekla", "Automation", "BIM"],
      tags_he: ["פבריקציה", "Tekla", "אוטומציה", "BIM"],
      thumbnail: "pics/Welcome-To-Bim-Blog1.png",
      url: "posts/welcome.html",
      readTime: "3 min read",
      readTime_en: "3 min read",
      readTime_he: "קריאה של 3 דק׳"
    }
  ]
};
