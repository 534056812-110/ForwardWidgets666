WidgetMetadata = {
    id: "jable_pro_max_makka",
    title: "Jable Pro",
    description: "支持手动搜索筛选，点击即可直接播放。",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    site: "https://jable.tv",
    version: "2.2.0",
    requiredVersion: "0.0.2",
    detailCacheDuration: 60,
    globalParams: [],
    modules: [
        {
            title: "🔍 全局搜索",
            functionName: "searchWrapper",
            requiresWebView: false,
            type: "list",
            params: [
                { name: "keyword", title: "关键词", type: "input", value: "" },
                {
                    name: "sort_by",
                    title: "排序",
                    type: "enumeration",
                    value: "video_viewed",
                    enumOptions: [
                        { title: "最多观看", value: "video_viewed" },
                        { title: "近期最佳", value: "post_date_and_popularity" },
                        { title: "最近更新", value: "post_date" },
                        { title: "最多收藏", value: "most_favourited" },
                    ],
                },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        {
            title: "🔥 热门榜单",
            functionName: "loadListWrapper",
            requiresWebView: false,
            type: "list",
            params: [
                { name: "path", type: "constant", value: "/hot/" },
                {
                    name: "sort_by",
                    title: "排序",
                    type: "enumeration",
                    value: "video_viewed_today",
                    enumOptions: [
                        { title: "今日热门", value: "video_viewed_today" },
                        { title: "本周热门", value: "video_viewed_week" },
                        { title: "本月热门", value: "video_viewed_month" },
                        { title: "所有时间", value: "video_viewed" },
                    ],
                },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        {
            title: "🆕 最新更新",
            functionName: "loadListWrapper",
            requiresWebView: false,
            type: "list",
            params: [
                { name: "path", type: "constant", value: "/new-release/" },
                {
                    name: "sort_by",
                    title: "排序",
                    type: "enumeration",
                    value: "post_date",
                    enumOptions: [
                        { title: "最新发布", value: "post_date" },
                        { title: "最多观看", value: "video_viewed" },
                        { title: "最多收藏", value: "most_favourited" },
                    ],
                },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        {
            title: "💃 女优筛选",
            functionName: "loadCategoryWrapper",
            requiresWebView: false,
            type: "list",
            params: [
                {
                    name: "manual_input",
                    title: "🔍 手动搜索 (优先)",
                    type: "input",
                    description: "输入名字(如:深田咏美)，将忽略下方选择",
                    value: ""
                },
                {
                    name: "path",
                    title: "快速选择",
                    type: "enumeration",
                    value: "/s1/models/yua-mikami/",
                    enumOptions: [
                        { title: "三上悠亚", value: "/s1/models/yua-mikami/" },
                        { title: "河北彩伽", value: "/models/saika-kawakita2/" },
                        { title: "楪可怜", value: "/models/86b2f23f95cc485af79fe847c5b9de8d/" },
                        { title: "小野夕子", value: "/models/2958338aa4f78c0afb071e2b8a6b5f1b/" },
                        { title: "大槻响", value: "/models/hibiki-otsuki/" },
                        { title: "JULIA", value: "/models/julia/" },
                        { title: "明里䌷", value: "/models/tsumugi-akari/" },
                        { title: "桃乃木香奈", value: "/models/momonogi-kana/" },
                        { title: "篠田ゆう", value: "/s1/models/shinoda-yuu/" },
                        { title: "枫可怜", value: "/models/kaede-karen/" },
                        { title: "美谷朱里", value: "/s1/models/mitani-akari/" },
                        { title: "山岸逢花", value: "/models/yamagishi-aika/" },
                        { title: "八掛うみ", value: "/models/83397477054d35cd07e2c48685335a86/" },
                        { title: "八木奈々", value: "/models/3610067a1d725dab8ee8cd3ffe828850/" },
                        { title: "本庄鈴", value: "/models/honjou-suzu/" },
                        { title: "樱空桃", value: "/models/sakura-momo/" },
                        { title: "石川澪", value: "/models/a855133fa44ca5e7679cac0a0ab7d1cb/" },
                        { title: "美ノ嶋めぐり", value: "/models/d1ebb3d61ee367652e6b1f35b469f2b6/" },
                        { title: "未歩なな", value: "/models/c9535c2f157202cd0e934d62ef582e2e/" },
                        { title: "凉森玲梦", value: "/models/7cadf3e484f607dc7d0f1c0e7a83b007/" }
                    ],
                },
                {
                    name: "sort_by",
                    title: "排序",
                    type: "enumeration",
                    value: "post_date",
                    enumOptions: [
                        { title: "最近更新", value: "post_date" },
                        { title: "最多观看", value: "video_viewed" },
                    ],
                },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        {
            title: "👙 衣着筛选",
            functionName: "loadCategoryWrapper",
            requiresWebView: false,
            type: "list",
            params: [
                {
                    name: "manual_input",
                    title: "🔍 手动搜索 (优先)",
                    type: "input",
                    description: "输入标签(如:白丝)，将忽略下方选择",
                    value: ""
                },
                {
                    name: "path",
                    title: "选择衣着",
                    type: "enumeration",
                    value: "/tags/black-pantyhose/",
                    enumOptions: [
                        { title: "黑丝", value: "/tags/black-pantyhose/" },
                        { title: "肉丝", value: "/tags/flesh-toned-pantyhose/" },
                        { title: "丝袜", value: "/tags/pantyhose/" },
                        { title: "兽耳", value: "/tags/kemonomimi/" },
                        { title: "渔网", value: "/tags/fishnets/" },
                        { title: "水着(泳装)", value: "/tags/swimsuit/" },
                        { title: "校服(JK)", value: "/tags/school-uniform/" },
                        { title: "旗袍", value: "/tags/cheongsam/" },
                        { title: "婚纱", value: "/tags/wedding-dress/" },
                        { title: "女僕", value: "/tags/maid/" },
                        { title: "和服", value: "/tags/kimono/" },
                        { title: "眼镜娘", value: "/tags/glasses/" },
                        { title: "过膝袜", value: "/tags/knee-socks/" },
                        { title: "运动装", value: "/tags/sportswear/" },
                        { title: "兔女郎", value: "/tags/bunny-girl/" },
                        { title: "Cosplay", value: "/tags/Cosplay/" }
                    ],
                },
                { name: "sort_by", title: "排序", type: "enumeration", value: "post_date", enumOptions: [{ title: "更新", value: "post_date" }, { title: "观看", value: "video_viewed" }] },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        {
            title: "🎬 剧情筛选",
            functionName: "loadCategoryWrapper",
            requiresWebView: false,
            type: "list",
            params: [
                {
                    name: "manual_input",
                    title: "🔍 手动搜索 (优先)",
                    type: "input",
                    description: "输入关键词(如:NTR)，将忽略下方选择",
                    value: ""
                },
                {
                    name: "path",
                    title: "选择剧情",
                    type: "enumeration",
                    value: "/tags/affair/",
                    enumOptions: [
                        { title: "出轨", value: "/tags/affair/" },
                        { title: "NTR", value: "/tags/ntr/" },
                        { title: "童贞", value: "/tags/virginity/" },
                        { title: "复仇", value: "/tags/avenge/" },
                        { title: "媚药", value: "/tags/love-potion/" },
                        { title: "催眠", value: "/tags/hypnosis/" },
                        { title: "偷拍", value: "/tags/private-cam/" },
                        { title: "时间停止", value: "/tags/time-stop/" },
                        { title: "颜射", value: "/tags/facial/" },
                        { title: "中出", value: "/tags/creampie/" },
                        { title: "多P/群交", value: "/tags/groupsex/" },
                        { title: "调教", value: "/tags/tune/" },
                        { title: "露出", value: "/tags/outdoor/" }
                    ],
                },
                { name: "sort_by", title: "排序", type: "enumeration", value: "post_date", enumOptions: [{ title: "更新", value: "post_date" }, { title: "观看", value: "video_viewed" }] },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        }
    ]
};

// ==========================================
// 业务逻辑函数 (全部独立，确保导入成功)
// ==========================================

async function searchWrapper(params) {
    return await executeSearch(params.keyword, params.sort_by, params.page);
}

async function loadListWrapper(params) {
    const baseUrl = "https://jable.tv";
    const suffix = "?mode=async&function=get_block&block_id=list_videos_common_videos_list";
    let url = `${baseUrl}${params.path}${suffix}`;
    return await fetchAndParse(url, params.sort_by, params.page);
}

async function loadCategoryWrapper(params) {
    // 手动输入逻辑：如果用户输入了文字，优先执行搜索
    if (params.manual_input && params.manual_input.trim().length > 0) {
        return await executeSearch(params.manual_input.trim(), params.sort_by, params.page);
    }
    
    // 下拉选择逻辑
    const baseUrl = "https://jable.tv";
    const suffix = "?mode=async&function=get_block&block_id=list_videos_common_videos_list";
    
    let path = params.path;
    if (!path.startsWith("http")) {
        path = baseUrl + path;
    }
    
    let url = path;
    if (!url.includes("mode=async")) {
        url += suffix;
    }
    
    return await fetchAndParse(url, params.sort_by, params.page);
}

async function executeSearch(keyword, sortBy, page) {
    if (!keyword) return [];
    const baseUrl = "https://jable.tv";
    const searchSuffix = "?mode=async&function=get_block&block_id=list_videos_videos_list_search_result";
    const encodedKey = encodeURIComponent(keyword);
    let url = `${baseUrl}/search/${encodedKey}/${searchSuffix}&q=${encodedKey}`;
    return await fetchAndParse(url, sortBy, page);
}

// 核心解析函数
async function fetchAndParse(url, sortBy, page) {
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://jable.tv/",
    };

    if (sortBy) url += `&sort_by=${sortBy}`;
    if (page) url += `&from=${page}`;

    try {
        const response = await Widget.http.get(url, { headers: headers });
        
        if (!response || !response.data) {
            return []; 
        }

        const $ = Widget.html.load(response.data);
        const items = [];

        $(".video-img-box").each((i, el) => {
            const $el = $(el);
            const $link = $el.find(".title a").first();
            const href = $link.attr("href");
            if (!href) return;

            const $img = $el.find("img").first();
            let cover = $img.attr("data-src") || $img.attr("src");
            const preview = $img.attr("data-preview") || cover;
            const title = $link.text().trim(); 
            const duration = $el.find(".absolute-bottom-right .label").text().trim();
            const viewCount = $el.find(".absolute-bottom-left .label").text().trim();

            items.push({
                id: href,
                // 这里关键：type: "url" 会触发 Forward 调用 loadDetail
                type: "url", 
                title: title,
                backdropPath: cover, 
                posterPath: cover,   
                previewUrl: preview, 
                link: href,
                mediaType: "movie",
                description: `时长: ${duration} | 观看: ${viewCount}`,
                // releaseDate 用于显示在副标题
                releaseDate: duration
            });
        });

        return items;

    } catch (e) {
        return [{ title: "加载失败", description: "请检查网络或代理", type: "text" }];
    }
}

// 播放详情解析函数 (Forward 会自动调用这个)
async function loadDetail(link) {
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://jable.tv/",
    };

    try {
        const response = await Widget.http.get(link, { headers: headers });
        const html = response.data;
        
        // 核心：提取 m3u8 地址
        const hlsMatch = html.match(/var hlsUrl = '(.*?)';/);
        let hlsUrl = "";
        if (hlsMatch && hlsMatch[1]) {
            hlsUrl = hlsMatch[1];
        } else {
            throw new Error("未找到视频地址，可能需要验证");
        }

        const $ = Widget.html.load(html);
        const title = $("meta[property='og:title']").attr("content") || "Video";
        const cover = $("meta[property='og:image']").attr("content") || "";
        
        // 提取相关推荐
        const relatedItems = [];
        $("#list_videos_common_videos_list .video-img-box").each((i, el) => {
             const $el = $(el);
             const href = $el.find(".title a").attr("href");
             const rTitle = $el.find(".title a").text().trim();
             const rCover = $el.find("img").attr("data-src");
             if(href) {
                 relatedItems.push({
                     id: href,
                     title: rTitle,
                     backdropPath: rCover,
                     link: href,
                     type: "url",
                     mediaType: "movie"
                 });
             }
        });

        // 返回给 Forward 的播放对象
        return {
            id: link,
            type: "detail", // 告诉 APP 这是一个详情页
            title: title,
            videoUrl: hlsUrl, // 视频流地址
            backdropPath: cover,
            mediaType: "movie",
            playerType: "system", // 使用系统播放器
            customHeaders: {
                "Referer": link, // 必须带 Referer 否则403
                "User-Agent": headers["User-Agent"]
            },
            childItems: relatedItems
        };

    } catch (e) {
        // 如果解析失败，抛出错误让 APP 提示
        throw e;
    }
}
