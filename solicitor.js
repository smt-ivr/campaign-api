// 1. רישום מתרים חדש (שם פונקציה תואם ל-worker.js)
export async function handleRegister(request, env) {
    try {
        const body = await request.json();
        const { name, email, phone, password, confirm_password, target_amount } = body;

        if (!name || !email || !password) {
            return new Response(JSON.stringify({ status: 'error', message: 'נא למלא את כל שדות החובה' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (password !== confirm_password) {
            return new Response(JSON.stringify({ status: 'error', message: 'הסיסמאות אינן תואמות' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        // בדיקה האם האימייל כבר קיים במערכת בעזרת env.DB
        const existing = await env.DB.prepare("SELECT id FROM solicitors WHERE email = ?").bind(email).first();
        if (existing) {
            return new Response(JSON.stringify({ status: 'error', message: 'כתובת אימייל זו כבר רשומה במערכת' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const target = target_amount ? parseFloat(target_amount) : 5000;

        // הכנסת המתרים למסד הנתונים
        const result = await env.DB.prepare(
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

// 2. התחברות משתמש (שם פונקציה תואם ל-worker.js)
export async function handleLogin(request, env) {
    try {
        const body = await request.json();
        const { identifier, password } = body;

        if (!identifier || !password) {
            return new Response(JSON.stringify({ status: 'error', message: 'יש להזין פרטי זיהוי וסיסמה' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // חיפוש המתרים בעזרת env.DB
        const solicitor = await env.DB.prepare(
            "SELECT * FROM solicitors WHERE id = ? OR email = ? OR phone = ?"
        ).bind(identifier, identifier, identifier).first();

        // השוואת הסיסמה
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

// 3. שליפת נתוני דאשבורד אישי 
export async function handleDashboard(request, env) {
    try {
        const url = new URL(request.url);
        const id = parseInt(url.searchParams.get('id'));
        const password = url.searchParams.get('p');

        if (!id || isNaN(id) || !password) {
            return new Response(JSON.stringify({ status: 'error', message: 'גישה חסומה. מזהה משתמש או מפתח אימות חסרים' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        // שליפת המתרים ובדיקת התאמת סיסמה
        const solicitor = await env.DB.prepare("SELECT * FROM solicitors WHERE id = ?").bind(id).first();
        if (!solicitor || solicitor.password !== password) {
            return new Response(JSON.stringify({ status: 'error', message: 'אימות נכשל. אין הרשאה לצפות בנתונים אלו' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        // שליפת רשימת התרומות
        const donations = await env.DB.prepare(
            "SELECT donor_name, amount, comment, created_at, currency FROM donations WHERE solicitor_id = ? ORDER BY created_at DESC"
        ).bind(id).all();

        const donationsList = donations.results || [];
        // סכימת סך כל התרומות ללא תלות במטבע (החלוקה המדויקת מתבצעת בדאשבורד בפרונטאנד)
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

        // וידוא שהמשתמש מורשה לעדכן את היעד 
        const solicitor = await env.DB.prepare("SELECT password FROM solicitors WHERE id = ?").bind(id).first();
        if (!solicitor || solicitor.password !== password) {
            return new Response(JSON.stringify({ status: 'error', message: 'אין הרשאה לביצוע פעולה זו' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        // ביצוע העדכון
        await env.DB.prepare("UPDATE solicitors SET target_amount = ? WHERE id = ?").bind(parseFloat(new_target), id).run();

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
