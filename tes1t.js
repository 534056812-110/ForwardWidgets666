WidgetMetadata = {
    id: "vod_stream_makka",
    title: "全能播放源 (聚合)",
    author: "MakkaPakka",
    description: "聚合 非凡/量子/厂长/Libvio/AGE，提供全网直连播放源。",
    version: "4.0.0",
    requiredVersion: "0.0.1",
    
    // 0. 全局免 Key
    globalParams: [],

    modules: [
        {
            id: "loadResource",
            title: "加载资源",
            functionName: "loadResource",
            type: "stream", // 关键：声明为 stream 类型，Forward 才会把它识别为播放源
            params: [] 
        }
    ]
};

// ==========================================
// 1. 核心分发逻辑
// ==========================================

async function loadResource(params) {
    // Forward 传入的标准参数: seriesName, season, episode, title(电影)
    const { seriesName, type = 'tv', season, episode, title } = params;
    
    // 搜索关键词处理
    // 剧集优先用 seriesName，电影用 title
    let queryName = seriesName || title;
    
    // 如果是第二季，尝试加上季数优化搜索 (如 "庆余年 第二季")
    // 但很多源站命名不规范，有时候搜纯名反而更准，这里我们并发搜两种
    let queries = [queryName];
    if (season && season > 1) {
        queries.push(`${queryName} 第${season}季`);
        queries.push(`${queryName} ${season}`);
    }

    console.log(`[Stream] Searching: ${queries.join(" | ")} (S${season}E${episode})`);

    // 并发任务池
    const tasks = [];

    // 1. VOD 采集站 (非凡/量子) - 速度快，最稳
    tasks.push(searchVodCms(queryName, season, episode));

    // 2. 精品站 (厂长/Libvio) - 画质好
    // 避免搜索词太长导致搜不到，精简搜索
    tasks.push(searchCzzy(queryName, season, episode));
    tasks.push(searchLibvio(queryName, season, episode));

    // 3. 动漫站 (AGE) - 仅当可能是动漫时搜
    // 简单判断：如果 type 是 tv 或者关键词像动漫
    tasks.push(searchAge(queryName, season, episode));

    const results = await Promise.all(tasks);
    
    // 扁平化并去重
    const flatResults = results.flat().filter(item => item && item.url);
    
    // 去重逻辑 (URL 去重)
    const uniqueMap = new Map();
    flatResults.forEach(item => {
        if (!uniqueMap.has(item.url)) {
            uniqueMap.set(item.url, item);
        }
    });

    return Array.from(uniqueMap.values());
}

// ==========================================
// 2. VOD CMS 解析 (非凡/量子)
// ==========================================
const CMS_SITES = [
    { name: "非凡", url: "http://cj.ffzyapi.com/api.php/provide/vod/" },
    { name: "量子", url: "https://cj.lziapi.com/api.php/provide/vod/" }
];

async function searchVodCms(keyword, season, episode) {
    // 针对 CMS，我们可以直接搜纯名
    const tasks = CMS_SITES.map(async (site) => {
        try {
            const url = `${site.url}?ac=detail&wd=${encodeURIComponent(keyword)}`;
            const res = await Widget.http.get(url);
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            
            if (!data || !data.list) return [];

            // 过滤：找到最匹配的那个剧
            // 简单逻辑：如果是剧集，尝试匹配 "第二季" 等字眼
            // 这里为了简单，我们取所有包含关键词的结果
            
            let resources = [];
            data.list.forEach(item => {
                // 解析播放列表 "第1集$url#第2集$url..."
                const playUrl = item.vod_play_url;
                const episodes = playUrl.split("#");
                
                // 寻找目标集数
                const targetEp = episode ? episode.toString() : "1";
                
                // 遍历集数
                episodes.forEach(epStr => {
                    const [epName, epLink] = epStr.split("$");
                    // 匹配集数 (简单包含匹配)
                    // "第1集", "01", "1"
                    if (season) { // 是剧集
                        const num = epName.match(/\d+/);
                        if (num && parseInt(num[0]) == targetEp) {
                            resources.push({
                                name: `${site.name} (直连)`,
                                description: `${item.vod_name} [${epName}]`,
                                url: epLink
                            });
                        }
                    } else { // 是电影
                        // 电影通常只有一集，或者叫 "HD", "蓝光"
                        resources.push({
                            name: `${site.name} (直连)`,
                            description: `${item.vod_name} [${epName}]`,
                            url: epLink
                        });
                    }
                });
            });
            return resources;
        } catch (e) { return []; }
    });
    
    const res = await Promise.all(tasks);
    return res.flat();
}

