import { useState } from "react";
import "./IndicVirtualKeyboard.css";

const VOWELS = ["अ","आ","इ","ई","उ","ऊ","ऋ","ए","ऐ","ओ","औ","अं","अः"];
const CONSONANTS = ["क","ख","ग","घ","ङ","च","छ","ज","झ","ञ","ट","ठ","ड","ढ","ण","त","थ","द","ध","न","प","फ","ब","भ","म","य","र","ल","व","श","ष","स","ह","क्ष","त्र","ज्ञ"];
const MARKS = ["ा","ि","ी","ु","ू","ृ","े","ै","ो","ौ","ं","ँ","ः","्","़","।","?",",","!","\n"];
const SPECIAL = { hi: ["ड़","ढ़","क़","ख़","ग़","ज़","फ़","ॐ"], mr: ["ळ","ऱ","ॲ","ऑ","ॅ","ॉ","ॐ"] };
const DICTIONARY = {
  hi: { mujhe:"मुझे", aaj:"आज", achha:"अच्छा", accha:"अच्छा", hai:"है", hain:"हैं", raha:"रहा", rahi:"रही", hoon:"हूँ", hun:"हूँ", main:"मैं", mein:"में", bahut:"बहुत", khush:"खुश", dukh:"दुख", laga:"लगा", lag:"लग", raha:"रहा", kya:"क्या", nahi:"नहीं", nahin:"नहीं", mera:"मेरा", meri:"मेरी", mujko:"मुझको", kal:"कल", se:"से", aur:"और", ke:"के", ki:"की", ko:"को", ka:"का", par:"पर", ye:"ये", yeh:"यह", tha:"था", thi:"थी", mujhe:"मुझे", dil:"दिल", man:"मन" },
  mr: { mala:"मला", aaj:"आज", khup:"खूप", khoop:"खूप", anand:"आनंद", zala:"झाला", jhala:"झाला", aahe:"आहे", ahe:"आहे", mi:"मी", majha:"माझा", majhi:"माझी", maza:"माझा", nahi:"नाही", naahi:"नाही", vatat:"वाटत", watat:"वाटत", hota:"होता", hoti:"होती", ani:"आणि", pan:"पण", khush:"खुश", dukhi:"दुःखी", kasa:"कसा", kashi:"कशी", kay:"काय", tu:"तू", tumhi:"तुम्ही", majhe:"माझे", ekta:"एकटं", ektaat:"एकट्यात", changla:"चांगला", changle:"चांगले", divas:"दिवस", man:"मन", aajcha:"आजचा" }
};
const VOWEL_RULES = [["aa","आ","ा"],["ai","ऐ","ै"],["au","औ","ौ"],["ee","ई","ी"],["ii","ई","ी"],["oo","ऊ","ू"],["uu","ऊ","ू"],["ri","ऋ","ृ"],["a","अ", ""],["i","इ","ि"],["u","उ","ु"],["e","ए","े"],["o","ओ","ो"]];
const CONSONANT_RULES = [["ksh","क्ष"],["chh","छ"],["gy","ज्ञ"],["jn","ज्ञ"],["kh","ख"],["gh","घ"],["ch","च"],["jh","झ"],["th","थ"],["dh","ध"],["ph","फ"],["bh","भ"],["sh","श"],["zh","झ"],["ng","ङ"],["ny","ञ"],["tt","ट"],["dd","ड"],["k","क"],["g","ग"],["c","क"],["j","ज"],["t","त"],["d","द"],["n","न"],["p","प"],["f","फ"],["b","ब"],["m","म"],["y","य"],["r","र"],["l","ल"],["v","व"],["w","व"],["s","स"],["h","ह"],["q","क"],["z","ज"],["x","क्स"]];

