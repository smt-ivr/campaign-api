import { insertDonation, isTransactionExists } from './db.js';
import { getIsraelTime } from './utils.js'; // ייבוא הפונקציה לשעון ישראל

export async function handleWebhookRequest(request, env) {
    try {
        const clientIP = request.headers.get('CF-Connecting-IP');
        if (clientIP !== '18.194.219.73') {
            throw new Error(`IP לא מורשה: ${clientIP}`);
        }

        let bodyData = {};
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            bodyData = await request.json();
        } else {
            const formData = await request.formData();
            bodyData = Object.fromEntries(formData);
        }
        
        console.log("נתוני העסקה שהתקבלו:", JSON.stringify(bodyData));

        const txId = bodyData.TransactionId;
        const amount = parseFloat(bodyData.Amount);
        const donorName = bodyData.ClientName || 'תורם אנונימי';
        const comment = bodyData.Comments || ''; 
        const solicitorId = parseInt(bodyData.Param1) || null;
        
        // *** עודכן: משיכת מטבע מנדרים פלוס (1=שקל, 2=דולר) ***
        const currency = bodyData.Currency || '1'; 

        if (!txId || isNaN(amount)) {
            throw new Error(`חסרים שדות חובה.`);
        }

        const exists = await isTransactionExists(env, txId);
        if (exists) {
            console.log("עסקה כבר קיימת, מתעלם:", txId);
            return new Response(JSON.stringify({ status: 'success', message: 'העסקה כבר קיימת במערכת' }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log("מנסה לשמור למסד הנתונים...");
        
        // *** עודכן: יצירת זמן ישראל ושמירה במסד ***
        const israelTime = getIsraelTime();
        await insertDonation(env, txId, solicitorId, donorName, amount, currency, comment, israelTime);
        
        console.log("העסקה נשמרה בהצלחה במסד הנתונים!");

        return new Response(JSON.stringify({ status: 'success', message: 'התרומה נרשמה בהצלחה' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("--- שגיאה בטיפול בוובהוק ---");
        console.error(error.message);
        throw new Error(`שגיאת וובהוק: ${error.message}`);
    }
}
