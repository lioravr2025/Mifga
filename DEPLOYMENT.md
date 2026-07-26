# פריסת Mifga לייצור על Coolify (159.69.43.197)

מסמך הפעלה (runbook) מיועד למי שיש לו גישת SSH/Terminal לשרת ה-Hetzner הזה וגישת admin ל-Coolify
בכתובת `http://159.69.43.197:8000`. מטרתו: להקים על השרת הקיים **פרויקט חדש ומבודד לגמרי** בשם `Mifga`,
בלי שום חיבור לפרויקט הקיים של ארגון ה-AI הישראלי שכבר רץ שם.

## עקרון הבידוד - למה זה בטוח

ב-Coolify, "Project" הוא גבול הבידוד המרכזי:
- לכל Resource (אפליקציה/שירות) בתוך Project משלו מקבל **container(s) נפרדים, network נפרד, ו-volumes נפרדים**
  כברירת מחדל - שני Projects שונים לא "רואים" זה את זה ברשת הפנימית, אלא אם מגדירים את זה במפורש (ולא נעשה זאת).
- משתני סביבה (env vars) וסודות (secrets) מוגדרים ברמת ה-Resource/Project הבודד - אין שיתוף אוטומטי בין פרויקטים.
- כתובת דומיין/תת-דומיין נפרדת לגמרי מהפרויקט הקיים.

**מה כן משותף:** רק חומרת השרת הפיזית - CPU, זיכרון, דיסק. זו הסיבה שבפרק 0 למטה בודקים משאבים פנויים,
ובפרק 4 קובעים מגבלות משאבים (resource limits) לפרויקט החדש - כדי שהוא לעולם לא "יחנוק" את הפרויקט הקיים.

**כלל ברזל למי שמבצע את זה:** לאורך כל התהליך - **לא לגעת, לא לערוך, ולא למחוק שום Resource, Environment, או
Volume ששייך לפרויקט הקיים.** כל פעולה כאן מתבצעת אך ורק בתוך ה-Project החדש `Mifga` שנוצר בשלב 1.

---

## שלב 0: בדיקת משאבים פנויים לפני שמתחילים

1. בדשבורד של Coolify: Servers → השרת → Overview - לבדוק כמה CPU/RAM/דיסק כבר בשימוש על ידי הפרויקט הקיים.
2. חלופה מהטרמינל (SSH לשרת): `docker stats --no-stream` ו-`df -h`.
3. **חשוב:** מחסנית Supabase עצמאית (Postgres + Auth + PostgREST + Realtime + Storage + Kong + Studio) צורכת
   בערך 1.5-2GB RAM בעצמה. אם השרת הוא Hetzner CX22 (2 vCPU / 4GB RAM) וכבר רץ עליו פרויקט נוסף, כדאי לוודא
   שנשארים לפחות 2GB RAM פנויים לפני שממשיכים - אחרת שני הפרויקטים "יריבו" על משאבים וגם הפרויקט הקיים ייפגע
   בביצועים. אם אין מספיק - זה הזמן לשקול שדרוג שרת (Coolify תומך בהוספת שרת נוסף לאותו חשבון בקלות, לא חייבים
   להתפשר על אותה מכונה).

---

## שלב 1: יצירת Project מבודד בשם Mifga

1. בדשבורד `http://159.69.43.197:8000/projects` → **+ New Project**
2. שם: `Mifga`
3. **אין** לבחור "Add to existing project" של הארגון - זה חייב להיות Project חדש לגמרי ברשימה.
4. בתוך ה-Project החדש, Coolify יוצר אוטומטית Environment בשם `production` - זה יספיק לשלב הזה (בלי לגעת
   ב-Environments של פרויקטים אחרים).

---

## שלב 2: פריסת Supabase עצמאי (בסיס הנתונים + Auth + API)

1. בתוך Project `Mifga` → **+ New Resource** → לחפש בקטלוג השירותים **Supabase** (Coolify כולל תבנית
   one-click רשמית שפורסת את כל המחסנית - Postgres, GoTrue/Auth, PostgREST, Realtime, Storage, Kong, Studio -
   כ"שירות" אחד מנוהל).
2. שם ה-Resource: `mifga-supabase`.
3. **סודות (Secrets) - ליצור חדשים, לעולם לא להעתיק מהפרויקט הקיים:**
   - `POSTGRES_PASSWORD` - סיסמה אקראית חזקה חדשה (למשל `openssl rand -base64 32`)
   - `JWT_SECRET` - מחרוזת אקראית של 32+ תווים (`openssl rand -base64 40`)
   - Coolify/תבנית ה-Supabase יגזרו מכך אוטומטית את `ANON_KEY` ו-`SERVICE_ROLE_KEY` (או שיהיה צריך להריץ script
     ליצירתם מה-JWT_SECRET - תלוי בגרסת התבנית; יש לעקוב אחר ההוראות שהתבנית מציגה בזמן ההגדרה).
