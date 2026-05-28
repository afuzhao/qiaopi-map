// Country choropleth map for qiaopi data.
const DATA_INDEX_URL = "data_index.json";
const DATA_SEARCH_URL = "data_search.json";
const MAX_MAP_MARKERS = 100;
const RECEIVING_CITY_LIST_LIMIT = 60;
const CITY_SENDER_PAGE_SIZE = 10;
const COUNTRY_BOUNDS_URL = "https://cdn.jsdelivr.net/npm/world-atlas/countries-110m.json";
const COUNTRY_NAMES_TSV_URL = "country-names.tsv";
const TOPOJSON_CLIENT_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";

const COUNTRY_ALIAS = {
  中国大陆: "china",
  泰国: "thailand",
  新加坡: "singapore",
  马来西亚: "malaysia",
  香港: "hong kong",
  印度尼西亚: "indonesia",
  越南: "vietnam",
  柬埔寨: "cambodia",
  老挝: "laos",
  文莱: "brunei",
  澳大利亚: "australia",
};

const COUNTRY_COLOR_BASE = "#8b6914";
const COUNTRY_COLOR_ACTIVE = "#b5341c";

let INDEX = null;
let totalLetterCount = 0;
const chunkCache = new Map();
const originMetaByCountry = new Map();
const receivingMetaByCountry = new Map();
const globalReceivingMetaByLabel = new Map();
const chunkOriginIndexCache = new Map();
const chunkReceivingIndexCache = new Map();
const expandedReceivingCountries = new Set();
let countryLayer = null;
let activeCountryName = null;
let activeCityKey = null;
let activeCityLabel = null;
let cityMarkerLayer = null;
let receivingCityMarkerLayer = null;
let receivingLetterMarkerLayer = null;
let originCityHighlightLayer = null;
let receivingLocationHighlightLayer = null;
let letterArcLayer = null;
let countryFallbackLayer = null;
let activeArcRow = null;
let senderSearchQuery = "";
let searchMode = "sender";
let citySortMode = "origin";
let globalReceivingViewActive = false;
let globalReceivingControlBtn = null;
let markerLegendControl = null;
let mapLoadingDepth = 0;
let activeCitySenderStats = [];
let activeCitySenderVisible = CITY_SENDER_PAGE_SIZE;
const letterCountByCountry = new Map();
const citiesByCountry = new Map();
const receivingCitiesByCountry = new Map();
const receivingCityCountsByCountry = new Map();
const allReceivingCityCounts = new Map();

const RECV_HUB_COLOR = "#1a6b3a";
const RECV_HUB_FILL = "#7fcf9a";
const CHAOSHAN_BOUNDS = [
  [22.9, 115.8],
  [24.0, 117.2],
];

const map = L.map("map", { center: [20, 108], zoom: 3, zoomControl: true, attributionControl: false });

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap · Carto · world-atlas").addTo(map);
cityMarkerLayer = L.layerGroup().addTo(map);
receivingCityMarkerLayer = L.layerGroup().addTo(map);
receivingLetterMarkerLayer = L.layerGroup().addTo(map);
originCityHighlightLayer = L.layerGroup().addTo(map);
receivingLocationHighlightLayer = L.layerGroup().addTo(map);
letterArcLayer = L.layerGroup().addTo(map);
countryFallbackLayer = L.layerGroup().addTo(map);

const COUNTRY_ARC_COLOR = {
  中国大陆: "#8e44ad",
  泰国: "#b5341c",
  新加坡: "#1a5276",
  马来西亚: "#1a6b3a",
  香港: "#7b2d8b",
  印度尼西亚: "#1f5f99",
  越南: "#b03a2e",
  柬埔寨: "#6c3483",
  老挝: "#2874a6",
  文莱: "#7d6608",
  澳大利亚: "#117864",
};

const COUNTRY_FILL_COLOR = {
  中国大陆: "#b57edc",
  泰国: "#e76f51",
  新加坡: "#4ea8de",
  马来西亚: "#52b788",
  香港: "#b089c6",
  印度尼西亚: "#5e81ac",
  越南: "#f28482",
  柬埔寨: "#9d4edd",
  老挝: "#4895ef",
  文莱: "#ffd166",
  澳大利亚: "#2a9d8f",
};

const COUNTRY_CENTROID = {
  泰国: [15.87, 100.99],
  新加坡: [1.3521, 103.8198],
  马来西亚: [4.21, 101.98],
  香港: [22.3193, 114.1694],
  印度尼西亚: [-2.2, 117.1],
  越南: [14.06, 108.28],
  柬埔寨: [12.56, 104.99],
  老挝: [19.85, 102.49],
  文莱: [4.54, 114.73],
  澳大利亚: [-25.27, 133.77],
};

const COUNTRY_NORMALIZE_MAP = {
  中国: "中国大陆",
  中国大陆: "中国大陆",
  中国内地: "中国大陆",
  内地: "中国大陆",
  mainlandchina: "中国大陆",
  泰: "泰国",
  暹罗: "泰国",
  thai: "泰国",
  thailand: "泰国",
  siam: "泰国",
  星加坡: "新加坡",
  新嘉坡: "新加坡",
  新架坡: "新加坡",
  新家坡: "新加坡",
  新加坡共和国: "新加坡",
  singapore: "新加坡",
  马来亚: "马来西亚",
  马来: "马来西亚",
  马亚西亚: "马来西亚",
  马拉西亚: "马来西亚",
  侨来西亚: "马来西亚",
  malaysia: "马来西亚",
  malaya: "马来西亚",
  香港特别行政区: "香港",
  "hong kong": "香港",
  hongkong: "香港",
  印尼: "印度尼西亚",
  indonesia: "印度尼西亚",
  寮国: "老挝",
  laos: "老挝",
  brunei: "文莱",
  australia: "澳大利亚",
};

const ATLAS_NAME_TO_CN = {
  china: "中国大陆",
  thailand: "泰国",
  singapore: "新加坡",
  malaysia: "马来西亚",
  "hong kong": "香港",
  indonesia: "印度尼西亚",
  vietnam: "越南",
  cambodia: "柬埔寨",
  laos: "老挝",
  "lao people's democratic republic": "老挝",
  brunei: "文莱",
  "brunei darussalam": "文莱",
  australia: "澳大利亚",
};

const COUNTRY_ID_OVERRIDES = {
  "36": "australia",
  "036": "australia",
  "96": "brunei",
  "096": "brunei",
  "116": "cambodia",
  "156": "china",
  "344": "hong kong",
  "360": "indonesia",
  "418": "laos",
  "458": "malaysia",
  "702": "singapore",
  "704": "vietnam",
  "764": "thailand",
};

const FEATURE_ID_TO_CN = {
  "156": "中国大陆",
  "344": "香港",
  "702": "新加坡",
  "764": "泰国",
  "458": "马来西亚",
  "360": "印度尼西亚",
  "704": "越南",
  "116": "柬埔寨",
  "418": "老挝",
  "096": "文莱",
  "96": "文莱",
  "036": "澳大利亚",
  "36": "澳大利亚",
};

const ZH_COLLATOR = new Intl.Collator("zh-Hans", { sensitivity: "base", numeric: true });
const EN_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const COUNTRY_WIDE_LABEL = "__COUNTRY_WIDE__";

const CITY_COUNTRY_HINTS = {
  新加坡: "新加坡",
  singapore: "新加坡",
  香港: "香港",
  "hong kong": "香港",
  hongkong: "香港",
  曼谷: "泰国",
  bangkok: "泰国",
  吉隆坡: "马来西亚",
  "kuala lumpur": "马来西亚",
  古晋: "马来西亚",
  kuching: "马来西亚",
  砂朥越: "马来西亚",
  砂捞越: "马来西亚",
  沙捞越: "马来西亚",
  sarawak: "马来西亚",
  槟城: "马来西亚",
  梹城: "马来西亚",
  penang: "马来西亚",
  麻坡: "马来西亚",
  新山: "马来西亚",
  雅加达: "印度尼西亚",
  jakarta: "印度尼西亚",
  万象: "老挝",
  vientiane: "老挝",
  金边: "柬埔寨",
  phnompenh: "柬埔寨",
  斯里巴加湾: "文莱",
  bandarsribegawan: "文莱",
  汕头: "中国大陆",
  潮安: "中国大陆",
  澄海: "中国大陆",
  shantou: "中国大陆",
};

const VALID_RECV_PLACE_RE =
  /(?:广东|福建)(?:潮汕|潮安|潮阳|潮州|澄海|澄邑|揭阳|揭邑|揭西|饶平|汕头|普宁|惠来|丰顺|大埔|梅县|广州|江门|庵埠|浮洋|陆丰|龙门|诏安|晋江|永春)/;

const OVERSEAS_RECV_NAME_RE =
  /^(新加坡|泰国|马来西亚|印度尼西亚|印尼|越南|柬埔寨|老挝|文莱|澳大利亚|澳洲|香港|缅甸)([\u4e00-\u9fff]{1,4})$/;

