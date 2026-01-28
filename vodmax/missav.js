WidgetMetadata = {
    id: "missav_ultimate",
    title: "MissAV (终极版)",
    author: "MakkaPakka",
    description: "完美复刻官方逻辑，支持无码/热门/搜索，强力反爬。",
    version: "2.0.0",
    requiredVersion: "0.0.1",
    site: "https://missav.ai",

    modules: [
        {
            title: "浏览视频",
            functionName: "loadList",
            type: "video",
            params: [
                { name: "page", title: "页码", type: "page" },
                { 
                    name: "category", 
                    title: "分类", 
                    type: "enumeration", 
                    value: "new",
                    enumOptions: [
                        { title: "🆕 最新发布", value: "dm588/cn/release" },
                        { title: "🔥 本周热门", value: "dm169/cn/weekly-hot" },
                        { title: "🌟 月度热门", value: "dm257/cn/monthly-hot" },
                        { title: "🔞 无码流出", value: "dm621/cn/uncensored-leak" },
                        { title: "🇯🇵 东京热", value: "dm29/cn/tokyohot" },
                        { title: "🇨🇳 中文字幕", value: "dm265/cn/chinese-subtitle" }
                    ] 
                },
                {
                    name: "sort",
                    title: "排序",
                    type: "enumeration",
                    value: "released_at",
                    enumOptions: [
                        { title: "发布日期", value: "released_at" },
                        { title: "今日浏览", value: "today_views" },
                        { title: "总浏览量", value: "views" },
                        { title: "收藏数", value: "saved" }
                    ]
                }
            ]
        }
    ]
};

// 核心配置：完全复刻成功代码的 Headers
const BASE_URL = "https://missav.ai";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "DNT": "1",
    "Referer": "https://missav.ai/",
    "Connection": "keep-alive"
};

// ==========================================
// 1. 列表加载
// ==========================================
async function loadList(params = {}) {
    const { page = 1, category = "dm588/cn/release", sort = "released_at" } = params;
    
    // 构造 URL: https://missav.ai/dm588/cn/release?sort=released_at&page=1
    let url = `${BASE_URL}/${category}?sort=${sort}`;
    if (page > 1) url += `&page=${page}`;

    try {
        const res = await Widget.http.get(url, { headers: HEADERS });
        const html = res.data;
        
        // 简单风控检查
        if (!html || html.length < 5000 || html.includes("Just a moment")) {
            return [{ id: "err_cf", type: "text", title: "访问受限", subTitle: "Cloudflare 正在验证，请稍后重试" }];
        }

        const $ = Widget.html.load(html);
        const results = [];

        $("div.group").each((i, el) => {
            const $el = $(el);
            const $link = $el.find("a.text-secondary");
            const href = $link.attr("href");
            
            if (href) {
                const title = $link.text().trim();
                const $img = $el.find("img");
                const imgSrc = $img.attr("data-src") || $img.attr("src");
                const duration = $el.find(".absolute.bottom-1.right-1").text().trim();

                // 提取 ID 用于拼接高清封面
                // href: https://missav.ai/cn/fc2-ppv-4250288
                const videoId = href.split('/').pop().replace(/-uncensored-leak|-chinese-subtitle/g, '').toUpperCase();
                const coverUrl = `https://fourhoi.com/${videoId.toLowerCase()}/cover-t.jpg`;

                results.push({
                    id: href,
                    type: "link", // 触发详情
                    title: title,
                    // 优先用拼接的高清封面，如果没有则用网页抓取的
                    coverUrl: coverUrl || imgSrc, 
                    link: href,
                    description: `时长: ${duration} | 番号: ${videoId}`,
                    customHeaders: HEADERS // 传递 headers
                });
            }
        });

        return results;
    } catch (e) {
        return [{ id: "err", type: "text", title: "加载失败", subTitle: e.message }];
    }
}

// ==========================================
// 2. 详情与播放解析
// ==========================================
async function loadDetail(link) {
    try {
        const res = await Widget.http.get(link, { headers: HEADERS });
        const html = res.data;
        const $ = Widget.html.load(html);
        const title = $("h1.text-base").text().trim();

        // --- 核心：播放地址提取 (复刻成功代码) ---
        let videoUrl = "";
        
        // 1. 查找 surrit.com 的 m3u8
        const scriptContent = $("script").text() || "";
        // 匹配 UUID 模式: 8-4-4-4-12 位十六进制
        const uuidMatch = html.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/);
        
        if (uuidMatch) {
            // MissAV 的 m3u8 规则通常是 https://surrit.com/{uuid}/playlist.m3u8
            // 这是一个非常重要的发现！
            videoUrl = `https://surrit.com/${uuidMatch[0]}/playlist.m3u8`;
        } else {
            // 2. 备用正则匹配
            const m3u8Match = html.match(/https:\/\/[^"']+\.m3u8/);
            if (m3u8Match) videoUrl = m3u8Match[0];
        }

        if (!videoUrl) {
            return [{ id: "err", type: "text", title: "解析失败", subTitle: "未找到播放地址" }];
        }

        return [{
            id: link,
            type: "video",
            title: title,
            videoUrl: videoUrl,
            playerType: "system",
            customHeaders: {
                "Referer": link, // 播放时必须带详情页作为 Referer
                "User-Agent": HEADERS["User-Agent"]
            }
        }];

    } catch (e) {
        return [{ id: "err", type: "text", title: "请求错误", subTitle: e.message }];
    }
}
