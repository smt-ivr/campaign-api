// yemot.js

export async function handleYemotStatus(request, env) {
    try {
        const yemotResponseString = `id_list_message=t-המערכת_בבניה&go_to_folder=/`; 
        return new Response(yemotResponseString, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (error) {
        return new Response(`id_list_message=t-שגיאה&go_to_folder=/`, { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    }
}

// 2. קבלת נתוני תרומה וסליקה
export async function handleYemotDonate(request, env) {
    try {
        const url = new URL(request.url);
        
        // פרמטרים בסיסיים
        const phone = url.searchParams.get('ApiPhone') || '';
        
        // פרמטרים שאנחנו אוספים בתהליך
        const solicitorId = url.searchParams.get('id'); // מזהה מתרים
        const amountRaw = url.searchParams.get('amount'); // סכום
        
        // קוד תשובה מחברת האשראי (מגיע רק אחרי ביצוע הסליקה)
        const ccCode = url.searchParams.get('CreditCard_CODE');

        // שלב 3: בדיקה אם אנחנו אחרי חזרה מסליקה
        if (ccCode !== null) {
            // בימות המשיח, 0 לרוב מסמל הצלחה. אפשר להוסיף לוגיקה לשמירה ב-DB כאן.
            if (ccCode === '0' || ccCode === '000') {
                return new Response("id_list_message=t-תרומתך_התקבלה_בהצלחה&go_to_folder=/", {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            } else {
                return new Response(`id_list_message=t-שגיאה_בביצוע_התשלום_קוד_שגיאה_${ccCode}&go_to_folder=/`, {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        }

        // שלב 1: אם אין מזהה מתרים - נבקש אותו
        if (!solicitorId) {
            // read=t-[var_name]=[file_to_play],MaxDigits,MinDigits,WaitSeconds,Retries
            // השמעת קובץ enter_id (נא להקיש מספר מתרים)
            return new Response("read=t-id=enter_id,10,1,7,3", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // שלב 2: אם אין סכום - נבקש אותו
        if (!amountRaw) {
            // השמעת קובץ enter_amount (נא להקיש סכום לתרומה, לאגורות הקישו כוכבית)
            return new Response("read=t-amount=enter_amount,10,1,7,3", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // שלב 4: יש לנו את כל הנתונים, מוציאים לסליקה בנדרים פלוס
        // המרת כוכבית מימות המשיח לנקודה עשרונית עבור נדרים פלוס (למשל: 55*6 הופך ל 55.6)
        const billingSum = amountRaw.replace('*', '.');
        const terminalNum = '7016822';
        const maxTashlumim = '12'; // מקסימום תשלומים
        const currency = '1'; // 1 = שקלים

        // המחרוזת המדויקת שביקשת
        const ccString = `credit_card=nedarim_plus,${billingSum},${terminalNum},${maxTashlumim},${currency},,,,all,,NameStt,NoAsk,,GoBack`;

        return new Response(ccString, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });

    } catch (error) {
        return new Response("id_list_message=t-שגיאת_מערכת&go_to_folder=/", { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    }
}
