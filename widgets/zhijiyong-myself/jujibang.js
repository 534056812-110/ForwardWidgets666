WidgetMetadata = {
    id: "trakt_global_remix_v3",
    title: "Trakt 全球影视 (V3重制版)",
    author: "Makkapakka",
    description: "V3.0: 采用'先抓热榜-后查时间-本地排序'新逻辑。修复日历无数据问题，支持按最新集更新排序。",
    version: "3.0.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [], // 内置 Key，无需输入

    modules: [
        {
            title: "🌍 全球热榜聚合",
            functionName: "loadRankingsRemix",
            type: "list",
            cacheDuration: 3600, 
            params: [
                {
                    name: "sort",
                    title: "排序模式",
                    type: "enumeration",
                    defaultValue: "trending",
                    enumOptions: [
                        { title: "🔥 默认热度 (Trending)", value: "trending" },
                        { title: "📅 按最新集更新 (Latest Ep)", value: "update_date" },
                        { title: "🆕 按首播/上映 (Premieres)", value: "release_date" }
                    ]
                },
                {
                    name: "type",
                    title: "内容类型",
                    type: "enumeration",
                    defaultValue: "shows",
                    enumOptions: [
                        { title: "📺 剧集", value: "shows" },
                        { title: "🎬 电影", value: "movies" },
                        { title: "♾️ 混合展示", value: "all" }
                    ]
                },
                {
                    name: "region",
                    title: "地区筛选",
                    type: "enumeration",
                    defaultValue: "global",
                    enumOptions: [
                        { title: "🌍 全球 (Global)", value: "global" },
                        { title: "🇺🇸 美剧 (US)", value: "us" },
                        { title: "🇨🇳 国产 (CN)", value: "cn" },
                        { title: "🇰🇷 韩剧 (KR)", value: "kr" },
                        { title: "🇯🇵 日剧 (JP)", value: "jp" },
                        { title: "🇭🇰 港剧 (HK)", value: "hk" },
                        { title: "🇬🇧 英剧 (GB)", value: "gb" }
                    ]
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// ==========================================
// 0. 常量与工具
// ==========================================

const CLIENT_ID = "95b59922670c84040db3632c7aac6f33704f6ffe5cbf3113a056e37cb45cb482";
const API_BASE = "https://api.trakt.tv";

// 格式化日期 2023-10-24 -> 10-24
function formatShortDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${m}-${d}`;
}

// ==========================================
// 1. 主逻辑 (你的思路实现)
// ==========================================

async function loadRankingsRemix(params = {}) {
    const type = params.type || "shows";
    const sort = params.sort || "trending"; // trending, update_date, release_date
    const region = params.region || "global";
    const page = parseInt(params.page) || 1;

    // 1. 获取源数据
    // 无论选什么排序，我们都先从 Trakt 抓取"Trending"（正在热播）的数据
    // 因为这些剧才有更新的价值。抓取数量稍微多一点(比如40个)，方便本地排序。
    let rawTraktItems = [];
    
    // 为了支持本地排序效果好，如果是日期排序，我们一次性抓多一点数据(limit=50)，忽略 Trakt 分页
    // 如果是默认排序，则正常分页
    const fetchLimit = (sort === "update_date" || sort === "release_date") ? 50 : 20;
    const fetchPage = (sort === "update_date" || sort === "release_date") ? 1 : page;

    if (type === "all") {
        const [movies, shows] = await Promise.all([
            fetchTraktTrending("movies", region, fetchPage, fetchLimit),
            fetchTraktTrending("shows", region, fetchPage, fetchLimit)
        ]);
        rawTraktItems = [...shows, ...movies];
    } else {
        rawTraktItems = await fetchTraktTrending(type, region, fetchPage, fetchLimit);
    }

    if (!rawTraktItems || rawTraktItems.length === 0) {
        return [{ id: "empty", type: "text", title: "暂无数据", subTitle: "请尝试切换筛选条件" }];
    }

    // 2. 数据补全 (查询 TMDB 详情，获取关键日期)
    const enrichedItems = await Promise.all(rawTraktItems.map(async (item) => {
        let subject = item.movie || item.show || item;
        if (!subject?.ids?.tmdb) return null;

        // 确定类型
        let mediaType = "movie";
        if (item.show || type === "shows" || item._type === "show") mediaType = "tv";

        // 去 TMDB 查详情 (包含最新一集时间、首播时间、高清图)
        const tmdbData = await fetchTmdbDetail(subject.ids.tmdb, mediaType);
        if (!tmdbData) return null;

        return {
            trakt: item,
            tmdb: tmdbData,
            // 提取关键排序字段
            lastAirDate: tmdbData.last_air_date || "1900-01-01", // 最新一集
            releaseDate: tmdbData.release_date || "1900-01-01", // 首播/上映
            mediaType: mediaType
        };
    }));

    // 过滤无效项
    let validItems = enrichedItems.filter(Boolean);

    // 3. 本地排序 (你的核心需求)
    if (sort === "update_date") {
        // 按最新一集播出时间倒序 (今天 -> 昨天 -> 前天)
        validItems.sort((a, b) => new Date(b.lastAirDate) - new Date(a.lastAirDate));
    } else if (sort === "release_date") {
        // 按首播/上映时间倒序 (最新出的剧/片在前面)
        validItems.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
    }
    // 如果是 trending，保持 Trakt 原序，无需操作

    // 4. 处理分页 (如果是本地排序模式，需要手动切片)
    if (sort === "update_date" || sort === "release_date") {
        const start = (page - 1) * 20;
        validItems = validItems.slice(start, start + 20);
    }

    // 5. 生成最终卡片
    return validItems.map(item => buildCard(item, sort));
}

// ==========================================
// 2. 数据获取层
// ==========================================

async function fetchTraktTrending(mediaType, region, page, limit) {
    // 始终使用 trending 接口作为数据源，保证列表里都是"活"的剧
    let url = `${API_BASE}/${mediaType}/trending?limit=${limit}&page=${page}`;
    
    // 地区 + 语言过滤
    let params = [];
    if (region && region !== "global") {
        params.push(`countries=${region}`);
        if (["cn", "hk", "tw"].includes(region)) params.push(`languages=zh`);
    }
    if (params.length > 0) url += "&" + params.join("&");

    try {
        const res = await Widget.http.get(url, {
            headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": CLIENT_ID }
        });
        const data = res.data || JSON.parse(res.body || "[]");
        return Array.isArray(data) ? data.map(d => ({ ...d, _type: mediaType === "shows" ? "show" : "movie" })) : [];
    } catch (e) { return []; }
}

async function fetchTmdbDetail(id, type) {
    try {
        // 获取中文详情
        const d = await Widget.tmdb.get(`/${type}/${id}`, { params: { language: "zh-CN" } });
        
        // 提取排序所需的关键日期
        let last_air = "";
        let release = d.first_air_date || d.release_date || ""; // 剧集首播 or 电影上映

        let next_ep_info = null;
        let last_ep_info = null;

        if (type === "tv") {
            // 剧集特有逻辑：找最新一集
            if (d.next_episode_to_air) {
                // 如果有下一集，记录下来
                next_ep_info = d.next_episode_to_air;
            }
            if (d.last_episode_to_air) {
                last_ep_info = d.last_episode_to_air;
                last_air = d.last_episode_to_air.air_date; // 用最后一集的时间作为"更新时间"
            } else {
                last_air = release; // 如果没有最后一集信息，用首播代替
            }
        } else {
            // 电影
            last_air = release;
        }

        return {
            ...d,
            last_air_date: last_air,
            release_date: release,
            next_ep: next_ep_info,
            last_ep: last_ep_info
        };
    } catch (e) { return null; }
}

// ==========================================
// 3. 卡片构建
// ==========================================

function buildCard(item, sortMode) {
    const tmdb = item.tmdb;
    const typeLabel = item.mediaType === "tv" ? "剧" : "影";
    
    // 🖼️ 图片策略：优先高清横图
    let imagePath = "";
    if (tmdb.backdrop_path) imagePath = `https://image.tmdb.org/t/p/w780${tmdb.backdrop_path}`;
    else if (tmdb.poster_path) imagePath = `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`;

    // 📝 副标题与右侧信息逻辑
    let subTitle = "";
    let genreTitle = ""; // 右侧信息

    if (sortMode === "update_date" && item.mediaType === "tv") {
        // 更新模式：显示 S01E05 • 10-24
        const ep = tmdb.next_ep || tmdb.last_ep;
        const icon = tmdb.next_ep ? "🔜" : "📅";
        if (ep) {
            const shortDate = formatShortDate(ep.air_date);
            subTitle = `${icon} ${shortDate} 更新 S${ep.season_number}E${ep.episode_number}`;
            genreTitle = shortDate; // 右侧也显示日期，一目了然
        } else {
            subTitle = `[${typeLabel}] 已完结`;
            genreTitle = tmdb.status || "End";
        }
    } else if (sortMode === "release_date") {
        // 上映模式
        const shortDate = formatShortDate(item.releaseDate);
        subTitle = `🆕 ${shortDate} 上映`;
        genreTitle = shortDate;
    } else {
        // 默认热度模式
        const year = (tmdb.release_date || "").substring(0, 4);
        const watchers = item.trakt.watchers || item.trakt.watcher_count || 0;
        subTitle = `[${typeLabel}] 🔥 ${watchers} 人在看`;
        genreTitle = year;
    }

    return {
        id: `trakt_${item.mediaType}_${tmdb.id}`,
        tmdbId: tmdb.id,
        type: "tmdb",
        mediaType: item.mediaType,
        title: tmdb.name || tmdb.title, // 中文名
        subTitle: subTitle,
        genreTitle: genreTitle,
        description: tmdb.overview,
        posterPath: imagePath
    };
}
