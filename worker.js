import { getCampaignData } from './campaign.js';
import { handleWebhook } from './webhook.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // פתרון CORS חובה - מאפשר לאתר לשלוח בקשות לשרת
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // 1. ניתוב לשליפת נתוני קמפיין (GET) - משמש את הפרונטאנד
            if (request.method === 'GET' && url.pathname.endsWith('/api/data')) {
                const data = await getCampaignData(env.DB);
                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            // 2. ניתוב לוובהוק של נדרים פלוס (POST)
            if (request.method === 'POST' && url.pathname.endsWith('/api/webhook')) {
                const result = await handleWebhook(request, env.DB);
                return new Response(JSON.stringify(result), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }

            // 3. אם הנתיב לא מוכר
            return new Response(JSON.stringify({ 
                error: "Not Found", 
                message: "הנתיב המבוקש לא קיים בשרת" 
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (error) {
            // === מערכת שגיאות מתקדמת ===
            // כל שגיאה בשרת או במסד הנתונים תיתפס כאן במקום לרסק את המערכת
            console.error("Critical Server Error:", error);
            
            return new Response(JSON.stringify({
                status: "error",
                message: error.message,
                stack: error.stack // מציג את שורת השגיאה המדויקת בדיבאג
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};