// Offline, approximate phonetic conversion. Common conversational words use language-specific spellings.
export function transliterateIndic(text, language) {
  if (!text || !["hi","mr"].includes(language)) return text;
  return text.replace(/[a-zA-Z]+/g, (word) => {
    const lower = word.toLowerCase();
    if (DICTIONARY[language][lower]) return DICTIONARY[language][lower];
    let result = "", i = 0;
    while (i < lower.length) {
      const vowel = VOWEL_RULES.find(([latin]) => lower.startsWith(latin, i));
      if (vowel) { result += vowel[1]; i += vowel[0].length; continue; }
      const consonant = CONSONANT_RULES.find(([latin]) => lower.startsWith(latin, i));
      if (!consonant) { result += lower[i++]; continue; }
      i += consonant[0].length;
      const nextVowel = VOWEL_RULES.find(([latin]) => lower.startsWith(latin, i));
      result += consonant[1];
      if (nextVowel) { result += nextVowel[2]; i += nextVowel[0].length; }
      else if (i < lower.length && CONSONANT_RULES.some(([latin]) => lower.startsWith(latin, i))) result += "्";
    }
    return result;
  });
}

export default function IndicVirtualKeyboard({ language, disabled = false, onInsert, onBackspace }) {
  const [mode, setMode] = useState("keys");
  const [phonetic, setPhonetic] = useState("");
  const [section, setSection] = useState("consonants");
  const letters = section === "vowels" ? VOWELS : section === "marks" ? MARKS : section === "special" ? SPECIAL[language] : CONSONANTS;
  const converted = transliterateIndic(phonetic, language);
  return (
    <section className="indic-keyboard" aria-label={`${language === "mr" ? "Marathi" : "Hindi"} virtual keyboard`}>
      <div className="indic-keyboard-header">
        <strong>{language === "mr" ? "मराठी" : "हिन्दी"} Keyboard</strong>
        <div className="indic-keyboard-modes" role="group" aria-label="Keyboard mode">
          <button type="button" className={mode === "keys" ? "is-active" : ""} onClick={() => setMode("keys")}>अक्षरे</button>
          <button type="button" className={mode === "phonetic" ? "is-active" : ""} onClick={() => setMode("phonetic")}>ABC → अ</button>
        </div>
      </div>
      {mode === "keys" ? <>
        <div className="indic-keyboard-sections" role="group" aria-label="Character categories">
          {[["consonants","Consonants"],["vowels","Vowels"],["marks","Matras"],["special","Special"]].map(([id,label]) => <button key={id} type="button" className={section === id ? "is-active" : ""} onClick={() => setSection(id)}>{label}</button>)}
        </div>
        <div className="indic-keyboard-grid">{letters.map((letter, index) => <button key={`${letter}-${index}`} type="button" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(letter)} aria-label={letter === "\n" ? "New line" : letter}>{letter === "\n" ? "↵" : letter}</button>)}</div>
        <div className="indic-keyboard-actions"><button type="button" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(" ")}>Space</button><button type="button" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onBackspace}>⌫ Backspace</button></div>
      </> : <div className="indic-keyboard-phonetic">
        <label htmlFor="indic-phonetic-input">Type using English letters</label>
        <textarea id="indic-phonetic-input" rows={2} value={phonetic} disabled={disabled} onChange={(e) => setPhonetic(e.target.value)} placeholder={language === "mr" ? "mala aaj khup anand zala" : "mujhe aaj achha lag raha hai"} />
        <div className="indic-keyboard-preview" lang={language}>{converted || "Devanagari preview will appear here"}</div>
        <div className="indic-keyboard-actions"><button type="button" disabled={disabled || !phonetic.trim()} onClick={() => { onInsert(converted); setPhonetic(""); }}>Insert into diary</button><button type="button" disabled={disabled || !phonetic} onClick={() => setPhonetic("")}>Clear</button></div>
        <p className="indic-keyboard-hint">Offline phonetic conversion is approximate. Check spellings before saving, especially names and less common words.</p>
      </div>}
    </section>
  );
}
