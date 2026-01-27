WidgetMetadata = {
    id: "whattowatch_pro",
    title: "今天看什么",
    author: "MakkaPakka",
    description: "剧荒拯救者。支持基于 Trakt 历史推荐，或完全随机发现。",
    version: "1.2.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    // 1. 全局参数
    globalParams: [
        {
            name: "apiKey",
            title: "TMDB API Key (必填)",
            type: "input",
            description: "用于获取推荐数据。",
            value: ""
        },
        {
            name: "traktUser",
            title: "Trakt 用户名 (可选)",
            type: "input",
            description: "填入后可根据你的观看历史进行个性化推荐。",
            value: ""
        }
    ],

    modules: [
        {
            title: "今天看什么",
            functionName: "loadRecommendations",
            type: "video", // 使用标准 video 类型
            cacheDuration: 0, // 不缓存，每次点击都刷新
            params: [
                {
                    name: "mediaType",
                    title: "想看什么",
                    type: "enumeration",
                    value: "tv",
                    enumOptions: [
                        { title: "电视剧 (TV Shows)", value: "tv" },
                        { title: "电影 (Movies)", value: "movie" }
                    ]
                }
            ]
        }
    ]
};

// Trakt 公共 Client ID (兜底用)
const TRAKT_CLIENT_ID = "003666572e92c4331002a28114387693994e43f5454659f81640a232f08a5996";

async function loadRecommendations(params = {}) {
    // 1. 获取参数
    const { apiKey, traktUser, mediaType = "tv" } = params;

    if (!apiKey) {
        return [{
            id: "err_no_key",
            type: "text",
            title: "配置缺失",
            subTitle: "请在设置中填入 TMDB API Key"
        }];
    }

    let results = [];
    let reason = ""; // 推荐理由

    // 2. 分流逻辑
    if (traktUser) {
        // === 模式 A: 个性化推荐 (基于 Trakt 历史) ===
        console.log(`[Mode] Trakt Personalized: ${traktUser}`);
        const historyItem = await fetchLastWatched(traktUser, mediaType);
        
        if (historyItem && historyItem.tmdbId) {
            reason = `因为你看过: ${historyItem.title}`;
            results = await fetchTmdbRecommendations(historyItem.tmdbId, mediaType, apiKey);
        } else {
            reason = "暂无 Trakt 记录，已切换至随机推荐";
            results = await fetchRandomTmdb(mediaType, apiKey);
        }
    } else {
        // === 模式 B: 完全随机发现 ===
        console.log(`[Mode] Random Discovery`);
        reason = "🎲 随机发现";
        results = await fetchRandomTmdb(mediaType, apiKey);
    }

    // 3. 结果处理
    if (!results || results.length === 0) {
        return [{
            id: "err_empty",
            type: "text",
            title: "没找到推荐",
            subTitle: "请重试或检查网络"
        }];
    }

    // 4. 格式化输出 (只取前 12 个)
    return results.slice(0, 12).map(item => {
        // 优先使用中文名
        const title = item.name || item.title;
        const originalName = item.original_name || item.original_title;
        
        // 副标题显示推荐理由，增强交互感
        const subTitle = reason;

        return {
            id: String(item.id),
            tmdbId: parseInt(item.id),
            type: "tmdb",
            mediaType: mediaType,
            
            title: title,
            subTitle: subTitle,
            description: item.overview || `原名: ${originalName}`,
            
            posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
            
            rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
            year: (item.first_air_date || item.release_date || "").substring(0, 4)
        };
    });
}

// ==========================================
// 工具函数
// ==========================================

/**
 * 获取 Trakt 用户最后观看的一部剧/电影
 */
async function fetchLastWatched(username, type) {
    // type 转换: tmdb "tv" -> trakt "shows", tmdb "movie" -> trakt "movies"
    const traktType = type === "tv" ? "shows" : "movies";
    // 加上 extended=full 以获取更多信息，加上 limit=1 只取最后一条
    const url = `https://api.trakt.tv/users/${username}/history/${traktType}?limit=1&extended=full`;
    
    try {
        const res = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": TRAKT_CLIENT_ID
            }
        });
        
        const data = res.data || [];
        if (data.length > 0) {
            const item = data[0];
            // Trakt 返回结构: { id: ..., show: { title: ..., ids: { tmdb: ... } } }
            const work = item.show || item.movie;
            if (work && work.ids && work.ids.tmdb) {
                return {
                    tmdbId: work.ids.tmdb,
                    title: work.title
                };
            }
        }
    } catch (e) {
        console.error("Trakt Error:", e);
    }
    return null;
}

/**
 * TMDB: 根据 ID 推荐相似 (Recommendations)
 */
async function fetchTmdbRecommendations(seedId, mediaType, apiKey) {
    const url = `https://api.themoviedb.org/3/${mediaType}/${seedId}/recommendations?api_key=${apiKey}&language=zh-CN&page=1`;
    
    try {
        const res = await Widget.http.get(url);
        const data = res.data || {};
        return data.results || [];
    } catch (e) {
        return [];
    }
}

/**
 * TMDB: 随机发现 (Discover with Random Page)
 */
async function fetchRandomTmdb(mediaType, apiKey) {
    // 1. 随机参数生成
    // 随机页码 (1-50页)
    const randomPage = Math.floor(Math.random() * 50) + 1;
    // 随机年份 (2010 - 2024)，保证不总是推荐老片
    const randomYear = Math.floor(Math.random() * (2024 - 2010 + 1)) + 2010;
    
    // 构造 Discover URL
    let url = `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${apiKey}&language=zh-CN&sort_by=popularity.desc&include_adult=false&vote_count.gte=200&page=${randomPage}`;
    
    // 加上年份筛选，增加随机性维度
    if (mediaType === "movie") {
        url += `&primary_release_year=${randomYear}`;
    } else {
        url += `&first_air_date_year=${randomYear}`;
    }

    try {
        const res = await Widget.http.get(url);
        const data = res.data || {};
        let items = data.results || [];
        
        // 2. 再次打乱当前页的顺序 (洗牌算法)
        // 即使请求同一页，展示顺序也不同
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        
        return items;
    } catch (e) {
        return [];
    }
}
