WidgetMetadata = {
    id: "asian_streaming_hub",
    title: "亚洲热播 & 更新表",
    author: "Makkapakka",
    description: "聚合腾讯、爱奇艺、优酷、芒果、ViuTV、LineTV 等平台热播榜单与更新日历。",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",

    modules: [
        // ===========================================
        // 模块 1: 各大平台热播榜
        // ===========================================
        {
            title: "📺 平台热播榜",
            functionName: "loadPlatformHot",
            type: "list",
            cacheDuration: 3600,
            params: [
                {
                    name: "platform",
                    title: "选择平台",
                    type: "enumeration",
                    value: "tencent",
                    enumOptions: [
                        { title: "🐧 腾讯视频 (Tencent)", value: "tencent" },
                        { title: "🥝 爱奇艺 (iQIYI)", value: "iqiyi" },
                        { title: "🎬 优酷 (Youku)", value: "youku" },
                        { title: "🟠 芒果TV (Mango)", value: "mango" },
                        { title: "🔷 ViuTV (香港)", value: "viutv" },
                        { title: "🟢 LINE TV (台湾)", value: "linetv" },
                        { title: "🔴 Netflix (华语区)", value: "netflix_zh" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        },

        // ===========================================
        // 模块 2: 华语剧集日历
        // ===========================================
        {
            title: "📅 每日更新 (华语)",
            functionName: "loadDailyCalendar",
            type: "list",
            cacheDuration: 1800,
            params: [
                {
                    name: "dayOffset",
                    title: "日期选择",
                    type: "enumeration",
                    value: "0",
                    enumOptions: [
                        { title: "🔥 今天更新", value: "0" },
                        { title: "🔙 昨天回顾", value: "-1" },
                        { title: "🔜 明天预告", value: "1" },
                        { title: "📆 本周热门", value: "week" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        },

        // ===========================================
        // 模块 3: ViuTV 实时节目表 (API直连)
        // ===========================================
        {
            title: "🔷 ViuTV 节目表",
            functionName: "loadViuTVSchedule",
            type: "list",
            cacheDuration: 600
        }
    ]
};

// =========================================================================
// 0. 核心配置与工具
// =========================================================================

// TMDB Network IDs (这些 ID 对应各家公司)
const NETWORK_IDS = {
    tencent: "2606|4698",  // Tencent Video
    iqiyi: "2280|4854",    // iQIYI
    youku: "3046",         // Youku
    mango: "2112|3823",    // Mango TV
    viutv: "2650",         // ViuTV
    linetv: "2654",        // LINE TV
    netflix_zh: "213"      // Netflix (配合语言筛选)
};

const GENRE_MAP = {
    18: "剧情", 35: "喜剧", 10759: "动作冒险", 10765: "科幻奇幻", 
    9648: "悬疑", 10749: "爱情", 80: "犯罪", 16: "动画", 10768: "战争"
};

function getGenreText(ids) {
    if (!ids || !Array.isArray(ids)) return "";
    return ids.map(id => GENRE_MAP[id]).filter(Boolean).slice(0, 2).join(" / ");
}

function buildItem({ id, tmdbId, type, title, year, poster, backdrop, rating, genreText, subTitle, desc }) {
    return {
        id: String(id),
        tmdbId: parseInt(tmdbId),
        type: "tmdb",
        mediaType: type || "tv",
        title: title,
        genreTitle: [year, genreText].filter(Boolean).join(" • "),
        subTitle: subTitle,
        posterPath: poster ? `https://image.tmdb.org/t/p/w500${poster}` : "",
        backdropPath: backdrop ? `https://image.tmdb.org/t/p/w780${backdrop}` : "",
        description: desc || "暂无简介",
        rating: rating ? Number(rating).toFixed(1) : "0.0",
        year: year
    };
}

// =========================================================================
// 1. 平台热播榜 (基于 TMDB Discovery)
// =========================================================================

async function loadPlatformHot(params = {}) {
    const { platform = "tencent", page = 1 } = params;
    const networkId = NETWORK_IDS[platform];

    let queryParams = {
        language: "zh-CN",
        page: page,
        sort_by: "popularity.desc",
        include_adult: false,
        "vote_count.gte": 5, // 过滤极冷门
        with_original_language: platform === 'netflix_zh' ? "zh" : undefined // Netflix 只看华语
    };

    if (networkId) {
        queryParams.with_networks = networkId;
    }
    
    // 针对台湾平台的特殊优化
    if (platform === 'linetv') {
        queryParams.with_original_language = "zh|ko|th"; // LineTV 主要是台剧、韩剧、泰剧
    }

    try {
        const res = await Widget.tmdb.get("/discover/tv", { params: queryParams });
        const data = res || {};
        if (!data.results) return [];

        return data.results.map(item => {
            return buildItem({
                id: item.id,
                tmdbId: item.id,
                type: "tv",
                title: item.name || item.title,
                year: (item.first_air_date || "").substring(0, 4),
                poster: item.poster_path,
                backdrop: item.backdrop_path,
                rating: item.vote_average,
                genreText: getGenreText(item.genre_ids),
                subTitle: `🔥 热度 ${Math.round(item.popularity)}`,
                desc: item.overview
            });
        });
    } catch (e) { return [{ id: "err", type: "text", title: "加载失败" }]; }
}

// =========================================================================
// 2. 华语剧集日历
// =========================================================================

async function loadDailyCalendar(params = {}) {
    const { dayOffset = "0", page = 1 } = params;

    let dateStr = "";
    let queryParams = {
        language: "zh-CN",
        page: page,
        with_original_language: "zh", // 只要华语剧
        include_null_first_air_dates: false,
        sort_by: "popularity.desc"
    };

    if (dayOffset === "week") {
        // 本周热门
        const d = new Date();
        d.setDate(d.getDate() - 7);
        queryParams["first_air_date.gte"] = d.toISOString().split('T')[0];
        queryParams["vote_count.gte"] = 10;
    } else {
        // 具体某一天
        const d = new Date();
        d.setDate(d.getDate() + parseInt(dayOffset));
        dateStr = d.toISOString().split('T')[0];
        
        // TMDB 很难精确筛选“单集更新”，我们用“首播日期”或“正在播出”来模拟
        // 这里采用策略：筛选正在热播且是华语的剧
        if (dayOffset === "0") {
             // 正在热播 + 华语 + 按热度
             queryParams["air_date.lte"] = dateStr;
             queryParams["air_date.gte"] = getPastDate(30); // 一个月内开播的
        } else {
             // 严格按首播日期（针对新剧）
             queryParams["first_air_date.gte"] = dateStr;
             queryParams["first_air_date.lte"] = dateStr;
        }
    }

    try {
        const res = await Widget.tmdb.get("/discover/tv", { params: queryParams });
        const results = res.results || [];

        return results.map(item => {
            return buildItem({
                id: item.id,
                tmdbId: item.id,
                type: "tv",
                title: item.name,
                year: (item.first_air_date || "").substring(0, 4),
                poster: item.poster_path,
                backdrop: item.backdrop_path,
                rating: item.vote_average,
                genreText: getGenreText(item.genre_ids),
                subTitle: `${item.first_air_date} 开播`,
                desc: item.overview
            });
        });
    } catch (e) { return [{ id: "err", type: "text", title: "日历加载失败" }]; }
}

function getPastDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

// =========================================================================
// 3. ViuTV 官方节目表 (API)
// =========================================================================

async function loadViuTVSchedule() {
    // 99台 ViuTV 频道ID
    const url = "https://api.viu.now.com/p8/2/getScheduleWithChannelId";
    
    try {
        const res = await Widget.http.post(url, {
            "channelId": "099",
            "callerReferenceNo": "123",
            "format": "json",
            "hour": 24 // 获取全天
        }, {
            headers: { "User-Agent": "ViuTV/2.0" }
        });

        const data = res.data || {};
        const items = data.data || [];

        if (items.length === 0) return [{ id: "empty", type: "text", title: "暂无节目信息" }];

        // 过滤掉新闻和广告，只留剧集和综艺
        // 并尝试去 TMDB 匹配海报
        const promises = items.map(async (item) => {
            const title = item.programTitle;
            const episodeTitle = item.episodeTitle;
            const startTime = new Date(item.start).toLocaleTimeString("zh-HK", {hour: '2-digit', minute:'2-digit'});
            
            // 简单的搜索匹配，为了速度不匹配也可以，直接显示文本
            // 这里我们做一个简单的尝试
            let poster = "";
            let tmdbId = 0;
            
            // 尝试匹配 TMDB (可选，如果觉得慢可以去掉 await)
            const searchRes = await searchTmdbSimple(title);
            if (searchRes) {
                poster = searchRes.poster_path;
                tmdbId = searchRes.id;
            }

            return {
                id: `viu_${item.episodeId}`,
                tmdbId: tmdbId, // 如果匹配到就有详情页
                type: "tmdb",
                mediaType: "tv",
                title: title,
                subTitle: `${startTime} • ${episodeTitle || "播出中"}`,
                description: item.synopsis || "暂无简介",
                posterPath: poster ? `https://image.tmdb.org/t/p/w500${poster}` : "", // 没海报 Forward 会显示默认图
                genreTitle: "ViuTV 99台"
            };
        });

        return await Promise.all(promises);

    } catch (e) { 
        return [{ id: "err", type: "text", title: "ViuTV 官网连接失败" }]; 
    }
}

async function searchTmdbSimple(query) {
    if (!query) return null;
    try {
        const res = await Widget.tmdb.get("/search/tv", { params: { query: query, language: "zh-HK" } });
        return (res.results || [])[0];
    } catch (e) { return null; }
}
