// שליפת הגדרות הקמפיין
export async function getCampaignSettings(env) {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings = {};
    for (let row of results) {
        settings[row.key] = row.value;
    }
    return settings;
}

// שליפת סך כל התרומות
export async function getTotalDonations(env) {
    const result = await env.DB.prepare("SELECT SUM(amount) as total FROM donations").first();
    return result?.total || 0;
}

// שליפת רשימת מתרימים עם חישוב כמה כל אחד גייס
export async function getSolicitors(env) {
    const { results } = await env.DB.prepare(`
        SELECT s.id, s.name, s.target_amount, COALESCE(SUM(d.amount), 0) as raised
        FROM solicitors s
        LEFT JOIN donations d ON s.id = d.solicitor_id
        GROUP BY s.id
    `).all();
    return results;
}

// בדיקה אם עסקה כבר קיימת כדי למנוע כפל תרומות
export async function isTransactionExists(env, txId) {
    const result = await env.DB.prepare("SELECT id FROM donations WHERE nedarim_tx_id = ?").first();
    return result !== null;
}

// הכנסת תרומה חדשה לטבלה
export async function insertDonation(env, txId, solicitorId, donorName, amount, comment) {
    await env.DB.prepare(`
        INSERT INTO donations (nedarim_tx_id, solicitor_id, donor_name, amount, comment) 
        VALUES (?, ?, ?, ?, ?)
    `).bind(txId, solicitorId, donorName, amount, comment).run();
}
