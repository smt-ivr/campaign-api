// שליפת הגדרות
export async function getCampaignSettings(env) {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings = {};
    for (let row of results) { settings[row.key] = row.value; }
    return settings;
}

export async function getTotalDonations(env) {
    const { results } = await env.DB.prepare("SELECT amount, currency FROM donations").all();
    let total_ils = 0;
    let total_usd = 0;
    
    if (results) {
        for (let row of results) {
            // קוד 2 של נדרים פלוס = דולר
            if (row.currency === '2' || row.currency === 'USD') {
                total_usd += row.amount;
            } else {
                total_ils += row.amount;
            }
        }
    }
    return { total_ils, total_usd };
}

// *** עודכן: חלוקת המטבעות לשקלים ולדולרים ישירות למתרימים ***
export async function getSolicitors(env) {
    const { results } = await env.DB.prepare(`
        SELECT 
            s.id, 
            s.name, 
            s.target_amount, 
            COALESCE(SUM(CASE WHEN d.currency = '2' OR d.currency = 'USD' THEN d.amount ELSE 0 END), 0) as raised_usd,
            COALESCE(SUM(CASE WHEN d.currency = '1' OR d.currency = 'ILS' OR d.currency IS NULL THEN d.amount ELSE 0 END), 0) as raised_ils
        FROM solicitors s 
        LEFT JOIN donations d ON s.id = d.solicitor_id 
        GROUP BY s.id
    `).all();
    return results;
}

export async function isTransactionExists(env, txId) {
    const result = await env.DB.prepare("SELECT id FROM donations WHERE nedarim_tx_id = ?").bind(txId).first();
    return result !== null;
}

export async function insertDonation(env, txId, solicitorId, donorName, amount, currency, comment, createdAt) {
    await env.DB.prepare(`
        INSERT INTO donations (nedarim_tx_id, solicitor_id, donor_name, amount, currency, comment, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(txId, solicitorId, donorName, amount, currency, comment, createdAt).run();
}

// --- פונקציות מתרימים ---

export async function checkSolicitorExists(env, email, phone) {
    const query = "SELECT id FROM solicitors WHERE email = ? OR (phone = ? AND phone != '')";
    const result = await env.DB.prepare(query).bind(email, phone || '').first();
    return result !== null;
}

export async function getSolicitorByLoginIdentifier(env, identifier) {
    const query = "SELECT * FROM solicitors WHERE id = ? OR email = ? OR phone = ?";
    return await env.DB.prepare(query).bind(identifier, identifier, identifier).first();
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
        SELECT donor_name, amount, comment, created_at, currency 
        FROM donations WHERE solicitor_id = ? ORDER BY created_at DESC
    `).bind(solicitorId).all();
    return results;
}

export async function updateSolicitorTarget(env, id, newTarget) {
    await env.DB.prepare("UPDATE solicitors SET target_amount = ? WHERE id = ?").bind(newTarget, id).run();
}
