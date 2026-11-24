// Every UN member state plus commonly served territories.
// Format: ISO-3166 alpha-2 | name | payout currency | region
// Where remittances are normally paid out in USD (dollarized or USD-preferred
// economies), the payout currency is USD.

export type Region = "Africa" | "Asia" | "Europe" | "Latin America & Caribbean" | "Middle East" | "North America" | "Oceania";
export type Country = { iso: string; name: string; currency: string; region: Region; flag: string };

const RAW: Record<Region, string> = {
  Africa: `DZ|Algeria|DZD AO|Angola|AOA BJ|Benin|XOF BW|Botswana|BWP BF|Burkina Faso|XOF BI|Burundi|BIF
CV|Cabo Verde|CVE CM|Cameroon|XAF CF|Central African Republic|XAF TD|Chad|XAF KM|Comoros|KMF CG|Congo|XAF
CD|DR Congo|CDF CI|Côte d'Ivoire|XOF DJ|Djibouti|DJF EG|Egypt|EGP GQ|Equatorial Guinea|XAF ER|Eritrea|ERN
SZ|Eswatini|SZL ET|Ethiopia|ETB GA|Gabon|XAF GM|Gambia|GMD GH|Ghana|GHS GN|Guinea|GNF GW|Guinea-Bissau|XOF
KE|Kenya|KES LS|Lesotho|LSL LR|Liberia|LRD LY|Libya|LYD MG|Madagascar|MGA MW|Malawi|MWK ML|Mali|XOF
MR|Mauritania|MRU MU|Mauritius|MUR MA|Morocco|MAD MZ|Mozambique|MZN NA|Namibia|NAD NE|Niger|XOF NG|Nigeria|NGN
RW|Rwanda|RWF ST|São Tomé and Príncipe|STN SN|Senegal|XOF SC|Seychelles|SCR SL|Sierra Leone|SLE SO|Somalia|USD
ZA|South Africa|ZAR SS|South Sudan|SSP SD|Sudan|SDG TZ|Tanzania|TZS TG|Togo|XOF TN|Tunisia|TND UG|Uganda|UGX
ZM|Zambia|ZMW ZW|Zimbabwe|USD`,
  "Middle East": `AE|United Arab Emirates|AED BH|Bahrain|BHD CY|Cyprus|EUR IR|Iran|IRR IQ|Iraq|IQD IL|Israel|ILS
JO|Jordan|JOD KW|Kuwait|KWD LB|Lebanon|USD OM|Oman|OMR PS|Palestine|ILS QA|Qatar|QAR SA|Saudi Arabia|SAR
SY|Syria|SYP TR|Türkiye|TRY YE|Yemen|YER`,
  Asia: `AF|Afghanistan|AFN AM|Armenia|AMD AZ|Azerbaijan|AZN BD|Bangladesh|BDT BT|Bhutan|BTN BN|Brunei|BND
KH|Cambodia|KHR CN|China|CNY GE|Georgia|GEL HK|Hong Kong|HKD IN|India|INR ID|Indonesia|IDR JP|Japan|JPY
KZ|Kazakhstan|KZT KP|North Korea|KPW KR|South Korea|KRW KG|Kyrgyzstan|KGS LA|Laos|LAK MO|Macau|MOP
MY|Malaysia|MYR MV|Maldives|MVR MN|Mongolia|MNT MM|Myanmar|MMK NP|Nepal|NPR PK|Pakistan|PKR PH|Philippines|PHP
SG|Singapore|SGD LK|Sri Lanka|LKR TW|Taiwan|TWD TJ|Tajikistan|TJS TH|Thailand|THB TL|Timor-Leste|USD
TM|Turkmenistan|TMT UZ|Uzbekistan|UZS VN|Vietnam|VND`,
  Europe: `AL|Albania|ALL AD|Andorra|EUR AT|Austria|EUR BY|Belarus|BYN BE|Belgium|EUR BA|Bosnia and Herzegovina|BAM
BG|Bulgaria|EUR HR|Croatia|EUR CZ|Czechia|CZK DK|Denmark|DKK EE|Estonia|EUR FI|Finland|EUR FR|France|EUR
DE|Germany|EUR GR|Greece|EUR HU|Hungary|HUF IS|Iceland|ISK IE|Ireland|EUR IT|Italy|EUR XK|Kosovo|EUR
LV|Latvia|EUR LI|Liechtenstein|CHF LT|Lithuania|EUR LU|Luxembourg|EUR MT|Malta|EUR MD|Moldova|MDL MC|Monaco|EUR
ME|Montenegro|EUR NL|Netherlands|EUR MK|North Macedonia|MKD NO|Norway|NOK PL|Poland|PLN PT|Portugal|EUR
RO|Romania|RON RU|Russia|RUB SM|San Marino|EUR RS|Serbia|RSD SK|Slovakia|EUR SI|Slovenia|EUR ES|Spain|EUR
SE|Sweden|SEK CH|Switzerland|CHF UA|Ukraine|UAH GB|United Kingdom|GBP VA|Vatican City|EUR`,
  "North America": `US|United States|USD CA|Canada|CAD`,
  "Latin America & Caribbean": `AG|Antigua and Barbuda|XCD AR|Argentina|ARS BS|Bahamas|BSD BB|Barbados|BBD BZ|Belize|BZD
BO|Bolivia|BOB BR|Brazil|BRL CL|Chile|CLP CO|Colombia|COP CR|Costa Rica|CRC CU|Cuba|CUP DM|Dominica|XCD
DO|Dominican Republic|DOP EC|Ecuador|USD SV|El Salvador|USD GD|Grenada|XCD GT|Guatemala|GTQ GY|Guyana|GYD
HT|Haiti|HTG HN|Honduras|HNL JM|Jamaica|JMD MX|Mexico|MXN NI|Nicaragua|NIO PA|Panama|USD PY|Paraguay|PYG
PE|Peru|PEN PR|Puerto Rico|USD KN|Saint Kitts and Nevis|XCD LC|Saint Lucia|XCD VC|Saint Vincent and the Grenadines|XCD
SR|Suriname|SRD TT|Trinidad and Tobago|TTD UY|Uruguay|UYU VE|Venezuela|VES`,
  Oceania: `AU|Australia|AUD FJ|Fiji|FJD KI|Kiribati|AUD MH|Marshall Islands|USD FM|Micronesia|USD NR|Nauru|AUD
NZ|New Zealand|NZD PW|Palau|USD PG|Papua New Guinea|PGK WS|Samoa|WST SB|Solomon Islands|SBD TO|Tonga|TOP
TV|Tuvalu|AUD VU|Vanuatu|VUV`,
};

