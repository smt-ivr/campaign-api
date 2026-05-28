import { handleCampaignRequest } from './campaign.js';
import { handleWebhookRequest } from './webhook.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // ניתוב לבקשת נתוני הקמפיין מהאתר (GET)
            if (path === '/campaign/api/data' && request.method === 'GET') {
                return await handleCampaignRequest(env);
            }
            
            // ניתוב לקבלת הוובהוק מנדרים פלוס (POST)
            if (path === '/campaign/api/webhook' && request.method === 'POST') {
                return await handleWebhookRequest(request, env);
            }

            // אם פנו לניתוב שלא קיים
            return new Response(JSON.stringify({ error: 'Not Found', requested_path: path }), { 
                status: 404, 
                headers: { 'Content-Type': 'application/json' } 
            });

        } catch (error) {
            // מערכת מתקדמת לתפיסת שגיאות - מחזירה פירוט מדויק של התקלה
            return new Response(JSON.stringify({ 
                status: 'error', 
                message: 'Internal Server Error',
                details: error.message,
                stack: error.stack // מומלץ להסיר בייצור, אבל מעולה לפיתוח
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' } 
            });
        }
    }
};
