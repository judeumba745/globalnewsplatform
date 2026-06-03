const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");

const app = express();
const parser = new Parser();

app.use(cors());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

let news = [];
// ⚠️ Render Free = mémoire effacée à chaque redémarrage. Compteurs repartent à 0
let likes = {};
let comments = {};

const sources = [
  "https://www.france24.com/fr/rss",
  "https://www.rfi.fr/fr/rss"
];

async function loadNews() {
  let allNews = [];
  for (let url of sources) {
    try {
      const feed = await parser.parseURL(url);
      for (let item of feed.items.slice(0, 15)) {
        let mainImage = item.enclosure?.url || item["media:content"]?.url || "";
        let content = item.content || item.contentSnippet || item.description || "";

        // Si l'article est nouveau, init à 0
        if(!likes[item.link]) likes[item.link] = 0;
        if(!comments[item.link]) comments[item.link] = [];

        allNews.push({
          id: item.link,
          title: item.title,
          content: content,
          mainImage: mainImage,
          link: item.link,
          source: feed.title,
          date: item.pubDate,
          likes: likes[item.link],
          comments: comments[item.link].length
        });
      }
    } catch (err) {
      console.log("Erreur source :", url);
    }
  }
  news = allNews;
  console.log("News mises à jour :", news.length);
}

loadNews();
setInterval(loadNews, 10 * 60 * 1000);

app.get("/", (req, res) => {
  res.render("index", { news });
});

app.post("/like", (req, res) => {
  const id = req.body.id;
  if (!likes[id]) likes[id] = 0;
  likes[id]++;
  res.json({ success: true, likes: likes[id] });
});

app.post("/comment", (req, res) => {
  const { id, text } = req.body;
  if (!comments[id]) comments[id] = [];
  comments[id].push({ text, date: new Date() });
  res.json({ success: true, count: comments[id].length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 News Platform running on port ${PORT}`);
});