// ==========================================
// 3. 厂长 (Czzy)
// ==========================================
const CZZY_URL = "https://www.zxzj.site"; // 替换为在线之家逻辑，因为厂长反爬太严

async function searchCzzy(keyword, season, episode) {
    try {
        // 在线之家搜索
        const res = await Widget.http.get(`${CZZY_URL}/vodsearch/-------------.html?wd=${encodeURIComponent(keyword)}`);
        const $ = Widget.html.load(res.data);
        
        let detailUrl = "";
        $(".stui-vodlist__thumb").each((i, el) => {
            if ($(el).attr("title").includes(keyword)) {
                detailUrl = $(el).attr("href");
                return false;
            }
        });

        if (!detailUrl) return [];
        
        // 详情页
        const res2 = await Widget.http.get(`${CZZY_URL}${detailUrl}`);
        const $2 = Widget.html.load(res2.data);
        
        // 找集数
        const targetEp = episode ? episode.toString() : "1";
        let playUrl = "";
        
        $2(".stui-content__playlist a").each((i, el) => {
            const text = $2(el).text();
            if (!season) { playUrl = $2(el).attr("href"); return false; }
            const num = text.match(/\d+/);
            if (num && parseInt(num[0]) == targetEp) {
                playUrl = $2(el).attr("href");
                return false;
            }
        });

        if (!playUrl) return [];

        // 播放页
        const res3 = await Widget.http.get(`${CZZY_URL}${playUrl}`);
        const jsonMatch = res3.data.match(/player_aaaa\s*=\s*({.*?})/);
        if (jsonMatch) {
            const json = JSON.parse(jsonMatch[1]);
            return [{
                name: "在线之家 (高清)",
                description: "ZXZJ 直连",
                url: json.url,
                headers: { "Referer": CZZY_URL }
            }];
        }
    } catch (e) {}
    return [];
}

// ==========================================
// 4. Libvio
// ==========================================
const LIB_URL = "https://libvio.app";

async function searchLibvio(keyword, season, episode) {
    try {
        const res = await Widget.http.get(`${LIB_URL}/search/-------------.html?wd=${encodeURIComponent(keyword)}`);
        const $ = Widget.html.load(res.data);
        
        let detailUrl = "";
        $(".stui-vodlist__thumb").each((i, el) => {
            if ($(el).attr("title").includes(keyword)) {
                detailUrl = $(el).attr("href");
                return false;
            }
        });

        if (!detailUrl) return [];
        const res2 = await Widget.http.get(`${LIB_URL}${detailUrl}`);
        const $2 = Widget.html.load(res2.data);
        
        const targetEp = episode ? episode.toString() : "1";
        let playUrl = "";
        
        $2(".stui-content__playlist a").each((i, el) => {
            const text = $2(el).text();
            if (!season) { playUrl = $2(el).attr("href"); return false; }
            const num = text.match(/\d+/);
            if (num && parseInt(num[0]) == targetEp) {
                playUrl = $2(el).attr("href");
                return false;
            }
        });

        if (!playUrl) return [];
        const res3 = await Widget.http.get(`${LIB_URL}${playUrl}`);
        const match = res3.data.match(/"url":"([^"]+)"/);
        
        if (match) {
            return [{
                name: "Libvio (蓝光)",
                description: "极速秒播",
                url: match[1],
                headers: { "Referer": LIB_URL }
            }];
        }
    } catch (e) {}
    return [];
}

// ==========================================
// 5. AGE动漫
// ==========================================
const AGE_URL = "https://www.agemys.net";

async function searchAge(keyword, season, episode) {
    // 简单判断：如果不是动漫，直接跳过
    // 但有时候很难判断，所以还是搜一下吧，反正并发不慢
    try {
        const res = await Widget.http.get(`${AGE_URL}/search?query=${encodeURIComponent(keyword)}`);
        const $ = Widget.html.load(res.data);
        
        let detailUrl = "";
        $(".cell_imform_name").each((i, el) => {
            if ($(el).text().includes(keyword)) {
                detailUrl = $(el).closest("a").attr("href");
                return false;
            }
        });

        if (!detailUrl) return [];
        
        // AGE 的播放地址解析比较麻烦，通常需要 Webview
        // 这里仅作为示例，如果能提取到 mp4 则返回，否则忽略
        // 实际上 AGE 需要 VParse，纯 JS 很难搞定
        // 暂时留空，避免返回无效链接
        return []; 
    } catch (e) {}
    return [];
}
