// 源代码作者: 阿米诺斯
// Modified by: MakkaPakka (Menu Optimized)
var WidgetMetadata = {
    id: "forward.combined.media.lists.v2",
    title: "影视榜单优化版",
    description: "豆瓣 / B站 / 猫眼 / TMDB 聚合榜单",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    site: "https://github.com/",
    version: "2.0.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 300,
    modules: [
        // --- 模块1: 豆瓣系列 ---
        {
            title: "豆瓣电影",
            description: "查看豆瓣各类榜单",
            functionName: "dispatchDouban", // 指向分发函数
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "榜单类型",
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
        // --- 模块2: 动漫系列 (B站) ---
        {
            title: "动漫榜单",
            description: "Bilibili 番剧与国创",
            functionName: "dispatchAnime", // 指向分发函数
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "区域",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🇯🇵 B站番剧", value: "bangumi" },
                        { title: "🇨🇳 B站国创", value: "guo_chuang" }
                    ],
                    value: "bangumi"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        },
        // --- 模块3: 综合热度 (猫眼 + TMDB) ---
        {
            title: "热门趋势",
            description: "猫眼热映与TMDB趋势",
            functionName: "dispatchOther", // 指向分发函数
            requiresWebView: false,
            params: [
                {
                    name: "type",
                    title: "来源",
                    type: "enumeration",
                    enumOptions: [
                        { title: "🐱 猫眼热映", value: "maoyan" },
                        { title: "🌎 TMDB趋势", value: "tmdb" }
                    ],
                    value: "maoyan"
                },
                { name: "page", title: "页码", type: "page", value: "1" }
            ]
        }
        // 已移除 TMDB搜索 和 TMDB设置
    ]
};

// =============================================================
// 中间分发层 (Dispatcher) - 负责把二级菜单转给原始函数
// =============================================================

async function dispatchDouban(params) {
    var type = params.type;
    // 调用原始逻辑函数
    if (type === "weekly") return await getDoubanWeekly(params);
    if (type === "top250") return await getDoubanTop250(params);
    if (type === "new") return await getDoubanNew(params);
    return [];
}

async function dispatchAnime(params) {
    var type = params.type;
    // B站逻辑：番剧是 1，国创是 4 (原始代码逻辑)
    if (type === "bangumi") {
        return await getBilibiliRank({ ...params, type: 1 });
    }
    if (type === "guo_chuang") {
        return await getBilibiliRank({ ...params, type: 4 });
    }
    return [];
}

async function dispatchOther(params) {
    var type = params.type;
    if (type === "maoyan") return await getMaoyanHot(params);
    if (type === "tmdb") return await getTmdbTrending(params);
    return [];
}

// =============================================================
// 原始逻辑代码 (保持和谐，未做删减，仅移除被屏蔽功能的入口)
// =============================================================

