# Chrome Web Store listing copy

Paste-ready values for the **Store listing** tab. Keep in sync with
`README.md` (the privacy policy) and `public/manifest.json`.

- **Category:** Shopping
- **Language:** Russian — Русский

---

## Description (RU — use this one)

Конвертер цен BYN показывает примерную цену в долларах или евро прямо под
ценой в белорусских рублях — на kufar.by и av.by. Не нужно открывать
калькулятор, искать курс и считать в уме: сумма в валюте появляется сразу,
на той же странице, рядом с исходной ценой.

Пересчёт делается по официальному курсу Национального банка Республики
Беларусь.

**Где работает**

• kufar.by — объявления, поиск, карточки товаров
• re.kufar.by — недвижимость, включая цену за квадратный метр
• av.by — объявления, поиск, карточки автомобилей, блоки автосалонов
• av.by — история изменения цены: и график, и журнал изменений

**Что умеет**

• Показывает USD, EUR или обе валюты сразу — на выбор
• Берёт официальный курс Нацбанка РБ и обновляет его автоматически раз в
  сутки (по минскому времени)
• Кнопка «Обновить курсы» — если нужно получить свежий курс прямо сейчас
• Свой курс вручную: можно задать собственный курс USD и/или EUR, если вы
  считаете по курсу обменника, банка или по своему
• Наведите курсор на пересчитанную сумму — во всплывающей подсказке видно,
  какой именно курс использован и за какую дату
• Отдельные переключатели для каждого сайта и общий выключатель — можно
  отключить всё одним кликом, ничего не удаляя

**Важно**

Расширение ничего не меняет на сайте: исходная цена в BYN остаётся на
месте, валютная сумма добавляется рядом как справочная. Это ориентир, а не
цена сделки — продавец по-прежнему указывает цену в рублях.

**Приватность**

• Никаких личных данных не собирается и никуда не передаётся
• Нет аналитики, трекеров и сторонних скриптов
• Не нужен аккаунт и регистрация
• Расширение обращается только к api.nbrb.by — за курсом валют
• Курс и ваши настройки хранятся в браузере, на вашем устройстве

Исходный код открыт:
https://github.com/IlyaSeminsky/kufar-usd-converter

Расширение бесплатное, без рекламы и без встроенных покупок.

---

## Description (EN — alternative, if the listing language is English)

BYN Price Converter shows an approximate price in US dollars or euros right
under the Belarusian ruble price on kufar.by and av.by. No calculator, no
looking up today's rate — the converted amount appears in place, next to the
original price.

Conversion uses the official exchange rates published by the National Bank
of the Republic of Belarus.

**Where it works**

• kufar.by — listings, search results, item pages
• re.kufar.by — real estate, including price per square metre
• av.by — listings, search results, car pages, dealer blocks
• av.by — price history: both the chart and the change log

**Features**

• Show USD, EUR, or both at once
• Official NBRB rates, refreshed automatically once a day (Minsk time)
• "Refresh rates" button when you want the latest rate immediately
• Manual rate override — set your own USD and/or EUR rate if you prefer an
  exchange office or bank rate
• Hover the converted amount to see which rate was used and for what date
• Per-site toggles and a global on/off switch

**Note**

The extension changes nothing on the page: the original BYN price stays
exactly where it is, and the currency amount is added next to it for
reference only. It is an estimate, not a transaction price — the seller
still prices in rubles.

**Privacy**

• No personal data is collected or transmitted
• No analytics, trackers, or third-party scripts
• No account or sign-in required
• The only server it contacts is api.nbrb.by, for exchange rates
• Rates and your settings are stored in your browser, on your device

Open source: https://github.com/IlyaSeminsky/kufar-usd-converter

Free, no ads, no in-app purchases.

---

# Privacy practices tab

Paste-ready justifications. Written in English — the review team reads these
in English regardless of the listing language. Keep them true to the code:
`src/background/index.ts` (alarms), `src/background/rateCache.ts` +
`src/shared/settings.ts` (storage), `src/sites/sites.json` (hosts).

## Single purpose

Display an informational USD/EUR equivalent next to the Belarusian ruble
prices already shown on kufar.by and av.by, converted at the official
National Bank of the Republic of Belarus exchange rate.

## Permission justification — `storage`

The extension caches the daily USD/BYN and EUR/BYN exchange rates it fetches
from the National Bank of the Republic of Belarus in `chrome.storage.local`,
so that every page view reuses one rate lookup per day instead of issuing a
network request per page or per price. It stores the user's own preferences
in `chrome.storage.sync`: the on/off switch, whether to display USD, EUR or
both, optional manual rate overrides, and which of the two supported sites
are enabled. Without `storage` the extension could not remember the user's
settings between page loads and would have to re-request the exchange rate
on every single page, which is both slower for the user and needless load on
the National Bank's public API. Nothing stored is personal data, and none of
it is transmitted anywhere.

## Permission justification — `alarms`

The National Bank of the Republic of Belarus publishes a new official
exchange rate once per calendar day (Minsk time). The extension registers a
single `chrome.alarms` alarm that wakes the MV3 service worker periodically
to check whether the cached rate is still for the current Minsk date, and
re-fetches it only when the day has rolled over — so in normal use this
results in one rate request per day. An MV3 service worker is terminated
when idle and cannot keep a `setTimeout`/`setInterval` alive, so `alarms` is
the only supported way to schedule this check. Without it the displayed
conversions would silently go stale until the user happened to open the
popup and refresh manually.

## Permission justification — host permissions

Host access is requested for exactly three destinations, each required for
the extension's single purpose:

- `https://www.kufar.by/*` and `https://re.kufar.by/*`, and `https://av.by/*`
  and `https://*.av.by/*` — the content script must run on these classifieds
  sites to read the BYN price text already visible on the page and insert
  the converted USD/EUR amount next to it. This is the entire function of
  the extension; it cannot work without access to the pages whose prices it
  converts. Only price elements are read. No other page content, and no
  personal data, messages, contact details or account information, is read,
  collected or transmitted.
- `https://api.nbrb.by/*` — the public, unauthenticated API of the National
  Bank of the Republic of Belarus, the source of the official exchange rate
  used for the conversion. No identifying information is sent with the
  request; it is a plain GET for the published daily rate.

No other host is accessed.

## Remote code

**No, I am not using remote code.** All JavaScript is bundled in the
extension package. The only network request is a GET to `api.nbrb.by` that
returns JSON exchange-rate data, which is parsed and validated as data and
never evaluated as code.

## Data usage disclosures

Check **no** category. The extension collects and transmits none of:
personally identifiable information, health information, financial and
payment information, authentication information, personal communications,
location, web history, or user activity. Website content is *read* on
kufar.by and av.by (price text only) but is never collected or transmitted
off the device.

Certify all three compliance statements:
- Data is not being sold to third parties, outside of approved use cases.
- Data is not being used or transferred for purposes unrelated to the item's
  single purpose.
- Data is not being used or transferred to determine creditworthiness or for
  lending purposes.

## Privacy policy URL

https://github.com/IlyaSeminsky/kufar-usd-converter/blob/main/README.md
