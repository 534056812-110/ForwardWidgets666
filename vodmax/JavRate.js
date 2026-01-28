WidgetMetadata = {
    id: "javrate_pro",
    title: "JavRate 浏览与播放",
    author: "MakkaPakka",
    description: "浏览 JavRate 高清视频，支持直连解析。",
    version: "1.0.0",
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
                        { title: "🆕 最新发布", value: "new-release" }
                    ] 
                }
            ]
        }
    ]
};

const BASE_URL = "https://javrate.com";

// ==========================================
// 1. 列表加载
// ==========================================
async function loadList(params = {}) {
    const { page = 1, category = "censored" } = params;
    
    // URL 构造 (根据 JavRate 实际路由调整)
    // 假设: https://javrate.com/censored/page/2
    let url = "";
    if (category === "new-release") {
        url = `${BASE_URL}/page/${page}`; // 首页即最新
    } else {
        url = `${BASE_URL}/${category}/page/${page}`;
    }

    console.log(`[JavRate] Fetching: ${url}`);

    try {
        const res = await Widget.http.get(url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
            }
        });
        
        const html = res.data;
        if (!html) return [];

        const $ = Widget.html.load(html);
        const results = [];

        // 解析列表
        // JavRate 常见结构: article.post or div.video-block
        $("article.post").each((i, el) => {
            const $el = $(el);
            const $link = $el.find("a").first();
            const href = $link.attr("href");
            
            if (href) {
                const title = $el.find("h2.entry-title").text().trim();
                const $img = $el.find("img");
                const img = $img.attr("data-src") || $img.attr("src");
                
                // 提取番号 (通常在标题里或者 meta 标签)
                // 简单处理：标题就是番号+名称
                
                results.push({
                    id: href,
                    type: "link", // 触发详情解析
                    title: title,
                    coverUrl: img,
                    link: href,
                    customHeaders: { "Referer": BASE_URL }
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
        const res = await Widget.http.get(link, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL
            }
        });
        const html = res.data;
        
        // 核心：寻找播放地址
        // JavRate 可能有多个播放源 (Tab)
        // 1. 尝试找直连 m3u8
        let m3u8Url = "";
        
        // 匹配 <source src="..."> 
        const matchSource = html.match(/<source\s+src=['"]([^'"]+\.m3u8[^'"]*)['"]/i);
        if (matchSource) m3u8Url = matchSource[1];
        
        // 匹配 var video_url = ...
        if (!m3u8Url) {
            const matchVar = html.match(/video_url\s*=\s*['"]([^'"]+)['"]/);
            if (matchVar) m3u8Url = matchVar[1];
        }

        // 2. 如果没找到直连，尝试找 iframe (可能是第三方播放器)
        // 这部分比较复杂，通常只能支持特定的几种 (如 dood)
        if (!m3u8Url) {
            const matchIframe = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
            if (matchIframe) {
                const iframeSrc = matchIframe[1];
                // 如果是 doodstream，Forward 可能无法直接播，需要 WebView
                // 但如果是 JavRate 自建的 player.php，可能里面藏着 m3u8
                if (iframeSrc.includes("player")) {
                    // 递归抓取 iframe 内容 (可选，比较耗时)
                    // m3u8Url = await fetchIframe(iframeSrc);
                }
            }
        }

        // 如果找到了地址
        if (m3u8Url) {
            const $ = Widget.html.load(html);
            const title = $("h1.entry-title").text().trim();
            
            return [{
                id: link,
                type: "video",
                title: title,
                videoUrl: m3u8Url,
                playerType: "system",
                customHeaders: {
                    "Referer": link, // 非常重要
                    "User-Agent": "Mozilla/5.0"
                }
            }];
        } else {
            // 如果没找到直连，尝试用 WebView 打开
            // Forward 支持 type: "webview" (需要确认内核版本支持)
            // 或者返回一个提示
            return [{ 
                id: "err", 
                type: "text", 
                title: "未找到直连", 
                subTitle: "该视频可能使用了第三方播放器，无法直接解析" 
            }];
        }

    } catch (e) {
        return [{ id: "err", type: "text", title: "解析错误" }];
    }
}
