import { getCampaignSettings, getTotalDonations, getSolicitors } from './db.js';

// 1. קריאה לקבלת מידע הקמפיין בלבד
export async function handleCampaignInfo(env) {
    try {
        const settings = await getCampaignSettings(env);
        const totalRaised = await getTotalDonations(env);
        
        const target = parseFloat(settings.campaign_target || 0);
        const percentage = target > 0 ? ((totalRaised / target) * 100).toFixed(2) : 0;

        return new Response(JSON.stringify({
            status: 'success',
            data: {
                campaign_name: settings.campaign_name || '',
                target: target,
                total_raised: totalRaised,
                percentage: parseFloat(percentage),
                end_date: settings.end_date || ''
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת נתוני הקמפיין: ${error.message}`);
    }
}

// 2. קריאה לקבלת כל המתרימים והמצב שלהם
export async function handleSolicitorsList(env) {
    try {
        const solicitors = await getSolicitors(env);
        return new Response(JSON.stringify({
            status: 'success',
            data: solicitors
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת מתרימים: ${error.message}`);
    }
}

// 3. קריאה לקבלת נתוני אימות והגדרות תרומה (עבור האייפרם/הסליקה)
export async function handleDonationInfo(env) {
    try {
        const settings = await getCampaignSettings(env);
        
        return new Response(JSON.stringify({
            status: 'success',
            data: {
                mosad_id: settings.mosad_id || '',
                api_valid: settings.api_valid || '',
                groupe: settings.groupe_name || '',
                category: settings.category || '' // אפשרות להוסיף קטגוריה אם מוגדר
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת נתוני תרומה: ${error.message}`);
    }
}