4. **Deploy**. יקח כמה דקות בפעם הראשונה (מוריד ובונה כמה containers).
5. אימות בידוד: ב-Resource → Networking, לוודא שה-Docker network ששויך הוא ייחודי לפרויקט הזה (לא אותו network
   של הפרויקט הקיים). Coolify עושה זאת אוטומטית - זה רק צעד וידוא.

### הגדרת דומיין/תת-דומיין

1. ב-Resource `mifga-supabase` → Domains, להגדיר תת-דומיין ייעודי, למשל:
   - `api-mifga.yourdomain.com` → מצביע על שער ה-API (Kong, פורט 8000 פנימי)
   - `studio-mifga.yourdomain.com` → מצביע על Supabase Studio (לניהול, לא לחשוף לציבור אם אפשר - ראו "אבטחה" למטה)
2. Coolify מנפיק אוטומטית תעודת SSL (Let's Encrypt) לכל תת-דומיין חדש - אין לגעת בהגדרות ה-Proxy הגלובליות
   שמשרתות את הפרויקט הקיים.
3. **אין להשתמש בפורטים גולמיים חדשים על השרת** (כמו `-p 5432:5432` על ה-host) - Coolify's Traefik proxy כבר
   מנתב הכל דרך 80/443 לפי הדומיין; חשיפת פורט ישיר על ה-host מגדילה סיכון להתנגשות עם הפרויקט הקיים ומיותרת.

### הרצת הסכמה

1. לפתוח את Supabase Studio (`studio-mifga.yourdomain.com`) → SQL Editor.
2. להדביק ולהריץ את התוכן המלא של `supabase/schema.sql` מתוך ה-repo (`lioravr2025/Mifga`).
3. לוודא שהריצה הצליחה בלי שגיאות (הסקריפט אידמפוטנטי - אפשר להריץ שוב בבטחה).
4. Authentication → Providers → לוודא ש-**Anonymous Sign-ins מופעל** (זה מנגנון ההזדהות שהאפליקציה
   משתמשת בו לקבוצת הבדיקה - ראו "אסטרטגיית הזדהות" ב-README).

---

## שלב 3: פריסת אפליקציית ה-Frontend (Mifga עצמה)

1. באותו Project `Mifga` → **+ New Resource** → **Public Repository** (או מחברים את חשבון ה-GitHub ובוחרים
   `lioravr2025/Mifga` אם רוצים בנייה אוטומטית בכל push).
2. Build Pack: **Static Site** (Vite בונה קבצים סטטיים ל-`dist/`) - Build Command: `npm run build`,
   Publish Directory: `dist`.
3. **Environment Variables** של ה-Resource הזה (לא של ה-Supabase - נפרד):
   - `VITE_SUPABASE_URL` = `https://api-mifga.yourdomain.com`
   - `VITE_SUPABASE_ANON_KEY` = ה-anon key שהתקבל בשלב 2
4. Domains: תת-דומיין נפרד, למשל `app-mifga.yourdomain.com` או `mifga.yourdomain.com`.
5. Deploy.

---

## שלב 4: מגבלות משאבים (כדי שלא "יחנוק" את הפרויקט הקיים)

בכל אחד מה-Resources בתוך Project `Mifga` (גם Supabase וגם ה-Frontend) → Advanced/Resource Limits:
- CPU limit: להתחיל שמרני, למשל 1 vCPU לכל אחד (אפשר להעלות בהמשך אם צריך)
- Memory limit: Supabase - עד 2GB, Frontend - עד 256MB (זה סטטי, כמעט לא צורך זיכרון)

זה מבטיח שגם אם יש עומס לא צפוי ב-Mifga, לפרויקט הקיים נשארים משאבים מובטחים.

---

## שלב 5: צ'קליסט אבטחה לפני שמפיצים APK לבודקים

- [ ] `POSTGRES_PASSWORD` ו-`JWT_SECRET` הם ערכים אקראיים חדשים, לא ברירת מחדל ולא הועתקו מפרויקט אחר
- [ ] Supabase Studio (`studio-mifga...`) מוגן בסיסמה נוספת (Coolify מאפשר Basic Auth על ה-Route), או לא חשוף
      לאינטרנט הפתוח בכלל (רק דרך VPN/SSH tunnel)
- [ ] RLS (Row Level Security) מופעל על כל הטבלאות - הסקריפט `schema.sql` כבר עושה את זה, רק לוודא בבדיקה
      ידנית ב-Studio → Authentication → Policies שהכל אכן ON
- [ ] `SERVICE_ROLE_KEY` (המפתח החזק שעוקף RLS) **לא** מוטמע באפליקציית ה-client בשום מקום - רק `ANON_KEY`
      מותר להיכנס לבנייה של ה-APK

---

## מה מחזירים אליי (Claude) בסוף

אחרי שהשלבים 1-3 בוצעו, צריך למסור בחזרה שני ערכים כדי שאשלים את חיווט הקוד:
1. `VITE_SUPABASE_URL` הסופי (כתובת ה-API)
2. `VITE_SUPABASE_ANON_KEY` הסופי

איתם אני אעדכן את קובץ `.env` בפרויקט ואבנה APK שמצביע על השרת האמיתי במקום המצב המקומי.
