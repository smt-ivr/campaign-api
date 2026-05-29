import { getCampaignSettings, getTotalDonations, getSolicitors } from './db.js';

// פונקציית עזר למשיכת שער יציג רשמי מבנק ישראל
async function getOfficialBoiRate() {
    let usdRate = 2.81; // גיבוי למקרה שהשרת של בנק ישראל למטה
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

// 1. קריאה לקבלת מידע הקמפיין (עם פירוט מטבעות)
export async function handleCampaignInfo(env) {
    try {
        const settings = await getCampaignSettings(env);
        
        // מביא אובייקט עם שקלים ודולרים בנפרד ממסד הנתונים
        const totals = await getTotalDonations(env); 
        
        // משיכת השער היציג מבנק ישראל
        const usdRate = await getOfficialBoiRate();
        
        // חישוב הסכום הכללי המשוקלל (שקלים + דולרים מומרים לפי השער היציג)
        const combinedTotalRaised = totals.total_ils + (totals.total_usd * usdRate);
        
        const target = parseFloat(settings.campaign_target || 0);
        const percentage = target > 0 ? ((combinedTotalRaised / target) * 100).toFixed(2) : 0;

        return new Response(JSON.stringify({
            status: 'success',
            data: {
                campaign_name: settings.campaign_name || '',
                target: target,
                total_raised: combinedTotalRaised, // שווי משוקלל בשקלים (למד ההתקדמות הראשי)
                total_ils: totals.total_ils,       // כמה נתרם נטו בשקלים
                total_usd: totals.total_usd,       // כמה נתרם נטו בדולרים
                usd_to_ils_rate: usdRate,          // שער הדולר היציג ששימש לחישוב
                percentage: parseFloat(percentage),
                end_date: settings.end_date || ''
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת נתוני הקמפיין: ${error.message}`);
    }
}

// 2. קריאה לקבלת כל המתרימים (משוקלל כולל דולרים)
export async function handleSolicitorsList(env) {
    try {
        const solicitorsRaw = await getSolicitors(env);
        
        // נמשוך את השער היציג כדי להמיר את הדולרים של כל מתרים
        const usdRate = await getOfficialBoiRate();

        // נשקלל את הסכום הסופי לכל מתרים כדי שהפרונטאנד ימשיך לעבוד רגיל
        const solicitors = solicitorsRaw.map(sol => {
            const combinedRaised = sol.raised_ils + (sol.raised_usd * usdRate);
            return {
                id: sol.id,
                name: sol.name,
                target_amount: sol.target_amount,
                raised_ils: sol.raised_ils, // שקלים בלבד למקרה שצריך
                raised_usd: sol.raised_usd, // דולרים בלבד למקרה שצריך
                raised: Math.round(combinedRaised) // הסכום הסופי המעוגל שיוצג בטבלה באתר
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

// 3. קריאה לקבלת נתוני אימות ותרומה
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
                category: settings.category || '',
                usd_to_ils_rate: usdRate 
            }
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
        throw new Error(`שגיאה בשליפת נתוני תרומה: ${error.message}`);
    }
}
