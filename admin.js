// admin.js (בצד שרת)
export async function handleAdminVisits(request, env) {
    const url = new URL(request.url);
    const password = url.searchParams.get('p');

    // סיסמת הניהול שלך - תוכל לשנות אותה כאן
    const ADMIN_PASSWORD = "admin"; 

    if (password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ status: 'error', message: 'גישה נדחתה. סיסמה שגויה.' }), {
            status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        // מושך את 2000 הכניסות האחרונות כדי לא להעמיס על זיכרון השרת
        const { results } = await env.DB.prepare("SELECT * FROM api_visits ORDER BY created_at DESC LIMIT 2000").all();
        
        return new Response(JSON.stringify({
            status: 'success',
            data: results
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (e) {
        return new Response(JSON.stringify({ status: 'error', message: e.message }), {
            status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
