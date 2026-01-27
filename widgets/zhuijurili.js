// 严格遵循 basic-widget.md 定义元数据
WidgetMetadata = {
  id: "tv.calendar.strict",
  title: "全球追剧日历",
  author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
  description: "根据TMDB日期生成追剧日历",
  version: "2.2.1",
  requiredVersion: "0.0.1",
  site: "https://www.themoviedb.org",
    
    // 全局参数：用户只需填一次 Key
    globalParams: [
        {
            name: "apiKey",
            title: "TMDB API Key (必填)",
            type: "input",
            description: "用于获取数据。请在 themoviedb.org 申请。",
            value: ""
        }
    ],

    modules: [
        // 模块 1: 每日更新 (包含老剧新集)
        {
            title: "每日更新",
            description: "查看今天或近期有更新的剧集",
            functionName: "loadUpdates",
            type: "video", // 遵循规范使用 video 类型
            cacheDuration: 3600,
            params: [
                {
                    name: "range",
                    title: "时间范围",
                    type: "enumeration",
                    value: "0",
                    enumOptions: [
                        { title: "今天 (Today)", value: "0" },
                        { title: "明天 (Tomorrow)", value: "1" },
                        { title: "近 3 天", value: "3" },
                        { title: "近 7 天", value: "7" }
                    ]
                },
                {
                    name: "region",
                    title: "地区筛选",
                    type: "enumeration",
                    value: "",
                    enumOptions: [
                        { title: "全球 (Global)", value: "" },
                        { title: "国产 (CN)", value: "CN" },
                        { title: "欧美 (US/GB)", value: "US|GB" },
                        { title: "日本 (JP)", value: "JP" },
                        { title: "韩国 (KR)", value: "KR" },
                        { title: "港台 (HK/TW)", value: "HK|TW" }
                    ]
                }
            ]
        },
        // 模块 2: 新剧首播 (只看新剧)
        {
            title: "新剧首播",
            description: "查看近期上线的第一季新剧",
            functionName: "loadPremieres",
            type: "video",
            cacheDuration: 7200,
            params: [
                {
                    name: "range",
                    title: "时间范围",
                    type: "enumeration",
                    value: "30",
                    enumOptions: [
                        { title: "近 7 天", value: "7" },
                        { title: "近 30 天", value: "30" },
                        { title: "未来 30 天", value: "future_30" }
                    ]
                },
                {
                    name: "region",
                    title: "地区筛选",
                    type: "enumeration",
                    value: "",
                    enumOptions: [
                        { title: "全球 (Global)", value: "" },
                        { title: "欧美 (US/GB)", value: "US|GB" },
                        { title: "日本 (JP)", value: "JP" },
                        { title: "韩国 (KR)", value: "KR" }
                    ]
                }
            ]
        }
    ]
};

// ============================================
// 核心逻辑
// ============================================

const BASE_URL = "https://api.themoviedb.org/3/discover/tv";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";

/**
 * 模块 1: 加载更新 (使用 air_date)
 */
async function loadUpdates(params = {}) {
    const { apiKey, range, region } = params;
    
    // 1. 计算日期范围
    const { start, end } = getDateRange(range, false); // false = 不是未来模式

    // 2. 构造请求参数
    const queryParams = {
        api_key: apiKey,
        language: "zh-CN",             // 强制中文
        sort_by: "popularity.desc",    // 按热度排序
        include_null_first_air_dates: false,
        "air_date.gte": start,         // 播出日期 >= start
        "air_date.lte": end,           // 播出日期 <= end
        timezone: "Asia/Shanghai"      // 修正时区
    };

    // 地区过滤
    if (region) {
        queryParams.with_origin_country = region;
    }

    return await fetchTmdbAndMap(queryParams, "更新");
}

/**
 * 模块 2: 加载首播 (使用 first_air_date)
 */
