import { 
    checkSolicitorExists, 
    createSolicitor, 
    getSolicitorById, 
    getSolicitorDonations, 
    updateSolicitorTarget,
    getSolicitorByLoginIdentifier
} from './db.js';

async function generateUniqueId(env) {
    let id;
    let exists = true;
    while (exists) {
        id = Math.floor(10000 + Math.random() * 90000);
        const check = await getSolicitorById(env, id);
        if (!check) exists = false;
    }
    return id;
}

// פונקציות עזר לבדיקת תקינות
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^[0-9]{9,10}$/.test(phone);
}

// הרשמת מתרים חדש
export async function handleRegister(request, env) {
    const data = await request.json();
    const { name, email, phone, password, confirm_password, target_amount } = data;

    // בדיקת שדות חובה
    if (!name || !email || !password || !confirm_password || target_amount === undefined) {
        return new Response(JSON.stringify({ status: 'error', message: 'חסרים שדות חובה להרשמה' }), { status: 400 });
    }

    // בדיקת סיסמה כפולה
    if (password !== confirm_password) {
        return new Response(JSON.stringify({ status: 'error', message: 'הסיסמאות שהוזנו אינן תואמות' }), { status: 400 });
    }

    // בדיקות תקינות אימייל וטלפון
    if (!isValidEmail(email)) {
        return new Response(JSON.stringify({ status: 'error', message: 'כתובת המייל אינה תקינה' }), { status: 400 });
    }
    
    if (phone && !isValidPhone(phone)) {
        return new Response(JSON.stringify({ status: 'error', message: 'מספר הטלפון אינו תקין (יש להזין 9-10 ספרות)' }), { status: 400 });
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
    const { identifier, password } = data; // identifier יכול להיות ID, מייל או טלפון

    if (!identifier || !password) {
        return new Response(JSON.stringify({ status: 'error', message: 'נא להזין פרטי התחברות וסיסמה' }), { status: 400 });
    }

    // חיפוש מתרים לפי אחד מהפרטים
    const solicitor = await getSolicitorByLoginIdentifier(env, identifier);
    
    if (!solicitor || solicitor.password !== password) {
        return new Response(JSON.stringify({ status: 'error', message: 'פרטי ההתחברות או הסיסמה שגויים' }), { status: 401 });
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
            donations: donations 
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
