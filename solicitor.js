// פונקציית עזר למשיכת שער יציג רשמי מבנק ישראל (נוספה גם לכאן לשמירה על חוסר תלות)
async function getOfficialBoiRate() {
    let usdRate = 2.81; 
    try {
        const res = await fetch('https://boi.org.il/PublicApi/GetExchangeRates');
        if (res.ok) {
            const data = await res.json();
            const usdData = data.exchangeRates.find(rate => rate.key === 'USD');
            if (usdData && usdData.currentExchangeRate) {
                usdRate = usdData.currentExchangeRate;
            }
        }
    } catch (e) {
        console.error("שגיאה במשיכת שער יציג מבנק ישראל", e);
    }
    return usdRate;
}

// 1. רישום מתרים חדש
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

        const existing = await env.DB.prepare("SELECT id FROM solicitors WHERE email = ?").bind(email).first();
        if (existing) {
            return new Response(JSON.stringify({ status: 'error', message: 'כתובת אימייל זו כבר רשומה במערכת' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const target = target_amount ? parseFloat(target_amount) : 5000;

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

// 2. התחברות משתמש
export async function handleLogin(request, env) {
    try {
        const body = await request.json();
        const { identifier, password } = body;

        if (!identifier || !password) {
            return new Response(JSON.stringify({ status: 'error', message: 'יש להזין פרטי זיהוי וסיסמה' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const solicitor = await env.DB.prepare(
            "SELECT * FROM solicitors WHERE id = ? OR email = ? OR phone = ?"
        ).bind(identifier, identifier, identifier).first();

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

// 3. שליפת נתוני דאשבורד אישי (מעודכן עם שער בנק ישראל והפרדת מטבעות)
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

        const solicitor = await env.DB.prepare("SELECT * FROM solicitors WHERE id = ?").bind(id).first();
        if (!solicitor || solicitor.password !== password) {
            return new Response(JSON.stringify({ status: 'error', message: 'אימות נכשל. אין הרשאה לצפות בנתונים אלו' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

        const donations = await env.DB.prepare(
            "SELECT donor_name, amount, comment, created_at, currency FROM donations WHERE solicitor_id = ? ORDER BY created_at DESC"
        ).bind(id).all();

        const donationsList = donations.results || [];
        
        let total_ils = 0;
        let total_usd = 0;

        donationsList.forEach(d => {
            if (d.currency === '2' || d.currency === 'USD') {
                total_usd += d.amount;
            } else {
                total_ils += d.amount;
            }
        });

        // חישוב מדויק של שווי התיק לפי בנק ישראל
        const usdRate = await getOfficialBoiRate();
        const combinedTotalRaised = total_ils + (total_usd * usdRate);

        return new Response(JSON.stringify({
            status: 'success',
            data: {
                id: solicitor.id,
                name: solicitor.name,
                target: solicitor.target_amount,
                total_raised: combinedTotalRaised, // שקלול מלא להצגה בבר ההתקדמות
                total_ils: total_ils,              // נטו שקלים
                total_usd: total_usd,              // נטו דולרים
                usd_to_ils_rate: usdRate,          // שער הדולר ביום השליפה
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

        const solicitor = await env.DB.prepare("SELECT password FROM solicitors WHERE id = ?").bind(id).first();
        if (!solicitor || solicitor.password !== password) {
            return new Response(JSON.stringify({ status: 'error', message: 'אין הרשאה לביצוע פעולה זו' }), {
                status: 403, headers: { 'Content-Type': 'application/json' }
            });
        }

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
