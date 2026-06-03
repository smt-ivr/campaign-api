// webhook.js
import { insertDonation, isTransactionExists, insertWebhookError, getCampaignSettings } from './db.js';
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
        
        // שמירת כל הנתונים שנשלחו (כדי שנוכל לשמור בבסיס הנתונים כפי שביקשת)
        const fullPayload = JSON.stringify(bodyData);

        // בדיקה האם נדרים פלוס מדווחים על עסקה שגויה (Status = Error)
        if (bodyData.Status === 'Error') {
            console.log("התקבל וובהוק על עסקה שנכשלה. שומר בטבלת שגיאות...");
            const errorMsg = bodyData.Message || 'שגיאה כללית מנדרים פלוס';
            await insertWebhookError(env, fullPayload, errorMsg, israelTime);
            
            // מחזירים 200 כדי שנדרים פלוס יראו שההודעה נקלטה
            return new Response(JSON.stringify({ status: 'success', message: 'שגיאה נקלטה ונרשמה בהצלחה' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // === זיהוי סוג העסקה ושליפת הנתונים ===
        const isKeva = bodyData.KevaId ? 1 : 0; // אם יש KevaId זו הוראת קבע
        // מזהה חד-חד ערכי (לעסקה רגילה זה TransactionId, להוראת קבע זה KevaId)
        const txId = bodyData.TransactionId || bodyData.KevaId; 
        
        const amount = parseFloat(bodyData.Amount);
        const donorName = bodyData.ClientName || 'תורם אנונימי';
        const comment = bodyData.Comments || ''; 
        const solicitorId = parseInt(bodyData.Param1) || null;
        const currency = bodyData.Currency || '1'; 
        const webhookGroupe = bodyData.Groupe || '';

        // בדיקת תקינות נתונים במקרה של עסקה רגילה או הו"ק
        if (!txId || isNaN(amount)) {
            console.log("חסרים שדות חובה בוובהוק. שומר בטבלת שגיאות...");
            await insertWebhookError(env, fullPayload, 'חסרים שדות חובה (TransactionId/KevaId או Amount)', israelTime);
            
            return new Response(JSON.stringify({ status: 'success', message: 'וובהוק לא תקין נקלט ונרשם' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // === בדיקת תאימות של הקטגוריה (Groupe) ===
        const settings = await getCampaignSettings(env);
        const campaignGroupe = settings.groupe_name || '';

        // אם מוגדרת קטגוריה לקמפיין במסד הנתונים, והעסקה לא שייכת אליה
        if (campaignGroupe && webhookGroupe !== campaignGroupe) {
            console.log(`עסקה לא שייכת לקמפיין. קטגוריה התקבלה: ${webhookGroupe}, נדרשת: ${campaignGroupe}`);
            await insertWebhookError(env, fullPayload, `התקבלה עסקה שלא שייכת לקבוצת הקמפיין (${webhookGroupe})`, israelTime);
            
            return new Response(JSON.stringify({ status: 'success', message: 'העסקה נשמרה בשגיאות עקב אי-תאימות בקבוצה' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // === מניעת כפילויות ===
        const exists = await isTransactionExists(env, String(txId));
        if (exists) {
            console.log("עסקה/הוראת קבע כבר קיימת, מתעלם:", txId);
            return new Response(JSON.stringify({ status: 'success', message: 'העסקה כבר קיימת במערכת' }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        console.log("מנסה לשמור למסד הנתונים...");
        
        // שמירת התרומה כולל כל הפרטים החדשים
        await insertDonation(env, String(txId), solicitorId, donorName, amount, currency, comment, israelTime, webhookGroupe, isKeva, fullPayload);
        
        console.log("העסקה/הוראת קבע נשמרה בהצלחה במסד הנתונים!");

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
