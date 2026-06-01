// yemot.js

// 1. שמיעת מצב הקמפיין
export async function handleYemotStatus(request, env) {
    return new Response("id_list_message=t-המערכת בבניה ותעודכן בקרוב&", {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

// 2. קבלת נתוני תרומה וסליקה בשיטת שחזור State (כמו בפרויקט שלך)
export async function handleYemotDonate(request, env) {
    const url = new URL(request.url);
    const params = url.searchParams;

    // --- 1. בדיקה אם חזרנו מסליקה ---
    const ccCode = params.get('CreditCard_CODE');
    if (ccCode !== null) {
        if (ccCode === '0' || ccCode === '000') {
            return new Response("id_list_message=t-תרומתך התקבלה בהצלחה תזכו למצוות&", {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        } else {
            return new Response(`id_list_message=t-שגיאה בביצוע התשלום קוד שגיאה ${ccCode}&`, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
    }

    // --- 2. חישוב המצב הנוכחי (Replay) ---
    const state = calculateState(params);
    const nextVar = `val_${state.nextIndex}`;
    
    let responseText = '';

    // --- 3. יציאה לתשלום ---
    if (state.stage === 'CHECKOUT') {
        const billingSum = state.amount.replace('*', '.');
        const terminalNum = '7016822';
        
        responseText = `credit_card=nedarim_plus,${billingSum},${terminalNum},12,1,,,,all,,NameStt,NoAsk,,GoBack&`;
        
        return new Response(responseText, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    // --- 4. יצירת התשובה לימות המשיח לפי השלב ---
    if (state.stage === 'GET_ID') {
        responseText = `read=t-אנא הקישו קוד מתרים וסולמית=${nextVar},,`;
    } 
    else if (state.stage === 'GET_AMOUNT') {
        responseText = `read=t-אנא הקישו את הסכום לתרומה וסולמית לאגורות הקישו כוכבית=${nextVar},,`;
    }

    return new Response(responseText, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

// --- פונקציות עזר ---

function calculateState(params) {
    let state = {
        solicitorId: params.get('id') || null, // אם מגיע 'id' קבוע מהגדרות השלוחה הוא ייכנס לפה
        amount: null,
        stage: 'GET_ID',
        nextIndex: 1
    };

    // אם הוגדר ID קבוע, נדלג ישר לשלב בקשת הסכום
    if (state.solicitorId) {
        state.stage = 'GET_AMOUNT';
    }

    let i = 1;
    while (true) {
        const valName = `val_${i}`;
        const input = params.get(valName);

        // אם אין יותר הקשות, עוצרים את הלולאה
        if (input === null || input === undefined) {
            state.nextIndex = i;
            break;
        }

        // שחזור השלבים לפי ההקשות שכבר נאספו
        if (state.stage === 'GET_ID') {
            state.solicitorId = input;
            state.stage = 'GET_AMOUNT';
        } 
        else if (state.stage === 'GET_AMOUNT') {
            state.amount = input;
            state.stage = 'CHECKOUT';
        }
        
        i++;
    }
    
    return state;
}
