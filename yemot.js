// yemot.js

// 1. שמיעת מצב הקמפיין (דוגמה)
export async function handleYemotStatus(request, env) {
    try {
        // מחזיר הודעת טקסט להקראה, ללא ניתוב לשלוחה אחרת
        const yemotResponseString = `id_list_message=t-המערכת_בבניה_ותעודכן_בקרוב`; 
        return new Response(yemotResponseString, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (error) {
        return new Response(`id_list_message=t-שגיאת_מערכת`, { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    }
}

// 2. קבלת נתוני תרומה וסליקה
export async function handleYemotDonate(request, env) {
    try {
        const url = new URL(request.url);
        
        // פרמטרים שאנחנו אוספים מהבקשה של ימות המשיח
        const phone = url.searchParams.get('ApiPhone') || '';
        const solicitorId = url.searchParams.get('id'); 
        const amountRaw = url.searchParams.get('amount'); 
        const ccCode = url.searchParams.get('CreditCard_CODE');

        // שלב 3: חזרה מהסליקה של חברת האשראי
        if (ccCode !== null) {
            if (ccCode === '0' || ccCode === '000') {
                return new Response("id_list_message=t-תרומתך_התקבלה_בהצלחה_תזכו_למצוות", {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            } else {
                return new Response(`id_list_message=t-שגיאה_בביצוע_התשלום_קוד_שגיאה_${ccCode}`, {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        }

        // שלב 1: בקשת מזהה מתרים (אם לא התקבל)
        if (!solicitorId) {
            // הקראת הטקסט המבוקש והמתנה להקשה
            return new Response("read=t-אנא_הקישו_קוד_מתרים_וסולמית=id,10,1,7,3", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // שלב 2: בקשת סכום (אם לא התקבל)
        if (!amountRaw) {
            // הקראת הטקסט המבוקש והמתנה להקשה
            return new Response("read=t-אנא_הקישו_את_הסכום_לתרומה_וסולמית_לאגורות_הקישו_כוכבית=amount,10,1,7,3", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // שלב 4: יש את כל הנתונים - מוציאים לסליקה
        // המרת הכוכבית לנקודה עשרונית
        const billingSum = amountRaw.replace('*', '.');
        const terminalNum = '7016822';
        const maxTashlumim = '12';
        const currency = '1';

        // הפקודה לביצוע חיוב אשראי - בדיוק בפורמט שביקשת
        const ccString = `credit_card=nedarim_plus,${billingSum},${terminalNum},${maxTashlumim},${currency},,,,all,,NameStt,NoAsk,,GoBack`;

        return new Response(ccString, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    } catch (error) {
        return new Response("id_list_message=t-שגיאת_מערכת_בשרת", { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    }
}
