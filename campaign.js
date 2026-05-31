import { getCampaignSettings, getTotalDonations, getSolicitors } from './db.js';

async function getOfficialBoiRate() {
    let usdRate = 2.81; 
    try {
        const res = await fetch('https://boi.org.il/PublicApi/GetExchangeRates');
        if (res.ok) {
            const data = await res.json();
            const usdData = data.exchangeRates.find(rate => rate.key === 'USD');
            if (usdData && usdData.currentExchangeRate) {
                usdRate = usdData.currentExchangeRate;
            }
        }
    } catch (e) {
        console.error("שגיאה במשיכת שער יציג מבנק ישראל", e);
    }
    return usdRate;
}

export async function handleCampaignInfo(env) {
    try {
        const settings = await getCampaignSettings(env);
        const totals = await getTotalDonations(env); 
        const usdRate = await getOfficialBoiRate();
        
        const combinedTotalRaised = totals.total_ils + (totals.total_usd * usdRate);
        const target = parseFloat(settings.campaign_target || 0);
        
        // אחוזים מדויקים ללא עיגול גס
        const percentage = target > 0 ? ((combinedTotalRaised / target) * 100).toFixed(2) : 0;

        return new Response(JSON.stringify({
            status: 'success',
            data: {
                campaign_name: settings.campaign_name || '',
                target: target,
                total_raised: combinedTotalRaised, 
                total_ils: totals.total_ils,       
                total_usd: totals.total_usd,       
                usd_to_ils_rate: usdRate,          
                percentage: parseFloat(percentage),
                end_date: settings.end_date || ''
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת נתוני הקמפיין: ${error.message}`);
    }
}

export async function handleSolicitorsList(env) {
    try {
        const solicitorsRaw = await getSolicitors(env);
        const usdRate = await getOfficialBoiRate();

        const solicitors = solicitorsRaw.map(sol => {
            const combinedRaised = sol.raised_ils + (sol.raised_usd * usdRate);
            
            // חישוב האחוז למתרים
            const percentage = sol.target_amount > 0 ? ((combinedRaised / sol.target_amount) * 100).toFixed(2) : 0;
            
            return {
                id: sol.id,
                name: sol.name,
                target_amount: sol.target_amount,
                raised_ils: sol.raised_ils, 
                raised_usd: sol.raised_usd, 
                raised: combinedRaised, // בוטל העיגול! נשמר דיוק מלא
                percentage: parseFloat(percentage) // שליחת האחוז ללקוח
            };
        });

        return new Response(JSON.stringify({
            status: 'success',
            data: solicitors
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת מתרימים: ${error.message}`);
    }
}

export async function handleDonationInfo(env) {
    try {
        const settings = await getCampaignSettings(env);
        const usdRate = await getOfficialBoiRate();
        
        return new Response(JSON.stringify({
            status: 'success',
            data: {
                mosad_id: settings.mosad_id || '',
                api_valid: settings.api_valid || '',
                groupe: settings.groupe_name || '',
                CallBackMailError: settings.CallBackMailError || '',
                usd_to_ils_rate: usdRate 
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת נתוני תרומה: ${error.message}`);
    }
}