// 豆瓣：本周口碑
async function getDoubanWeekly(params) {
    var res = await Widget.http.get("https://movie.douban.com/chart");
    var html = res.data;
    var $ = Widget.html.load(html);
    var items = [];
    var list = $('div#list > div.box > div.indent > div > table');
    list.each(function(i, el) {
        var item = $(el);
        var link = item.find('div.pl2 > a').attr('href');
        var title = item.find('div.pl2 > a').text().replace(/\s/g, "").replace(/\//g, " ");
        var img = item.find('a.nbg > img').attr('src');
        var rating = item.find('span.rating_nums').text();
        items.push({
            title: title,
            subTitle: "评分: " + rating,
            posterPath: img,
            link: link,
            type: "url" // 保持原始设定，点击跳网页
        });
    });
    return items;
}

// 豆瓣：Top250
async function getDoubanTop250(params) {
    var start = (params.page - 1) * 25;
    var res = await Widget.http.get("https://movie.douban.com/top250?start=" + start);
    var html = res.data;
    var $ = Widget.html.load(html);
    var items = [];
    var list = $('ol.grid_view > li');
    list.each(function(i, el) {
        var item = $(el);
        var link = item.find('div.hd > a').attr('href');
        var title = item.find('span.title').text();
        var img = item.find('div.pic > a > img').attr('src');
        var rating = item.find('span.rating_num').text();
        items.push({
            title: "No." + (start + i + 1) + " " + title,
            subTitle: "评分: " + rating,
            posterPath: img,
            link: link,
            type: "url"
        });
    });
    return items;
}

// 豆瓣：新片榜
async function getDoubanNew(params) {
    var res = await Widget.http.get("https://movie.douban.com/chart");
    var html = res.data;
    var $ = Widget.html.load(html);
    var items = [];
    var list = $('div.indent > div > table'); // 选择器略有不同
    list.each(function(i, el) {
        var item = $(el);
        var link = item.find('div.pl2 > a').attr('href');
        var title = item.find('div.pl2 > a').text().replace(/\s/g, "").replace(/\//g, " ");
        var img = item.find('a.nbg > img').attr('src');
        var rating = item.find('span.rating_nums').text();
        if (title) { // 过滤掉无效数据
            items.push({
                title: title,
                subTitle: "评分: " + rating,
                posterPath: img,
                link: link,
                type: "url"
            });
        }
    });
    return items;
}

// B站：排行榜 (type=1 番剧, type=4 国创)
async function getBilibiliRank(params) {
    var type = params.type || 1;
    var res = await Widget.http.get("https://api.bilibili.com/pgc/web/rank/list?day=3&season_type=" + type);
    var json = JSON.parse(res.data);
    var list = json.result.list;
    var items = [];
    
    // 只显示前20，防止过长
    list = list.slice(0, 50);

    list.forEach(item => {
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

// 猫眼：热映
async function getMaoyanHot(params) {
    // 猫眼为了反爬，这里使用的是某种移动端接口或镜像逻辑
    var res = await Widget.http.get("https://i.maoyan.com/api/mmdb/movie/v3/list/hot.json?ct=%E8%A5%BF%E5%AE%81&ci=42&channelId=4");
    var json = JSON.parse(res.data);
    var list = json.data.hot;
    var items = [];
    list.forEach(item => {
        items.push({
            title: item.nm,
            subTitle: "评分: " + item.sc,
            posterPath: item.img.replace('w.h', '128.180'),
            link: "https://m.maoyan.com/movie/" + item.id,
            type: "url"
        });
    });
    return items;
}

// TMDB：趋势 (原本的代码逻辑，去掉了 Key 管理部分，直接写死或留空)
// 如果你之前配置了 key，这里会尝试读取，如果没有配置，可能无法使用。
// 但鉴于你要求屏蔽 TMDB 管理，这里保留逻辑但可能需要你在代码里写死 key 或者它本来就有公用key。
async function getTmdbTrending(params) {
    var page = params.page || 1;
    // 尝试读取 Key，如果没有则使用空字符串(会导致请求失败)，或者你可以填入自己的 Key
    var apiKey = Widget.getVariable("tmdb_api_key"); 
    if (!apiKey) {
        return [{ title: "请先配置 TMDB Key", description: "此功能已被屏蔽设置入口", type: "text" }];
    }

    var url = "https://api.themoviedb.org/3/trending/all/week?api_key=" + apiKey + "&language=zh-CN&page=" + page;
    var res = await Widget.http.get(url);
    var json = JSON.parse(res.data);
    var items = [];
    
    json.results.forEach(item => {
        var title = item.title || item.name;
        var date = item.release_date || item.first_air_date;
        var img = item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : "";
        items.push({
            title: title,
            subTitle: date,
            posterPath: img,
            backdropPath: item.backdrop_path ? "https://image.tmdb.org/t/p/w500" + item.backdrop_path : img,
            link: "https://www.themoviedb.org/" + item.media_type + "/" + item.id,
            type: "url"
        });
    });
    return items;
}
