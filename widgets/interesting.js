WidgetMetadata = {
    id: "tmdb_niche_genres",
    title: "设定控 | 趣味流派",
    author: "MakkaPakka",
    description: "拒绝无聊分类！探索 赛博朋克/时空循环/克苏鲁/大逃杀 等特殊设定影视。",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    site: "https://www.themoviedb.org",

    // 全局参数
    globalParams: [
        {
            name: "apiKey",
            title: "TMDB API Key (必填)",
            type: "input",
            description: "用于获取数据。",
            value: ""
        }
    ],

    modules: [
        {
            title: "探索流派",
            functionName: "loadNicheGenre",
            type: "video",
            cacheDuration: 3600,
            params: [
                {
                    name: "themeId",
                    title: "选择感兴趣的设定",
                    type: "enumeration",
                    value: "12190", // 默认赛博朋克
                    enumOptions: [
                        { title: "🤖 赛博朋克 (Cyberpunk)", value: "12190" },
                        { title: "⏳ 时空循环 (Time Loop)", value: "4366|193382" }, // 组合关键词
                        { title: "🧟 丧尸围城 (Zombie)", value: "12377" },
                        { title: "🚀 太空歌剧 (Space Opera)", value: "3737" },
                        { title: "🔪 大逃杀/吃鸡 (Battle Royale)", value: "10565|263628" },
                        { title: "🐙 克苏鲁/洛夫克拉夫特 (Lovecraftian)", value: "210368" },
                        { title: "⚙️ 蒸汽朋克 (Steampunk)", value: "11105" },
                        { title: "🏚️ 末日废土 (Post-apocalyptic)", value: "2853" },
                        { title: "🕵️ 密室/本格推理 (Whodunit)", value: "10714" },
                        { title: "👻 伪纪录片 (Found Footage)", value: "10620" },
                        { title: "🦈 巨物恐惧 (Monster)", value: "4064" },
                        { title: "🧠 烧脑/心理惊悚 (Psychological)", value: "9919" },
                        { title: "🦄 黑暗奇幻 (Dark Fantasy)", value: "3205" }
                    ]
                },
                {
                    name: "mediaType",
                    title: "类型",
                    type: "enumeration",
                    value: "movie",
                    enumOptions: [
                        { title: "电影", value: "movie" },
                        { title: "剧集", value: "tv" }
                    ]
                },
                {
                    name: "sort",
                    title: "排序",
                    type: "enumeration",
                    value: "popularity.desc",
                    enumOptions: [
                        { title: "最热门", value: "popularity.desc" },
                        { title: "评分最高", value: "vote_average.desc" },
                        { title: "最新上映", value: "primary_release_date.desc" }
                    ]
                }
            ]
        }
    ]
};

async function loadNicheGenre(params = {}) {
    const { apiKey, themeId, mediaType = "movie", sort = "popularity.desc" } = params;

    if (!apiKey) {
        return [{
            id: "err_key",
            type: "text",
            title: "配置缺失",
            subTitle: "请在设置中填入 TMDB API Key"
        }];
    }

    // 1. 构造 Discover 链接
    // with_keywords: 核心参数，筛选特定 ID
    // vote_count.gte: 过滤掉没人看过的烂片
    let url = `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${apiKey}&language=zh-CN&sort_by=${sort}&include_adult=false&include_video=false&page=1&with_keywords=${themeId}&vote_count.gte=50`;

    // 如果是按评分排序，增加投票人数门槛，防止只有1个人评10分的情况
    if (sort === "vote_average.desc") {
        url += "&vote_count.gte=300";
    }

    console.log(`[Niche] Fetching: ${mediaType} - keywords:${themeId}`);

    try {
        const res = await Widget.http.get(url);
        const data = res.data || res;
        
        if (!data.results || data.results.length === 0) {
            return [{
                id: "empty",
                type: "text",
                title: "暂无数据",
                subTitle: "该分类下暂无内容"
            }];
        }

        // 2. 映射数据
        return data.results.map(item => {
            const title = item.title || item.name;
            const originalName = item.original_title || item.original_name;
            const year = (item.release_date || item.first_air_date || "").substring(0, 4);
            
            // 动态副标题：显示评分和年份
            const subTitle = `${year} · ⭐️ ${item.vote_average ? item.vote_average.toFixed(1) : "0.0"}`;

            return {
                id: String(item.id),
                tmdbId: parseInt(item.id),
                type: "tmdb",
                mediaType: mediaType,
                
                title: title,
                subTitle: subTitle,
                description: item.overview || `原名: ${originalName}`,
                
                posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
                backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
                
                rating: item.vote_average ? item.vote_average.toFixed(1) : "0.0",
                year: year
            };
        });

    } catch (e) {
        return [{
            id: "err_net",
            type: "text",
            title: "网络错误",
            subTitle: e.message
        }];
    }
}
