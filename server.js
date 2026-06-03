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
let likes = {};
let comments = {};

const sources = [
  "https://www.france24.com/fr/rss",
  "https://www.bbc.com/news/rss.xml",
  "https://www.aljazeera.com/xml/rss/all.xml"
];

// Fonction pour extraire vidéo YouTube/Dailymotion du contenu
function extractVideo(html) {
  if (!html) return null;

  // YouTube
  let match = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;

  match = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;

  // Dailymotion
  match = html.match(/dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/);
  if (match) return `https://www.dailymotion.com/embed/video/${match[1]}`;

  return null;
}

async function fetchNews() {
  let allNews = [];
  for (let url of sources) {
    try {
      let feed = await parser.parseURL(url);
      feed.items.slice(0, 15).forEach(item => {
        const videoUrl = extractVideo(item.content || item.contentSnippet || item.description);

        allNews.push({
          id: item.link,
          title: item.title,
          link: item.link,
          date: item.pubDate,
          source: feed.title,
          summary: item.contentSnippet || item.description || "",
          content: item.content || item.description || "",
          image: item.enclosure?.url || item.image?.url || null,
          video: videoUrl
        });
      });
    } catch (err) {
      console.log("Erreur fetch:", url, err.message);
    }
  }
  news = allNews.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
  console.log("News chargées:", news.length);
}

fetchNews();
setInterval(fetchNews, 10 * 60 * 1000);

app.get("/", (req, res) => {
  res.render("index", { news, likes, comments });
});

app.post("/like", (req, res) => {
  const { id } = req.body;
  likes[id] = (likes[id] || 0) + 1;
  res.json({ likes: likes[id] });
});

app.post("/comment", (req, res) => {
  const { id, text } = req.body;
  if (!comments[id]) comments[id] = [];
  comments[id].push({ text, date: new Date() });
  res.json({ comments: comments[id] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Server running on port", PORT));
