/**
 * 演示：动态副标题逻辑
 * 首页：横版 (16:9) -> "2026 · 科幻"
 * 榜单：竖版 (3:4) -> "2026-01-31"
 */

// 1. 定义常量以防未定义错误
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

var WidgetMetadata = {
  id: "dynamic_subtitle_pro",
  title: "动态 UI 演示",
  author: "Gemini",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  
  modules: [
    {
      title: "首页精选 (横版)",
      functionName: "loadHome",
      type: "video"
    },
    {
      title: "热播榜单 (竖版)",
      functionName: "loadRank",
      type: "video"
    }
  ]
};

// --- 模块入口 ---

async function loadHome(params) {
  // 模拟从某个接口获取数据
  const list = getMockData();
  // 传入 1.77 触发 "年份 · 类型" 副标题
  return formatVideoList(list, 1.77);
}

async function loadRank(params) {
  const list = getMockData();
  // 传入 0.75 触发 "具体年月日" 副标题
  return formatVideoList(list, 0.75);
}

// --- 核心格式化逻辑 (参考热门精选.js) ---

function formatVideoList(data, ratio) {
  if (!data || !Array.isArray(data)) return [];

  return data.map(item => {
    // 处理日期
    const dateStr = item.date || "2026-01-01";
    const year = dateStr.split('-')[0];
    const category = item.type || "电影";

    // 副标题切换逻辑
    let displayDesc = "";
    if (ratio > 1) {
      // 横版布局：2026 · 科幻
      displayDesc = `${year} · ${category}`;
    } else {
      // 竖版布局：2026-01-31
      displayDesc = dateStr;
    }

    return {
      id: item.id.toString(),
      title: item.title,
      description: displayDesc, // 赋给副标题
      coverUrl: item.cover,
      coverRatio: ratio,
      type: "link",
      link: "https://example.com/detail/" + item.id
    };
  });
}

// 模拟数据源
function getMockData() {
  return [
    {
      id: "9527",
      title: "星际穿越续作",
      date: "2026-01-31",
      type: "科幻",
      cover: "https://p.pstatp.com/origin/1376d0001088661642236"
    },
    {
      id: "9528",
      title: "最后的人类",
      date: "2026-02-15",
      type: "剧情",
      cover: "https://p.pstatp.com/origin/137a60000bd962f3ec051"
    }
  ];
}
