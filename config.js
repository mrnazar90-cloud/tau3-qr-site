// Конфигурация
// 1) Google Apps Script Web App URL-ін осында қойыңыз (Deploy -> Web app URL)
// Мысал: const SUBMIT_URL = "https://script.google.com/macros/s/....../exec";
const SUBMIT_URL = "https://script.google.com/macros/s/AKfycbzxGFtD5WonkTBV7P6R9GsJ4x9YLKfq-OKKR1kO6IXRraB22TawD8rPfEbV3TWIvzBr/exec";

// 2) (Қаласаңыз) байланыс үшін мұғалімнің email/telegram
const TEACHER_CONTACT = "Мұғалімге байланыс: ...";

// 3) Дедлайн (уақыттан кейін сайт "жабық" болады)
// ISO форматта таймзонамен бірге берген дұрыс:
// Мысалы Қазақстан үшін: "2026-03-20T23:59:00+05:00"
const DEADLINE_ISO = ""; // бос қалса — дедлайн жоқ

// 4) Сабақ ішіндегі таймер (минут). Тапсырманы алған сәттен бастап есептеледі.
const SESSION_MINUTES = 25;
