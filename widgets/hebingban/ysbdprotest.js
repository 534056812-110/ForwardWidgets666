var WidgetMetadata = {
    id: "movie_chart_combined_v5",
    title: "影视榜单 (合并修复版)",
    description: "豆瓣/TMDB/B站/IMDb 聚合",
    author: "Forward_Dev",
    site: "https://movie.douban.com",
    version: "5.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "豆瓣电影",
            description: "各类豆瓣榜单",
            functionName: "dispatchDouban",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "📅 本周口碑榜", value: "weekly" },
                        { title: "🌟 Top250", value: "top250" },
                        { title: "🆕 新片榜", value: "new" },
                        { title: "🔥 热门推荐", value: "hot" }
                    ],
                    value: "weekly"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "TMDB",
            description: "全球影视趋势",
            functionName: "dispatchTmdb",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "📈 本周趋势", value: "trending_week" },
                        { title: "🔥 今日趋势", value: "trending_day" },
                        { title: "🎬 正在热映", value: "now_playing" },
                        { title: "📺 热门剧集", value: "tv_popular" }
                    ],
                    value: "trending_week"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "动漫榜单",
            description: "Bilibili 番剧/国创",
            functionName: "dispatchBilibili",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "区域",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🇯🇵 番剧", value: "bangumi" },
                        { title: "🇨🇳 国创", value: "guochuang" }
                    ],
                    value: "bangumi"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        {
            title: "IMDb",
            description: "权威评分榜单",
            functionName: "dispatchImdb",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单",
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
        {
            title: "猫眼热映",
            description: "国内票房热度",
            functionName: "getMaoyanHot",
            requiresWebView: false,
            params: [
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// ==========================================
// 核心逻辑区 (使用 ES5 语法，防止报错)
// ==========================================

var HEADERS_PC = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
};
var HEADERS_MO = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
};

// --- 1. 豆瓣分发 ---
async function dispatchDouban(params) {
    var type = params.type;
    var page = params.page || 1;
    
    if (type === "weekly") {
        return await fetchDoubanChart("#list > div.box > div.indent > div > table");
    } else if (type === "new") {
        return await fetchDoubanChart("div.indent > div > table");
    } else if (type === "top250") {
        return await fetchDoubanTop250(page);
    } else if (type === "hot") {
        return await fetchDoubanHot(page);
    }
    return [];
}

// 豆瓣 Chart 通用解析
async function fetchDoubanChart(selector) {
    var res = await Widget.http.get("https://movie.douban.com/chart", { headers: HEADERS_PC });
    var $ = Widget.html.load(res.data);
    var items = [];
    $(selector).each(function(i, el) {
        var $el = $(el);
        var link = $el.find("div.pl2 > a").attr("href");
        var title = $el.find("div.pl2 > a").text().replace(/\s/g, "").replace(/\//g, " ");
        var img = $el.find("a.nbg > img").attr("src");
        var rate = $el.find("span.rating_nums").text();
        items.push({
            title: title,
            subTitle: "评分: " + rate,
            posterPath: img,
            link: link,
            type: "url"
        });
    });
    return items;
}

// 豆瓣 Top250
async function fetchDoubanTop250(page) {
    var start = (parseInt(page) - 1) * 25;
    var res = await Widget.http.get("https://movie.douban.com/top250?start=" + start, { headers: HEADERS_PC });
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

// 豆瓣热门 (API)
async function fetchDoubanHot(page) {
    var start = (parseInt(page) - 1) * 20;
    var url = "https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8&sort=recommend&page_limit=20&page_start=" + start;
    var res = await Widget.http.get(url, { headers: HEADERS_PC });
    var json = JSON.parse(res.data);
    var items = [];
    if (json.subjects) {
        for (var i = 0; i < json.subjects.length; i++) {
            var item = json.subjects[i];
            items.push({
                title: item.title,
                subTitle: "评分: " + item.rate,
                posterPath: item.cover,
                link: item.url,
                type: "url"
            });
        }
    }
    return items;
}

// --- 2. TMDB 分发 ---
async function dispatchTmdb(params) {
    // 尝试读取 Key，如果没有，就用一个空值，可能会失败
    var apiKey = Widget.getVariable("tmdb_api_key");
    if (!apiKey) {
        return [{ title: "未配置 TMDB Key", subTitle: "请在变量管理中设置 tmdb_api_key", type: "text" }];
    }
    
    var type = params.type;
    var page = params.page || 1;
    var url = "";
    
    if (type === "trending_week") url = "https://api.themoviedb.org/3/trending/all/week?language=zh-CN&api_key=" + apiKey + "&page=" + page;
    else if (type === "trending_day") url = "https://api.themoviedb.org/3/trending/all/day?language=zh-CN&api_key=" + apiKey + "&page=" + page;
    else if (type === "now_playing") url = "https://api.themoviedb.org/3/movie/now_playing?language=zh-CN&api_key=" + apiKey + "&page=" + page;
    else if (type === "tv_popular") url = "https://api.themoviedb.org/3/tv/popular?language=zh-CN&api_key=" + apiKey + "&page=" + page;
    
    try {
        var res = await Widget.http.get(url);
        var json = JSON.parse(res.data);
        var items = [];
        if (json.results) {
            for (var i = 0; i < json.results.length; i++) {
                var it = json.results[i];
                var name = it.title || it.name;
                var date = it.release_date || it.first_air_date || "";
                var img = it.poster_path ? "https://image.tmdb.org/t/p/w500" + it.poster_path : "";
                var mediaType = it.media_type || (type.indexOf("tv") > -1 ? "tv" : "movie");
                items.push({
                    title: name,
                    subTitle: date,
                    posterPath: img,
                    link: "https://www.themoviedb.org/" + mediaType + "/" + it.id,
                    type: "url"
                });
            }
        }
        return items;
    } catch(e) {
        return [{ title: "TMDB 请求错误", subTitle: "Key 无效或网络问题", type: "text" }];
    }
}

// --- 3. B站分发 ---
async function dispatchBilibili(params) {
    var type = (params.type === "bangumi") ? 1 : 4; 
    var url = "https://api.bilibili.com/pgc/web/rank/list?day=3&season_type=" + type;
    
    try {
        var res = await Widget.http.get(url);
        var json = JSON.parse(res.data);
        var list = json.result.list || [];
        
        // 简单分页逻辑
        var page = parseInt(params.page) || 1;
        var start = (page - 1) * 20;
        var end = start + 20;
        var pagedList = list.slice(start, end);
        
        var items = [];
        for (var i = 0; i < pagedList.length; i++) {
            var item = pagedList[i];
            items.push({
                title: item.title,
                subTitle: item.new_ep.index_show,
                posterPath: item.cover,
                link: item.link,
                type: "url"
            });
        }
        return items;
    } catch(e) {
        return [];
    }
}

// --- 4. IMDb 分发 ---
async function dispatchImdb(params) {
    var type = params.type;
    var url = (type === "top250") ? "https://m.imdb.com/chart/top/" : "https://m.imdb.com/chart/moviemeter/";
    
    try {
        var res = await Widget.http.get(url, { headers: HEADERS_MO });
        var html = res.data;
        var $ = Widget.html.load(html);
        var items = [];
        
        // 尝试解析 IMDb 移动端结构
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
        
        if (items.length === 0) {
            return [{ title: "IMDb 解析需验证", subTitle: "网站结构复杂或需要验证码", type: "text" }];
        }
        return items;
    } catch (e) {
        return [{ title: "IMDb 连接失败", subTitle: "网络超时", type: "text" }];
    }
}

// --- 5. 猫眼 ---
async function getMaoyanHot(params) {
    var url = "https://i.maoyan.com/api/mmdb/movie/v3/list/hot.json?ct=%E8%A5%BF%E5%AE%81&ci=42&channelId=4";
    try {
        var res = await Widget.http.get(url, { headers: HEADERS_MO });
        var json = JSON.parse(res.data);
        var items = [];
        if (json.data && json.data.hot) {
            var list = json.data.hot;
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                items.push({
                    title: item.nm,
                    subTitle: "评分: " + item.sc,
                    posterPath: item.img.replace('w.h', '128.180'),
                    link: "https://m.maoyan.com/movie/" + item.id,
                    type: "url"
                });
            }
        }
        return items;
    } catch(e) {
        return [];
    }
}
