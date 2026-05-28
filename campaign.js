import { getCampaignSettings, getTotalDonations, getSolicitors } from './db.js';

export async function handleCampaignRequest(env) {
    try {
        const settings = await getCampaignSettings(env);
        const totalRaised = await getTotalDonations(env);
        const solicitors = await getSolicitors(env);
        
        const target = parseFloat(settings.campaign_target || 0);
        const percentage = target > 0 ? ((totalRaised / target) * 100).toFixed(2) : 0;

        const responseData = {
            status: 'success',
            data: {
                mosad_id: settings.mosad_id,
                groupe: settings.groupe_name
                target: target,
                total_raised: totalRaised,
                percentage: parseFloat(percentage),
                end_date: settings.end_date,
                solicitors: solicitors
            }
        };

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // חובה כדי שהאתר יוכל למשוך את הנתונים
            }
        });

    } catch (error) {
        throw new Error(`שגיאה בבניית נתוני הקמפיין: ${error.message}`);
    }
}