async function loadPremieres(params = {}) {
    const { apiKey, range, region } = params;

    const isFuture = range === "future_30";
    const days = isFuture ? 30 : parseInt(range);
    
    const { start, end } = getDateRange(days, isFuture);

    const queryParams = {
        api_key: apiKey,
        language: "zh-CN",
        sort_by: "popularity.desc",
        include_null_first_air_dates: false,
        "first_air_date.gte": start,   // 首播日期
        "first_air_date.lte": end,
        timezone: "Asia/Shanghai"
    };

    if (region) {
        queryParams.with_origin_country = region;
    }

    return await fetchTmdbAndMap(queryParams, "首播");
}

// ============================================
// 辅助函数
// ============================================

/**
 * 通用请求与映射处理
 */
async function fetchTmdbAndMap(queryParams, tag) {
    if (!queryParams.api_key) {
        return [{
            id: "error_no_key",
            type: "text",
            title: "❌ 请填写 TMDB API Key",
            subTitle: "在组件设置中填写 Key 后即可获取中文海报和数据"
        }];
    }

    console.log(`[TMDB] Request: ${JSON.stringify(queryParams)}`);

    try {
        const res = await Widget.http.get(BASE_URL, { params: queryParams });
        const data = res.data || res;

        if (!data.results || data.results.length === 0) {
            return [{
                id: "empty",
                type: "text",
                title: "暂无数据",
                subTitle: "该时间段内无剧集更新"
            }];
        }

        return data.results.map(item => {
            // 优先显示中文名，没有则显示原名
            const title = item.name || item.original_name;
            const subTitle = item.original_name !== title ? item.original_name : "";
            
            return {
                id: String(item.id), // 必须转字符串
                type: "tmdb",        // 关键：Forward 会识别此类型并处理点击跳转
                tmdbId: item.id,
                mediaType: "tv",
                
                // 视觉信息
                title: title,
                subTitle: subTitle,
                description: item.overview || "暂无简介",
                
                // 图片 (直接给完整链接，速度最快)
                posterPath: item.poster_path ? `${IMG_BASE}${item.poster_path}` : "",
                backdropPath: item.backdrop_path ? `${BACKDROP_BASE}${item.backdrop_path}` : "",
                
                // 元数据
                rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
                year: (item.first_air_date || "").substring(0, 4),
                
                // 标记是首播还是更新 (显示在Extra或Log中，或者通过不同Subtitle展示)
                // 这里我们简单地把 tag 放在 subTitle 前面如果需要的话，或者保持 clean
            };
        });

    } catch (e) {
        return [{
            id: "error",
            type: "text",
            title: "请求失败",
            subTitle: e.message
        }];
    }
}

/**
 * 日期计算工具
 */
function getDateRange(rangeValue, isFuture) {
    const today = new Date();
    const target = new Date(today);
    const toStr = (d) => d.toISOString().split('T')[0];

    // 如果 rangeValue 是字符串 "0", "1", "30" 等
    const days = parseInt(rangeValue);

    if (isFuture) {
        // 从明天开始往后推
        today.setDate(today.getDate() + 1);
        target.setDate(today.getDate() + days);
        return { start: toStr(today), end: toStr(target) };
    } else {
        if (days === 0) {
            // 今天
            return { start: toStr(today), end: toStr(today) };
        } else if (days === 1) {
            // 明天
            target.setDate(today.getDate() + 1);
            return { start: toStr(target), end: toStr(target) };
        } else {
            // 过去N天 (更新) 或 未来N天 (根据逻辑)
            // 这里逻辑定义为：如果是 loadUpdates，通常看"最近N天"
            // 为了简化，我们假设是 Today 到 Today + N (如果是查看即将更新)
            // 或者 Today - N 到 Today (查看历史更新)
            // 参考原需求 "7天内上线"，通常指未来。
            // 修正：TMDB Discover air_date 逻辑
            
            // 设定为：从今天开始的未来 N 天 (符合追剧日历习惯)
            target.setDate(today.getDate() + days);
            return { start: toStr(today), end: toStr(target) };
        }
    }
}