const I18N = {
  "zh-Hans": {
    siteTitle: "潮汕侨批网络",
    siteSubtitle: "潮汕侨批 · 书信与汇款网络",
    navAbout: "关于",
    navMap: "地图",
    backAbout: "返回关于",
    archiveTag: "侨批档案",
    selectCorridor: "选择线路",
    clickMapHint: "点击地图中的弧线或标记",
    tabAll: "全部",
    tabEnvelope: "封",
    tabLetter: "含信",
    statLetters: "批信",
    statPeriod: "时期",
    statSenders: "寄批人",
    loadingArchive: "正在加载侨批档案…",
    loadingMap: "正在加载地图，请稍候…",
    aboutKicker: "引言",
    aboutTitle: "什么是侨批？",
    aboutDefinition:
      "侨批是华侨寄给中国家人的历史性汇款书信，尤其集中于十九至二十世纪。每一份文书往往兼具私人通信与经济支持，保存了跨地域亲属关系、劳工流动与日常生活的历史痕迹。",
    exploreMap: "探索地图",
    footerCredit: "",
    sender: "寄批人",
    recipient: "收批人",
    searchSender: "按寄批人搜索",
    searchRecipient: "按收批人搜索",
    country: "国家",
    selectCountry: "选择国家",
    countryView: "国家视图",
    countryDetail: "国家详情",
    cityDetail: "城市详情",
    clickCountryHint: "点击高亮国家轮廓，或在下方选择国家。",
    loadedLetters: "已加载 {count} 封侨批；有数据的国家已在地图高亮。",
    sentFromCities: "寄批地城市",
    receivingCities: "收批地城市（中国）",
    noCityInfo: "未找到城市级地点信息。",
    clickSentCity: "点击以缩放并查看从该城市寄出的侨批",
    clickReceivingCity: "点击以缩放并查看寄至该中国城市的侨批",
    totalLetters: "共 {count} 封侨批",
    cityOverview: "城市概览",
    backToCityList: "← 返回城市列表",
    returnToCities: "返回 {country} 的全部{mode}城市",
    sentPlace: "寄批地",
    receivingPlace: "收批地",
    lettersReceivedInCity: "本城市收到侨批：{count}",
    lettersFromCity: "本城市寄出侨批：{count}",
    originCountry: "寄批来源国家：{country}",
    lettersToCity: "寄至本城市侨批：{count}",
    noPreciseCity: "缺少精确城市坐标，地图仅高亮国家。",
    clickSearchForRoute: "可从搜索结果点击具体侨批以查看路线细节。",
    markersOnMap: "地图标记数量：{count}",
    markersOnMapCapped: "地图显示 {shown} 个散点（共 {count} 封，其余以汇总点表示）",
    mapHubOnly: "地图以汇总点表示本城市全部 {count} 封侨批",
    loadingCity: "正在加载该城市数据…",
    clickMarkerDetail: "点击单个标记可在下方查看侨批元数据。",
    couldNotLoadIndex: "无法加载 data_index.json",
    couldNotLoadChunk: "无法加载国家数据分片",
    topSenders: "寄批人（前{count}）",
    senderLettersCount: "{name} · {count}封",
    showMoreSenders: "再显示{step}位寄批人（剩余{remaining}位）",
    senderMatches: "寄批人匹配",
    recipientMatches: "收批人匹配",
    noMatches: "未找到{mode}匹配结果。",
    dateUnknown: "日期不详",
    letterDetail: "批 · 详情",
    fieldCountry: "寄批地_国家",
    fieldCity: "寄批地_城市",
    fieldSender: "寄批人",
    fieldRecipient: "收批人",
    fieldDestination: "收批地",
    fieldDate: "寄批时间",
    fieldType: "类别",
    fieldBureau: "批局",
    countryWide: "全国",
    regionWide: "全地区",
    unknownCity: "不详",
    receivingControlShow: "显示中国收批地",
    receivingControlHide: "隐藏中国收批地",
    legendLetter: "1点 = 1封侨批",
    legendReceiving: "中国收批地城市",
    loadingErrorHelp: "请使用本地网页服务器（如 VS Code Live Server）以正确加载远程 GeoJSON 与 data.json。",
    couldNotLoadTopojson: "无法加载 topojson-client。",
    couldNotLoadBoundaries: "无法加载国家边界数据",
    couldNotLoadNames: "无法加载国家名称数据",
    couldNotLoadData: "无法加载 data.json",
    badDataShape: "data.json 必须是数组，或包含 letters 数组的对象。",
  },
  "zh-Hant": {
    siteTitle: "潮汕僑批網絡",
    siteSubtitle: "潮汕僑批 · 書信與匯款網絡",
    navAbout: "關於",
    navMap: "地圖",
    backAbout: "返回關於",
    archiveTag: "僑批檔案",
    selectCorridor: "選擇線路",
    clickMapHint: "點擊地圖中的弧線或標記",
    tabAll: "全部",
    tabEnvelope: "封",
    tabLetter: "含信",
    statLetters: "批信",
    statPeriod: "時期",
    statSenders: "寄批人",
    loadingArchive: "正在載入僑批檔案…",
    loadingMap: "正在載入地圖，請稍候…",
    aboutKicker: "引言",
    aboutTitle: "什麼是僑批？",
    aboutDefinition:
      "僑批是華僑寄給中國家人的歷史性匯款書信，尤其集中於十九至二十世紀。每一份文書往往兼具私人通信與經濟支持，保存了跨地域親屬關係、勞工流動與日常生活的歷史痕跡。",
    exploreMap: "探索地圖",
    footerCredit: "",
    sender: "寄批人",
    recipient: "收批人",
    searchSender: "按寄批人搜尋",
    searchRecipient: "按收批人搜尋",
    country: "國家",
    selectCountry: "選擇國家",
    countryView: "國家視圖",
    countryDetail: "國家詳情",
    cityDetail: "城市詳情",
    clickCountryHint: "點擊高亮國家輪廓，或在下方選擇國家。",
    loadedLetters: "已載入 {count} 封僑批；有資料的國家已在地圖高亮。",
    sentFromCities: "寄批地城市",
    receivingCities: "收批地城市（中國）",
    noCityInfo: "未找到城市級地點資訊。",
    clickSentCity: "點擊以縮放並查看從該城市寄出的僑批",
    clickReceivingCity: "點擊以縮放並查看寄至該中國城市的僑批",
    totalLetters: "共 {count} 封僑批",
    cityOverview: "城市概覽",
    backToCityList: "← 返回城市列表",
    returnToCities: "返回 {country} 的全部{mode}城市",
    sentPlace: "寄批地",
    receivingPlace: "收批地",
    lettersReceivedInCity: "本城市收到僑批：{count}",
    lettersFromCity: "本城市寄出僑批：{count}",
    originCountry: "寄批來源國家：{country}",
    lettersToCity: "寄至本城市僑批：{count}",
    noPreciseCity: "缺少精確城市座標，地圖僅高亮國家。",
    clickSearchForRoute: "可從搜尋結果點擊具體僑批以查看路線細節。",
    markersOnMap: "地圖標記數量：{count}",
    markersOnMapCapped: "地圖顯示 {shown} 個散點（共 {count} 封，其餘以匯總點表示）",
    mapHubOnly: "地圖以匯總點表示本城市全部 {count} 封僑批",
    loadingCity: "正在載入該城市數據…",
    clickMarkerDetail: "點擊單個標記可在下方查看僑批元資料。",
    couldNotLoadIndex: "無法載入 data_index.json",
    couldNotLoadChunk: "無法載入國家數據分片",
    topSenders: "寄批人（前{count}）",
    senderLettersCount: "{name} · {count}封",
    showMoreSenders: "再顯示{step}位寄批人（剩餘{remaining}位）",
    senderMatches: "寄批人匹配",
    recipientMatches: "收批人匹配",
    noMatches: "未找到{mode}匹配結果。",
    dateUnknown: "日期不詳",
    letterDetail: "批 · 詳情",
    fieldCountry: "寄批地_國家",
    fieldCity: "寄批地_城市",
    fieldSender: "寄批人",
    fieldRecipient: "收批人",
    fieldDestination: "收批地",
    fieldDate: "寄批時間",
    fieldType: "類別",
    fieldBureau: "批局",
    countryWide: "全國",
    regionWide: "全地區",
    unknownCity: "不詳",
    receivingControlShow: "顯示中國收批地",
    receivingControlHide: "隱藏中國收批地",
    legendLetter: "1點 = 1封僑批",
    legendReceiving: "中國收批地城市",
    loadingErrorHelp: "請使用本地網頁伺服器（如 VS Code Live Server）以正確載入遠端 GeoJSON 與 data.json。",
    couldNotLoadTopojson: "無法載入 topojson-client。",
    couldNotLoadBoundaries: "無法載入國家邊界資料",
    couldNotLoadNames: "無法載入國家名稱資料",
    couldNotLoadData: "無法載入 data.json",
    badDataShape: "data.json 必須是陣列，或包含 letters 陣列的物件。",
  },
  en: {
    siteTitle: "Chaoshan Qiaopi Network",
    siteSubtitle: "Correspondence & Remittance Network",
    navAbout: "About",
    navMap: "Map",
    backAbout: "Back to About",
    archiveTag: "Qiaopi Archive",
    selectCorridor: "Select a corridor",
    clickMapHint: "Click an arc or marker on the map",
    tabAll: "All",
    tabEnvelope: "Envelope only",
    tabLetter: "With letter",
    statLetters: "Letters",
    statPeriod: "Period",
    statSenders: "Senders",
    loadingArchive: "Loading archive…",
    loadingMap: "Loading map, please wait…",
    aboutKicker: "Introduction",
    aboutTitle: "What Is Qiaopi?",
    aboutDefinition:
      "Qiaopi are historical remittance letters sent by overseas Chinese migrants to their families in China, especially across the nineteenth and twentieth centuries. Each document often combines personal correspondence with financial support, preserving traces of kinship, labor, migration, and everyday life across long distances.",
    exploreMap: "Explore Map",
    footerCredit: "",
    sender: "Sender",
    recipient: "Recipient",
    searchSender: "Search by sender name",
    searchRecipient: "Search by recipient name",
    country: "Country",
    selectCountry: "Select country",
    countryView: "Country View",
    countryDetail: "Country Detail",
    cityDetail: "City Detail",
    clickCountryHint: "Click a highlighted country outline or choose a country below.",
    loadedLetters: "{count} letters loaded. Countries with data are highlighted on the map.",
    sentFromCities: "Sent-from cities",
    receivingCities: "Receiving cities in China",
    noCityInfo: "No city-level locations found.",
    clickSentCity: "Click to zoom and view letters sent from this city",
    clickReceivingCity: "Click to zoom and view letters received in this China city",
    totalLetters: "{count} total letters",
    cityOverview: "City overview",
    backToCityList: "← Back to city list",
    returnToCities: "Return to all {mode} cities in {country}",
    sentPlace: "sent-from",
    receivingPlace: "receiving",
    lettersReceivedInCity: "Letters received in this city: {count}",
    lettersFromCity: "Letters from this city: {count}",
    originCountry: "Origin country: {country}",
    lettersToCity: "Letters to this city: {count}",
    noPreciseCity: "No precise city coordinates. Country is highlighted on map.",
    clickSearchForRoute: "Click a specific letter from search to inspect route details.",
    markersOnMap: "Markers on map: {count}",
    markersOnMapCapped: "Map shows {shown} sample markers ({count} letters total; hub summarizes the rest)",
    mapHubOnly: "Map shows one hub for all {count} letters in this city",
    loadingCity: "Loading city data…",
    clickMarkerDetail: "Click an individual marker to open letter metadata below.",
    couldNotLoadIndex: "Could not load data_index.json",
    couldNotLoadChunk: "Could not load country data chunk",
    topSenders: "Top senders ({count})",
    senderLettersCount: "{name} · {count} letters",
    showMoreSenders: "Show {step} more senders ({remaining} remaining)",
    senderMatches: "Sender matches",
    recipientMatches: "Recipient matches",
    noMatches: "No {mode} matches.",
    dateUnknown: "Date unknown",
    letterDetail: "Letter Detail",
    fieldCountry: "Origin country",
    fieldCity: "Origin city",
    fieldSender: "Sender",
    fieldRecipient: "Recipient",
    fieldDestination: "Destination",
    fieldDate: "Date",
    fieldType: "Type",
    fieldBureau: "Bureau",
    countryWide: "Country-wide",
    regionWide: "Region-wide",
    unknownCity: "Unknown",
    receivingControlShow: "Show receiving cities",
    receivingControlHide: "Hide receiving cities",
    legendLetter: "1 dot = 1 letter",
    legendReceiving: "Receiving city in China",
    loadingErrorHelp: "Use a local web server (e.g. VS Code Live Server) so remote GeoJSON and data.json can load correctly.",
    couldNotLoadTopojson: "Could not load topojson-client.",
    couldNotLoadBoundaries: "Could not load country boundaries",
    couldNotLoadNames: "Could not load country names",
    couldNotLoadData: "Could not load data.json",
    badDataShape: "data.json must be either an array or an object with a letters array.",
  },
};

