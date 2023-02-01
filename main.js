import fs       from 'fs';
import fetch    from 'node-fetch';
import open     from 'open';
import {escape} from 'querystring';

const useStoredHome = (process.argv[2] === 'useStoredHome');

const rx_show      = new RegExp('"show:.*?:@global": ?{(.*?)}',          'sg');
const rx_title     = new RegExp('"title": ?"(.*?)"',                     's');
const rx_slug      = new RegExp('"slug": ?"(.*?)"',                      's');
const rx_genre     = new RegExp('Lozenge .*? href="/tv/genre/.*?>(.*?)<','sg');

const oldShows = JSON.parse(fs.readFileSync("oldShows.json"));

// const homeUrl = "https://reelgood.com/tv";
const homeUrl = "https://reelgood.com/new/tv";
// const homeUrl = "https://reelgood.com/tv/browse/new-tv-on-your-sources";
// const homeUrl = "https://reelgood.com/tv?filter-sort=3"; // sort by release date

let homeHtml;
if(!useStoredHome) {
  console.log('fetching a fresh reelgood home page');
  const homeData = await fetch(homeUrl);
  homeHtml = await homeData.text();
  fs.writeFileSync("home.html", homeHtml);
}
else {
  console.log('using stored reelgood home page');
  homeHtml = fs.readFileSync("home.html");
}

(async () => {
  let show;
  rx_show.lastIndex = 0;
  showLoop:
  while((show = rx_show.exec(homeHtml)) !== null) {

    const titleMatches = rx_title.exec(show);
    if(!titleMatches?.length) continue showLoop;

    const title = titleMatches[1];
    if(title in oldShows) continue showLoop;
    
    oldShows[title] = true;
    fs.writeFileSync("oldShows.json", JSON.stringify(oldShows));

    console.log('\n'+title);

    const slugMatches = rx_slug.exec(show);
    const slug        = slugMatches[1];
    const showUrl     = `https://reelgood.com/show/${slug}`;

    let reelData;
    try {
      reelData = await fetch(showUrl);
    }
    catch(e) {
      console.log(e+'\n'+'\n');
      process.exit();
    }

    const reelHtml = await reelData.text();
    let genreMatches;
    rx_genre.lastIndex = 0;
    while((genreMatches = rx_genre.exec(reelHtml)) !== null) {
      const genre = genreMatches[1];
      if( genre === 'Anime'               ||
          genre === 'Biography'           ||
          genre === 'Children'            ||
          genre === 'Documentary'         ||
          genre === 'Family'              ||
          genre === 'Food'                ||
          genre === 'Game Show'           ||
          genre === 'History'             ||
          genre === 'Home &amp; Garden'   ||
          genre === 'LGBTQ'               ||
          genre === 'Musical'             ||
          genre === 'Reality'             ||
          genre === 'Sport'               ||
          genre === 'Stand-up &amp; Talk' ||
          genre === 'Travel') {
        console.log('---- skipping', genre);
        continue showLoop;
      }
    }

    const imbdUrl = `https://www.imdb.com/find/?q=${escape(title)}`;
    const wikiUrl = `https://en.wikipedia.org/wiki/` +
                       `${title.replace(/ /g, '_')}%20(TV%20Series)`;
    const googleUrl  = `https://www.google.com/search?q=%22` +
                       `${title.replace(/ /g, '+')}%22+wiki+tv+show`;

    fs.writeFileSync("links.txt", 
      'USESTOREDHOME COMMAND: run useStoredHome\n\n');
    fs.appendFileSync("links.txt", imbdUrl+'\n');
    fs.appendFileSync("links.txt", wikiUrl+'\n');
    fs.appendFileSync("links.txt", googleUrl+'\n');

    console.log(`opening ${showUrl}`);
    open(showUrl);

    break;
  }
})()
