WidgetMetadata = {
    id: "trakt_global_landscape_pro",
    title: "Trakt 全球影视 (横图版)",
    author: "Makkapakka",
    description: "v2.2: 修复日历排序无数据问题；启用高清横版封面(Backdrop)；优化日期显示格式。",
    version: "2.2.0",
    requiredVersion: "0.0.1",
    site: "https://trakt.tv",

    globalParams: [], // 移除输入框，强制内置

    modules: [
        {
            title: "🌍 全球热榜",
            functionName: "loadGlobalRankings",
            type: "list",
            cacheDuration: 3600, 
            params: [
                {
                    name: "sort",
                    title: "排序模式",
                    type: "enumeration",
                    defaultValue: "trending",
                    enumOptions: [
                        { title: "🔥 正在热播 (Trending)", value: "trending" },
                        { title: "📅 按更新时间 (日历)", value: "update_date" }, // 已修复
                        { title: "❤️ 最受欢迎 (Popular)", value: "popular" },
                        { title: "🆕 最新上映 (Premieres)", value: "release_date" },
                        { title: "👁️ 观看最多 (Played)", value: "played" },
                        { title: "🌟 最受期待 (Anticipated)", value: "anticipated" }
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
                        { title: "🇺🇸 美国 (US)", value: "us" },
                        { title: "🇨🇳 中国 (CN)", value: "cn" },
                        { title: "🇰🇷 韩国 (KR)", value: "kr" },
                        { title: "🇯🇵 日本 (JP)", value: "jp" },
                        { title: "🇭🇰 香港 (HK)", value: "hk" },
                        { title: "🇬🇧 英国 (GB)", value: "gb" }
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

// 格式化日期 MM-DD (参考了你的示例代码)
function formatShortDate(dateStr) {
    if (!dateStr) return "待定";
    const date = new Date(dateStr);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${m}-${d}`;
}

// ==========================================
// 1. 主逻辑
// ==========================================

async function loadGlobalRankings(params = {}) {
    const type = params.type || "shows";
    const sort = params.sort || "trending";
    const region = params.region || "global";
    const page = parseInt(params.page) || 1;

    let rawItems = [];

    // --- A. 日历模式 (按更新/上映) ---
    // 使用 Trakt Calendar API 抓取具体日期数据
    if (sort === "update_date" || sort === "release_date") {
        if (type === "all") {
            const [movies, shows] = await Promise.all([
                fetchTraktCalendar("movies", sort, region),
                fetchTraktCalendar("shows", sort, region)
            ]);
            // 合并并按日期排序
            rawItems = [...shows, ...movies].sort((a,b) => new Date(a.date) - new Date(b.date));
        } else {
            rawItems = await fetchTraktCalendar(type, sort, region);
        }
        // 本地分页 (因为 Calendar 接口不支持标准 page 参数)
        const start = (page - 1) * 20;
        rawItems = rawItems.slice(start, start + 20);
    } 
    // --- B. 常规榜单 (热播/流行) ---
    else {
        if (type === "all") {
            const [movies, shows] = await Promise.all([
                fetchTraktList("movies", sort, region, page),
                fetchTraktList("shows", sort, region, page)
            ]);
            // 交叉合并
            rawItems = [];
            const maxLen = Math.max(movies.length, shows.length);
            for (let i = 0; i < maxLen; i++) {
                if (movies[i]) rawItems.push(movies[i]);
                if (shows[i]) rawItems.push(shows[i]);
            }
        } else {
            rawItems = await fetchTraktList(type, sort, region, page);
        }
    }

    if (!rawItems || rawItems.length === 0) {
        return page === 1 ? [{ id: "empty", type: "text", title: "暂无数据", subTitle: "尝试切换筛选条件" }] : [];
    }

    // --- C. TMDB 中文补全 + 横版封面 ---
    const promises = rawItems.map(async (item) => {
        // 提取主体
        let subject = item.movie || item.show || item;
        // 兼容 Popular 结构
        if (!subject.ids && item.ids) subject = item;

        if (!subject?.ids?.tmdb) return null;

        // 确定类型
        let mediaType = "movie";
        if (item.episode || item.show || type === "shows" || item._type === "show") {
            mediaType = "tv";
        }

        // 构造显示的额外信息
        let subInfo = "";
        let genreInfo = ""; // 用于右侧显示年份或日期

        if (sort === "update_date" && item.episode) {
            // 日历模式: 01-30 S01E05
            const ep = item.episode;
            const shortDate = formatShortDate(item.first_aired);
            subInfo = `📺 S${ep.season}E${ep.episode}`;
            genreInfo = shortDate; // 右侧显示日期
        } else if (sort === "release_date") {
            const shortDate = formatShortDate(item.first_aired || subject.released);
            subInfo = "🆕 最新上映";
            genreInfo = shortDate;
        } else {
            // 热度模式
            if (item.watchers) subInfo = `🔥 ${item.watchers}人在看`;
            else if (item.watcher_count) subInfo = `👁️ ${item.watcher_count}观看`;
            else subInfo = mediaType === "tv" ? "热门剧集" : "热门电影";
            genreInfo = (subject.year || "").toString();
        }

        return await fetchTmdbDetail(subject.ids.tmdb, mediaType, subInfo, subject.title, genreInfo);
    });

    return (await Promise.all(promises)).filter(Boolean);
}

// ==========================================
// 2. 数据获取 (Trakt)
// ==========================================

async function fetchTraktList(mediaType, sort, region, page) {
    let url = `${API_BASE}/${mediaType}/${sort}?limit=20&page=${page}`;
    
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

async function fetchTraktCalendar(mediaType, sort, region) {
    // 逻辑：获取"今天"开始的未来7天数据，确保有数据
    const today = new Date().toISOString().split('T')[0];
    const days = 7; 
    
    let endpoint = "";
    if (sort === "update_date") {
        if (mediaType === "movies") endpoint = "/calendars/all/movies"; 
        else endpoint = "/calendars/all/shows"; // 所有更新
    } else { 
        if (mediaType === "movies") endpoint = "/calendars/all/movies";
        else endpoint = "/calendars/all/shows/new"; // 仅新剧首播
    }

    let url = `${API_BASE}${endpoint}/${today}/${days}?extended=full`;

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
        
        // 处理 Trakt 日历数据（有时是 Array，有时是 Object）
        let flatList = [];
        if (Array.isArray(data)) {
            flatList = data;
        } else if (typeof data === 'object') {
            // 某些旧版 API 可能会按日期分组 key 返回
            Object.values(data).forEach(items => flatList.push(...items));
        }
        
        return flatList.map(d => ({ ...d, _type: mediaType === "shows" ? "show" : "movie", date: d.first_aired }));
    } catch (e) { return []; }
}

// ==========================================
// 3. TMDB 详情 + 横图处理 (核心)
// ==========================================

async function fetchTmdbDetail(id, type, subInfo, originalTitle, genreInfo) {
    try {
        // 调用 Widget.tmdb 获取中文详情
        const d = await Widget.tmdb.get(`/${type}/${id}`, { params: { language: "zh-CN" } });
        
        // 🖼️ 图片策略：优先使用背景大图 (Backdrop)，实现横版效果
        // 你的参考代码里喜欢高清图，这里用 w780 保证清晰度
        let imagePath = "";
        if (d.backdrop_path) {
            imagePath = `https://image.tmdb.org/t/p/w780${d.backdrop_path}`;
        } else if (d.poster_path) {
            // 如果没有横图，退化为竖图
            imagePath = `https://image.tmdb.org/t/p/w500${d.poster_path}`;
        }

        const title = d.name || d.title || originalTitle;
        const typeLabel = type === "tv" ? "剧" : "影";
        
        // 最终组合
        return {
            id: `trakt_${type}_${d.id}`, 
            tmdbId: d.id, 
            type: "tmdb", // 保持 tmdb 类型以便 Forward 处理资源搜索
            mediaType: type,
            title: title,
            subTitle: `[${typeLabel}] ${subInfo}`, 
            genreTitle: genreInfo, // 右侧显示日期或年份
            description: d.overview,
            posterPath: imagePath // 这里填入的是横版大图链接
        };
    } catch (e) {
        // 出错兜底
        return {
            id: `err_${id}`,
            title: originalTitle,
            subTitle: subInfo + " (无详情)",
            type: "text"
        };
    }
}
