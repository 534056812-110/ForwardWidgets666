WidgetMetadata = {
    id: "trakt_global_stable_v3_2",
    title: "Trakt 全球影视 (防空兜底版)",
    author: "Makkapakka",
    description: "v3.2: 增加万能数据解析逻辑，修复因接口结构不同导致的列表为空问题。加入强力兜底机制，接口报错也能显示基础信息。",
    version: "3.2.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [], 

    modules: [
        {
            title: "🌍 全球热榜 (稳定版)",
            functionName: "loadRankingsStable",
            type: "list",
            cacheDuration: 3600, 
            params: [
                {
                    name: "region",
                    title: "🌏 地区过滤",
                    type: "enumeration",
                    defaultValue: "global",
                    enumOptions: [
                        { title: "🌍 全球 (不过滤)", value: "global" },
                        { title: "🇰🇷 韩国 (韩剧)", value: "kr" },
                        { title: "🇨🇳 中国大陆", value: "cn" },
                        { title: "🇺🇸 美国 (美剧)", value: "us" },
                        { title: "🇯🇵 日本 (日剧)", value: "jp" }
                    ]
                },
                {
                    name: "sort",
                    title: "排序模式",
                    type: "enumeration",
                    defaultValue: "trending",
                    enumOptions: [
                        { title: "🔥 热门趋势 (Trending)", value: "trending" },
                        { title: "❤️ 最受欢迎 (Popular)", value: "popular" },
                        { title: "📅 按最新集更新", value: "update_date" }
                    ]
                },
                {
                    name: "type",
                    title: "内容类型",
                    type: "enumeration",
                    defaultValue: "shows",
                    enumOptions: [
                        { title: "📺 剧集", value: "shows" },
                        { title: "🎬 电影", value: "movies" }
                    ]
                }
            ]
        }
    ]
};

// ==========================================
// 0. 核心配置
// ==========================================

const TRAKT_CLIENT_ID = "95b59922670c84040db3632c7aac6f33704f6ffe5cbf3113a056e37cb45cb482";
const TRAKT_API_BASE = "https://api.trakt.tv";
// 使用公共 Key 避免个人 Key 额度超限
const TMDB_API_KEY = "2a818c9927d8122a27b87870a30b2067"; 

// ==========================================
// 1. 主入口
// ==========================================

async function loadRankingsStable(params = {}) {
    const sortMode = params.sort || "trending";
    const type = params.type || "shows";
    const region = params.region || "global"; 

    // 1. 获取列表
    const rawItems = await fetchTraktRankings(type, sortMode, region);
    
    if (!rawItems || rawItems.length === 0) {
        // 🚨 如果还是空，返回调试卡片
        return [{ 
            title: "没有获取到数据", 
            subTitle: `地区: ${region} | 类型: ${type}`, 
            description: "可能是该过滤条件下Trakt暂无数据，建议切换为'全球'试试。",
            type: "text" 
        }];
    }

    // 2. 并发增强 (TMDB)
    // 限制处理前 20 个
    const itemsToProcess = rawItems.slice(0, 20);
    
    const enrichedItems = await Promise.all(itemsToProcess.map(async (item) => {
        return await enrichItem(item, type);
    }));

    // 过滤无效项 (这次我们尽量不返回 null，所以 validItems 应该很多)
    let validItems = enrichedItems.filter(Boolean);

    // 3. 本地排序
    if (sortMode === "update_date") {
        validItems.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    }

    // 4. 生成卡片
    return validItems.map(item => buildCard(item, sortMode));
}

// ==========================================
// 2. Trakt 列表获取 (万能解析)
// ==========================================

async function fetchTraktRankings(type, sortMode, region) {
    // 映射 Endpoint
    // 注意：update_date 不是 API 端点，我们用 trending 抓回来再本地排
    let endpoint = sortMode === "update_date" ? "trending" : sortMode;
    
    // 构建 URL
    let url = `${TRAKT_API_BASE}/${type}/${endpoint}?extended=full&limit=30&page=1`;
    
    if (region && region !== "global") {
        url += `&countries=${region}`;
    }

    try {
        const res = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": TRAKT_CLIENT_ID
            }
        });
        
        let data = JSON.parse(res.body || res.data);
        if (!Array.isArray(data)) return [];

        // ✅ 核心修复：万能结构解析
        // 无论 Trakt 返回 {show:{...}} 还是直接返回 {...}，都统一提取
        return data.map(i => {
            // 尝试提取 show 或 movie 对象，如果没有，说明 i 本身就是对象
            const mediaObj = i.show || i.movie || i;
            // 确保有 ids 属性才返回，否则是无效数据
            if (mediaObj && mediaObj.ids) {
                return {
                    ...mediaObj,
                    _traktRaw: i // 保留原始引用
                };
            }
            return null;
        }).filter(Boolean); // 过滤掉 null

    } catch (e) {
        console.log("Trakt Fetch Error: " + e);
        return [];
    }
}

