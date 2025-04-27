import { google } from "googleapis";
import htmlParser from "node-html-parser";
import { authenticate } from "./google-oauth2.ts";

const alphaNumeric = /^[a-zA-Z0-9]+$/;

const getPlaylistEntries = async (query: string) => {
  if (!query.match(alphaNumeric)) {
    return Promise.reject("Invalid query parameter (id)");
  }

  const fetchRes = await fetch(
    `https://open.spotify.com/playlist/${encodeURIComponent(query)}`,
  ).then((x) => x.text());
  const root = htmlParser.parse(fetchRes);
  const elems = root.querySelectorAll("[data-testid=track-row]");
  return elems.map((x) => {
    const nodes = x.childNodes.at(-1)?.childNodes.at(0)?.childNodes;
    return {
      title: nodes?.at(0)?.text,
      artist: nodes?.at(1)?.text,
    };
  });
};

const spotifyWeekly = await getPlaylistEntries("37i9dQZEVXcHfx15OOLQ3L");

console.log("Spotify Weekly", spotifyWeekly);

const scopes = ["https://www.googleapis.com/auth/youtube"];
await authenticate(scopes);
const youtube = google.youtube("v3");
const createdPlaylist = await youtube.playlists.insert({
  part: ["snippet"],
  requestBody: {
    snippet: {
      title: `Spotify Weekly Exporter ${new Date().toISOString()}`,
      description: "Test Playlist Description",
    },
  },
});

const searchResults = spotifyWeekly.map((x) =>
  youtube.search.list({ part: ["snippet"], q: `${x.title} - ${x.artist}` }),
);

const searchResultsAwaited = await Promise.all(searchResults);

const newPlaylistId = createdPlaylist.data.id;

for (const searchResult of searchResultsAwaited) {
  if (searchResult.data.items?.length === 0) {
    console.log("No results for", searchResult.config.params.q);
    continue;
  }
  console.log(`Adding`, searchResult.data.items?.at(0)?.id);
  await youtube.playlistItems.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        playlistId: newPlaylistId,
        resourceId: searchResult.data.items?.at(0)?.id,
      },
    },
  });
}
