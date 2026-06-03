self.addEventListener("install", () => {
  console.log("SW installé");
});

self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});
