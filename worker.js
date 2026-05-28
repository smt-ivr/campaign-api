import { handleCampaignRequest } from './campaign.js';
import { handleWebhookRequest } from './webhook.js';
import { handleRegister, handleLogin, handleDashboard, handleUpdateTarget } from './solicitor.js';

function corsResponse(response) {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(response.body, { status: response.status, headers: newHeaders });
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (request.method === 'OPTIONS') {
            return corsResponse(new Response(null, { status: 204 }));
        }

        try {
            let response;

            if (path === '/campaign/api/data' && request.method === 'GET') {
                response = await handleCampaignRequest(env);
            }
            else if (path === '/campaign/api/webhook' && request.method === 'POST') {
                response = await handleWebhookRequest(request, env);
            }
            else if (path === '/campaign/api/solicitor/register' && request.method === 'POST') {
                response = await handleRegister(request, env);
            }
            else if (path === '/campaign/api/solicitor/login' && request.method === 'POST') {
                response = await handleLogin(request, env);
            }
            else if (path === '/campaign/api/solicitor/dashboard' && request.method === 'GET') {
                response = await handleDashboard(request, env);
            }
            else if (path === '/campaign/api/solicitor/update' && request.method === 'POST') {
                response = await handleUpdateTarget(request, env);
            }
            else {
                response = new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            }

            return corsResponse(response);

        } catch (error) {
            // מערכת המעקב: מדפיסה את השגיאה המדויקת ללוגים של קלאודפלייר!
            console.error("=== קריסת שרת נתפסה בראוטר הראשי ===");
            console.error("נתיב שניסה לגשת:", path);
            console.error("הודעת שגיאה:", error.message);
            console.error("פירוט (Stack):", error.stack);

            return corsResponse(new Response(JSON.stringify({ 
                status: 'error', 
                message: 'שגיאת שרת פנימית',
                details: error.message
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' } 
            }));
        }
    }
};
