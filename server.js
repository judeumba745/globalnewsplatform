const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
const parser = new Parser();
app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

// 🧠 DATA
let news = [];
let likes = {};
let comments = {};

// 🌍 SOURCES
const sources = [
  "https://www.france24.com/fr/rss",
  "https://www.rfi.fr/fr/rss"
];

// 📰 LOAD NEWS + CONTENU COMPLET
async function loadNews() {
  let allNews = [];

  for (let url of sources) {
    try {
      const feed = await parser.parseURL(url);

      for (let item of feed.items.slice(0, 10)) { // limite à 10 news pour éviter timeout
        try {
          // Va chercher la page complète
          const res = await fetch(item.link, { timeout: 10000 });
          const html = await res.text();
          const $ = cheerio.load(html);

          let content = "";
          let images = [];
          let mainImage = "";

          // Sélecteurs France24
          if (url.includes("france24")) {
            content = $(".t-content__body").html() || item.content || item.contentSnippet;
            mainImage = $("meta[property='og:image']").attr("content") || "";
            $(".t-content__body img").each((i, el) => {
              let src = $(el).attr("src");
              if (src &&!images.includes(src)) images.push(src);
            });
          }

          // Sélecteurs RFI
          if (url.includes("rfi.fr")) {
            content = $(".article__content").html() || item.content || item.contentSnippet;
            mainImage = $("meta[property='og:image']").attr("content") || "";
            $(".article__content img").each((i, el) => {
              let src = $(el).attr("src");
              if (src &&!images.includes(src)) images.push(src);
            });
          }

          allNews.push({
            id: item.link,
            title: item.title,
            content: content || item.contentSnippet,
            mainImage: mainImage,
            images: images,
            link: item.link,
            source: feed.title,
            date: item.pubDate
          });

        } catch(e) {
          console.log("Erreur scraping:", item.link);
          // Fallback si scraping échoue
          allNews.push({
            id: item.link,
            title: item.title,
            content: item.content || item.contentSnippet,
            mainImage: item.enclosure?.url || "",
            images: [],
            link: item.link,
            source: feed.title,
            date: item.pubDate
          });
        }
      }
    } catch (err) {
      console.log("Erreur source :", url);
    }
  }

  news = allNews;
  console.log("News mises à jour :", news.length);
}

// 🔥 TRENDING
function getTrendingNews() {
  return news
   .map(n => ({...n, likesCount: likes[n.id] || 0 }))
   .sort((a, b) => b.likesCount - a.likesCount);
}

// 🚀 INIT
loadNews();
setInterval(loadNews, 10 * 60 * 1000); // refresh toutes les 10min

// 🏠 HOME
app.get("/", (req, res) => {
  const trending = getTrendingNews();
  res.render("index", { news: trending, likes, comments });
});

app.get("/trending", (req, res) => {
  const trending = getTrendingNews();
  res.render("index", { news: trending, likes, comments });
});

// 📡 API
app.get("/api/news", (req, res) => {
  res.json(news);
});

// 👍 LIKE
app.post("/like", (req, res) => {
  const id = req.body.id;
  if (!likes[id]) likes[id] = 0;
  likes[id]++;
  res.json({ success: true, likes: likes[id] });
});

// 💬 COMMENTAIRES
app.post("/comment", (req, res) => {
  const { id, text } = req.body;
  if (!comments[id]) comments[id] = [];
  comments[id].push({ text, date: new Date() });
  res.json({ success: true });
});

// 🚀 SERVER
app.listen(3000, () => {
  console.log("🚀 News Platform running on http://localhost:3000");
});