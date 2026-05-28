import { handleCampaignRequest } from './campaign.js';
import { handleWebhookRequest } from './webhook.js';
import { handleRegister, handleLogin, handleDashboard, handleUpdateTarget } from './solicitor.js';

// פונקציית עזר להחזרת תשובות עם CORS למניעת חסימות בדפדפן
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

        // טיפול בבקשות OPTIONS שהדפדפן שולח לפני POST (Preflight)
        if (request.method === 'OPTIONS') {
            return corsResponse(new Response(null, { status: 204 }));
        }

        try {
            let response;

            // נתוני קמפיין כלליים
            if (path === '/campaign/api/data' && request.method === 'GET') {
                response = await handleCampaignRequest(env);
            }
            // קבלת וובהוק מנדרים
            else if (path === '/campaign/api/webhook' && request.method === 'POST') {
                response = await handleWebhookRequest(request, env);
            }
            // --- ניתובים חדשים לאזור מתרימים ---
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
            // שגיאת 404 אם הנתיב לא נמצא
            else {
                response = new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            }

            return corsResponse(response);

        } catch (error) {
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
