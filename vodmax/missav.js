WidgetMetadata = {
    id: "missav_fix_play",
    title: "MissAV (播放修复版)",
    author: "MakkaPakka",
    description: "完美复刻官方播放逻辑，支持高清直连。",
    version: "2.1.0",
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

const BASE_URL = "https://missav.ai";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://missav.ai/",
    "Connection": "keep-alive"
};

async function loadList(params = {}) {
    const { page = 1, category = "dm588/cn/release", sort = "released_at" } = params;
    
    let url = `${BASE_URL}/${category}?sort=${sort}`;
    if (page > 1) url += `&page=${page}`;

    try {
        const res = await Widget.http.get(url, { headers: HEADERS });
        const html = res.data;
        
        if (!html || html.includes("Just a moment")) {
            return [{ id: "err_cf", type: "text", title: "被 Cloudflare 拦截", subTitle: "请稍后重试" }];
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

                const videoId = href.split('/').pop().replace(/-uncensored-leak|-chinese-subtitle/g, '').toUpperCase();
                const coverUrl = `https://fourhoi.com/${videoId.toLowerCase()}/cover-t.jpg`;

                results.push({
                    id: href,
                    type: "link", 
                    title: title,
                    coverUrl: coverUrl || imgSrc, 
                    link: href,
                    description: `时长: ${duration} | 番号: ${videoId}`,
                    customHeaders: HEADERS
                });
            }
        });

        return results;
    } catch (e) {
        return [{ id: "err", type: "text", title: "加载失败", subTitle: e.message }];
    }
}

async function loadDetail(link) {
    try {
        const res = await Widget.http.get(link, { headers: HEADERS });
        const html = res.data;
        const $ = Widget.html.load(html);
        
        let title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim();
        
        // --- 核心播放逻辑 (完全照搬成功代码) ---
        let videoUrl = "";
        
        // 遍历所有 script 标签，寻找 UUID
        $('script').each((i, el) => {
            const scriptContent = $(el).html() || "";
            
            // 1. 优先找 surrit 直连
            if (scriptContent.includes('surrit.com') && scriptContent.includes('.m3u8')) {
                const matches = scriptContent.match(/https:\/\/surrit\.com\/[a-f0-9\-]+\/[^"'\s]*\.m3u8/g);
                if (matches && matches.length > 0) {
                    videoUrl = matches[0];
                    return false; // break
                }
            }
            
            // 2. 其次找 eval 混淆代码里的 UUID
            if (!videoUrl && scriptContent.includes('eval(function')) {
                // 这是一个标准的 UUID 正则
                const uuidMatches = scriptContent.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g);
                if (uuidMatches && uuidMatches.length > 0) {
                    // 只要找到 UUID，拼接这个 URL 一定能播！
                    videoUrl = `https://surrit.com/${uuidMatches[0]}/playlist.m3u8`;
                    return false; // break
                }
            }
        });

        if (!videoUrl) {
            // 最后尝试一下简单的 source = ...
            const matchSimple = html.match(/source\s*=\s*['"]([^'"]+)['"]/);
            if (matchSimple) videoUrl = matchSimple[1];
        }

        if (videoUrl) {
            return [{
                id: link,
                type: "video",
                title: title,
                videoUrl: videoUrl,
                playerType: "system",
                customHeaders: {
                    "Referer": "https://missav.ai/", // 必须是根域名，不能是 link
                    "User-Agent": HEADERS["User-Agent"],
                    "Origin": "https://missav.ai"
                }
            }];
        } else {
            return [{ id: "err", type: "text", title: "解析失败", subTitle: "未找到播放地址" }];
        }

    } catch (e) {
        return [{ id: "err", type: "text", title: "请求错误", subTitle: e.message }];
    }
}
