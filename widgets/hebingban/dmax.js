var WidgetMetadata = {
    id: "douban_pure",
    title: "豆瓣榜单",
    description: "本周口碑 / Top250 / 新片 / 热门",
    author: "Forward_User",
    site: "https://movie.douban.com",
    version: "1.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        {
            title: "浏览榜单",
            description: "查看豆瓣各类排行榜",
            functionName: "loadList",
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "📅 本周口碑榜", value: "weekly" },
                        { title: "🌟 Top250", value: "top250" },
                        { title: "🆕 新片排行榜", value: "new" },
                        { title: "🔥 热门电影", value: "hot" }
                    ],
                    value: "weekly"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
    ]
};

// =================== 核心逻辑 ===================

// 模拟电脑浏览器 UA，防止豆瓣拦截
var HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://movie.douban.com/"
};

// 统一入口函数
async function loadList(params) {
    var type = params.type || "weekly";
    var page = parseInt(params.page) || 1;

    if (type === "weekly") {
        // 口碑榜 (无分页，只取第一页)
        if (page > 1) return []; 
        return await fetchChart("#list > div.box > div.indent > div > table");
    } 
    else if (type === "new") {
        // 新片榜 (无分页，只取第一页)
        if (page > 1) return [];
        return await fetchChart("div.indent > div > table");
    } 
    else if (type === "top250") {
        // Top250 (支持分页)
        return await fetchTop250(page);
    } 
    else if (type === "hot") {
        // 热门 (API 分页)
        return await fetchHot(page);
    }
    
    return [];
}

/**
 * 解析 Chart 页面 (口碑榜/新片榜)
 * 这两个榜单都在同一个页面，只是 HTML 结构位置不同
 */
async function fetchChart(selector) {
    var url = "https://movie.douban.com/chart";
    var res = await Widget.http.get(url, { headers: HEADERS });
    var $ = Widget.html.load(res.data);
    var items = [];
    
    $(selector).each(function(i, el) {
        var $el = $(el);
        var link = $el.find("div.pl2 > a").attr("href");
        
        // 提取标题，去除多余空格和换行
        var rawTitle = $el.find("div.pl2 > a").text();
        var title = rawTitle.replace(/\s+/g, "").replace(/\//g, " ").trim();
        
        var img = $el.find("a.nbg > img").attr("src");
        var rating = $el.find("span.rating_nums").text();
        var date = $el.find("p.pl").text().split("/")[0].trim(); // 提取年份/日期

        if (title) {
            items.push({
                title: title,
                subTitle: "评分: " + rating + " | " + date,
                posterPath: img,
                link: link,
                type: "url" // 豆瓣无法直接播放，使用 URL 模式跳浏览器
            });
        }
    });
    return items;
}

/**
 * 解析 Top 250
 */
async function fetchTop250(page) {
    var start = (page - 1) * 25;
    var url = "https://movie.douban.com/top250?start=" + start;
    
    var res = await Widget.http.get(url, { headers: HEADERS });
    var $ = Widget.html.load(res.data);
    var items = [];
    
    $("ol.grid_view > li").each(function(i, el) {
        var $el = $(el);
        var title = $el.find("span.title").first().text();
        var rating = $el.find("span.rating_num").text();
        var img = $el.find(".pic img").attr("src");
        var link = $el.find(".hd a").attr("href");
        var quote = $el.find("span.inq").text(); // 一句话简评

        items.push({
            title: "No." + (start + i + 1) + " " + title,
            subTitle: "评分: " + rating + (quote ? " | " + quote : ""),
            posterPath: img,
            link: link,
            type: "url"
        });
    });
    return items;
}

/**
 * 获取热门 (使用内部 JSON API)
 */
async function fetchHot(page) {
    var start = (page - 1) * 20;
    // 豆瓣官方的一个隐藏 API，获取热门电影
    var url = "https://movie.douban.com/j/search_subjects?type=movie&tag=%E7%83%AD%E9%97%A8&sort=recommend&page_limit=20&page_start=" + start;
    
    try {
        var res = await Widget.http.get(url, { headers: HEADERS });
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
    } catch (e) {
        return [];
    }
}
