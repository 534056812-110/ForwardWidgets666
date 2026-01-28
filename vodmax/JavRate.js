WidgetMetadata = {
    id: "javrate_ultimate",
    title: "JavRate 浏览器",
    author: "MakkaPakka",
    description: "全套防爬Headers + 多重源解析，支持高清直连。",
    version: "2.0.0",
    requiredVersion: "0.0.1",
    site: "https://javrate.com",

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
                    value: "censored",
                    enumOptions: [
                        { title: "🎬 有码 (Censored)", value: "censored" },
                        { title: "🔞 无码 (Uncensored)", value: "uncensored" },
                        { title: "🔥 热门影片", value: "trending" },
                        { title: "🆕 最新发布", value: "new-release" } // 对应首页
                    ] 
                }
            ]
        }
    ]
};

// 1. 核心配置：照搬成功的 MissAV Headers
const BASE_URL = "https://javrate.com";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "DNT": "1",
    "Referer": BASE_URL,
    "Connection": "keep-alive"
};

// ==========================================
// 1. 列表加载
// ==========================================
async function loadList(params = {}) {
    const { page = 1, category = "censored" } = params;
    
    // URL 构造
    let url = "";
    if (category === "new-release") {
        url = page > 1 ? `${BASE_URL}/page/${page}` : BASE_URL;
    } else {
        url = page > 1 ? `${BASE_URL}/${category}/page/${page}` : `${BASE_URL}/${category}`;
    }

    try {
        const res = await Widget.http.get(url, { headers: HEADERS });
        const html = res.data;
        
        if (!html || html.length < 2000) {
            return [{ id: "err", type: "text", title: "访问受限", subTitle: "网站可能开启了强力盾" }];
        }

        const $ = Widget.html.load(html);
        const results = [];

        // JavRate 结构: article.post
        $("article.post").each((i, el) => {
            const $el = $(el);
            const $link = $el.find("a").first();
            const href = $link.attr("href");
            
            if (href) {
                const title = $el.find("h2.entry-title").text().trim();
                const $img = $el.find("img");
                // 优先 data-src
                const img = $img.attr("data-src") || $img.attr("src");
                
                // 提取番号 (例如: [FHD/2.5G] IPX-123 ...)
                const codeMatch = title.match(/([A-Z]{2,5}-\d{3,5})/);
                const code = codeMatch ? codeMatch[1] : "JAV";

                results.push({
                    id: href,
                    type: "link", 
                    title: title,
                    coverUrl: img,
                    link: href,
                    description: `番号: ${code}`,
                    customHeaders: HEADERS // 传递 Headers
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
        const title = $("h1.entry-title").text().trim();

        let videoUrl = "";

        // --- 策略 A: 寻找直连 m3u8 (优先) ---
        // JavRate 有时会直接把 m3u8 放在 source 标签或 var hls 变量里
        
        // 1. 正则全页面搜索 https://...m3u8
        const m3u8Match = html.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/);
        if (m3u8Match) {
            videoUrl = m3u8Match[1];
        }

        // 2. 如果没找到，尝试找 Cloud Video (类似 MissAV 的 UUID)
        if (!videoUrl) {
            // JavRate 的播放器常嵌在 iframe 里，例如 https://javrate.com/player/Index.php?v=...
            const iframeSrc = $("iframe").attr("src");
            if (iframeSrc && iframeSrc.includes("player")) {
                // 这里可能需要二次请求 iframe 页面去提取，但 Forward 不支持递归太深
                // 我们可以尝试直接拼接: 很多 JavRate 的 iframe src 参数 v= 就是 m3u8 的一部分
                // 但这比较玄学。
            }
        }

        // --- 策略 B: Doodstream 降级 ---
        // 如果找不到直连，但找到了 Doodstream iframe
        if (!videoUrl && html.includes("dood")) {
            // Forward 无法直接播 Dood，返回一个 Webview 类型的 Item 引导用户去网页看
            // 或者提示用户
            return [{
                id: "dood_webview",
                type: "webview", // 尝试用 WebView 打开
                title: "点击在网页播放 (Doodstream)",
                link: link,
                description: "此视频源为 Doodstream，无法直接解析，请使用内置浏览器观看。"
            }];
        }

        if (videoUrl) {
            return [{
                id: link,
                type: "video",
                title: title,
                videoUrl: videoUrl,
                playerType: "system",
                customHeaders: {
                    "Referer": link, // 关键：防盗链
                    "User-Agent": HEADERS["User-Agent"]
                }
            }];
        } else {
            return [{ 
                id: "err", 
                type: "text", 
                title: "暂无直连源", 
                subTitle: "未找到 m3u8 直连，可能是第三方网盘源" 
            }];
        }

    } catch (e) {
        return [{ id: "err", type: "text", title: "解析错误", subTitle: e.message }];
    }
}
