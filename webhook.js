import { insertDonation, isTransactionExists } from './db.js';

export async function handleWebhookRequest(request, env) {
    try {
        // 1. אבטחה: אימות כתובת IP של נדרים פלוס
        const clientIP = request.headers.get('CF-Connecting-IP');
        if (clientIP !== '18.194.219.73') {
            throw new Error(`IP לא מורשה: ${clientIP}. ציפינו ל-18.194.219.73`);
        }

        // 2. קריאה חכמה של הנתונים (תומך גם ב-Form וגם ב-JSON)
        let bodyData = {};
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            bodyData = await request.json();
        } else {
            const formData = await request.formData();
            bodyData = Object.fromEntries(formData);
        }
        
        // 3. חילוץ הנתונים החשובים מהעסקה
        const txId = bodyData.TransactionId;
        const amount = parseFloat(bodyData.Amount);
        const donorName = `${bodyData.FirstName || ''} ${bodyData.LastName || ''}`.trim() || 'תורם אנונימי';
        const comment = bodyData.Comment || '';
        const solicitorId = parseInt(bodyData.Param1) || null; // ה-ID של המתרים שהעברנו מהפרונטאנד

        // 4. וולידציה בסיסית
        if (!txId || isNaN(amount)) {
            throw new Error('חסרים שדות חובה (TransactionId או Amount לא תקין)');
        }

        // 5. מניעת כפילויות (במקרה שנדרים שולחים שוב את אותו קאלבק)
        const exists = await isTransactionExists(env, txId);
        if (exists) {
            return new Response(JSON.stringify({ status: 'success', message: 'העסקה כבר קיימת במערכת' }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // 6. שמירה במסד הנתונים D1
        await insertDonation(env, txId, solicitorId, donorName, amount, comment);

        // 7. תגובת הצלחה לנדרים פלוס
        return new Response(JSON.stringify({ status: 'success', message: 'התרומה נרשמה בהצלחה' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        // זריקת השגיאה כדי שה-index.js יתפוס אותה ויחזיר פירוט מדויק
        throw new Error(`שגיאת וובהוק: ${error.message}`);
    }
}
