WidgetMetadata = {
    id: "trakt_global_region_fix_v3_1",
    title: "Trakt 全球影视 (地区修复版)",
    author: "Makkapakka",
    description: "v3.1: 修复韩剧/日剧榜单混入美剧的问题。新增【地区过滤】，支持强制锁定特定国家内容。",
    version: "3.1.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [], 

    modules: [
        {
            title: "🌍 全球热榜聚合",
            functionName: "loadRankingsRemix",
            type: "list",
            cacheDuration: 3600, 
            params: [
                {
                    name: "region",
                    title: "🌏 地区过滤 (关键)",
                    type: "enumeration",
                    defaultValue: "global",
                    enumOptions: [
                        { title: "🌍 全球 (不过滤)", value: "global" },
                        { title: "🇨🇳 中国大陆 (国产剧)", value: "cn" },
                        { title: "🇰🇷 韩国 (韩剧/韩影)", value: "kr" },
                        { title: "🇺🇸 美国 (美剧/好莱坞)", value: "us" },
                        { title: "🇯🇵 日本 (日剧/番剧)", value: "jp" },
                        { title: "🇬🇧 英国 (英剧)", value: "gb" },
                        { title: "🇭🇰 中国香港", value: "hk" }
                    ]
                },
                {
                    name: "sort",
                    title: "排序模式",
                    type: "enumeration",
                    defaultValue: "trending",
                    enumOptions: [
                        { title: "🔥 默认热度 (Trending)", value: "trending" },
                        { title: "📅 按最新集更新 (追更)", value: "update_date" },
                        { title: "🆕 按首播/上映 (新片)", value: "release_date" }
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

// ==========================================
// 1. 主入口
// ==========================================

async function loadRankingsRemix(params = {}) {
    const sortMode = params.sort || "trending";
    const type = params.type || "shows";
    const region = params.region || "global"; // 新增地区参数

    // 1. 从 Trakt 获取原始列表 (带地区过滤)
    const rawItems = await fetchTraktRankings(type, sortMode, region);
    
    if (!rawItems || rawItems.length === 0) {
        return [{ title: "列表为空", subTitle: "Trakt 未返回数据或该分类无内容", type: "text" }];
    }

    // 2. 并发查询 TMDB 详情 (获取中文名、图片、具体集数时间)
    // 限制处理数量，防止卡顿
    const itemsToProcess = rawItems.slice(0, 20);
    
    const enrichedItems = await Promise.all(itemsToProcess.map(async (item) => {
        return await enrichItem(item, type);
    }));

    // 过滤无效项
    let validItems = enrichedItems.filter(Boolean);

    // 3. 本地二次排序 (如果用户选择了“按更新时间”)
    // 只有在数据全部拿到后，才能按精确的“播出时间”排序
    if (sortMode === "update_date") {
        validItems.sort((a, b) => {
            // 优先按 sortDate (下一集或最新集) 倒序
            return new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime();
        });
    } else if (sortMode === "release_date") {
        validItems.sort((a, b) => {
            return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        });
    }

    // 4. 生成卡片
    return validItems.map(item => buildCard(item, sortMode));
}

// ==========================================
// 2. Trakt 列表获取 (核心修复点)
// ==========================================

async function fetchTraktRankings(type, sortMode, region) {
    // 映射: 如果是 update_date，Trakt 并没有直接的接口，我们通常用 trending 取回来再本地排
    // 或者使用 anticipated (期待)
    let traktEndpoint = "trending"; 
    if (sortMode === "release_date") traktEndpoint = "anticipated"; 
    
    // 构建 URL
    let url = `${TRAKT_API_BASE}/${type}/${traktEndpoint}?extended=full&limit=30&page=1`;
    
    // ✅ 关键修复：加上地区参数
    // Trakt API: ?countries=kr
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
        // Trakt trending 返回的是 [{ watchers: 10, show: {...} }] 结构
        // anticipated 返回 [{ list_count: 10, show: {...} }]
        // 我们需要统一提取里面的 show 或 movie 对象
        return data.map(i => {
            const mediaObj = i.show || i.movie;
            return {
                ...mediaObj,
                _traktMeta: i // 保留外层数据(watchers等)
            };
        });
    } catch (e) {
        console.log("Trakt Fetch Error: " + e);
        return [];
    }
}

// ==========================================
// 3. 数据增强 (TMDB + Trakt Time)
// ==========================================

async function enrichItem(traktItem, type) {
    const tmdbId = traktItem.ids.tmdb;
    const title = traktItem.title;
    const year = traktItem.year;

    try {
        // A. 获取 TMDB 中文信息 (ID和图片)
        // 直接用 TMDB ID 查详情，比搜索更准
        const tmdbUrl = type === "shows" 
            ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=2a818c9927d8122a27b87870a30b2067&language=zh-CN`
            : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=2a818c9927d8122a27b87870a30b2067&language=zh-CN`;
        
        const tmdbRes = await Widget.http.get(tmdbUrl);
        const tmdbData = JSON.parse(tmdbRes.body || tmdbRes.data);
        
        if (!tmdbData.id) return null; // 没查到

        // B. 获取精准时间 (如果是剧集且需要按更新排序)
        let sortDate = "1900-01-01";
        let nextEp = null;
        let lastEp = null;
        let status = traktItem.status; // Trakt 里的状态 usually accurate

        if (type === "shows") {
            // 直接利用 TMDB 详情里的 last_episode_to_air 和 next_episode_to_air
            // 这是 TMDB 最好用的地方，不用发额外请求
            if (tmdbData.next_episode_to_air) {
                nextEp = tmdbData.next_episode_to_air;
                sortDate = nextEp.air_date;
            } else if (tmdbData.last_episode_to_air) {
                lastEp = tmdbData.last_episode_to_air;
                sortDate = lastEp.air_date;
            } else {
                sortDate = tmdbData.first_air_date;
            }
        } else {
            sortDate = tmdbData.release_date;
        }

        return {
            tmdb: tmdbData,
            trakt: traktItem,
            mediaType: type === "shows" ? "tv" : "movie",
            sortDate: sortDate || "1900-01-01",
            releaseDate: (tmdbData.first_air_date || tmdbData.release_date || "1900-01-01"),
            nextEp: nextEp,
            lastEp: lastEp
        };

    } catch (e) {
        return null; // 出错就跳过
    }
}

// ==========================================
// 4. 卡片 UI
// ==========================================

function buildCard(item, sortMode) {
    const d = item.tmdb;
    const typeLabel = item.mediaType === "tv" ? "剧" : "影";
    
    // 图片
    let imagePath = "";
    if (d.backdrop_path) imagePath = `https://image.tmdb.org/t/p/w780${d.backdrop_path}`;
    else if (d.poster_path) imagePath = `https://image.tmdb.org/t/p/w500${d.poster_path}`;

    // 格式化日期
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

    if (sortMode === "update_date" && item.mediaType === "tv") {
        // 更新模式
        if (item.nextEp) {
            const date = formatDate(item.nextEp.air_date);
            subTitle = `🔜 ${date} 更新 S${item.nextEp.season_number}E${item.nextEp.episode_number}`;
            genreTitle = date;
        } else if (item.lastEp) {
            const date = formatDate(item.lastEp.air_date);
            if (d.status === "Ended" || d.status === "Canceled") {
                 subTitle = `[${typeLabel}] 已完结`;
                 genreTitle = "End";
            } else {
                 subTitle = `📅 ${date} 更新 S${item.lastEp.season_number}E${item.lastEp.episode_number}`;
                 genreTitle = date;
            }
        } else {
             subTitle = `[${typeLabel}] 暂无更新信息`;
             genreTitle = formatDate(item.releaseDate);
        }
    } else {
        // 热度模式 或 上映模式
        const year = (item.releaseDate || "").substring(0, 4);
        subTitle = `🔥 Trakt 热度: ${item.trakt._traktMeta.watchers || "High"}`;
        
        if (item.mediaType === "tv" && item.nextEp) {
             // 即使是热度模式，如果有下一集也提示一下
             const date = formatDate(item.nextEp.air_date);
             subTitle = `🔜 ${date} 更新 S${item.nextEp.season_number}E${item.nextEp.episode_number}`;
        }
        
        genreTitle = year;
    }
    
    return {
        id: `trakt_${d.id}`,
        tmdbId: d.id, 
        type: "tmdb",
        mediaType: item.mediaType,
        title: d.name || d.title, // 优先用 TMDB 中文名
        subTitle: subTitle,
        genreTitle: genreTitle,
        description: d.overview,
        posterPath: imagePath
    };
}
