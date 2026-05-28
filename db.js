// --- פונקציות קמפיין ותרומות (קיימות) ---

export async function getCampaignSettings(env) {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings = {};
    for (let row of results) { settings[row.key] = row.value; }
    return settings;
}

export async function getTotalDonations(env) {
    const result = await env.DB.prepare("SELECT SUM(amount) as total FROM donations").first();
    return result?.total || 0;
}

export async function getSolicitors(env) {
    const { results } = await env.DB.prepare(`
        SELECT s.id, s.name, s.target_amount, COALESCE(SUM(d.amount), 0) as raised
        FROM solicitors s LEFT JOIN donations d ON s.id = d.solicitor_id GROUP BY s.id
    `).all();
    return results;
}

export async function isTransactionExists(env, txId) {
    const result = await env.DB.prepare("SELECT id FROM donations WHERE nedarim_tx_id = ?").first();
    return result !== null;
}

export async function insertDonation(env, txId, solicitorId, donorName, amount, comment) {
    await env.DB.prepare(`
        INSERT INTO donations (nedarim_tx_id, solicitor_id, donor_name, amount, comment) 
        VALUES (?, ?, ?, ?, ?)
    `).bind(txId, solicitorId, donorName, amount, comment).run();
}

// --- פונקציות מתרימים חדשות (אזור אישי) ---

export async function checkSolicitorExists(env, email, phone) {
    // בודק אם מייל קיים, או אם טלפון קיים (רק אם הוזן טלפון)
    const query = "SELECT id FROM solicitors WHERE email = ? OR (phone = ? AND phone != '')";
    const result = await env.DB.prepare(query).bind(email, phone || '').first();
    return result !== null;
}

export async function getSolicitorById(env, id) {
    return await env.DB.prepare("SELECT * FROM solicitors WHERE id = ?").bind(id).first();
}

export async function createSolicitor(env, id, name, email, phone, password, targetAmount) {
    await env.DB.prepare(`
        INSERT INTO solicitors (id, name, email, phone, password, target_amount)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, name, email, phone || null, password, targetAmount).run();
}

export async function getSolicitorDonations(env, solicitorId) {
    const { results } = await env.DB.prepare(`
        SELECT donor_name, amount, comment, created_at 
        FROM donations WHERE solicitor_id = ? ORDER BY created_at DESC
    `).bind(solicitorId).all();
    return results;
}

export async function updateSolicitorTarget(env, id, newTarget) {
    await env.DB.prepare("UPDATE solicitors SET target_amount = ? WHERE id = ?").bind(newTarget, id).run();
}
