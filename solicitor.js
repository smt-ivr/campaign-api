import { 
    checkSolicitorExists, 
    createSolicitor, 
    getSolicitorById, 
    getSolicitorDonations, 
    updateSolicitorTarget 
} from './db.js';

// פונקציית עזר: הגרלת ID בן 5 ספרות שלא קיים במערכת
async function generateUniqueId(env) {
    let id;
    let exists = true;
    while (exists) {
        id = Math.floor(10000 + Math.random() * 90000); // מספר בין 10000 ל-99999
        const check = await getSolicitorById(env, id);
        if (!check) exists = false;
    }
    return id;
}

// הרשמת מתרים חדש
export async function handleRegister(request, env) {
    const data = await request.json();
    const { name, email, phone, password, target_amount } = data;

    if (!name || !email || !password || target_amount === undefined) {
        throw new Error('חסרים שדות חובה להרשמה');
    }

    const exists = await checkSolicitorExists(env, email, phone);
    if (exists) {
        return new Response(JSON.stringify({ status: 'error', message: 'מייל או טלפון כבר קיימים במערכת' }), { status: 400 });
    }

    const id = await generateUniqueId(env);
    await createSolicitor(env, id, name, email, phone, password, parseFloat(target_amount));

    return new Response(JSON.stringify({ status: 'success', id: id, message: 'החשבון נוצר בהצלחה' }), { status: 200 });
}

// התחברות
export async function handleLogin(request, env) {
    const data = await request.json();
    const { id, password } = data;

    if (!id || !password) throw new Error('נא להזין מספר מתרים וסיסמה');

    const solicitor = await getSolicitorById(env, parseInt(id));
    
    // בדיקת סיסמה (בטקסט רגיל כפי שביקשת)
    if (!solicitor || solicitor.password !== password) {
        return new Response(JSON.stringify({ status: 'error', message: 'מספר מתרים או סיסמה שגויים' }), { status: 401 });
    }

    return new Response(JSON.stringify({ 
        status: 'success', 
        data: { id: solicitor.id, name: solicitor.name } 
    }), { status: 200 });
}

// שליפת נתונים לאזור האישי
export async function handleDashboard(request, env) {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id'));

    if (!id) throw new Error('חסר מזהה מתרים');

    const solicitor = await getSolicitorById(env, id);
    if (!solicitor) throw new Error('מתרים לא נמצא');

    const donations = await getSolicitorDonations(env, id);
    const totalRaised = donations.reduce((sum, donation) => sum + donation.amount, 0);

    return new Response(JSON.stringify({
        status: 'success',
        data: {
            id: solicitor.id,
            name: solicitor.name,
            target: solicitor.target_amount,
            total_raised: totalRaised,
            donations: donations // רשימת התרומות כדי להציג לו מי תרם
        }
    }), { status: 200 });
}

// עדכון יעד אישי
export async function handleUpdateTarget(request, env) {
    const data = await request.json();
    const { id, password, new_target } = data;

    const solicitor = await getSolicitorById(env, parseInt(id));
    if (!solicitor || solicitor.password !== password) {
        return new Response(JSON.stringify({ status: 'error', message: 'פעולה לא מורשית - סיסמה שגויה' }), { status: 401 });
    }

    await updateSolicitorTarget(env, parseInt(id), parseFloat(new_target));

    return new Response(JSON.stringify({ status: 'success', message: 'היעד עודכן בהצלחה' }), { status: 200 });
}