const flag = (iso: string) => String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

export const COUNTRIES: Country[] = (Object.entries(RAW) as [Region, string][])
  .flatMap(([region, block]) =>
    block
      .split(/\s+(?=[A-Z]{2}\|)/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [iso, name, currency] = s.split("|");
        return { iso, name, currency, region, flag: flag(iso) };
      }),
  )
  .sort((a, b) => a.name.localeCompare(b.name));

export const byIso = new Map(COUNTRIES.map((c) => [c.iso, c]));

// Comprehensively sanctioned destinations — licensed remittance providers
// (and this demo) do not route money there.
export const SANCTIONED = new Set(["KP", "IR", "SY", "CU", "RU", "BY"]);

// High-risk or hard-to-serve corridors: digital-first apps generally don't
// cover them; large cash networks (Western Union, MoneyGram, Ria) usually do.
export const HARD_TO_SERVE = new Set(["AF", "SO", "YE", "LY", "SD", "SS", "ER", "MM", "VE", "LB", "CF", "TD", "KP"]);

// High-income economies: cash pickup / mobile money are rarely offered by
// digital-first apps here; money is normally sent to a bank account.
export const ADVANCED = new Set([
  "US", "CA", "GB", "IE", "FR", "DE", "NL", "BE", "LU", "AT", "CH", "LI", "IT", "ES", "PT", "GR", "CY", "MT",
  "DK", "SE", "NO", "FI", "IS", "EE", "LV", "LT", "SK", "SI", "CZ", "HR", "MC", "SM", "VA", "AD", "PL",
  "AU", "NZ", "JP", "KR", "SG", "HK", "MO", "TW", "IL", "AE", "QA", "KW", "BH", "SA", "BN", "PR",
]);

// Countries where mobile-money wallets (M-Pesa, MTN MoMo, Orange Money, Wave,
// GCash, bKash, JazzCash, eSewa, MoMo, Tigo Money, MonCash…) are a common payout.
export const MOBILE_MONEY = new Set([
  "KE", "UG", "TZ", "RW", "BI", "GH", "NG", "SN", "CI", "ML", "BF", "NE", "BJ", "TG", "GN", "GW", "CM", "GA",
  "CG", "CD", "ZM", "ZW", "MW", "MZ", "MG", "ET", "SL", "LR", "GM", "SO", "SS", "EG", "MA", "TD", "CF", "DJ",
  "PH", "BD", "PK", "NP", "LK", "VN", "ID", "MM", "KH", "LA", "MN", "TJ", "KG", "UZ",
  "HT", "GT", "HN", "SV", "BO", "PY", "CO", "NI", "JM", "DO", "PE", "FJ", "PG", "WS", "TO", "VU",
]);

// Countries where providers can push money straight to a recipient's debit card.
export const CARD_PAYOUT = new Set([
  "MX", "GT", "HN", "SV", "NI", "CO", "DO", "PE", "EC", "JM", "PH", "VN", "IN", "UA", "MD", "GE", "AM", "KZ", "UZ",
]);
