import { getDb } from './db.js';

// 1. רישום מתרים/שגריר חדש
export async function handleRegisterSolicitor(request, env) {
    try {
        const body = await request.json();
        const { name, email, phone, password, confirm_password, target_amount } = body;

        if (!name || !email || !password) {
            return new Response(JSON.stringify({ status: 'error', message: 'נא למלא את כל שדות החובה (שם, אימייל וסיסמה)' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (password !== confirm_password) {
            return new Response(JSON.stringify({ status: 'error', message: 'הסיסמאות אינן תואמות' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = getDb(env);

        // בדיקה האם האימייל כבר קיים במערכת
        const existing = await db.prepare("SELECT id FROM solicitors WHERE email = ?").bind(email).first();
        if (existing) {
            return new Response(JSON.stringify({ status: 'error', message: 'כתובת אימייל זו כבר רשומה במערכת' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const target = target_amount ? parseFloat(target_amount) : 5000;

        // הכנסת המתרים למסד הנתונים עם הסיסמה בטקסט גלוי (ללא הצפנה)
        const result = await db.prepare(
            "INSERT INTO solicitors (name, email, phone, password, target_amount) VALUES (?, ?, ?, ?, ?)"
        ).bind(name, email, phone || null, password, target).run();

        const newId = result.meta.last_row_id;

        return new Response(JSON.stringify({
            status: 'success',
            message: 'החשבון נוצר בהצלחה',
            id: newId
        }), { status: 201, headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: 'שגיאה פנימית ברישום המתרים' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 2. התחברות משתמש (Login)
export async function handleLoginSolicitor(request, env) {
    try {
        const body = await request.json();
        const { identifier, password } = body; // identifier יכול להיות אימייל, טלפון או מזהה מספר

        if (!identifier || !password) {
            return new Response(JSON.stringify({ status: 'error', message: 'יש להזין פרטי זיהוי וסיסמה' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = getDb(env);
        
        // חיפוש המתרים לפי מזהה, אימייל או טלפון
        const solicitor = await db.prepare(
            "SELECT * FROM solicitors WHERE id = ? OR email = ? OR phone = ?"
        ).bind(identifier, identifier, identifier).first();

        // השוואת הסיסמה בטקסט גלוי ישיר
        if (!solicitor || solicitor.password !== password) {
            return new Response(JSON.stringify({ status: 'error', message: 'פרטי הזיהוי או הסיסמה שגויים' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            status: 'success',
            data: {
                id: solicitor.id,
                name: solicitor.name,
                email: solicitor.email
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: 'שגיאה בתהליך האימות מול השרת' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 3. שליפת נתוני דאשבורד אישי (מאובטח באמצעות אימות סיסמה)
export async function handleDashboard(request, env) {
    try {
        const url = new URL(request.url);
        const id = parseInt(url.searchParams.get('id'));
        const password = url.searchParams.get('p'); // קבלת הסיסמה מהקליינט למניעת סריקות

        if (!id || isNaN(id) || !password) {
            return new Response(JSON.stringify({ status: 'error', message: 'גישה חסומה. מזהה משתמש או מפתח אימות חסרים' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = getDb(env);

        // שליפת המתרים ובדיקת התאמת סיסמה ישירה
        const solicitor = await db.prepare("SELECT * FROM solicitors WHERE id = ?").bind(id).first();
        if (!solicitor || solicitor.password !== password) {
            return new Response(JSON.stringify({ status: 'error', message: 'אימות נכשל. אין הרשאה לצפות בנתונים אלו' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        // שליפת רשימת התרומות שזרמו דרך שותף זה
        const donations = await db.prepare(
            "SELECT donor_name, amount, comment, created_at FROM donations WHERE solicitor_id = ? ORDER BY created_at DESC"
        ).bind(id).all();

        const donationsList = donations.results || [];
        const totalRaised = donationsList.reduce((sum, d) => sum + d.amount, 0);

        return new Response(JSON.stringify({
            status: 'success',
            data: {
                id: solicitor.id,
                name: solicitor.name,
                target: solicitor.target_amount,
                total_raised: totalRaised,
                donations: donationsList
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: 'שגיאה בשליפת נתוני הדאשבורד' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 4. עדכון יעד גיוס אישי
export async function handleUpdateTarget(request, env) {
    try {
        const body = await request.json();
        const { id, password, new_target } = body;

        if (!id || !password || !new_target || isNaN(new_target)) {
            return new Response(JSON.stringify({ status: 'error', message: 'נתונים חסרים או לא תקינים לעדכון היעד' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const db = getDb(env);

        // וידוא שהמשתמש מורשה לעדכן את היעד (בדיקת סיסמה ישירה)
        const solicitor = await db.prepare("SELECT password FROM solicitors WHERE id = ?").bind(id).first();
        if (!solicitor || solicitor.password !== password) {
            return new Response(JSON.stringify({ status: 'error', message: 'אין הרשאה לביצוע פעולה זו' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        // ביצוע העדכון בפועל
        await db.prepare("UPDATE solicitors SET target_amount = ? WHERE id = ?").bind(parseFloat(new_target), id).run();

        return new Response(JSON.stringify({
            status: 'success',
            message: 'היעד האישי עודכן בהצלחה'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: 'שגיאה פנימית בעדכון היעד' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 5. שליפת רשימת כל המתרימים (עבור תפריט הבחירה באתר התרומות הראשי)
export async function handleGetSolicitors(request, env) {
    try {
        const db = getDb(env);
        // שליפת השמות והמזהים בלבד (ללא חשיפת סיסמאות או מידע אישי)
        const solicitors = await db.prepare("SELECT id, name FROM solicitors ORDER BY name ASC").all();

        return new Response(JSON.stringify(solicitors.results || []), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // מאפשר גישה מדומיינים שונים לפרונטאנד
            }
        });
    } catch (err) {
        return new Response(JSON.stringify([]), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