let currentLang = localStorage.getItem("qiaopiLang") || "zh-Hans";
if (!I18N[currentLang]) currentLang = "zh-Hans";

function t(key, params = {}) {
  let text = I18N[currentLang]?.[key] ?? I18N["zh-Hans"][key] ?? key;
  Object.entries(params).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.title = t("siteTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    const value = t(key);
    el.textContent = value;
  });
  const select = document.getElementById("languageSelect");
  if (select) select.value = currentLang;
  updateMapLoadingText();
}

function updateMapLoadingText() {
  const el = document.getElementById("mapLoadingText");
  if (el) el.textContent = t("loadingMap");
}

function showMapLoading() {
  mapLoadingDepth += 1;
  const overlay = document.getElementById("mapLoadingOverlay");
  if (overlay) overlay.classList.add("visible");
}

function hideMapLoading() {
  mapLoadingDepth = Math.max(0, mapLoadingDepth - 1);
  if (mapLoadingDepth > 0) return;
  const overlay = document.getElementById("mapLoadingOverlay");
  if (overlay) overlay.classList.remove("visible");
}

function refreshDynamicText() {
  addMarkerLegend(true);
  updateGlobalReceivingControlText();
  if (globalReceivingViewActive) {
    renderSidebarIntro();
    drawAllReceivingCityMarkers();
    return;
  }
  if (activeCountryName && activeCityLabel) {
    selectCity(activeCountryName, activeCityLabel, citySortMode, { preserveMap: true });
  } else if (activeCountryName) {
    renderCountrySidebar(activeCountryName);
  } else {
    renderSidebarIntro();
  }
}

function setLanguage(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  localStorage.setItem("qiaopiLang", lang);
  applyStaticTranslations();
  if (INDEX) refreshDynamicText();
}

function setupLanguageSelector() {
  applyStaticTranslations();
  const select = document.getElementById("languageSelect");
  if (!select) return;
  select.addEventListener("change", () => setLanguage(select.value));
}

function addMarkerLegend(refresh = false) {
  if (refresh && markerLegendControl) {
    map.removeControl(markerLegendControl);
    markerLegendControl = null;
  }
  if (markerLegendControl) return;
  const legend = L.control({ position: "bottomleft" });
  legend.onAdd = function onAdd() {
    const div = L.DomUtil.create("div");
    div.style.background = "rgba(255,255,255,0.92)";
    div.style.padding = "6px 10px";
    div.style.border = "1px solid #c9b98a";
    div.style.borderRadius = "3px";
    div.style.fontSize = "12px";
    div.style.color = "#4f3a1f";
    div.style.fontFamily = "'Noto Serif SC', serif";
    div.innerHTML =
      `<div style="margin-bottom:4px;"><span style="display:inline-block;width:8px;height:8px;background:#c9872a;border:1px solid #7b2d8b;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>${escapeHtml(t("legendLetter"))}</div>` +
      `<div><span style="display:inline-block;width:8px;height:8px;background:#7fcf9a;border:1px solid #1a6b3a;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>${escapeHtml(t("legendReceiving"))}</div>`;
    return div;
  };
  legend.addTo(map);
  markerLegendControl = legend;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanCountryText(v) {
  return String(v || "")
    .replace(/_x000D_/gi, "")
    .replace(/[【】\[\]()（）]/g, "")
    .replace(/[，。、]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeCountryNameZh(rawValue) {
  const text = cleanCountryText(rawValue);
  if (!text) return "";
  const low = text.toLowerCase();
  if (COUNTRY_NORMALIZE_MAP[low]) return COUNTRY_NORMALIZE_MAP[low];
  if (COUNTRY_NORMALIZE_MAP[text]) return COUNTRY_NORMALIZE_MAP[text];
  if (COUNTRY_ALIAS[text]) return text;

  const contains = (s) => text.includes(s) || low.includes(s);
  if (contains("新加坡") || contains("新嘉坡")) return "新加坡";
  if (contains("马来")) return "马来西亚";
  if (contains("泰国") || contains("暹罗") || contains("泰京")) return "泰国";
  if (contains("中国") || contains("内地")) return "中国大陆";
  if (contains("广东") || contains("潮安") || contains("澄海") || contains("潮阳") || contains("揭阳") || contains("饶平"))
    return "中国大陆";
  if (contains("香港")) return "香港";
  if (contains("印尼") || contains("印度尼西亚")) return "印度尼西亚";
  if (contains("越南")) return "越南";
  if (contains("柬埔寨")) return "柬埔寨";
  if (contains("老挝") || contains("寮国")) return "老挝";
  if (contains("文莱")) return "文莱";
  if (contains("澳大利亚") || contains("澳洲")) return "澳大利亚";

  return text;
}

function getRowCountry(row) {
  const standardized = (row["寄批地_国家_标准化"] || "").trim();
  if (standardized && COUNTRY_ALIAS[standardized]) return standardized;
  if (standardized) return normalizeCountryNameZh(standardized);
  return normalizeCountryNameZh(row["寄批地_国家"] || row["寄批地"]);
}

function compactText(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）,【】\[\].,，。]/g, "");
}

function compactKey(s) {
  return compactText(s);
}

function inferCountryFromCityLabel(cityLabel) {
  const labelKey = compactKey(cityLabel);
  if (!labelKey) return "";
  for (const [hint, country] of Object.entries(CITY_COUNTRY_HINTS)) {
    if (labelKey.includes(compactKey(hint))) return country;
  }
  return "";
}

function inferCountryFromRow(row, cityLabel = "") {
  const blob = `${row["寄批地_城市"] || ""} ${row["寄批地_城市_英文"] || ""} ${row["寄批地_批局"] || ""} ${cityLabel || ""}`.toLowerCase();
  if (blob.includes("kuching") || blob.includes("古晋") || blob.includes("砂朥越") || blob.includes("砂捞越") || blob.includes("沙捞越") || blob.includes("sarawak")) {
    return "马来西亚";
  }
  const byCity = inferCountryFromCityLabel(cityLabel);
  if (byCity) return byCity;
  const bureau = `${row["寄批地_批局"] || ""} ${row["寄批地_城市"] || ""} ${row["寄批地_城市_英文"] || ""}`;
  return inferCountryFromCityLabel(bureau);
}

function cityMatchesCountry(cityLabel, countryName) {
  if (!countryName) return false;
  const countryNorm = normalizeCountryNameZh(countryName);
  const label = String(cityLabel || "").trim();
  if (!label || label === "不详") return true;
  if (isCountryLikeCityLabel(label)) return true;

  const parts = parseCityLabelParts(label);
  const tokens = [parts.zh, parts.en, parts.raw].filter(Boolean);
  for (const token of tokens) {
    const norm = normalizeCountryNameZh(token);
    if (norm && norm === countryNorm) return true;
    const low = token.toLowerCase();
    if (COUNTRY_NORMALIZE_MAP[low] === countryNorm) return true;
    if (COUNTRY_ALIAS[countryNorm] && low === COUNTRY_ALIAS[countryNorm]) return true;
  }
  return false;
}

function resolveLocationForRow(row) {
  let country = getRowCountry(row);
  const rawCityLabel = cityLabelFromRow(row, country);
  const inferredCountry = inferCountryFromRow(row, rawCityLabel);
  if (inferredCountry) country = inferredCountry;

  const rawZh = normalizeCityText(row["寄批地_城市"] || "");
  const rawEn = normalizeCityText(row["寄批地_城市_英文"] || "");
  const missingCity = (!rawZh && !rawEn) || rawZh === "不详" || rawEn === "不详";
  const citySameAsCountry =
    cityMatchesCountry(rawCityLabel, country) ||
    cityMatchesCountry(rawZh, country) ||
    (rawEn && cityMatchesCountry(rawEn, country));

  const countryCoords = COUNTRY_CENTROID[country] || null;
  const lat = Number(row["寄批地_纬度"]);
  const lng = Number(row["寄批地_经度"]);
  const rowCoords = isValidLatLng(lat, lng) ? [lat, lng] : null;

  if (missingCity || citySameAsCountry) {
    return {
      country,
      coords: countryCoords || rowCoords,
      hasCity: false,
    };
  }

  return {
    country,
    city: rawCityLabel,
    coords: rowCoords || countryCoords,
    hasCity: true,
  };
}

function getEffectiveCountry(row) {
  return resolveLocationForRow(row).country;
}

function isCountryWideLabel(label) {
  return label === COUNTRY_WIDE_LABEL;
}

function displayCityLabel(label, countryName = "") {
  if (isCountryWideLabel(label)) {
    return countryName === "香港" ? t("regionWide") : t("countryWide");
  }
  if (label === "不详") return t("unknownCity");
  return label;
}

function normalizeCityText(v) {
  const t = String(v || "")
    .replace(/_x000D_/gi, "")
    .replace(/[【】\[\]()（）]/g, "")
    .replace(/[，。、]/g, "")
    .trim();
  if (!t) return "";
  const low = t.toLowerCase();
  if (low === "不详" || low === "unknown" || low === "n/a" || low === "na") return "不详";
  return t;
}

function containsCjk(s) {
  return /[\u3400-\u9fff]/.test(s || "");
}

function parseCityLabelParts(label) {
  const raw = String(label || "").trim();
  const m = raw.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!m) {
    return {
      raw,
      zh: containsCjk(raw) ? raw : "",
      en: containsCjk(raw) ? "" : raw.toLowerCase(),
      hasParenPair: false,
    };
  }
  const left = m[1].trim();
  const right = m[2].trim();
  const zh = containsCjk(left) ? left : containsCjk(right) ? right : left;
  const en = containsCjk(left) ? right.toLowerCase() : left.toLowerCase();
  return { raw, zh, en, hasParenPair: true };
}

