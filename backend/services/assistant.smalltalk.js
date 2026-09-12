'use strict';
/**
 * Small talk for Simran's rule mode: greetings, "kaise ho", thanks, ok/acha, bye, who-are-you.
 * Only used for short messages that carry no data question (hours, tasks, leave, score…).
 */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const DATA_WORDS = /task|leave|chutti|chhutti|score|rank|shift|hours|ghante|kaam hua|clock|punch|break|salary|pay|holiday|attendance|absent|present|late|overtime|notification|password|project|wfh|deadline|kaise|how|kahan|kya hai|kya hota/;

const RULES = [
  { re: /(kaise ho|kese ho|kaisi ho|kaise hain|kesi ho|how are you|how r u|kya haal|kya hal|sab theek|sab thik|whats up|what's up|wassup)/, a: n => pick([`Main ekdum badhiya, ${n}! 😊 Aap kaise ho? Aaj ke kaam mein kuch help chahiye?`, `Sab first class! Aap sunao ${n}, kya chal raha hai? Hours, tasks ya leaves, kuch bhi poocho.`, `Mast hoon, thank you! Aap batao ${n}, aaj kya plan hai?`]) },
  { re: /(good morning|subah|gud morning|gm\b)/, a: n => `Good morning ${n}! ☀️ Naya din, naye tasks. Clock in ho gaya? Kuch chahiye to batao.` },
  { re: /(good afternoon|good evening|shubh sandhya)/, a: n => `Good evening ${n}! Aaj ka din kaisa gaya? Hours ya tasks check karne hon to bolo.` },
  { re: /(good night|gn\b|so raha|sone ja|shubh ratri)/, a: n => `Good night ${n}! 🌙 Clock out kar liya na? Kal milte hain.` },
  { re: /(thank|thanks|thnx|thx|shukriya|dhanyavad|dhanyawad|thank u)/, a: n => pick([`Welcome ${n}! 😊 Aur kuch chahiye to main yahin hoon.`, `Koi baat nahi ${n}, isi liye to hoon! Kuch aur poochna ho to batao.`]) },
  { re: /^(ok|okay|okk|oky|k|acha|achha|accha|theek|thik|thik hai|theek hai|hmm+|haan|ha|han|yes|yup|nice|good|great|cool|badhiya|mast|wah|sahi|sahi hai|got it|samajh gaya|samjha|👍|🙏|❤️|😊)\W*$/, a: n => pick([`Great! 👍 Aur kuch poochna ho to batao.`, `Theek hai ${n}. Jab bhi kuch chahiye, bas likh dena.`, `Perfect! Main yahin hoon, kabhi bhi poocho.`]) },
  { re: /(bye|bbye|tata|alvida|chalo|chalta hu|chalti hu|see you|milte hain|later)/, a: n => pick([`Bye ${n}! 👋 Kaam achha rahe, kal milte hain.`, `Tata ${n}! Kuch bhi chahiye ho to wapas aa jaana.`]) },
  { re: /(tum kaun|tu kaun|aap kaun|who are you|who r u|tumhara naam|tera naam|apna naam|naam kya|what is your name|introduce)/, a: n => `Main Simran hoon, Lighthouse ki assistant 🏮 ${n}, main aapke hours, tasks, leaves, score aur app ke baare mein bata sakti hoon. Jo mujhe nahi pata wo admin ko WhatsApp kar deti hoon.` },
  { re: /(kisne banaya|who made you|who created|kaun banaya|banaya kisne|kahan se aayi)/, a: () => `Mujhe Limelight ki team ne Lighthouse app ke liye banaya hai, taaki sabko apne kaam ki info turant mil jaaye. 😊` },
  { re: /(kya kar rahi|kya kar rhi|what are you doing|busy ho|free ho)/, a: n => `Bas aapka wait kar rahi thi ${n}! 😄 Batao, kya poochna hai?` },
  { re: /(tum insaan|robot ho|bot ho|ai ho|real ho|human)/, a: () => `Main ek assistant bot hoon, insaan nahi 🤖 par kaam ki baatein poori imaandari se bataati hoon.` },
  { re: /(joke|hasao|hansao|funny|mazak|kuch sunao)/, a: () => pick([`Team leader: "Task kab tak?" Editor: "Bas render ho raha hai." 3 ghante baad… "render ho raha hai." 😄 Chalo, ab task pe wapas!`, `Deadline aur Monday mein kya common hai? Dono hamesha jaldi aa jaate hain. 😅`]) },
  { re: /(love you|pyaar|shaadi|marry|girlfriend|boyfriend|date pe)/, a: n => `Haha ${n}, main sirf kaam ki baatein karti hoon 😄 Tasks ya hours poocho, usme poori madad karungi.` },
  { re: /(sorry|maaf|galti)/, a: n => `Koi baat nahi ${n}, sab theek hai. Batao kya chahiye?` },
  { re: /(bore ho raha|bored|boring|mann nahi|thak gaya|thak gayi|tired)/, a: n => `Thoda break le lo ${n} ☕ Home pe "Take a break" dabao, 10 minute baad fresh hoke wapas. Break ka time hours se minus ho jaata hai, koi tension nahi.` },
  { re: /(time kya|kitne baje|date kya|aaj kya din|what time|what date)/, a: (n, ctx) => `Abhi ${ctx.now} baje hain, aaj ${ctx.today} hai.` },
  { re: /(weather|mausam|baarish)/, a: () => `Mausam ka mujhe pata nahi 🌦️ par office ke andar sab set hai. Kaam ki baat poocho!` }
];

function reply(text, ctx) {
  const t = String(text || '').toLowerCase().trim();
  if (!t || t.length > 60) return null;
  if (DATA_WORDS.test(t) && !/kaise ho|kese ho|kaisi ho/.test(t)) return null;
  for (const r of RULES) if (r.re.test(t)) return r.a(ctx.firstName, ctx);
  return null;
}

module.exports = { reply };
