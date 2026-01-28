WidgetMetadata = {
    id: "danmu_api_ultimate",
    title: "多源弹幕 (繁简转换版)",
    version: "2.0.0",
    requiredVersion: "0.0.1",
    description: "聚合多源弹幕，支持繁简互转。",
    author: "MakkaPakka",
    site: "https://github.com/h05n/ForwardWidgets",
    globalParams: [
        // --- 弹幕源配置 (同模块A) ---
        { name: "server", title: "源1 (必填)", type: "input", value: "https://api.dandanplay.net" },
        { name: "server2", title: "源2", type: "input" },
        { name: "server3", title: "源3", type: "input" },
        { name: "server4", title: "源4", type: "input" },
        // --- 功能配置 (来自模块B) ---
        {
            name: "convertMode",
            title: "🔠 弹幕转换",
            type: "enumeration",
            value: "none",
            enumOptions: [
                { title: "保持原样", value: "none" },
                { title: "转简体 (繁->简)", value: "t2s" },
                { title: "转繁体 (简->繁)", value: "s2t" }
            ]
        }
    ],
    modules: [
        { id: "searchDanmu", title: "搜索", functionName: "searchDanmu", type: "danmu", params: [] },
        { id: "getDetail", title: "详情", functionName: "getDetailById", type: "danmu", params: [] },
        { id: "getComments", title: "弹幕", functionName: "getCommentsById", type: "danmu", params: [] }
    ]
};

// ==========================================
// 1. 繁简转换核心 (移植自模块B)
// ==========================================
const DICT_URL_S2T = "https://cdn.jsdelivr.net/npm/opencc-data@1.0.3/data/STCharacters.txt";
const DICT_URL_T2S = "https://cdn.jsdelivr.net/npm/opencc-data@1.0.3/data/TSCharacters.txt";
let MEM_S2T_MAP = null;
let MEM_T2S_MAP = null;

async function initDict(mode) {
    if (!mode || mode === "none") return;
    if (mode === "s2t" && MEM_S2T_MAP) return;
    if (mode === "t2s" && MEM_T2S_MAP) return;

    const storageKey = `dict_${mode}_v1`;
    let localData = await Widget.storage.get(storageKey);

    if (!localData) {
        try {
            console.log(`[Dict] Downloading ${mode}...`);
            const res = await Widget.http.get(mode === "s2t" ? DICT_URL_S2T : DICT_URL_T2S);
            let textData = res.data || res;
            if (typeof textData === 'string' && textData.length > 100) {
                const mapObj = parseDictText(textData);
                await Widget.storage.set(storageKey, JSON.stringify(mapObj));
                if (mode === "s2t") MEM_S2T_MAP = mapObj; else MEM_T2S_MAP = mapObj;
            }
        } catch (e) { console.error("Dict download failed", e); }
    } else {
        try {
            const mapObj = JSON.parse(localData);
            if (mode === "s2t") MEM_S2T_MAP = mapObj; else MEM_T2S_MAP = mapObj;
        } catch (e) { await Widget.storage.remove(storageKey); }
    }
}

function parseDictText(text) {
    const map = {};
    text.split('\n').forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) map[parts[0]] = parts[1];
    });
    return map;
}

function convertText(text, mode) {
    if (!text || !mode || mode === "none") return text;
    const dict = (mode === "s2t") ? MEM_S2T_MAP : MEM_T2S_MAP;
    if (!dict) return text;
    return text.split('').map(char => dict[char] || char).join('');
}

// ==========================================
// 2. 基础工具 (模块A风格)
// ==========================================
function normalizeServer(s) {
    return s && typeof s === "string" && !s.includes("{") ? s.trim().replace(/\/+$/, "") : "";
}

function getServersFromParams(params) {
    return [params.server, params.server2, params.server3, params.server4]
        .map(normalizeServer).filter(s => /^https?:\/\//i.test(s));
}

async function safeGet(url) {
    try {
        const res = await Widget.http.get(url, { headers: { "User-Agent": "ForwardWidgets/2.0" } });
        const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        return { ok: true, data };
    } catch (e) { return { ok: false }; }
}

// ==========================================
// 3. 核心业务逻辑
// ==========================================

async function searchDanmu(params) {
    const { title, season } = params;
    const servers = getServersFromParams(params);
    if (!servers.length) return { animes: [] };

    const tasks = servers.map(server => 
        safeGet(`${server}/api/v2/search/anime?keyword=${encodeURIComponent(title)}`)
    );
    const results = await Promise.all(tasks);

    let animes = [];
    results.forEach((r, i) => {
        if (r.ok && r.data?.animes) {
            // 给每个 animeID 加上 server 前缀，方便后续 getDetail 知道去哪里取
            const prefix = servers[i];
            const taggedAnimes = r.data.animes.map(a => ({
                ...a,
                animeId: `${prefix}|${a.animeId}` // 关键：标记来源
            }));
            animes = animes.concat(taggedAnimes);
        }
    });

    return { animes }; // 这里简化了 season 匹配逻辑，如有需要可再加回 matchSeason
}

async function getDetailById(params) {
    const { animeId } = params;
    // 解析 server|realId
    const parts = animeId.split('|');
    const realId = parts.pop();
    const serverUrl = parts.join('|'); // 防止 URL 本身含 |

    if (!serverUrl) return [];

    const res = await safeGet(`${serverUrl}/api/v2/bangumi/${realId}`);
    if (!res.ok || !res.data?.bangumi?.episodes) return [];

    // 给 episodeId 也加上前缀
    return res.data.bangumi.episodes.map(ep => ({
        ...ep,
        episodeId: `${serverUrl}|${ep.episodeId}`
    }));
}

async function getCommentsById(params) {
    const { commentId, convertMode } = params;
    if (!commentId) return null;

    // 1. 预加载字典 (异步)
    await initDict(convertMode);

    // 2. 解析来源
    const parts = commentId.split('|');
    const realId = parts.pop();
    const serverUrl = parts.join('|');

    if (!serverUrl) return null;

    // 3. 请求弹幕
    // chConvert=0: 告诉服务端不要转，我们自己转
    const res = await safeGet(`${serverUrl}/api/v2/comment/${realId}?withRelated=true&chConvert=0`);
    
    if (!res.ok || !res.data) return null;

    let base = res.data;
    
    // 4. 执行转换
    if (convertMode !== "none") {
        const list = base.danmakus || base.comments || [];
        list.forEach(d => {
            // 弹幕内容字段通常是 m 或 p (p有时候包含内容)
            // dandanplay 标准: p="时间,类型...", m="内容"
            if (d.m) d.m = convertText(d.m, convertMode);
            // 有些旧接口可能用 message
            if (d.message) d.message = convertText(d.message, convertMode);
        });
    }

    return base;
}