function sortCityLabelsForCountry(cityLabels, countryName) {
  const countryKey = normalizeCountryNameZh(countryName);
  return cityLabels.slice().sort((a, b) => {
    if (isCountryWideLabel(a) !== isCountryWideLabel(b)) return isCountryWideLabel(a) ? 1 : -1;
    const A = parseCityLabelParts(a);
    const B = parseCityLabelParts(b);

    const aIsFallback = normalizeCountryNameZh(A.raw) === countryKey;
    const bIsFallback = normalizeCountryNameZh(B.raw) === countryKey;
    if (aIsFallback !== bIsFallback) return aIsFallback ? 1 : -1;

    if (A.hasParenPair !== B.hasParenPair) return A.hasParenPair ? -1 : 1;

    if (A.zh && B.zh) {
      const c = ZH_COLLATOR.compare(A.zh, B.zh);
      if (c !== 0) return c;
    } else if (A.zh !== B.zh) {
      return A.zh ? -1 : 1;
    }

    const c2 = EN_COLLATOR.compare(A.en || A.raw.toLowerCase(), B.en || B.raw.toLowerCase());
    if (c2 !== 0) return c2;

    return EN_COLLATOR.compare(A.raw.toLowerCase(), B.raw.toLowerCase());
  });
}

function setSidebarHeader(tagText, titleText, metaText, countrySelectHtml = "") {
  const senderActive = searchMode === "sender";
  const recipientActive = searchMode === "recipient";
  const titleBlock = countrySelectHtml
    ? `<div style="margin-top:2px;">${countrySelectHtml}</div>`
    : `<h2>${escapeHtml(titleText)}</h2>`;
  document.getElementById("sbHead").innerHTML = `
    <div class="corridor-tag">${escapeHtml(tagText)}</div>
    ${titleBlock}
    <div class="meta">${escapeHtml(metaText)}</div>
    <div style="margin-top:10px;display:flex;gap:6px;">
      <button id="searchTabSender" style="flex:1;padding:5px 8px;border:1px solid #d9c99a;background:${senderActive ? "#f1e4c6" : "#fff8ec"};cursor:pointer;font-family:'Noto Serif SC',serif;font-size:0.72rem;color:#4f3a1f;">${escapeHtml(t("sender"))}</button>
      <button id="searchTabRecipient" style="flex:1;padding:5px 8px;border:1px solid #d9c99a;background:${recipientActive ? "#f1e4c6" : "#fff8ec"};cursor:pointer;font-family:'Noto Serif SC',serif;font-size:0.72rem;color:#4f3a1f;">${escapeHtml(t("recipient"))}</button>
    </div>
    <div style="margin-top:10px;">
      <input id="senderSearchInput" type="text" placeholder="${
        senderActive ? escapeHtml(t("searchSender")) : escapeHtml(t("searchRecipient"))
      }" style="width:100%;padding:7px 9px;border:1px solid #d9c99a;background:#fff8ec;font-family:'Noto Serif SC',serif;font-size:0.78rem;color:#4f3a1f;border-radius:2px;outline:none;" />
    </div>`;
  wireSearchControls();
}

function countriesWithLetterData() {
  return Array.from(letterCountByCountry.entries())
    .filter(([, n]) => n > 0)
    .map(([name]) => name)
    .sort((a, b) => ZH_COLLATOR.compare(a, b));
}

function buildCountrySelectHtml(selectedCountry = "") {
  const countries = countriesWithLetterData();
  if (!countries.length) return "";
  const options = countries
    .map((c) => `<option value="${escapeHtml(c)}" ${c === selectedCountry ? "selected" : ""}>${escapeHtml(c)}</option>`)
    .join("");
  const placeholder = selectedCountry
    ? ""
    : `<option value="" ${!selectedCountry ? "selected" : ""}>${escapeHtml(t("selectCountry"))}</option>`;
  return `<label for="countrySelect" style="display:block;font-size:0.62rem;letter-spacing:0.12em;color:#8b6914;margin-bottom:4px;">${escapeHtml(t("country"))}</label>
    <select id="countrySelect" style="width:100%;padding:7px 9px;border:1px solid #d9c99a;background:#fff8ec;font-family:'Noto Serif SC',serif;font-size:0.85rem;color:#1a1209;border-radius:2px;outline:none;">
      ${placeholder}${options}
    </select>`;
}

function selectCountryFromSidebar(cnName) {
  if (!cnName || !letterCountByCountry.get(cnName)) return;
  globalReceivingViewActive = false;
  updateGlobalReceivingControlState();
  activeCountryName = cnName;
  activeCityKey = null;
  activeCityLabel = null;
  citySortMode = "origin";
  cityMarkerLayer.clearLayers();
  clearReceivingMapLayers();
  originCityHighlightLayer.clearLayers();
  receivingLocationHighlightLayer.clearLayers();
  letterArcLayer.clearLayers();
  activeArcRow = null;
  if (countryLayer) countryLayer.setStyle(getCountryStyle);
  renderCountrySidebar(cnName);
}

function wireSearchControls() {
  const tabSender = document.getElementById("searchTabSender");
  const tabRecipient = document.getElementById("searchTabRecipient");
  const input = document.getElementById("senderSearchInput");
  const prevCountry = document.getElementById("countrySelect")?.value || activeCountryName || "";
  if (tabSender) {
    tabSender.onclick = () => {
      if (searchMode === "sender") return;
      searchMode = "sender";
      setSidebarHeader(
        document.querySelector("#sbHead .corridor-tag")?.textContent || "侨批档案",
        document.querySelector("#sbHead h2")?.textContent || "",
        document.querySelector("#sbHead .meta")?.textContent || "",
        buildCountrySelectHtml(prevCountry)
      );
      if (senderSearchQuery.trim()) renderSearchResults();
    };
  }
  if (tabRecipient) {
    tabRecipient.onclick = () => {
      if (searchMode === "recipient") return;
      searchMode = "recipient";
      setSidebarHeader(
        document.querySelector("#sbHead .corridor-tag")?.textContent || "侨批档案",
        document.querySelector("#sbHead h2")?.textContent || "",
        document.querySelector("#sbHead .meta")?.textContent || "",
        buildCountrySelectHtml(prevCountry)
      );
      if (senderSearchQuery.trim()) renderSearchResults();
    };
  }
  if (!input) return;
  input.value = senderSearchQuery;
  input.oninput = () => {
    senderSearchQuery = input.value || "";
    renderSearchResults();
  };

  const countrySelect = document.getElementById("countrySelect");
  if (countrySelect) {
    countrySelect.onchange = () => {
      const v = countrySelect.value;
      if (!v) return;
      selectCountryFromSidebar(v);
    };
  }
}

function ensureTopojsonClient() {
  if (window.topojson) return Promise.resolve(window.topojson);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TOPOJSON_CLIENT_URL;
    script.async = true;
    script.onload = () => resolve(window.topojson);
    script.onerror = () => reject(new Error(t("couldNotLoadTopojson")));
    document.head.appendChild(script);
  });
}

function normalizeCountryName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+s\.?a\.?r\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCountryNamesTsv(tsvText) {
  const nameMap = new Map();
  const lines = String(tsvText || "").split(/\r?\n/).filter(Boolean);
  if (lines.length > 1) {
    const header = lines[0].split("\t");
    const idIdx = header.indexOf("id");
    const nameIdx = header.indexOf("name");
    if (idIdx >= 0 && nameIdx >= 0) {
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split("\t");
        if (cols.length <= Math.max(idIdx, nameIdx)) continue;
        const rawId = String(cols[idIdx] || "").trim();
        const rawName = String(cols[nameIdx] || "").trim().toLowerCase();
        if (!rawId || !rawName) continue;
        nameMap.set(rawId, rawName);
        const numId = String(Number(rawId));
        if (numId !== "NaN") nameMap.set(numId, rawName);
      }
    }
  }
  Object.entries(COUNTRY_ID_OVERRIDES).forEach(([id, name]) => nameMap.set(id, name));
  return nameMap;
}

function atlasToChineseCountry(atlasName) {
  const normAtlas = normalizeCountryName(atlasName);
  if (ATLAS_NAME_TO_CN[normAtlas]) return ATLAS_NAME_TO_CN[normAtlas];
  return Object.keys(COUNTRY_ALIAS).find((k) => COUNTRY_ALIAS[k] === normAtlas) || null;
}

function drawCountryFallbackHighlights() {
  countryFallbackLayer.clearLayers();
  const alwaysDot = new Set(["新加坡", "香港"]);
  letterCountByCountry.forEach((count, cnName) => {
    if (!count) return;
    const ll = COUNTRY_CENTROID[cnName];
    if (!ll) return;
    const dot = L.circleMarker(ll, {
      radius: alwaysDot.has(cnName) ? 6.5 : 4.5,
      color: COUNTRY_ARC_COLOR[cnName] || "#7b2d8b",
      weight: 1.2,
      fillColor: COUNTRY_FILL_COLOR[cnName] || fillColorForCount(count),
      fillOpacity: 0.95,
    }).addTo(countryFallbackLayer);
    dot.bindTooltip(`${cnName} · ${count}`, { direction: "top", offset: [0, -5], opacity: 0.9 });
    dot.on("click", () => {
      activeCountryName = cnName;
      if (countryLayer) countryLayer.setStyle(getCountryStyle);
      renderCountrySidebar(cnName);
    });
  });
}

