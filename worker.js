import { getRealtimeStats, getSolicitorsData, getSettings } from './campaign.js';
import { handleWebhookRequest } from './webhook.js';
import { handleRegister, handleLogin, handleDashboard, handleUpdateTarget } from './solicitor.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // --- נתוני קמפיין (מפוצל) ---
            if (path === '/campaign/api/stats') return await getRealtimeStats(env);
            if (path === '/campaign/api/solicitors') return await getSolicitorsData(env);
            if (path === '/campaign/api/settings') return await getSettings(env);
            
            // --- וובהוק ---
            if (path === '/campaign/api/webhook') return await handleWebhookRequest(request, env);

            // --- אזור מתרימים ---
            if (path === '/campaign/api/solicitor/register') return await handleRegister(request, env);
            if (path === '/campaign/api/solicitor/login') return await handleLogin(request, env);
            if (path === '/campaign/api/solicitor/dashboard') return await handleDashboard(request, env);
            if (path === '/campaign/api/solicitor/update') return await handleUpdateTarget(request, env);

            return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
    }
};
