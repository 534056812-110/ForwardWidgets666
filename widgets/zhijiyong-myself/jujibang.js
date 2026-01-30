WidgetMetadata = {
    id: "trakt_global_native",
    title: "Trakt 全球影视榜单 (中文)",
    author: "Makkapakka",
    description: "基于 Trakt 大数据 + TMDB 中文补全。支持全球/各国/流媒体热度排行。",
    version: "2.0.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [
        { 
            name: "traktClientId", 
            title: "Trakt Client ID (选填)", 
            type: "input", 
            description: "不填则使用内置高速Key。", 
            value: "" 
        }
    ],

    modules: [
        {
            title: "🌍 全球热榜",
            functionName: "loadGlobalRankings",
            type: "list",
            cacheDuration: 3600, // 缓存1小时
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "enumeration",
                    defaultValue: "shows",
                    enumOptions: [
                        { title: "📺 热门剧集", value: "shows" },
                        { title: "🎬 热门电影", value: "movies" },
                        { title: "♾️ 剧集+电影", value: "all" }
                    ]
                },
                {
                    name: "sort",
                    title: "排序依据",
                    type: "enumeration",
                    defaultValue: "trending",
                    enumOptions: [
                        { title: "🔥 正在热播 (Trending)", value: "trending" },
                        { title: "❤️ 最受欢迎 (Popular)", value: "popular" },
                        { title: "👁️ 观看最多 (Played)", value: "played" },
                        { title: "🆕 最受期待 (Anticipated)", value: "anticipated" }
                    ]
                },
                {
                    name: "region",
                    title: "地区筛选 (部分榜单生效)",
                    type: "enumeration",
                    defaultValue: "global",
                    enumOptions: [
                        { title: "🌍 全球", value: "global" },
                        { title: "🇺🇸 美国", value: "us" },
                        { title: "🇨🇳 中国大陆", value: "cn" },
                        { title: "🇰🇷 韩国", value: "kr" },
                        { title: "🇯🇵 日本", value: "jp" },
                        { title: "🇭🇰 香港", value: "hk" },
                        { title: "🇬🇧 英国", value: "gb" }
                    ]
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// ==========================================
// 0. 常量与配置
// ==========================================

const DEFAULT_CLIENT_ID = "95b59922670c84040db3632c7aac6f33704f6ffe5cbf3113a056e37cb45cb482";
const API_BASE = "https://api.trakt.tv";

// ==========================================
// 1. 主逻辑
// ==========================================

async function loadGlobalRankings(params = {}) {
    // 1. 参数处理
    const clientId = params.traktClientId || DEFAULT_CLIENT_ID;
    const type = params.type || "shows";
    const sort = params.sort || "trending";
    const region = params.region || "global";
    const page = parseInt(params.page) || 1;

    let rawItems = [];

    // 2. 根据类型获取数据
    if (type === "all") {
        // 混合模式：同时请求电影和剧集
        const [movies, shows] = await Promise.all([
            fetchTraktData(clientId, "movies", sort, region, page),
            fetchTraktData(clientId, "shows", sort, region, page)
        ]);
        // 简单的穿插合并，避免前20个全是电影
        rawItems = [];
        const maxLen = Math.max(movies.length, shows.length);
        for (let i = 0; i < maxLen; i++) {
            if (movies[i]) rawItems.push(movies[i]);
            if (shows[i]) rawItems.push(shows[i]);
        }
    } else {
        // 单一模式
        rawItems = await fetchTraktData(clientId, type, sort, region, page);
    }

    if (!rawItems || rawItems.length === 0) {
        return page === 1 ? [{ id: "empty", type: "text", title: "列表为空或加载失败" }] : [];
    }

    // 3. 核心：使用 Widget.tmdb 补全中文信息
    // 这一步是把你原本只有英文的 Trakt 数据，转换成带图、带中文标题的卡片
    const promises = rawItems.map(async (item) => {
        // 提取主体 (Trakt 返回结构有多种，这里统一处理)
        let subject = item.movie || item.show || item;
        // 如果是 Popular 榜单，Trakt 直接返回 subject 对象，没有嵌套
        if (!subject.ids && item.ids) subject = item;

        if (!subject?.ids?.tmdb) return null;

        // 确定类型 (Trakt 数据里有时不带 type 字段，需要根据上下文判断)
        // 我们的 fetchTraktData 会预埋 type 标记，或者通过 ids 结构猜测
        let mediaType = "movie";
        if (subject.season || item.show || (type === "shows") || (type==="all" && item._type === "show")) {
            mediaType = "tv";
        }

        // 构造副标题 (热度数据)
        let subInfo = "";
        if (item.watchers) subInfo = `🔥 ${item.watchers} 人在看`;
        else if (item.watcher_count) subInfo = `👁️ ${item.watcher_count} 观看`;
        else if (item.list_count) subInfo = `❤️ ${item.list_count} 收藏`;
        else subInfo = mediaType === "tv" ? "热门剧集" : "热门电影";
        
        // 调用 TMDB 获取详情 (复用你那个好用的逻辑)
        return await fetchTmdbDetail(subject.ids.tmdb, mediaType, subInfo, subject.title);
    });

    return (await Promise.all(promises)).filter(Boolean);
}

// ==========================================
// 2. 数据获取层 (Trakt)
// ==========================================

async function fetchTraktData(clientId, mediaType, sort, region, page) {
    // 构造 URL
    // https://api.trakt.tv/shows/trending?limit=20&page=1
    let url = `${API_BASE}/${mediaType}/${sort}?limit=20&page=${page}`;
    
    // 地区参数 (仅 trending/popular/anticipated 支持)
    if (region && region !== "global") {
        url += `&countries=${region}`;
    }

    try {
        const res = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": clientId
            }
        });
        
        const data = res.data || JSON.parse(res.body || "[]");
        if (!Array.isArray(data)) return [];
        
        // 预处理：给数据打上类型标签，方便混合排序时识别
        return data.map(d => {
            // 如果是对象，浅拷贝一份并标记类型
            // mediaType 传入的是 "movies" 或 "shows"
            if (typeof d === 'object') {
                d._type = (mediaType === "shows") ? "show" : "movie";
            }
            return d;
        });

    } catch (e) {
        console.log("Trakt Error: " + e.message);
        return [];
    }
}

// ==========================================
// 3. 数据补全层 (TMDB - 借用你的逻辑)
// ==========================================

async function fetchTmdbDetail(id, type, subInfo, originalTitle) {
    try {
        // 使用 Widget.tmdb 自动处理中文参数
        const d = await Widget.tmdb.get(`/${type}/${id}`, { params: { language: "zh-CN" } });
        
        // 获取年份
        const dateStr = d.first_air_date || d.release_date || "";
        const year = dateStr.substring(0, 4);
        
        // 组合副标题：[电影] 2023 • 🔥 500人在看
        const typeLabel = type === "tv" ? "剧集" : "电影";
        const finalSub = `[${typeLabel}] ${year} • ${subInfo}`;

        return {
            id: `trakt_${type}_${d.id}`, 
            tmdbId: d.id, 
            type: "tmdb", 
            mediaType: type,
            title: d.name || d.title || originalTitle, // 优先用中文名
            subTitle: finalSub, 
            genreTitle: year, // 列表右侧显示年份
            description: d.overview,
            posterPath: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : ""
        };
    } catch (e) {
        // 如果 TMDB 失败，回退到纯文本显示 (防止整行消失)
        return {
            id: `err_${id}`,
            title: originalTitle,
            subTitle: subInfo + " (无中文详情)",
            type: "text"
        };
    }
}
