import { insertDonation, isTransactionExists } from './db.js';

export async function handleWebhookRequest(request, env) {
    try {
        const clientIP = request.headers.get('CF-Connecting-IP');
        if (clientIP !== '18.194.219.73') {
            throw new Error(`IP לא מורשה: ${clientIP}. ציפינו ל-18.194.219.73`);
        }

        let bodyData = {};
        const contentType = request.headers.get('content-type') || '';
        
        console.log("=== התקבל וובהוק מנדרים פלוס ===");
        console.log("Content-Type:", contentType);

        if (contentType.includes('application/json')) {
            bodyData = await request.json();
        } else {
            const formData = await request.formData();
            bodyData = Object.fromEntries(formData);
        }
        
        // הלוג החשוב ביותר: ידפיס את כל הנתונים שהתקבלו
        console.log("נתוני העסקה שהתקבלו:", JSON.stringify(bodyData));

        const txId = bodyData.TransactionId;
        const amount = parseFloat(bodyData.Amount);
        const donorName = `${bodyData.FirstName || ''} ${bodyData.LastName || ''}`.trim() || 'תורם אנונימי';
        const comment = bodyData.Comment || '';
        const solicitorId = parseInt(bodyData.Param1) || null;

        if (!txId || isNaN(amount)) {
            throw new Error(`חסרים שדות חובה. TransactionId: ${txId}, Amount: ${bodyData.Amount}`);
        }

        const exists = await isTransactionExists(env, txId);
        if (exists) {
            console.log("עסקה כבר קיימת, מתעלם:", txId);
            return new Response(JSON.stringify({ status: 'success', message: 'העסקה כבר קיימת במערכת' }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // ניסיון שמירה למסד הנתונים
        console.log("מנסה לשמור למסד הנתונים...");
        await insertDonation(env, txId, solicitorId, donorName, amount, comment);
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
