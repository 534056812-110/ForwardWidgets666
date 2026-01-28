WidgetMetadata = {
    id: "franchise_binge_pro",
    title: "系列电影大满贯",
    author: "MakkaPakka",
    description: "一键获取经典 IP 系列电影观看顺序，支持自定义搜索任意合集。",
    version: "2.0.2",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",

    // 0. 全局免 Key
    globalParams: [],

    modules: [
        {
            title: "系列合集",
            functionName: "loadFranchise",
            type: "list",
            cacheDuration: 3600,
            params: [
                {
                    name: "presetId",
                    title: "选择系列",
                    type: "enumeration",
                    value: "custom",
                    enumOptions: [
                        { title: "🔍 自定义搜索 (手动输入)", value: "custom" },
                        { title: "哈利波特 (Harry Potter)", value: "1241" },
                        { title: "漫威宇宙 (MCU)", value: "86311" },
                        { title: "007 詹姆斯邦德", value: "645" },
                        { title: "指环王 (Lord of the Rings)", value: "119" },
                        { title: "星球大战 (Star Wars)", value: "10" },
                        { title: "速度与激情", value: "9485" },
                        { title: "碟中谍 (Mission: Impossible)", value: "87359" },
                        { title: "蝙蝠侠 (Nolan)", value: "263" },
                        { title: "变形金刚", value: "8650" },
                        { title: "黑客帝国", value: "2344" },
                        { title: "加勒比海盗", value: "295" },
                        { title: "生化危机 (Resident Evil)", value: "8925" },
                        { title: "异形 (Alien)", value: "8091" },
                        { title: "教父 (The Godfather)", value: "230" },
                        { title: "玩具总动员", value: "10194" },
                        { title: "饥饿游戏", value: "131635" },
                        { title: "暮光之城", value: "33514" }
                    ]
                },
                {
                    name: "customQuery",
                    title: "搜索系列名",
                    type: "input",
                    description: "例如：教父、功夫熊猫、John Wick",
                    belongTo: {
                        paramName: "presetId",
                        value: ["custom"]
                    }
                },
                {
                    name: "sortOrder",
                    title: "观看顺序",
                    type: "enumeration",
                    value: "asc",
                    enumOptions: [
                        { title: "上映时间 (正序 1->N)", value: "asc" },
                        { title: "上映时间 (倒序 N->1)", value: "desc" },
                        { title: "评分 (高->低)", value: "rating" }
                    ]
                }
            ]
        }
    ]
};

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚",
    10752: "战争", 37: "西部"
};

async function loadFranchise(params = {}) {
    const { presetId = "custom", customQuery, sortOrder = "asc" } = params;

    let collectionId = presetId;
    let collectionName = "";

    // 1. 处理自定义搜索
    if (presetId === "custom") {
        if (!customQuery) {
            return [{ id: "err_no_q", type: "text", title: "请输入搜索词", subTitle: "在配置中输入系列名称" }];
        }
        console.log(`[Collection] Searching: ${customQuery}`);
        
        const searchResult = await searchCollection(customQuery);
        
        if (!searchResult) {
            return [{ id: "err_404", type: "text", title: "未找到合集", subTitle: `TMDB 中没有 "${customQuery}" 的官方系列合集` }];
        }
        
        collectionId = searchResult.id;
        collectionName = searchResult.name;
    }

    console.log(`[Collection] Fetching ID: ${collectionId}`);

    // 2. 获取合集详情 (免 Key)
    try {
        const res = await Widget.tmdb.get(`/collection/${collectionId}`, {
            params: { language: "zh-CN" }
        });
        const data = res || {};

        if (!data.parts || data.parts.length === 0) {
            return [{ id: "err_empty", type: "text", title: "合集数据为空", subTitle: "该系列暂无影片信息" }];
        }

        // 3. 排序处理
        let movies = data.parts;
        movies.sort((a, b) => {
            if (sortOrder === "rating") {
                return b.vote_average - a.vote_average;
            } else {
                const dateA = a.release_date ? new Date(a.release_date) : new Date("2099-01-01");
                const dateB = b.release_date ? new Date(b.release_date) : new Date("2099-01-01");
                return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
            }
        });

        // 4. 格式化输出
        const finalName = data.name || collectionName || "系列合集";
        
        return movies.map((item, index) => {
            const year = (item.release_date || "").substring(0, 4);
            const rank = index + 1;
            const score = item.vote_average ? item.vote_average.toFixed(1) : "0.0";

            // 类型处理
            const genreText = (item.genre_ids || [])
                .map(id => GENRE_MAP[id])
                .filter(Boolean)
                .slice(0, 2)
                .join(" / ");

            return {
                id: String(item.id),
                tmdbId: parseInt(item.id),
                type: "tmdb",
                mediaType: "movie",

                title: `${rank}. ${item.title}`,
                
                // 【UI 核心】年份 • 类型
                genreTitle: [year, genreText].filter(Boolean).join(" • "),
                
                // 副标题：评分
                subTitle: `TMDB ${score}`,
                
                posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
                backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
                rating: score,
                year: year,
                
                description: `所属: ${finalName}\n${item.overview || ""}`
            };
        });

    } catch (e) {
        return [{ id: "err_net", type: "text", title: "请求失败", subTitle: e.message }];
    }
}

async function searchCollection(query) {
    try {
        const res = await Widget.tmdb.get("/search/collection", {
            params: { query: encodeURIComponent(query), language: "zh-CN", page: 1 }
        });
        const data = res || {};
        
        if (data.results && data.results.length > 0) {
            return data.results[0];
        }
    } catch (e) {}
    return null;
}
