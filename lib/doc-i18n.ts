import type { Locale, MenuItem } from "./types";

// Wording for documents the client receives, in the client's language. Kept apart from the app's own
// translations, because a Gujarati quotation is often made by someone using the app in English.

const en = {
  quotation: "Quotation", menu: "Menu card", confirmation: "Booking confirmation", taxInvoice: "Tax invoice", proforma: "Proforma invoice", creditNote: "Credit note", creditRefund: "Credit note and refund receipt",
  preparedFor: "Prepared for", billedTo: "Billed to", issuedTo: "Issued to", clientName: "Client name", event: "Event", date: "Date", validUntil: "Valid until", order: "Order",
  perPlate: "per plate", guests: "guests", package: "package", description: "Description", qty: "Qty", rate: "Rate", amount: "Amount", food: "food", liveCounters: "live counters",
  subtotal: "Subtotal", discount: "Discount", lessDiscount: "Less discount", gst: "GST", included: "included above", grandTotal: "Grand total", invoiceTotal: "Invoice total",
  received: "Received", receivedToDate: "Received to date", balanceDue: "Balance due", balancePayable: "Balance payable", terms: "Terms", menuTbd: "Menu to be finalised.",
  taxableValue: "Taxable value", pricesIncludeGst: "prices include GST", amountInWords: "Amount in words", proformaNote: "This is a proforma for payment and is not a tax invoice.",
  reason: "Reason", amountCredited: "Amount credited", refunded: "Refunded", adjusted: "Adjusted against the bill", against: "Against order",
  scanToPay: "Scan to pay", bank: "Bank", upi: "UPI", for: "For", signatory: "Authorised signatory", sac: "SAC",
  morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night", to: "to", referralCredit: "Referral credit",
};
type Key = keyof typeof en;

const hi: Record<Key, string> = {
  quotation: "कोटेशन", menu: "मेनू कार्ड", confirmation: "बुकिंग पुष्टि", taxInvoice: "टैक्स इनवॉइस", proforma: "प्रोफ़ॉर्मा इनवॉइस", creditNote: "क्रेडिट नोट", creditRefund: "क्रेडिट नोट और रिफ़ंड रसीद",
  preparedFor: "के लिए तैयार", billedTo: "बिल प्राप्तकर्ता", issuedTo: "जारी किया गया", clientName: "ग्राहक का नाम", event: "कार्यक्रम", date: "तारीख", validUntil: "मान्य तिथि तक", order: "ऑर्डर",
  perPlate: "प्रति प्लेट", guests: "मेहमान", package: "पैकेज", description: "विवरण", qty: "मात्रा", rate: "दर", amount: "राशि", food: "भोजन", liveCounters: "लाइव काउंटर",
  subtotal: "उप-योग", discount: "छूट", lessDiscount: "घटाएँ छूट", gst: "जीएसटी", included: "ऊपर शामिल", grandTotal: "कुल राशि", invoiceTotal: "इनवॉइस कुल",
  received: "प्राप्त", receivedToDate: "अब तक प्राप्त", balanceDue: "बकाया राशि", balancePayable: "देय शेष", terms: "शर्तें", menuTbd: "मेनू तय होना बाकी है।",
  taxableValue: "कर योग्य मूल्य", pricesIncludeGst: "कीमतों में जीएसटी शामिल", amountInWords: "राशि शब्दों में", proformaNote: "यह भुगतान हेतु प्रोफ़ॉर्मा है, टैक्स इनवॉइस नहीं।",
  reason: "कारण", amountCredited: "क्रेडिट राशि", refunded: "वापस किया", adjusted: "बिल में समायोजित", against: "ऑर्डर के विरुद्ध",
  scanToPay: "भुगतान के लिए स्कैन करें", bank: "बैंक", upi: "यूपीआई", for: "की ओर से", signatory: "अधिकृत हस्ताक्षरकर्ता", sac: "SAC",
  morning: "सुबह", afternoon: "दोपहर", evening: "शाम", night: "रात", to: "से", referralCredit: "रेफ़रल क्रेडिट",
};

const gu: Record<Key, string> = {
  quotation: "ક્વોટેશન", menu: "મેનુ કાર્ડ", confirmation: "બુકિંગ પુષ્ટિ", taxInvoice: "ટેક્સ ઇન્વૉઇસ", proforma: "પ્રોફોર્મા ઇન્વૉઇસ", creditNote: "ક્રેડિટ નોટ", creditRefund: "ક્રેડિટ નોટ અને રિફંડ રસીદ",
  preparedFor: "માટે તૈયાર", billedTo: "બિલ મેળવનાર", issuedTo: "જારી કરેલ", clientName: "ગ્રાહકનું નામ", event: "પ્રસંગ", date: "તારીખ", validUntil: "માન્ય તારીખ સુધી", order: "ઓર્ડર",
  perPlate: "પ્રતિ પ્લેટ", guests: "મહેમાન", package: "પેકેજ", description: "વિગત", qty: "જથ્થો", rate: "દર", amount: "રકમ", food: "ભોજન", liveCounters: "લાઇવ કાઉન્ટર",
  subtotal: "પેટા સરવાળો", discount: "વળતર", lessDiscount: "બાદ વળતર", gst: "જીએસટી", included: "ઉપર સમાવિષ્ટ", grandTotal: "કુલ રકમ", invoiceTotal: "ઇન્વૉઇસ કુલ",
  received: "મળેલ", receivedToDate: "અત્યાર સુધી મળેલ", balanceDue: "બાકી રકમ", balancePayable: "ચૂકવવાની બાકી રકમ", terms: "શરતો", menuTbd: "મેનુ નક્કી કરવાનું બાકી છે.",
  taxableValue: "કરપાત્ર મૂલ્ય", pricesIncludeGst: "ભાવમાં જીએસટી સમાવિષ્ટ", amountInWords: "રકમ શબ્દોમાં", proformaNote: "આ ચુકવણી માટેનું પ્રોફોર્મા છે, ટેક્સ ઇન્વૉઇસ નથી.",
  reason: "કારણ", amountCredited: "ક્રેડિટ રકમ", refunded: "પરત કરેલ", adjusted: "બિલમાં સરભર", against: "ઓર્ડર સામે",
  scanToPay: "ચુકવણી માટે સ્કેન કરો", bank: "બેંક", upi: "યુપીઆઈ", for: "વતી", signatory: "અધિકૃત સહી કરનાર", sac: "SAC",
  morning: "સવાર", afternoon: "બપોર", evening: "સાંજ", night: "રાત", to: "થી", referralCredit: "રેફરલ ક્રેડિટ",
};

const dictionaries: Record<Locale, Record<Key, string>> = { en, hi, gu };

export type DocT = (key: Key) => string;
export const docT = (lang: Locale = "en"): DocT => (key) => dictionaries[lang]?.[key] ?? en[key];

export const docLanguages: { id: Locale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "gu", label: "ગુજરાતી" },
];

const script: Record<Locale, RegExp | null> = { en: null, hi: /[ऀ-ॿ]/, gu: /[઀-૿]/ };

/** A dish's name for a document: the local name when it is written in the document's script, otherwise English. */
export function dishName(item: Pick<MenuItem, "name" | "nameLocal">, lang: Locale = "en") {
  const re = script[lang];
  return re && item.nameLocal && re.test(item.nameLocal) ? item.nameLocal : item.name;
}