// ==========================================
// 3. 数据增强 (即使 TMDB 失败也要返回)
// ==========================================

async function enrichItem(traktItem, type) {
    const tmdbId = traktItem.ids.tmdb;
    const title = traktItem.title; // 英文名作为保底
    
    let finalData = {
        tmdb: {},
        trakt: traktItem,
        mediaType: type === "shows" ? "tv" : "movie",
        sortDate: "1900-01-01",
        releaseDate: "1900-01-01",
        nextEp: null,
        lastEp: null,
        isFallback: false
    };

    try {
        // A. 尝试获取 TMDB 中文信息
        const tmdbUrl = type === "shows" 
            ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=zh-CN`
            : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=zh-CN`;
        
        const tmdbRes = await Widget.http.get(tmdbUrl);
        const tmdbData = JSON.parse(tmdbRes.body || tmdbRes.data);
        
        if (tmdbData.id) {
            finalData.tmdb = tmdbData;
            
            // 时间处理
            if (type === "shows") {
                if (tmdbData.next_episode_to_air) {
                    finalData.nextEp = tmdbData.next_episode_to_air;
                    finalData.sortDate = finalData.nextEp.air_date;
                } else if (tmdbData.last_episode_to_air) {
                    finalData.lastEp = tmdbData.last_episode_to_air;
                    finalData.sortDate = finalData.lastEp.air_date;
                } else {
                    finalData.sortDate = tmdbData.first_air_date;
                }
                finalData.releaseDate = tmdbData.first_air_date;
            } else {
                finalData.sortDate = tmdbData.release_date;
                finalData.releaseDate = tmdbData.release_date;
            }
        } else {
             // TMDB 返回了但没 ID (极其罕见)，走 Fallback
             finalData.isFallback = true;
        }

    } catch (e) {
        // B. TMDB 请求失败，走保底逻辑 (Fallback)
        // 使用 Trakt 自带的年份和标题
        finalData.isFallback = true;
        finalData.releaseDate = `${traktItem.year}-01-01`;
        finalData.sortDate = `${traktItem.year}-01-01`;
    }

    return finalData;
}

// ==========================================
// 4. UI 构建
// ==========================================

function buildCard(item, sortMode) {
    const d = item.tmdb;
    const t = item.trakt;
    
    // 标题：优先中文，失败则用 Trakt 英文
    const displayTitle = d.name || d.title || t.title || "未知标题";
    
    // 图片
    let imagePath = "";
    if (d.backdrop_path) imagePath = `https://image.tmdb.org/t/p/w780${d.backdrop_path}`;
    else if (d.poster_path) imagePath = `https://image.tmdb.org/t/p/w500${d.poster_path}`;

    // 格式化
    const formatDate = (str) => {
        if (!str || str.startsWith("1900")) return "";
        const date = new Date(str);
        if (isNaN(date.getTime())) return "";
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${m}-${day}`;
    };

    let subTitle = "";
    let genreTitle = "";

    // 兜底模式显示的副标题
    if (item.isFallback) {
        subTitle = "⚠️ 暂无中文详情 (网络/接口问题)";
        genreTitle = t.year;
    } else if (sortMode === "update_date" && item.mediaType === "tv") {
        // 更新模式
        if (item.nextEp) {
            const date = formatDate(item.nextEp.air_date);
            subTitle = `🔜 ${date} 更新 S${item.nextEp.season_number}E${item.nextEp.episode_number}`;
            genreTitle = date;
        } else if (item.lastEp) {
            const date = formatDate(item.lastEp.air_date);
            if (d.status === "Ended") {
                 subTitle = "全剧终";
                 genreTitle = "End";
            } else {
                 subTitle = `📅 ${date} 更新 S${item.lastEp.season_number}E${item.lastEp.episode_number}`;
                 genreTitle = date;
            }
        } else {
             subTitle = `📅 ${formatDate(item.releaseDate)} 首播`;
             genreTitle = (item.releaseDate || "").substring(0,4);
        }
    } else {
        // 默认模式
        const year = (item.releaseDate || "").substring(0, 4);
        subTitle = `🔥 Trakt 热度: ${t.ids.trakt}`;
        genreTitle = year;
    }
    
    return {
        id: `trakt_${t.ids.trakt}`,
        tmdbId: t.ids.tmdb, 
        type: "tmdb",
        mediaType: item.mediaType,
        title: displayTitle,
        subTitle: subTitle,
        genreTitle: genreTitle,
        description: d.overview || "暂无简介",
        posterPath: imagePath
    };
}
