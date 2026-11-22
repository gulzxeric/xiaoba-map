import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const directory = new URL('./', import.meta.url);
const source = readFileSync(new URL('index.html', directory), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const dataEnd = script?.indexOf('    const today =');
if (!script || dataEnd < 0) {
  throw new Error('找不到地图点位与日期数据，请检查 index.html。');
}
const data = JSON.parse(runInNewContext(
  script.slice(0, dataEnd) + '\nJSON.stringify({ places, activityDates });'
));
const updateNote = (source.match(/<p>中国内地打卡地图 · ([^<]+)<\/p>/)?.[1]
  || '核对时间见在线地图').replaceAll(' · ', '，');
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const cities = [...new Set(data.places.map(place => place.city))];
const links = cities.map((city, index) => `<a href="#city-${index}">${escapeHtml(city)}</a>`).join('');
const sections = cities.map((city, index) => {
  const articles = data.places.filter(place => place.city === city).map(place => {
    const dates = data.activityDates[place.id];
    const period = dates ? dates.join(' 至 ') : '常设门店';
    const sources = place.sources.map(([label, url]) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    ).join(' ');
    const navigation = new URL('https://uri.amap.com/search');
    navigation.search = new URLSearchParams({ keyword:place.map || place.address, city, view:'map', src:'xiaoba-map' });
    return `<article id="${escapeHtml(place.id)}">
      <p class="period">${escapeHtml(period)}</p>
      <h3>${escapeHtml(place.title)}</h3>
      <p>${escapeHtml(place.address)}</p>
      <p>${escapeHtml(place.feature)}</p>
      <p class="entry">公告中的入场说明 · ${escapeHtml(place.entry)}</p>
      <p class="sources"><a href="${escapeHtml(navigation.href)}" target="_blank" rel="noopener noreferrer">高德搜索（联网）</a> ${sources}</p>
    </article>`;
  }).join('\n');
  return `<section id="city-${index}"><h2>${escapeHtml(city)}</h2>${articles}</section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="可保存到本机的中国内地小八打卡地点资料，包含地址、展期、入场说明和出处。">
<title>去哪儿找小八 · 离线地点册</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; color:#19344c; background:#f5f9fd; font:16px/1.65 "Microsoft YaHei","PingFang SC",system-ui,sans-serif; }
  header,main,footer { width:min(900px,100% - 32px); margin-inline:auto; }
  header { padding-top:28px; }
  h1 { font-size:32px; line-height:1.25; margin:0 0 12px; }
  h2 { margin:28px 0 12px; font-size:24px; }
  h3 { margin:0 0 8px; font-size:20px; }
  p { margin:8px 0; }
  nav { display:flex; flex-wrap:wrap; gap:8px; padding:12px 0; }
  nav a { min-height:44px; display:flex; align-items:center; padding:7px 14px; border:1px solid #d4e1ee; border-radius:9px; background:white; text-decoration:none; }
  a { color:#20568f; overflow-wrap:anywhere; }
  article { background:white; border:1px solid #d4e1ee; border-radius:12px; padding:18px; margin-bottom:12px; scroll-margin-top:16px; }
  .period,.entry,.sources,.meta { color:#465e74; font-size:14px; }
  .sources { display:flex; flex-wrap:wrap; gap:8px 16px; }
  footer { padding:20px 0 32px; }
  @media print { body { background:white; } nav { display:none; } article { break-inside:avoid; } }
</style>
</head>
<body>
<header>
  <h1>去哪儿找小八 · 离线地点册</h1>
  <p>保存这个 HTML 文件后，可在浏览器中离线查看 ${data.places.length} 个点位的地址、展期和入场资料。点城市跳转，也可用浏览器的查找功能搜索。</p>
  <p class="meta">${escapeHtml(updateNote)}。限时活动请按所列展期判断，常设店的临时调整以会场公告为准。</p>
  <p class="meta">高德导航、预约小程序和出处页面需要联网，已下载文件的资料不会自动更新。</p>
  <nav aria-label="按城市跳转">${links}</nav>
</header>
<main>${sections}</main>
<footer>在线地图 <a href="https://gulzxeric.github.io/xiaoba-map/">gulzxeric.github.io/xiaoba-map</a></footer>
</body>
</html>
`;
const output = new URL('xiaoba-map-offline.html', directory);
writeFileSync(output, html, 'utf8');
console.log(`已生成 ${fileURLToPath(output)}，${data.places.length} 个点位，${cities.length} 个城市，${Buffer.byteLength(html)} 字节。`);

const markdownSections = cities.map(city => {
  const points = data.places.filter(place => place.city === city).map(place => {
    const dates = data.activityDates[place.id];
    const period = dates ? dates.join(' 至 ') : '常设门店';
    const citations = place.sources.map(([label, url]) => `[${label}](${url})`).join(' · ');
    return `### ${place.title}\n\n${period}\n\n${place.address}\n\n${place.feature}\n\n公告中的入场说明 · ${place.entry}\n\n${citations}`;
  }).join('\n\n');
  return `## ${city}\n\n${points}`;
}).join('\n\n');
const markdown = `# 小八打卡地点清单

按城市查看中国内地 ${data.places.length} 个有公开出处的点位。${updateNote}。限时活动请按所列展期判断，门店临时调整以会场公告为准。

[打开交互地图](https://gulzxeric.github.io/xiaoba-map/) · [下载离线地点册](https://github.com/gulzxeric/xiaoba-map/releases/latest/download/xiaoba-map-offline.html)

离线地点册约 17 KB，保存 HTML 文件后用浏览器打开即可查看地址、展期和入场资料。高德、预约小程序和出处页需要联网，已下载资料不会自动更新。

${markdownSections}
`;
writeFileSync(new URL('README.md', directory), markdown, 'utf8');
console.log('已同步生成 README.md 备用地点清单。');
