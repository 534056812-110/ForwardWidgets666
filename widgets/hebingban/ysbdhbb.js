// 基于阿米诺斯原版逻辑复刻 - 菜单合并版
var WidgetMetadata = {
    id: "movie_chart_amino_merge",
    title: "影视榜单 (合并版)",
    description: "豆瓣/B站/TMDB/猫眼/IMDb (含搜索与设置)",
    author: "Forward_User",
    site: "https://github.com/",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        // --- 1. 豆瓣系列 (合并) ---
        {
            title: "豆瓣电影",
            description: "口碑 / Top250 / 新片",
            functionName: "dispatchDouban",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单选择",
                    type: "enumeration",
                    enumOptions: [
                        { title: "📅 本周口碑榜", value: "weekly" },
                        { title: "🌟 Top250", value: "top250" },
                        { title: "🆕 新片榜", value: "new" }
                    ],
                    value: "weekly"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 2. 动漫榜单 (合并) ---
        {
            title: "B站动漫",
            description: "番剧与国创",
            functionName: "dispatchBilibili",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "区域选择",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🇯🇵 B站番剧", value: "bangumi" },
                        { title: "🇨🇳 B站国创", value: "guochuang" }
                    ],
                    value: "bangumi"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 3. TMDB 榜单 (合并) ---
        {
            title: "TMDB 榜单",
            description: "全球影视趋势",
            functionName: "dispatchTmdbList",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🔥 热门趋势", value: "trending" },
                        { title: "🎬 正在热映", value: "now_playing" },
                        { title: "📺 热门剧集", value: "tv_popular" }
                    ],
                    value: "trending"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 4. IMDb 榜单 (合并) ---
        {
            title: "IMDb 榜单",
            description: "权威评分排行",
            functionName: "dispatchImdb",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🏆 Top 250", value: "top250" },
                        { title: "🔥 热门电影", value: "popular" }
                    ],
                    value: "top250"
                }
            ]
        },
        // --- 5. 猫眼 (独立) ---
        {
            title: "猫眼热映",
            description: "国内票房热度",
            functionName: "getMaoyanHot",
            requiresWebView: false,
            params: [
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 6. TMDB 搜索 (保留原版独立入口) ---
        {
            title: "TMDB 搜索",
            description: "搜索 TMDB 数据库",
            functionName: "searchTmdb",
            requiresWebView: false,
            params: [
                {
                    name: "keyword",
                    title: "关键词",
                    type: "input",
                    description: "输入电影或剧集名称"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 7. TMDB 设置 (保留原版独立入口) ---
        {
            title: "TMDB 设置",
            description: "配置 API Key",
            functionName: "setupTmdbKey",
            requiresWebView: false,
            params: [
                {
                    name: "api_key",
                    title: "API Key",
                    type: "input",
                    description: "输入你的 TMDB API Key"
                }
            ]
        }
    ]
};

// =============================================================
// 核心逻辑区 (严格保留原版功能)
// =============================================================

var UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var UA_MOBILE = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

// --- 豆瓣分发 ---
async function dispatchDouban(params) {
    var type = params.type;
    if (type === "weekly") return await getDoubanChart("weekly");
    if (type === "top250") return await getDoubanTop250(params);
    if (type === "new") return await getDoubanChart("new");
    return [];
}

async function getDoubanChart(mode) {
    var url = "https://movie.douban.com/chart";
    var res = await Widget.http.get(url, { headers: { "User-Agent": UA_DESKTOP } });
    var $ = Widget.html.load(res.data);
    var items = [];
    var selector = mode === "weekly" ? "#list > div.box > div.indent > div > table" : "div.indent > div > table";
    
    $(selector).each(function(i, el) {
        var $el = $(el);
        var link = $el.find("div.pl2 > a").attr("href");
        var title = $el.find("div.pl2 > a").text().replace(/\s/g, "").replace(/\//g, " ");
        var img = $el.find("a.nbg > img").attr("src");
        var rating = $el.find("span.rating_nums").text();
        items.push({
            title: title,
            subTitle: "评分: " + rating,
            posterPath: img,
            link: link,
            type: "url"
        });
    });
    return items;
}

async function getDoubanTop250(params) {
    var page = parseInt(params.page) || 1;
    var start = (page - 1) * 25;
    var res = await Widget.http.get("https://movie.douban.com/top250?start=" + start, { headers: { "User-Agent": UA_DESKTOP } });
    var $ = Widget.html.load(res.data);
    var items = [];
    $("ol.grid_view > li").each(function(i, el) {
        var $el = $(el);
        var title = $el.find("span.title").first().text();
        var rate = $el.find("span.rating_num").text();
        var img = $el.find(".pic img").attr("src");
        var link = $el.find(".hd a").attr("href");
        items.push({
            title: "No." + (start + i + 1) + " " + title,
            subTitle: "评分: " + rate,
            posterPath: img,
            link: link,
            type: "url"
        });
    });
    return items;
}

// --- B站分发 ---
async function dispatchBilibili(params) {
    var type = params.type === "bangumi" ? 1 : 4;
    var res = await Widget.http.get("https://api.bilibili.com/pgc/web/rank/list?day=3&season_type=" + type);
    var json = JSON.parse(res.data);
    var list = json.result.list || [];
    var items = [];
    
    // 简单的分页模拟
    var page = parseInt(params.page) || 1;
    var start = (page - 1) * 20;
    var end = start + 20;
    var pagedList = list.slice(start, end);

    pagedList.forEach(function(item) {
        items.push({
            title: item.title,
            subTitle: item.new_ep.index_show,
            posterPath: item.cover,
            link: item.link,
            type: "url"
        });
    });
    return items;
}

// --- TMDB 逻辑 (列表 + 搜索 + 设置) ---

// 获取 API Key (优先读取设置，没有则尝试使用默认/空)
function getTmdbKey() {
    return Widget.getVariable("tmdb_api_key");
}

async function dispatchTmdbList(params) {
    var apiKey = getTmdbKey();
    if (!apiKey) return [{ title: "未设置 API Key", subTitle: "请在主菜单选择【TMDB 设置】进行配置", type: "text" }];
    
    var type = params.type;
    var page = params.page || 1;
    var url = "";
    
    if (type === "trending") url = "https://api.themoviedb.org/3/trending/all/week?language=zh-CN&api_key=" + apiKey + "&page=" + page;
    if (type === "now_playing") url = "https://api.themoviedb.org/3/movie/now_playing?language=zh-CN&api_key=" + apiKey + "&page=" + page;
    if (type === "tv_popular") url = "https://api.themoviedb.org/3/tv/popular?language=zh-CN&api_key=" + apiKey + "&page=" + page;
    
    return await fetchTmdb(url);
}

async function searchTmdb(params) {
    var apiKey = getTmdbKey();
    if (!apiKey) return [{ title: "未设置 API Key", subTitle: "请在主菜单选择【TMDB 设置】进行配置", type: "text" }];
    
    var keyword = params.keyword;
    var page = params.page || 1;
    var url = "https://api.themoviedb.org/3/search/multi?api_key=" + apiKey + "&language=zh-CN&query=" + encodeURIComponent(keyword) + "&page=" + page;
    
    return await fetchTmdb(url);
}

async function fetchTmdb(url) {
    try {
        var res = await Widget.http.get(url);
        var json = JSON.parse(res.data);
        var items = [];
        if (json.results) {
            json.results.forEach(function(it) {
                var name = it.title || it.name;
                var date = it.release_date || it.first_air_date || "";
                var img = it.poster_path ? "https://image.tmdb.org/t/p/w500" + it.poster_path : "";
                var mediaType = it.media_type || "movie"; // 默认
                if (!it.media_type && it.name) mediaType = "tv"; // 简单推断

                items.push({
                    title: name,
                    subTitle: date,
                    posterPath: img,
                    link: "https://www.themoviedb.org/" + mediaType + "/" + it.id,
                    type: "url"
                });
            });
        }
        return items;
    } catch(e) {
        return [{ title: "TMDB 请求失败", subTitle: "请检查 API Key 或网络", type: "text" }];
    }
}

// TMDB 设置功能
async function setupTmdbKey(params) {
    var key = params.api_key;
    if (key) {
        Widget.setVariable("tmdb_api_key", key);
        return [{ title: "设置成功", subTitle: "TMDB API Key 已保存: " + key, type: "text" }];
    } else {
        return [{ title: "输入无效", subTitle: "API Key 不能为空", type: "text" }];
    }
}

// --- IMDb 分发 ---
async function dispatchImdb(params) {
    var type = params.type;
    var url = type === "top250" ? "https://m.imdb.com/chart/top/" : "https://m.imdb.com/chart/moviemeter/";
    
    try {
        var res = await Widget.http.get(url, { headers: { "User-Agent": UA_MOBILE, "Accept-Language": "en-US" } });
        var html = res.data;
        var $ = Widget.html.load(html);
        var items = [];
        
        $(".media-list .media-list__item").each(function(i, el) {
            var $el = $(el);
            var title = $el.find(".media-list__item-title").text().trim();
            var rank = $el.find(".media-list__item-index").text().trim();
            var rate = $el.find(".imdb-rating").text().trim();
            var img = $el.find("img").attr("src");
            var link = "https://m.imdb.com" + $el.find("a").attr("href");
            
            if (title) {
                items.push({
                    title: rank + " " + title,
                    subTitle: "Rating: " + rate,
                    posterPath: img,
                    link: link,
                    type: "url"
                });
            }
        });
        
        if (items.length === 0) return [{ title: "IMDb 暂时无法访问", subTitle: "可能需要验证", type: "text" }];
        return items;
    } catch(e) {
        return [{ title: "网络错误", subTitle: "连接 IMDb 失败", type: "text" }];
    }
}

// --- 猫眼逻辑 ---
async function getMaoyanHot(params) {
    var url = "https://i.maoyan.com/api/mmdb/movie/v3/list/hot.json?ct=%E8%A5%BF%E5%AE%81&ci=42&channelId=4";
    try {
        var res = await Widget.http.get(url, { headers: { "User-Agent": UA_MOBILE } });
        var json = JSON.parse(res.data);
        var list = json.data.hot || [];
        var items = [];
        list.forEach(function(item) {
            items.push({
                title: item.nm,
                subTitle: "评分: " + item.sc,
                posterPath: item.img.replace('w.h', '128.180'),
                link: "https://m.maoyan.com/movie/" + item.id,
                type: "url"
            });
        });
        return items;
    } catch(e) {
        return [];
    }
}
