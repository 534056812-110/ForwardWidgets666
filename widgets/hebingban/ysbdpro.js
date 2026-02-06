var WidgetMetadata = {
    id: "universal_movie_chart_v3",
    title: "影视榜单 (全功能合并)",
    description: "豆瓣 / TMDB / B站 / IMDb / 猫眼 聚合",
    author: "玛卡巴卡",
    site: "https://movie.douban.com",
    version: "3.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        // --- 1. 豆瓣系列 (合并) ---
        {
            title: "豆瓣电影",
            description: "评分 / Top250 / 新片",
            functionName: "dispatchDouban", // 分发函数
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单选择",
                    type: "enumeration",
                    enumOptions: [
                        { title: "📅 本周口碑榜", value: "weekly" },
                        { title: "🌟 Top250", value: "top250" },
                        { title: "🆕 新片榜", value: "new" },
                        { title: "🔥 热门电影", value: "hot" }
                    ],
                    value: "weekly"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 2. TMDB 系列 (合并) ---
        {
            title: "TMDB 影视",
            description: "全球趋势 / 热映",
            functionName: "dispatchTmdb", // 分发函数
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单选择",
                    type: "enumeration",
                    enumOptions: [
                        { title: "📈 热门趋势 (周)", value: "trending_week" },
                        { title: "🔥 热门趋势 (日)", value: "trending_day" },
                        { title: "🎬 正在热映", value: "now_playing" },
                        { title: "📺 热门剧集", value: "tv_hot" }
                    ],
                    value: "trending_week"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 3. 动漫系列 (B站合并) ---
        {
            title: "动漫榜单",
            description: "Bilibili 番剧与国创",
            functionName: "dispatchBilibili", // 分发函数
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "区域选择",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🇯🇵 B站番剧榜", value: "bangumi" },
                        { title: "🇨🇳 B站国创榜", value: "guo_chuang" }
                    ],
                    value: "bangumi"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 4. IMDb 系列 (合并) ---
        {
            title: "IMDb 榜单",
            description: "全球权威评分",
            functionName: "dispatchImdb", // 分发函数
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单选择",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🏆 Top 250", value: "top250" },
                        { title: "🔥 热门电影", value: "popular" }
                    ],
                    value: "top250"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 5. 其他榜单 (猫眼) ---
        {
            title: "猫眼热映",
            description: "国内票房与热度",
            functionName: "getMaoyanHot",
            requiresWebView: false,
            params: [
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// =================== 核心请求头 ===================
const UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

// =================== 1. 豆瓣分发与逻辑 ===================
async function dispatchDouban(params) {
    const type = params.type;
    if (type === "weekly") return await getDoubanList("https://movie.douban.com/chart", "weekly");
    if (type === "new") return await getDoubanList("https://movie.douban.com/chart", "new");
    if (type === "top250") return await getDoubanTop250(params);
    if (type === "hot") return await getDoubanHot(params);
    return [];
}

async function getDoubanList(url, type) {
    const res = await Widget.http.get(url, { headers: { "User-Agent": UA_DESKTOP } });
    const $ = Widget.html.load(res.data);
    const items = [];
    
    // 豆瓣Chart页面的两种表格
    const selector = type === "weekly" ? '#list > div.box > div.indent > div > table' : 'div.indent > div > table';
    
    $(selector).each((i, el) => {
        const $el = $(el);
        const link = $el.find('div.pl2 > a').attr('href');
        const title = $el.find('div.pl2 > a').text().replace(/\s/g, "").replace(/\//g, " ");
        const img = $el.find('a.nbg > img').attr('src');
        const rating = $el.find('span.rating_nums').text();
        if (title) {
            items.push({
                title: title,
                subTitle: `评分: ${rating}`,
                posterPath: img,
                link: link,
                type: "url"
            });
        }
    });
    return items;
}

async function getDoubanTop250(params) {
    const start = (parseInt(params.page) - 1) * 25;
    const url = `https://movie.douban.com/top250?start=${start}`;
    const res = await Widget.http.get(url, { headers: { "User-Agent": UA_DESKTOP } });
    const $ = Widget.html.load(res.data);
    const items = [];
    
    $('ol.grid_view > li').each((i, el) => {
        const $el = $(el);
        const title = $el.find('span.title').first().text();
        const rating = $el.find('span.rating_num').text();
        const img = $el.find('.pic img').attr('src');
        const link = $el.find('.hd a').attr('href');
        items.push({
            title: `No.${start + i + 1} ${title}`,
            subTitle: `评分: ${rating}`,
            posterPath: img,
            link: link,
            type: "url"
        });
    });
    return items;
}

async function getDoubanHot(params) {
    // 豆瓣热门采用 API 形式
    const start = (parseInt(params.page) - 1) * 20;
    const url = `https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8&sort=recommend&page_limit=20&page_start=${start}`;
    const res = await Widget.http.get(url, { headers: { "User-Agent": UA_DESKTOP, "Referer": "https://movie.douban.com/" } });
    const json = JSON.parse(res.data);
    
    return json.subjects.map(item => ({
        title: item.title,
        subTitle: `评分: ${item.rate}`,
        posterPath: item.cover,
        link: item.url,
        type: "url"
    }));
}


// =================== 2. TMDB 分发与逻辑 ===================
// 如果没有 API Key，这里使用公开的 Vercel 镜像或者提示
async function dispatchTmdb(params) {
    // 尝试获取用户之前设置的 Key，如果没有，提示
    // 原版榜单通常依赖用户自己填 Key，或者内置了一个公共 Key。
    // 为了保证你能用，这里建议你去 TMDB 申请一个 Key 填在下面变量里
    const API_KEY = Widget.getVariable("tmdb_api_key"); 
    
    if (!API_KEY) {
        return [{ 
            title: "需要配置 TMDB API Key", 
            description: "请在变量管理中添加 'tmdb_api_key'", 
            type: "text" 
        }];
    }

    const type = params.type;
    const page = params.page || 1;
    let url = "";

    if (type === "trending_week") url = `https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=zh-CN&page=${page}`;
    if (type === "trending_day") url = `https://api.themoviedb.org/3/trending/all/day?api_key=${API_KEY}&language=zh-CN&page=${page}`;
    if (type === "now_playing") url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=zh-CN&page=${page}`;
    if (type === "tv_hot") url = `https://api.themoviedb.org/3/tv/popular?api_key=${API_KEY}&language=zh-CN&page=${page}`;

    try {
        const res = await Widget.http.get(url);
        const json = JSON.parse(res.data);
        return json.results.map(item => ({
            title: item.title || item.name,
            subTitle: item.release_date || item.first_air_date || "未知日期",
            posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
            link: `https://www.themoviedb.org/${item.media_type || (type.includes('tv') ? 'tv':'movie')}/${item.id}`,
            type: "url"
        }));
    } catch(e) {
        return [{ title: "TMDB 请求失败", description: "请检查网络或 API Key", type: "text" }];
    }
}


// =================== 3. B站动漫 分发与逻辑 ===================
async function dispatchBilibili(params) {
    const type = params.type === "bangumi" ? 1 : 4; // 1番剧 4国创
    const url = `https://api.bilibili.com/pgc/web/rank/list?day=3&season_type=${type}`;
    
    const res = await Widget.http.get(url);
    const json = JSON.parse(res.data);
    
    // B站接口一次返回所有数据，我们模拟分页
    const list = json.result.list || [];
    const page = parseInt(params.page) || 1;
    const pageSize = 20;
    const start = (page - 1) * pageSize;
    const pagedList = list.slice(start, start + pageSize);

    return pagedList.map(item => ({
        title: item.title,
        subTitle: item.new_ep.index_show,
        posterPath: item.cover,
        link: item.link,
        type: "url"
    }));
}


// =================== 4. IMDb 分发与逻辑 ===================
async function dispatchImdb(params) {
    // IMDb 很难爬，这里使用简单的页面解析，可能需要 VPN
    const type = params.type;
    let url = "";
    if (type === "top250") url = "https://m.imdb.com/chart/top/";
    if (type === "popular") url = "https://m.imdb.com/chart/moviemeter/";

    try {
        const res = await Widget.http.get(url, { 
            headers: { 
                "User-Agent": UA_MOBILE,
                "Accept-Language": "en-US,en;q=0.9"
            } 
        });
        const html = res.data;
        // 针对 IMDb 移动版页面的简单正则提取 (比 DOM 解析更稳)
        // 这是一个简化的提取逻辑
        const items = [];
        const $ = Widget.html.load(html);
        
        $('.media-list .media-list__item').each((i, el) => {
             const $el = $(el);
             const title = $el.find('.media-list__item-title').text().trim();
             const rank = $el.find('.media-list__item-index').text().trim();
             const rating = $el.find('.imdb-rating').text().trim();
             const img = $el.find('img').attr('src');
             const link = "https://m.imdb.com" + $el.find('a').attr('href');
             
             if (title) {
                 items.push({
                     title: `${rank} ${title}`,
                     subTitle: `Rating: ${rating}`,
                     posterPath: img,
                     link: link,
                     type: "url"
                 });
             }
        });

        // 如果上面没提取到 (IMDb 经常改版)，做个兜底提示
        if (items.length === 0) {
            return [{ title: "IMDb 解析失败", description: "网站结构已变更或需要验证码", type: "text" }];
        }
        return items;

    } catch (e) {
        return [{ title: "连接 IMDb 失败", description: "请确保网络环境支持访问 IMDb", type: "text" }];
    }
}


// =================== 5. 猫眼逻辑 ===================
async function getMaoyanHot(params) {
    const url = "https://i.maoyan.com/api/mmdb/movie/v3/list/hot.json?ct=%E8%A5%BF%E5%AE%81&ci=42&channelId=4";
    const res = await Widget.http.get(url, { headers: { "User-Agent": UA_MOBILE } });
    const json = JSON.parse(res.data);
    
    return json.data.hot.map(item => ({
        title: item.nm,
        subTitle: `评分: ${item.sc}`,
        posterPath: item.img.replace('w.h', '128.180'),
        link: `https://m.maoyan.com/movie/${item.id}`,
        type: "url"
    }));
}
