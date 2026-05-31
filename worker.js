import { insertDonation, isTransactionExists, insertWebhookError } from './db.js';
import { getIsraelTime } from './utils.js';

export async function handleWebhookRequest(request, env) {
    try {
        const clientIP = request.headers.get('CF-Connecting-IP');
        
        // חסימת IP לא מורשה עם הודעת שגיאה מפורטת במקום לקרוס
        if (clientIP !== '18.194.219.73') {
            console.warn(`נדחתה גישה מוובהוק בשל IP לא מורשה: ${clientIP}`);
            return new Response(JSON.stringify({ 
                status: 'error', 
                message: `גישה נדחתה: כתובת ה-IP שלך (${clientIP}) אינה מורשית לגשת לנקודה זו.` 
            }), { 
                status: 403, 
                headers: { 'Content-Type': 'application/json' } 
            });
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
        const israelTime = getIsraelTime();

        // בדיקה האם נדרים פלוס מדווחים על עסקה שגויה (Status = Error)
        if (bodyData.Status === 'Error') {
            console.log("התקבל וובהוק על עסקה שנכשלה. שומר בטבלת שגיאות...");
            const errorMsg = bodyData.Message || 'שגיאה כללית מנדרים פלוס';
            await insertWebhookError(env, JSON.stringify(bodyData), errorMsg, israelTime);
            
            // מחזירים 200 כדי שנדרים פלוס יראו שההודעה נקלטה
            return new Response(JSON.stringify({ status: 'success', message: 'שגיאה נקלטה ונרשמה בהצלחה' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const txId = bodyData.TransactionId;
        const amount = parseFloat(bodyData.Amount);
        const donorName = bodyData.ClientName || 'תורם אנונימי';
        const comment = bodyData.Comments || ''; 
        const solicitorId = parseInt(bodyData.Param1) || null;
        const currency = bodyData.Currency || '1'; 

        // בדיקת תקינות נתונים במקרה של עסקה רגילה
        if (!txId || isNaN(amount)) {
            console.log("חסרים שדות חובה בוובהוק רגיל. שומר בטבלת שגיאות...");
            await insertWebhookError(env, JSON.stringify(bodyData), 'חסרים שדות חובה (TransactionId או Amount)', israelTime);
            
            return new Response(JSON.stringify({ status: 'success', message: 'וובהוק לא תקין נקלט ונרשם' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
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
        
        await insertDonation(env, txId, solicitorId, donorName, amount, currency, comment, israelTime);
        
        console.log("העסקה נשמרה בהצלחה במסד הנתונים!");

        return new Response(JSON.stringify({ status: 'success', message: 'התרומה נרשמה בהצלחה' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("--- שגיאה בטיפול בוובהוק ---");
        console.error(error.message);
        
        // החזרת שגיאה מפורטת במקום לקרוס ולגרום לראוטר להחזיר שגיאה כללית
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: 'שגיאה פנימית בשרת בעת עיבוד הוובהוק',
            details: error.message
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
