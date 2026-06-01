import { Router } from 'itty-router';

// יצירת נתב נפרד עבור ימות המשיח
const yemotRouter = Router({ base: '/yemot' }); // תוכל לשנות את נתיב הבסיס אם תרצה

// --------------------------------------------------------
// נתב לשמיעת מצב הקמפיין
// --------------------------------------------------------
yemotRouter.get('/status', async (request, env) => {
    try {
        // כאן תוכל לבצע שליפה של נתוני הקמפיין ממסד הנתונים (D1)
        // לדוגמה:
        // const totalQuery = await env.DB.prepare("SELECT SUM(amount) as total FROM donations").first('total');
        // const total = totalQuery || 0;
        
        // כאן אתה מכניס את תחביר ימות המשיח המדויק שלך, כולל שילוב המשתנים ששלפת
        const yemotResponseString = ``; 
        
        return new Response(yemotResponseString, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (error) {
        // תשובת שגיאה בתחביר ימות המשיח במידה ומשהו קורס
        const errorString = ``;
        
        return new Response(errorString, { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    }
});

// --------------------------------------------------------
// נתב לביצוע תרומה
// --------------------------------------------------------
yemotRouter.get('/donate', async (request, env) => {
    try {
        // איסוף פרמטרים שימות המשיח שולח דרך ה-URL
        const url = new URL(request.url);
        
        const phone = url.searchParams.get('ApiPhone') || '';
        const amount = url.searchParams.get('amount') || '';
        const creditCard = url.searchParams.get('cc') || ''; 
        const exp = url.searchParams.get('exp') || '';
        const cvv = url.searchParams.get('cvv') || '';
        
        // כאן תבוא הלוגיקה שלך לביצוע הסליקה בפועל (למשל מול נדרים פלוס)
        // ושמירת נתוני התרומה למסד הנתונים במידה והצליח
        
        // כאן אתה מכניס את תחביר ימות המשיח המדויק שלך להודעת הצלחה / מעבר שלוחה
        const successString = ``;
        
        return new Response(successString, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (error) {
        const errorString = ``;
        
        return new Response(errorString, { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    }
});

// טיפול בנתיבים לא קיימים תחת הראוטר הזה
yemotRouter.all('*', () => new Response('Not Found', { status: 404 }));

export default yemotRouter;
