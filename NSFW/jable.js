const CONFIG = {
    BASE_URL: "https://jable.tv",
    // 通用的列表加载后缀
    COMMON_SUFFIX: "?mode=async&function=get_block&block_id=list_videos_common_videos_list",
    // 搜索专用的后缀
    SEARCH_SUFFIX: "?mode=async&function=get_block&block_id=list_videos_videos_list_search_result",
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://jable.tv/",
    }
};

WidgetMetadata = {
    id: "jable_makka_pro",
    title: "Jable Pro",
    description: "Jable 增强版 - 支持手动搜索筛选",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    site: "https://jable.tv",
    version: "1.0.2",
    requiredVersion: "0.0.2",
    detailCacheDuration: 60,
    modules: [
        // --- 搜索模块 ---
        {
            title: "搜索",
            functionName: "searchWrapper", // 统一入口
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
        // --- 热门模块 ---
        {
            title: "热门",
            functionName: "loadListWrapper",
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
        // --- 最新模块 ---
        {
            title: "最新",
            functionName: "loadListWrapper",
            type: "list",
            params: [
                { name: "path", type: "constant", value: "/new-release/" },
                {
                    name: "sort_by",
                    title: "排序",
                    type: "enumeration",
                    value: "post_date",
                    enumOptions: [
                        { title: "最新发布", value: "post_date" }, // 修正 key
                        { title: "最多观看", value: "video_viewed" },
                        { title: "最多收藏", value: "most_favourited" },
                    ],
                },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        // --- 中文模块 ---
        {
            title: "中文",
            functionName: "loadListWrapper",
            type: "list",
            params: [
                { name: "path", type: "constant", value: "/categories/chinese-subtitle/" },
                {
                    name: "sort_by",
                    title: "排序",
                    type: "enumeration",
                    value: "post_date",
                    enumOptions: [
                        { title: "最近更新", value: "post_date" },
                        { title: "最多观看", value: "video_viewed" },
                        { title: "最多收藏", value: "most_favourited" },
                    ],
                },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        // --- 女优模块 (带手动输入) ---
        {
            title: "女优",
            functionName: "loadCategoryWrapper",
            type: "list",
            params: [
                {
                    name: "manual_input",
                    title: "🔍 手动搜索 (选填)",
                    type: "input",
                    description: "输入女优名字，将忽略下方选择",
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
                        { title: "最多收藏", value: "most_favourited" },
                    ],
                },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        },
        // --- 衣着模块 (带手动输入) ---
        {
            title: "衣着",
            functionName: "loadCategoryWrapper",
            type: "list",
            params: [
                {
                    name: "manual_input",
                    title: "🔍 手动搜索 (选填)",
                    type: "input",
                    description: "输入标签名，将忽略下方选择",
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
        // --- 剧情模块 (带手动输入) ---
        {
            title: "剧情",
            functionName: "loadCategoryWrapper",
            type: "list",
            params: [
                {
                    name: "manual_input",
                    title: "🔍 手动搜索 (选填)",
                    type: "input",
                    description: "输入关键词，将忽略下方选择",
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
        },
        // --- 角色模块 (带手动输入) ---
        {
            title: "角色",
            functionName: "loadCategoryWrapper",
            type: "list",
            params: [
                {
                    name: "manual_input",
                    title: "🔍 手动搜索 (选填)",
                    type: "input",
                    value: ""
                },
                {
                    name: "path",
                    title: "选择角色",
                    type: "enumeration",
                    value: "/tags/wife/",
                    enumOptions: [
                        { title: "人妻", value: "/tags/wife/" },
                        { title: "老师", value: "/tags/teacher/" },
                        { title: "护士", value: "/tags/nurse/" },
                        { title: "空姐", value: "/tags/flight-attendant/" },
                        { title: "学生", value: "/tags/school/" },
                        { title: "女上司", value: "/tags/female-boss/" },
                        { title: "风俗娘", value: "/tags/club-hostess-and-sex-worker/" },
                        { title: "未亡人", value: "/tags/widow/" }
                    ],
                },
                { name: "sort_by", title: "排序", type: "enumeration", value: "post_date", enumOptions: [{ title: "更新", value: "post_date" }, { title: "观看", value: "video_viewed" }] },
                { name: "page", title: "页码", type: "page", value: "1" },
            ],
        }
    ],
};


// ================= 业务逻辑 =================

// 1. 搜索包装器
async function searchWrapper(params) {
    return await executeSearch(params.keyword, params.sort_by, params.page);
}

// 2. 普通列表包装器
async function loadListWrapper(params) {
    let url = `${CONFIG.BASE_URL}${params.path}${CONFIG.COMMON_SUFFIX}`;
    return await fetchAndParse(url, params.sort_by, params.page);
}

// 3. 分类/标签包装器（核心改动：支持手动输入）
async function loadCategoryWrapper(params) {
    // 如果用户在手动输入框填了字，优先执行搜索，忽略 Path
    if (params.manual_input && params.manual_input.trim().length > 0) {
        return await executeSearch(params.manual_input, params.sort_by, params.page);
    }
    
    // 否则使用下拉菜单选中的 Path
    let path = params.path;
    if (!path.startsWith("http")) {
        path = CONFIG.BASE_URL + path;
    }
    
    // 自动补全 API 参数
    let url = path;
    if (!url.includes("mode=async")) {
        url += CONFIG.COMMON_SUFFIX;
    }
    
    return await fetchAndParse(url, params.sort_by, params.page);
}

// 4. 执行搜索的核心逻辑
async function executeSearch(keyword, sortBy, page) {
    if (!keyword) return [];
    const encodedKey = encodeURIComponent(keyword);
    // 搜索接口有点特殊，需要带上 q 参数
    let url = `${CONFIG.BASE_URL}/search/${encodedKey}/${CONFIG.SEARCH_SUFFIX}&q=${encodedKey}`;
    return await fetchAndParse(url, sortBy, page);
}

// 5. 通用网络请求与HTML处理
async function fetchAndParse(url, sortBy, page) {
    // 拼接排序和页码
    if (sortBy) url += `&sort_by=${sortBy}`;
    if (page) url += `&from=${page}`;

    try {
        const response = await Widget.http.get(url, { headers: CONFIG.headers });
        
        if (!response || !response.data) {
            return []; 
        }

        // HTML 解析
        const $ = Widget.html.load(response.data);
        const items = [];

        // 遍历视频卡片
        $(".video-img-box").each((i, el) => {
            const $el = $(el);
            
            // 提取链接和ID
            const $link = $el.find(".title a").first();
            const href = $link.attr("href");
            if (!href) return;

            // 提取封面
            const $img = $el.find("img").first();
            let cover = $img.attr("data-src") || $img.attr("src");
            // 尝试获取动态预览图
            const preview = $img.attr("data-preview") || cover;

            // 提取标题和时长
            const title = $link.text().trim(); // 使用 trim 去除空白
            const duration = $el.find(".absolute-bottom-right .label").text().trim();
            const viewCount = $el.find(".absolute-bottom-left .label").text().trim();

            items.push({
                id: href,
                type: "url", // 必须是 url 类型才能进入详情页
                title: title,
                backdropPath: cover, // 横向封面
                posterPath: cover,   // 竖向封面(复用)
                previewUrl: preview, // 鼠标悬停/长按预览
                link: href,
                mediaType: "movie",
                description: `时长: ${duration} | 观看: ${viewCount}`,
                releaseDate: duration,
                playerType: "system"
            });
        });

        // 如果解析为空，可能是到底了或者反爬，返回空数组
        return items;

    } catch (e) {
        console.error("Fetch Error:", e);
        // 出错返回错误提示项，方便调试
        return [{
            title: "加载失败",
            description: e.message,
            type: "text"
        }];
    }
}

// 6. 详情页加载 (解析 m3u8)
async function loadDetail(link) {
    try {
        const response = await Widget.http.get(link, { headers: CONFIG.headers });
        const html = response.data;
        
        // 正则提取 HLS 地址
        const hlsMatch = html.match(/var hlsUrl = '(.*?)';/);
        let hlsUrl = "";
        if (hlsMatch && hlsMatch[1]) {
            hlsUrl = hlsMatch[1];
        } else {
            throw new Error("未找到视频地址，可能需要登录或已被删除");
        }

        const $ = Widget.html.load(html);
        
        // 尝试提取更多元数据
        const title = $("meta[property='og:title']").attr("content") || "Jable Video";
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

        return {
            id: link,
            type: "detail",
            title: title,
            videoUrl: hlsUrl,
            backdropPath: cover,
            mediaType: "movie",
            playerType: "system",
            // 必须带 Referer 否则无法播放
            customHeaders: {
                "Referer": link,
                "User-Agent": CONFIG.headers["User-Agent"]
            },
            childItems: relatedItems // 显示相关推荐
        };

    } catch (e) {
        throw e;
    }
}