function applyIndexStats() {
  if (!INDEX) return;
  letterCountByCountry.clear();
  citiesByCountry.clear();
  receivingCitiesByCountry.clear();
  receivingCityCountsByCountry.clear();
  allReceivingCityCounts.clear();
  originMetaByCountry.clear();
  receivingMetaByCountry.clear();
  globalReceivingMetaByLabel.clear();
  expandedReceivingCountries.clear();

  Object.entries(INDEX.letterCountByCountry || {}).forEach(([country, count]) => {
    if (COUNTRY_ALIAS[country] || country === "其他") letterCountByCountry.set(country, count);
  });

  Object.entries(INDEX.originCitiesByCountry || {}).forEach(([country, cities]) => {
    if (!COUNTRY_ALIAS[country] && country !== "其他") return;
    citiesByCountry.set(
      country,
      new Set((cities || []).map((c) => c.label))
    );
    originMetaByCountry.set(
      country,
      new Map((cities || []).map((c) => [c.label, c]))
    );
  });

  Object.entries(INDEX.receivingCitiesByCountry || {}).forEach(([country, cities]) => {
    if (!COUNTRY_ALIAS[country] && country !== "其他") return;
    const labelSet = new Set();
    const countMap = new Map();
    (cities || []).forEach((c) => {
      labelSet.add(c.label);
      countMap.set(c.label, c.count);
    });
    receivingCitiesByCountry.set(country, labelSet);
    receivingCityCountsByCountry.set(country, countMap);
    receivingMetaByCountry.set(
      country,
      new Map((cities || []).map((c) => [c.label, c]))
    );
  });

  (INDEX.allReceivingCities || []).forEach((c) => {
    allReceivingCityCounts.set(c.label, c.count);
    globalReceivingMetaByLabel.set(c.label, c);
  });
}

function getOriginCityMeta(countryName, cityLabel) {
  return originMetaByCountry.get(countryName)?.get(cityLabel) || null;
}

function getReceivingCityMeta(countryName, cityLabel) {
  return receivingMetaByCountry.get(countryName)?.get(cityLabel) || null;
}

function getGlobalReceivingMeta(label) {
  return globalReceivingMetaByLabel.get(label) || null;
}

function buildChunkIndexes(countryName, letters) {
  const originMap = new Map();
  const receivingMap = new Map();
  const countryWide = [];

  letters.forEach((row) => {
    const loc = resolveLocationForRow(row);
    if (loc.country !== countryName) return;
    if (loc.hasCity && loc.city) {
      if (!originMap.has(loc.city)) originMap.set(loc.city, []);
      originMap.get(loc.city).push(row);
    } else {
      countryWide.push(row);
    }

    const recv = receivingLabelFromRow(row);
    if (recv) {
      if (!receivingMap.has(recv)) receivingMap.set(recv, []);
      receivingMap.get(recv).push(row);
    }
  });

  if (countryWide.length) originMap.set(COUNTRY_WIDE_LABEL, countryWide);
  chunkOriginIndexCache.set(countryName, originMap);
  chunkReceivingIndexCache.set(countryName, receivingMap);
}

