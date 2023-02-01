import fs       from 'fs';
import fetch    from 'node-fetch';
import open     from 'open';
import {escape} from 'querystring';

const useStoredHome = (process.argv[2] === 'useStoredHome');

//<ul><li><i><a href="/wiki/House_(TV_series)" title="House (TV series)">House</a></i></li>
//<li><i><a href="/wiki/Royal_Pains" title="Royal Pains">Royal Pains</a></i></li>

const rx_show = 
    new RegExp('<li><i><a href="/wiki/.*?" title="(.*?)">', 'sg');

const oldShows = JSON.parse(fs.readFileSync("oldShows.json"));

const homeUrl = "https://en.wikipedia.org/wiki/List_of_British_television_programmes";

let homeHtml;
if(!useStoredHome) {
  console.log('fetching a fresh wiki page');
  const homeData = await fetch(homeUrl);
  homeHtml = await homeData.text();
  fs.writeFileSync("home.html", homeHtml);
}
else {
  console.log('using stored wiki home page');
  homeHtml = fs.readFileSync("home.html");
}

(async () => {
  let show;
  rx_show.lastIndex = 0;
  showLoop:
  while((show = rx_show.exec(homeHtml)) !== null) {

    const titleTVseries = unEscape(show[1]);

    const title = titleTVseries.replace(/ \(TV series\)/, '');

    if(title in oldShows) continue showLoop;
    
    console.log({title});

    oldShows[title] = true;
    fs.writeFileSync("oldShows.json", JSON.stringify(oldShows));

    const showUrl = 
      `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}_(TV_series)`;

    console.log(`opening ${showUrl}`);
    open(showUrl);

    break;

    let wikiData;
    try {
      wikiData = await fetch(showUrl);
    }
    catch(e) {
      console.log(e.message + '\n\n');
      process.exit();
    }

    const showHtml = await wikiData.text();
    let genreMatches;
    rx_genre.lastIndex = 0;
    while((genreMatches = rx_genre.exec(showHtml)) !== null) {
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

    fs.writeFileSync("links.txt", 'run useStoredHome\n\n');
    fs.appendFileSync("links.txt", showUrl+'\n');

    console.log(`opening ${showUrl}`);
    open(showUrl);

    break;
  }
})()

function unEscape(htmlStr) {
  htmlStr = htmlStr.replace(/&lt;/g,  '<');	 
  htmlStr = htmlStr.replace(/&gt;/g,  '>');     
  htmlStr = htmlStr.replace(/&quot;/g,'"');  
  htmlStr = htmlStr.replace(/&#39;/g, "'");   
  htmlStr = htmlStr.replace(/&amp;/g, '&');
  return htmlStr;
}