async function loadChunk(countryName) {
  if (chunkCache.has(countryName)) return chunkCache.get(countryName);
  const url = INDEX?.chunks?.[countryName] || INDEX?.chunks?.["其他"] || "data/chunks/other.json";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${t("couldNotLoadChunk")} (HTTP ${resp.status})`);
  const data = await resp.json();
  const letters = Array.isArray(data) ? data : data.letters || [];
  chunkCache.set(countryName, letters);
  buildChunkIndexes(countryName, letters);
  return letters;
}

function cityLabelFromRow(row, fallbackCountry = "") {
  const cityZh = normalizeCityText(row["寄批地_城市"] || "");
  const cityEn = normalizeCityText(row["寄批地_城市_英文"] || "");
  if (cityZh === "不详" || cityEn === "不详") return "不详";
  if (cityZh && cityEn) return `${cityZh} (${cityEn})`;
  if (cityZh || cityEn) return cityZh || cityEn;
  return "不详";
}

function isValidReceivingPlace(label) {
  const s = String(label || "").trim();
  if (!s || s === "不详") return false;
  if (OVERSEAS_RECV_NAME_RE.test(s)) return false;
  if (["马来西亚", "新加坡", "泰国", "印度尼西亚", "越南"].includes(s)) return false;
  return VALID_RECV_PLACE_RE.test(s);
}

function receivingLabelFromRow(row) {
  const raw = normalizeCityText(row["收批地_标准化"] || row["收批地"] || "");
  if (!isValidReceivingPlace(raw)) return "";
  return raw;
}

function isCountryLikeCityLabel(cityLabel) {
  const label = String(cityLabel || "").trim();
  if (!label || label === "不详") return false;
  const tokens = cityTokensFromLabel(label);
  return tokens.some((t) => {
    const norm = normalizeCountryNameZh(t);
    return Boolean(norm && COUNTRY_ALIAS[norm]);
  });
}

function cityKeyFromLabel(label) {
  return (label || "").toLowerCase().trim();
}

function cityTokensFromLabel(label) {
  const m = (label || "").match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (m) return [m[1], m[2]].map((s) => s.toLowerCase().trim()).filter(Boolean);
  return [(label || "").toLowerCase().trim()].filter(Boolean);
}

async function lettersForCity(countryName, cityLabel) {
  await loadChunk(countryName);
  const indexed = chunkOriginIndexCache.get(countryName);
  if (!indexed) return [];
  return indexed.get(cityLabel) || [];
}

async function lettersForReceivingCity(countryName, recvLabel) {
  await loadChunk(countryName);
  const indexed = chunkReceivingIndexCache.get(countryName);
  if (!indexed) return [];
  return indexed.get(recvLabel) || [];
}

function cityCenterFromLetters(letters) {
  for (const row of letters) {
    const lat = Number(row["寄批地_纬度"]);
    const lng = Number(row["寄批地_经度"]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }
  return null;
}

function receivingCenterFromLetters(letters) {
  for (const row of letters) {
    const lat = Number(row["收批地_纬度"]);
    const lng = Number(row["收批地_经度"]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }
  return null;
}

function receivingCenterForLabel(recvLabel) {
  const meta = getGlobalReceivingMeta(recvLabel);
  if (meta && Number.isFinite(meta.lat) && Number.isFinite(meta.lng)) return [meta.lat, meta.lng];
  return null;
}

function receivingHubRadius(count) {
  return Math.min(12, Math.max(5, 4 + Math.sqrt(count || 1)));
}

function createReceivingHubMarker(center, label, count, onClick) {
  const marker = L.circleMarker(center, {
    radius: receivingHubRadius(count),
    color: RECV_HUB_COLOR,
    weight: 1.2,
    fillColor: RECV_HUB_FILL,
    fillOpacity: 0.9,
  });
  marker.bindTooltip(`${label} · ${Number(count).toLocaleString()}`, { direction: "top", offset: [0, -5], opacity: 0.9 });
  if (onClick) marker.on("click", onClick);
  return marker;
}

function fitMapToReceivingMarkers(latLngs) {
  if (latLngs.length) {
    map.fitBounds(L.latLngBounds(latLngs).pad(0.15), { duration: 0.8 });
  } else {
    map.fitBounds(CHAOSHAN_BOUNDS, { duration: 0.8 });
  }
}

function flyToCountryOverview(countryName) {
  const centroid = COUNTRY_CENTROID[countryName];
  if (!centroid) return;
  const zoom = countryName === "新加坡" || countryName === "香港" ? 8 : 5;
  map.flyTo(centroid, zoom, { duration: 0.8 });
}

function clearReceivingMapLayers() {
  receivingCityMarkerLayer.clearLayers();
  receivingLetterMarkerLayer.clearLayers();
}

function drawReceivingCityMarkersForCountry(countryName) {
  receivingCityMarkerLayer.clearLayers();
  const cities = INDEX?.receivingCitiesByCountry?.[countryName] || [];
  const latLngs = [];
  const cityMetaMap = receivingMetaByCountry.get(countryName) || new Map();

  sortCityLabelsForCountry(
    cities.map((c) => c.label),
    "中国大陆"
  ).forEach((label) => {
    const meta = cityMetaMap.get(label);
    if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return;
    const center = [meta.lat, meta.lng];
    const marker = createReceivingHubMarker(center, label, meta.count, () => selectCity(countryName, label, "receiving"));
    marker.addTo(receivingCityMarkerLayer);
    latLngs.push(center);
  });

  fitMapToReceivingMarkers(latLngs);
}

function drawAllReceivingCityMarkers() {
  receivingCityMarkerLayer.clearLayers();
  const latLngs = [];

  sortCityLabelsForCountry(
    (INDEX?.allReceivingCities || []).map((c) => c.label),
    "中国大陆"
  ).forEach((label) => {
    const meta = getGlobalReceivingMeta(label);
    if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return;
    const center = [meta.lat, meta.lng];
    const marker = createReceivingHubMarker(center, label, meta.count);
    marker.addTo(receivingCityMarkerLayer);
    latLngs.push(center);
  });

  fitMapToReceivingMarkers(latLngs);
}

function updateGlobalReceivingControlState() {
  if (!globalReceivingControlBtn) return;
  globalReceivingControlBtn.style.background = globalReceivingViewActive ? "#e8f5e9" : "#fff8ec";
  globalReceivingControlBtn.style.borderColor = globalReceivingViewActive ? RECV_HUB_COLOR : "#d9c99a";
  updateGlobalReceivingControlText();
}

function updateGlobalReceivingControlText() {
  if (!globalReceivingControlBtn) return;
  globalReceivingControlBtn.textContent = globalReceivingViewActive ? t("receivingControlHide") : t("receivingControlShow");
}

function setGlobalReceivingView(active) {
  showMapLoading();
  globalReceivingViewActive = active;
  updateGlobalReceivingControlState();
  receivingLetterMarkerLayer.clearLayers();
  letterArcLayer.clearLayers();
  activeArcRow = null;
  originCityHighlightLayer.clearLayers();
  receivingLocationHighlightLayer.clearLayers();
  cityMarkerLayer.clearLayers();

  if (active) {
    activeCountryName = null;
    activeCityKey = null;
    activeCityLabel = null;
    if (countryLayer) countryLayer.setStyle(getCountryStyle);
    drawAllReceivingCityMarkers();
    renderSidebarIntro();
    setTimeout(hideMapLoading, 0);
    return;
  }

  clearReceivingMapLayers();
  map.flyTo([20, 108], 3, { duration: 0.8 });
  renderSidebarIntro();
  setTimeout(hideMapLoading, 0);
}

function toggleGlobalReceivingView() {
  setGlobalReceivingView(!globalReceivingViewActive);
}

function addGlobalReceivingControl() {
  const control = L.control({ position: "topright" });
  control.onAdd = function onAdd() {
    const div = L.DomUtil.create("div");
    div.style.background = "rgba(255,255,255,0.92)";
    div.style.padding = "4px";
    div.style.border = "1px solid #c9b98a";
    div.style.borderRadius = "3px";
    const btn = L.DomUtil.create("button", "", div);
    globalReceivingControlBtn = btn;
    btn.type = "button";
    btn.textContent = t("receivingControlShow");
    btn.style.display = "block";
    btn.style.padding = "6px 10px";
    btn.style.border = "1px solid #d9c99a";
    btn.style.borderRadius = "2px";
    btn.style.background = "#fff8ec";
    btn.style.cursor = "pointer";
    btn.style.fontFamily = "'Noto Serif SC', serif";
    btn.style.fontSize = "0.72rem";
    btn.style.color = "#4f3a1f";
    btn.style.whiteSpace = "nowrap";
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.on(btn, "click", (e) => {
      L.DomEvent.stop(e);
      toggleGlobalReceivingView();
    });
    updateGlobalReceivingControlState();
    return div;
  };
  control.addTo(map);
}

function updateCountryMapView(cnName, mode = citySortMode) {
  showMapLoading();
  globalReceivingViewActive = false;
  updateGlobalReceivingControlState();
  receivingLetterMarkerLayer.clearLayers();
  letterArcLayer.clearLayers();
  activeArcRow = null;
  originCityHighlightLayer.clearLayers();
  receivingLocationHighlightLayer.clearLayers();

  if (mode === "receiving") {
    cityMarkerLayer.clearLayers();
    drawReceivingCityMarkersForCountry(cnName);
    setTimeout(hideMapLoading, 0);
    return;
  }

  clearReceivingMapLayers();
  flyToCountryOverview(cnName);
  setTimeout(hideMapLoading, 0);
}

function originLatLngForRow(row) {
  const loc = resolveLocationForRow(row);
  if (loc.coords && isValidLatLng(loc.coords[0], loc.coords[1])) return loc.coords;
  return null;
}

function receivingLatLngForRow(row) {
  const lat = Number(row["收批地_纬度"]);
  const lng = Number(row["收批地_经度"]);
  if (isValidLatLng(lat, lng)) return [lat, lng];
  return null;
}

function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizeLng180(lng) {
  let out = lng;
  while (out > 180) out -= 360;
  while (out < -180) out += 360;
  return out;
}

function curvePoints(from, to, steps = 50) {
  const pts = [];
  const [lat1, lng1Raw] = from;
  const [lat2, lng2Raw] = to;
  const lng1 = normalizeLng180(lng1Raw);
  let lng2 = normalizeLng180(lng2Raw);
  let dLng = lng2 - lng1;
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  lng2 = lng1 + dLng;

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const lift = Math.max(2, Math.min(18, Math.abs(lat2 - lat1) * 0.35 + Math.abs(dLng) * 0.06));
  const cLat = midLat + lift;
  const cLng = midLng;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cLat + t * t * lat2;
    const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * cLng + t * t * lng2;
    if (isValidLatLng(lat, normalizeLng180(lng))) pts.push([lat, normalizeLng180(lng)]);
  }
  return pts;
}

function drawArcForRow(row) {
  letterArcLayer.clearLayers();
  if (!row) return;

  const origin = originLatLngForRow(row);
  const recv = receivingLatLngForRow(row);
  if (!origin || !recv) return;

  const country = getEffectiveCountry(row);
  const color = COUNTRY_ARC_COLOR[country] || "#8b6914";
  const pts = curvePoints(origin, recv, 64);
  if (pts.length < 2) return;
  L.polyline(pts, {
    color,
    weight: 2.8,
    opacity: 0.88,
    smoothFactor: 1,
  }).addTo(letterArcLayer);
}

function countToFromForCity(cityLabel, cityRows, countryName = activeCountryName) {
  const from = cityRows.length;
  const meta = countryName ? getOriginCityMeta(countryName, cityLabel) : null;
  const to = meta?.toCount ?? 0;
  return { from, to };
}

function fillColorForCount(count) {
  if (!count) return "#d8d8d8";
  if (count > 1000) return "#6f2a1d";
  if (count > 500) return "#8d3b21";
  if (count > 150) return "#a74d27";
  return "#bd6335";
}

function getCountryStyle(feature) {
  const cnName = feature.properties.cnName;
  const count = letterCountByCountry.get(cnName) || 0;
  const isSmallCountry = cnName === "新加坡" || cnName === "香港";
  return {
    stroke: isSmallCountry && count > 0,
    color: isSmallCountry && count > 0 ? COUNTRY_ARC_COLOR[cnName] || COUNTRY_COLOR_ACTIVE : "transparent",
    weight: isSmallCountry && count > 0 ? 1.1 : 0,
    fillColor: count > 0 ? COUNTRY_FILL_COLOR[cnName] || fillColorForCount(count) : fillColorForCount(0),
    fillOpacity: count > 0 ? (isSmallCountry ? 0.9 : 0.55) : 0.08,
  };
}

function renderSidebarIntro() {
  activeCityLabel = null;
  setSidebarHeader(
    t("countryView"),
    "",
    t("clickCountryHint"),
    buildCountrySelectHtml("")
  );
  document.getElementById("timeline").innerHTML = `<div class="intro"><div class="intro-icon">✦</div><p>${escapeHtml(t("loadedLetters", { count: totalLetterCount }))}</p></div>`;
  const detailPanel = document.getElementById("detailPanel");
  if (detailPanel) {
    detailPanel.innerHTML = "";
    detailPanel.classList.remove("open");
    detailPanel.style.display = "none";
  }
}

function renderCountrySidebar(cnName) {
  activeCityLabel = null;
  const count = letterCountByCountry.get(cnName) || 0;
  const originCities = sortCityLabelsForCountry(Array.from(citiesByCountry.get(cnName) || []), cnName);
  const receivingCities = sortCityLabelsForCountry(Array.from(receivingCitiesByCountry.get(cnName) || []), "中国大陆");
  const mode = citySortMode === "receiving" ? "receiving" : "origin";
  const fullCityList = mode === "origin" ? originCities : receivingCities;
  const collapsedReceiving = mode === "receiving" && !expandedReceivingCountries.has(cnName);
  const cityList = collapsedReceiving ? fullCityList.slice(0, RECEIVING_CITY_LIST_LIMIT) : fullCityList;
  const cityItems = cityList.length
    ? cityList
        .map(
          (city) =>
            `<button class="letter-card city-row" data-city="${encodeURIComponent(city)}" data-mode="${mode}" style="width:100%;text-align:left;border:none;background:transparent;">
              <div class="card-body">
                <div class="card-amount">${escapeHtml(displayCityLabel(city, cnName))}</div>
                <div class="card-meta">${
                  mode === "origin"
                    ? escapeHtml(t("clickSentCity"))
                    : escapeHtml(t("clickReceivingCity"))
                }</div>
              </div>
            </button>`
        )
        .join("")
    : `<div style="padding:20px;color:#9a7840;font-style:italic;font-size:0.82rem;text-align:center;">${escapeHtml(t("noCityInfo"))}</div>`;
  const showMoreBtn =
    mode === "receiving" && collapsedReceiving && fullCityList.length > RECEIVING_CITY_LIST_LIMIT
      ? `<button id="showMoreReceivingCities" class="letter-card" style="width:100%;text-align:left;border:1px solid #d9c99a;background:#f7f0df;cursor:pointer;">
          <div class="card-body">
            <div class="card-amount">+ ${fullCityList.length - cityList.length}</div>
            <div class="card-meta">${escapeHtml(t("receivingCities"))}</div>
          </div>
        </button>`
      : "";

  setSidebarHeader(
    t("countryDetail"),
    "",
    t("totalLetters", { count }),
    buildCountrySelectHtml(cnName)
  );

  document.getElementById("timeline").innerHTML = `
    <div style="display:flex;gap:6px;margin:2px 0 10px;">
      <button id="cityModeOrigin" style="flex:1;padding:6px 8px;border:1px solid #d9c99a;background:${
        mode === "origin" ? "#f1e4c6" : "#fff8ec"
      };cursor:pointer;font-family:'Noto Serif SC',serif;font-size:0.72rem;color:#4f3a1f;">${escapeHtml(t("sentFromCities"))}</button>
      <button id="cityModeReceiving" style="flex:1;padding:6px 8px;border:1px solid #d9c99a;background:${
        mode === "receiving" ? "#f1e4c6" : "#fff8ec"
      };cursor:pointer;font-family:'Noto Serif SC',serif;font-size:0.72rem;color:#4f3a1f;">${escapeHtml(t("receivingCities"))}</button>
    </div>
    <div class="year-label">${escapeHtml(mode === "origin" ? t("sentFromCities") : t("receivingCities"))} · ${fullCityList.length}</div>
    ${showMoreBtn}
    ${cityItems}`;

  const modeOriginBtn = document.getElementById("cityModeOrigin");
  const modeRecvBtn = document.getElementById("cityModeReceiving");
  if (modeOriginBtn) {
    modeOriginBtn.addEventListener("click", () => {
      citySortMode = "origin";
      renderCountrySidebar(cnName);
    });
  }
  if (modeRecvBtn) {
    modeRecvBtn.addEventListener("click", () => {
      citySortMode = "receiving";
      renderCountrySidebar(cnName);
    });
  }
  const showMore = document.getElementById("showMoreReceivingCities");
  if (showMore) {
    showMore.addEventListener("click", () => {
      expandedReceivingCountries.add(cnName);
      renderCountrySidebar(cnName);
    });
  }

  document.querySelectorAll(".city-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const city = decodeURIComponent(btn.dataset.city || "");
      const clickedMode = btn.dataset.mode || "origin";
      selectCity(cnName, city, clickedMode);
    });
  });
  updateCountryMapView(cnName, mode);
  if (senderSearchQuery.trim()) renderSearchResults();
}

function wireBackToCities(countryName, mode = citySortMode) {
  const backBtn = document.getElementById("backToCitiesBtn");
  if (!backBtn) return;
  backBtn.addEventListener("click", () => {
    activeCityKey = null;
    activeCityLabel = null;
    activeCitySenderStats = [];
    activeCitySenderVisible = CITY_SENDER_PAGE_SIZE;
    cityMarkerLayer.clearLayers();
    receivingLetterMarkerLayer.clearLayers();
    citySortMode = mode;
    renderCountrySidebar(countryName);
    const detailPanel = document.getElementById("detailPanel");
    if (detailPanel) {
      detailPanel.innerHTML = "";
      detailPanel.classList.remove("open");
      detailPanel.style.display = "none";
    }
  });
}

function buildSenderStats(cityLetters) {
  const counts = new Map();
  cityLetters.forEach((row) => {
    const name = String(row["寄批人"] || "").trim() || "—";
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || ZH_COLLATOR.compare(a.name, b.name));
}

function renderCitySenderList() {
  const wrap = document.getElementById("citySenderList");
  const moreBtn = document.getElementById("citySenderMoreBtn");
  if (!wrap || !moreBtn) return;
  const visible = activeCitySenderStats.slice(0, activeCitySenderVisible);
  wrap.innerHTML = visible
    .map(
      (item) => `
      <div class="letter-card" style="width:100%;text-align:left;border:1px solid #e1d5b2;background:#fbf6ea;cursor:default;">
        <div class="card-body">
          <div class="card-amount">${escapeHtml(item.name)}</div>
          <div class="card-meta">${escapeHtml(t("senderLettersCount", { name: item.name, count: item.count }))}</div>
        </div>
      </div>`
    )
    .join("");

  const remaining = Math.max(0, activeCitySenderStats.length - activeCitySenderVisible);
  if (remaining <= 0) {
    moreBtn.style.display = "none";
    return;
  }
  const step = Math.min(CITY_SENDER_PAGE_SIZE, remaining);
  moreBtn.style.display = "block";
  moreBtn.innerHTML = `
    <div class="card-body">
      <div class="card-amount">+ ${step}</div>
      <div class="card-meta">${escapeHtml(t("showMoreSenders", { step, remaining }))}</div>
    </div>`;
  moreBtn.onclick = () => {
    activeCitySenderVisible += CITY_SENDER_PAGE_SIZE;
    renderCitySenderList();
  };
}

function markerOffsetMeters(index) {
  if (index === 0) return [0, 0];
  const angle = index * 2.399963229728653;
  const radius = 35 + 9 * Math.sqrt(index);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function offsetLatLng(baseLat, baseLng, eastMeters, northMeters) {
  const dLat = northMeters / 111320;
  const dLng = eastMeters / (111320 * Math.cos((baseLat * Math.PI) / 180));
  return [baseLat + dLat, baseLng + dLng];
}

function renderLetterMarkers(cityLetters, center, countryName = "", targetLayer = cityMarkerLayer) {
  targetLayer.clearLayers();
  const strokeColor = COUNTRY_ARC_COLOR[countryName] || "#7b2d8b";
  const fillColor = COUNTRY_FILL_COLOR[countryName] || "#c9872a";
  const total = cityLetters.length;
  const hubRadius = Math.min(18, Math.max(10, 6 + Math.sqrt(total) * 0.35));

  const hub = L.circleMarker(center, {
    radius: hubRadius,
    color: strokeColor,
    weight: 2.4,
    fillColor,
    fillOpacity: 0.72,
  });
  hub.bindTooltip(`${Number(total).toLocaleString()}`, { direction: "top", offset: [0, -6], opacity: 0.92 });
  hub.addTo(targetLayer);

  if (total <= MAX_MAP_MARKERS) {
    cityLetters.forEach((row, idx) => {
      const [dx, dy] = markerOffsetMeters(idx);
      const [lat, lng] = offsetLatLng(center[0], center[1], dx, dy);
      const marker = L.circleMarker([lat, lng], {
        radius: 5,
        color: strokeColor,
        weight: 1.2,
        fillColor,
        fillOpacity: 0.9,
      });
      marker.on("click", () => showLetterDetail(row));
      marker.addTo(targetLayer);
    });
  }
}

function showLetterDetail(row) {
  const detailPanel = document.getElementById("detailPanel");
  if (!detailPanel) return;
  detailPanel.style.display = "block";
  detailPanel.classList.add("open");
  detailPanel.innerHTML = `
    <div class="detail-title">${escapeHtml(t("letterDetail"))} · EID ${row["EID"] || "—"}</div>
    <div class="detail-grid">
      <div class="df"><label>${escapeHtml(t("fieldCountry"))}</label><span>${getEffectiveCountry(row) || row["寄批地_国家"] || row["寄批地"] || "—"}</span></div>
      <div class="df"><label>${escapeHtml(t("fieldCity"))}</label><span>${cityLabelFromRow(row, "—") || "—"}</span></div>
      <div class="df"><label>${escapeHtml(t("fieldSender"))}</label><span>${row["寄批人"] || "—"}</span></div>
      <div class="df"><label>${escapeHtml(t("fieldRecipient"))}</label><span>${row["收批人"] || "—"}</span></div>
      <div class="df"><label>${escapeHtml(t("fieldDestination"))}</label><span>${receivingLabelFromRow(row) || row["收批地"] || "—"}</span></div>
      <div class="df"><label>${escapeHtml(t("fieldDate"))}</label><span>${row["寄批时间"] || "—"}</span></div>
      <div class="df"><label>${escapeHtml(t("fieldType"))}</label><span>${row["类别"] || "—"}</span></div>
      <div class="df"><label>${escapeHtml(t("fieldBureau"))}</label><span>${row["寄批地_批局"] || "—"}</span></div>
    </div>`;
  activeArcRow = row;
  drawArcForRow(activeArcRow);
}

function highlightOriginCity(row) {
  originCityHighlightLayer.clearLayers();
  receivingLocationHighlightLayer.clearLayers();
  const lat = Number(row["寄批地_纬度"]);
  const lng = Number(row["寄批地_经度"]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const cityName = cityLabelFromRow(row, getEffectiveCountry(row) || t("unknownCity"));
  const marker = L.circleMarker([lat, lng], {
    radius: 10,
    color: "#1a5276",
    weight: 2.5,
    fillColor: "#c9a84c",
    fillOpacity: 0.55,
  }).addTo(originCityHighlightLayer);
  marker.bindTooltip(cityName, { direction: "top", offset: [0, -5], opacity: 0.9 }).openTooltip();
  map.flyTo([lat, lng], 8, { duration: 0.75 });
  activeArcRow = row;
  drawArcForRow(activeArcRow);
}

function highlightReceivingLocation(row) {
  receivingLocationHighlightLayer.clearLayers();
  originCityHighlightLayer.clearLayers();
  const lat = Number(row["收批地_纬度"]);
  const lng = Number(row["收批地_经度"]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const recvName = receivingLabelFromRow(row) || row["收批地"] || t("fieldDestination");
  const marker = L.circleMarker([lat, lng], {
    radius: 10,
    color: "#1a6b3a",
    weight: 2.5,
    fillColor: "#7fcf9a",
    fillOpacity: 0.55,
  }).addTo(receivingLocationHighlightLayer);
  marker.bindTooltip(recvName, { direction: "top", offset: [0, -5], opacity: 0.9 }).openTooltip();
  map.flyTo([lat, lng], 10, { duration: 0.75 });
  activeArcRow = row;
  drawArcForRow(activeArcRow);
}

function renderSearchResults() {
  const q = senderSearchQuery.trim();
  if (!q) {
    if (activeCountryName && activeCityLabel) {
      selectCity(activeCountryName, activeCityLabel, citySortMode);
      return;
    }
    if (activeCountryName) {
      renderCountrySidebar(activeCountryName);
      return;
    }
    renderSidebarIntro();
    return;
  }

  const qLower = q.toLowerCase();
  const results = [];
  (INDEX?.search || []).forEach((entry) => {
    const target = searchMode === "sender" ? String(entry.sender || "") : String(entry.recipient || "");
    if (!target) return;
    if (target.includes(q) || target.toLowerCase().includes(qLower)) results.push(entry);
  });

  const resultHtml = results.length
    ? results
        .slice(0, 400)
        .map((entry) => {
          const sender = entry.sender || "—";
          const recipient = entry.recipient || "—";
          const city = entry.city || "—";
          const recv = entry.recv || "—";
          const date = entry.date || t("dateUnknown");
          const eid = entry.eid || entry.idx;
          const title = searchMode === "sender" ? sender : recipient;
          const subline =
            searchMode === "sender"
              ? `${city} · ${date} · EID ${eid}`
              : `${recv} · ${date} · EID ${eid}`;
          return `<button class="letter-card sender-result-row" data-country="${escapeHtml(entry.country)}" data-idx="${entry.idx}" style="width:100%;text-align:left;border:none;background:transparent;">
            <div class="card-body">
              <div class="card-amount">${escapeHtml(title)}</div>
              <div class="card-meta">${escapeHtml(subline)}</div>
            </div>
          </button>`;
        })
        .join("")
    : `<div style="padding:20px;color:#9a7840;font-style:italic;font-size:0.82rem;text-align:center;">${escapeHtml(
        t("noMatches", { mode: searchMode === "sender" ? t("sender") : t("recipient") })
      )}</div>`;

  document.getElementById("timeline").innerHTML = `
    <div class="year-label">${escapeHtml(searchMode === "sender" ? t("senderMatches") : t("recipientMatches"))} · ${results.length}</div>
    ${resultHtml}`;

  document.querySelectorAll(".sender-result-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const country = btn.dataset.country || "";
      if (!Number.isFinite(idx) || !country) return;
      loadChunk(country)
        .then((chunk) => {
          const row = chunk[idx];
          if (!row) return;
          if (searchMode === "sender") highlightOriginCity(row);
          else highlightReceivingLocation(row);
        })
        .catch((err) => console.error(err));
    });
  });
}

async function selectCity(countryName, cityLabel, mode = citySortMode) {
  showMapLoading();
  globalReceivingViewActive = false;
  updateGlobalReceivingControlState();
  citySortMode = mode === "receiving" ? "receiving" : "origin";
  const isReceivingMode = citySortMode === "receiving";
  const isCountryWide = isCountryWideLabel(cityLabel);
  const isUnknownCity = cityLabel === "不详";

  activeCityKey = cityKeyFromLabel(cityLabel);
  activeCityLabel = cityLabel;
  activeCountryName = countryName;

  const timelineEl = document.getElementById("timeline");
  if (timelineEl && !isUnknownCity && !isCountryWide) {
    timelineEl.innerHTML = `<div class="intro"><div class="intro-icon">✦</div><p>${escapeHtml(t("loadingCity"))}</p></div>`;
  }

  let cityLetters = [];
  try {
    cityLetters = isReceivingMode
      ? await lettersForReceivingCity(countryName, cityLabel)
      : await lettersForCity(countryName, cityLabel);
  } catch (err) {
    if (timelineEl) {
      timelineEl.innerHTML = `<div class="intro"><div class="intro-icon">✦</div><p style="color:#8b4513">${escapeHtml(err.message)}</p></div>`;
    }
    console.error(err);
    hideMapLoading();
    return;
  }
  if (!cityLetters.length) {
    hideMapLoading();
    return;
  }
  activeCitySenderStats = buildSenderStats(cityLetters);
  activeCitySenderVisible = CITY_SENDER_PAGE_SIZE;
  if (countryLayer) countryLayer.setStyle(getCountryStyle);

  if (isUnknownCity || isCountryWide) {
    cityMarkerLayer.clearLayers();
    receivingLetterMarkerLayer.clearLayers();
    if (isReceivingMode) receivingCityMarkerLayer.clearLayers();
    originCityHighlightLayer.clearLayers();
    receivingLocationHighlightLayer.clearLayers();
    letterArcLayer.clearLayers();
    activeArcRow = null;
    if (isReceivingMode) {
      map.fitBounds(CHAOSHAN_BOUNDS, { duration: 0.8 });
    } else {
      const centroid = COUNTRY_CENTROID[countryName];
      if (centroid) map.flyTo(centroid, 5, { duration: 0.8 });
    }
  } else {
    const meta = isReceivingMode
      ? getReceivingCityMeta(countryName, cityLabel)
      : getOriginCityMeta(countryName, cityLabel);
    const center = meta && Number.isFinite(meta.lat) && Number.isFinite(meta.lng)
      ? [meta.lat, meta.lng]
      : isReceivingMode
        ? receivingCenterFromLetters(cityLetters)
        : cityCenterFromLetters(cityLetters);
    if (center) {
      map.flyTo(center, isReceivingMode ? 10 : 9, { duration: 0.8 });
      if (isReceivingMode) {
        cityMarkerLayer.clearLayers();
        receivingCityMarkerLayer.clearLayers();
        const hubCount = receivingCityCountsByCountry.get(countryName)?.get(cityLabel) ?? cityLetters.length;
        L.circleMarker(center, {
          radius: 14,
          color: RECV_HUB_COLOR,
          weight: 2.5,
          fillColor: RECV_HUB_FILL,
          fillOpacity: 0.55,
        })
          .bindTooltip(`${cityLabel} · ${Number(hubCount).toLocaleString()}`, { direction: "top", offset: [0, -5], opacity: 0.9 })
          .addTo(receivingCityMarkerLayer);
        renderLetterMarkers(cityLetters, center, countryName, receivingLetterMarkerLayer);
      } else {
        clearReceivingMapLayers();
        renderLetterMarkers(cityLetters, center, countryName, cityMarkerLayer);
      }
    } else {
      cityMarkerLayer.clearLayers();
      if (isReceivingMode) clearReceivingMapLayers();
    }
  }

  const { from, to } = countToFromForCity(cityLabel, cityLetters);
  setSidebarHeader(
    t("cityDetail"),
    displayCityLabel(cityLabel, countryName),
    `${countryName} · ${t("totalLetters", { count: cityLetters.length })}`,
    buildCountrySelectHtml(countryName)
  );

  document.getElementById("timeline").innerHTML = `
    <div class="year-label">${escapeHtml(t("cityOverview"))}</div>
    <button id="backToCitiesBtn" class="letter-card" style="width:100%;text-align:left;border:1px solid #d9c99a;background:#f7f0df;cursor:pointer;">
      <div class="card-body">
        <div class="card-amount">${escapeHtml(t("backToCityList"))}</div>
        <div class="card-meta">${escapeHtml(t("returnToCities", { country: countryName, mode: isReceivingMode ? t("receivingPlace") : t("sentPlace") }))}</div>
      </div>
    </button>
    <div class="letter-card">
      <div class="card-body">
        <div class="card-amount">${
          isReceivingMode
            ? escapeHtml(t("lettersReceivedInCity", { count: cityLetters.length }))
            : escapeHtml(t("lettersFromCity", { count: from }))
        }</div>
        <div class="card-meta">${
          isReceivingMode
            ? escapeHtml(t("originCountry", { country: countryName }))
            : escapeHtml(t("lettersToCity", { count: to }))
        }</div>
      </div>
    </div>
    <div class="letter-card">
      <div class="card-body">
        <div class="card-meta">${
          isUnknownCity || isCountryWide
            ? escapeHtml(t("noPreciseCity"))
            : cityLetters.length > MAX_MAP_MARKERS
              ? escapeHtml(t("mapHubOnly", { count: cityLetters.length }))
              : escapeHtml(t("markersOnMap", { count: cityLetters.length }))
        }</div>
        <div class="card-meta">${
          isUnknownCity || isCountryWide
            ? escapeHtml(t("clickSearchForRoute"))
            : escapeHtml(t("clickMarkerDetail"))
        }</div>
      </div>
    </div>
    <div class="year-label">${escapeHtml(t("topSenders", { count: Math.min(activeCitySenderVisible, activeCitySenderStats.length) }))}</div>
    <div id="citySenderList"></div>
    <button id="citySenderMoreBtn" class="letter-card" style="width:100%;text-align:left;border:1px solid #d9c99a;background:#f7f0df;cursor:pointer;"></button>`;
  wireBackToCities(countryName, citySortMode);
  renderCitySenderList();

  const detailPanel = document.getElementById("detailPanel");
  if (detailPanel) {
    detailPanel.innerHTML = "";
    detailPanel.classList.remove("open");
    detailPanel.style.display = "none";
  }
  if (senderSearchQuery.trim()) renderSearchResults();
  hideMapLoading();
}

function onEachCountry(feature, layer) {
  const cnName = feature.properties.cnName;
  const count = letterCountByCountry.get(cnName) || 0;
  if (!count) return;

  layer.on("mouseover", () => {
    if (activeCountryName !== cnName) layer.setStyle({ stroke: false, weight: 0, color: "transparent", fillOpacity: 0.65 });
  });
  layer.on("mouseout", () => {
    if (countryLayer) countryLayer.resetStyle(layer);
  });
  layer.on("click", () => {
    selectCountryFromSidebar(cnName);
  });
}

map.on("moveend zoomend", () => {
  if (activeArcRow) drawArcForRow(activeArcRow);
});

async function loadAndRenderCountries() {
  await ensureTopojsonClient();
  const [topologyResp, namesResp] = await Promise.all([fetch(COUNTRY_BOUNDS_URL), fetch(COUNTRY_NAMES_TSV_URL)]);
  if (!topologyResp.ok) throw new Error(`${t("couldNotLoadBoundaries")} (HTTP ${topologyResp.status}).`);
  if (!namesResp.ok) throw new Error(`${t("couldNotLoadNames")} (HTTP ${namesResp.status}).`);

  const topology = await topologyResp.json();
  const namesTsv = await namesResp.text();
  const idNameMap = parseCountryNamesTsv(namesTsv);
  const geojson = window.topojson.feature(topology, topology.objects.countries);

  geojson.features.forEach((f) => {
    const fid = String(f.id);
    const atlasName = idNameMap.get(fid) || idNameMap.get(String(Number(fid))) || COUNTRY_ID_OVERRIDES[fid] || "";
    const cnName = FEATURE_ID_TO_CN[fid] || atlasToChineseCountry(atlasName);
    f.properties = { ...(f.properties || {}), atlasName, cnName };
  });

  countryLayer = L.geoJSON(geojson, {
    style: getCountryStyle,
    onEachFeature: onEachCountry,
  }).addTo(map);
  drawCountryFallbackHighlights();
}

function hideUnusedSidebarUI() {
  const statsBar = document.getElementById("statsBar");
  const detailPanel = document.getElementById("detailPanel");
  const filterRow = document.querySelector(".filter-row");
  if (statsBar) statsBar.style.display = "none";
  if (detailPanel) {
    detailPanel.classList.remove("open");
    detailPanel.style.display = "none";
  }
  if (filterRow) filterRow.style.display = "none";
}

function toggleCorridor() {}
function setTab() {}
function selectLetter() {}

async function startApp() {
  hideUnusedSidebarUI();
  renderSidebarIntro();
  addMarkerLegend();
  addGlobalReceivingControl();
  await loadAndRenderCountries();
}

setupLanguageSelector();

function loadSearchIndex() {
  return fetch(DATA_SEARCH_URL)
    .then((r) => {
      if (!r.ok) return null;
      return r.json();
    })
    .then((data) => {
      if (data && INDEX) INDEX.search = data.search || [];
    })
    .catch((err) => console.warn("Search index load failed", err));
}

showMapLoading();
fetch(DATA_INDEX_URL)
  .then((r) => {
    if (!r.ok) throw new Error(`${t("couldNotLoadIndex")} (HTTP ${r.status}).`);
    return r.json();
  })
  .then(async (index) => {
    INDEX = index;
    INDEX.search = [];
    totalLetterCount = index.totalCount || 0;
    applyIndexStats();
    await startApp();
    loadSearchIndex();
    hideMapLoading();
  })
  .catch((err) => {
    document.getElementById("timeline").innerHTML = `<div class="intro"><div class="intro-icon">✦</div><p style="color:#8b4513">${escapeHtml(err.message)}</p><p style="margin-top:14px;font-size:0.78rem;line-height:1.6;">${escapeHtml(t("loadingErrorHelp"))}</p></div>`;
    console.error(err);
    hideMapLoading();
  });
