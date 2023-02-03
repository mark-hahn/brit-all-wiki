import fs       from 'fs';
import fetch    from 'node-fetch';
import open     from 'open';
import {escape} from 'querystring';

const useStoredHome = (process.argv[2] === 'useStoredHome');

//<ul><li><i><a href="/wiki/House_(TV_series)" title="House (TV series)">House</a></i></li>
//<li><i><a href="/wiki/Royal_Pains" title="Royal Pains">Royal Pains</a></i></li>

const rx_show     = new RegExp(`<li><i><a href="/wiki/.*?" title="(.*?)">`, 'sg');

const oldShows = JSON.parse(fs.readFileSync("oldShows.json"));
const oldLinks = JSON.parse(fs.readFileSync("oldLinks.json"));

const homeUrl = 
      "https://en.wikipedia.org/wiki/List_of_British_television_programmes";

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

    const imdbSearchUrl = 
      `https://www.imdb.com/find/?q=${escape(title)}&ref_=nv_sr_sm`;
    
    console.log('fetching imdb search results page');
    const imdbData = await fetch(imdbSearchUrl);
    const imdbHtml = await imdbData.text();

    fs.writeFileSync('imdbHtml.html', imdbHtml);

    const rx_imdbCode = 
            new RegExp(`href="(/title/tt[^"]*)">${title}</a>`,'sg');

    rx_imdbCode.lastIndex = 0;
    let imdbCodeGroups;
    rx_imdbCodeLoop:
    while((imdbCodeGroups = rx_imdbCode.exec(imdbHtml)) !== null) {
      const relLink = imdbCodeGroups[1];
      if(relLink in oldLinks) continue;

      oldLinks[relLink] = true;
      fs.writeFileSync("oldLinks.json", JSON.stringify(oldLinks));

      const link = 'https://www.imdb.com' + relLink;
      console.log('opening link:', link);
      open(link);
      return;
    }

    oldShows[title] = true;
    // fs.writeFileSync("oldShows.json", JSON.stringify(oldShows));

    // let wikiData;
    // try {
    //   wikiData = await fetch(showUrl);
    // }
    // catch(e) {
    //   console.log(e.message + '\n\n');
    //   process.exit();
    // }

    // const showHtml = await wikiData.text();
    // let genreMatches;
    // rx_genre.lastIndex = 0;
    // while((genreMatches = rx_genre.exec(showHtml)) !== null) {
    //   const genre = genreMatches[1];
    //   if( genre === 'Anime'               ||
    //       genre === 'Biography'           ||
    //       genre === 'Children'            ||
    //       genre === 'Documentary'         ||
    //       genre === 'Family'              ||
    //       genre === 'Food'                ||
    //       genre === 'Game Show'           ||
    //       genre === 'History'             ||
    //       genre === 'Home &amp; Garden'   ||
    //       genre === 'LGBTQ'               ||
    //       genre === 'Musical'             ||
    //       genre === 'Reality'             ||
    //       genre === 'Sport'               ||
    //       genre === 'Stand-up &amp; Talk' ||
    //       genre === 'Travel') {
    //     console.log('---- skipping', genre);
    //     continue showLoop;
    //   }
    // }

    const showUrl = 
      `https://en.wikipedia.org/wiki/${titleTVseries.replace(/ /g, '_')}`;

    fs.writeFileSync("links.txt", 'run useStoredHome\n\n');
    fs.appendFileSync("links.txt", showUrl+'\n');
    fs.appendFileSync("links.txt", imdbSearchUrl+'\n');

    // console.log(`opening ${showUrl}`);
    // open(imdbUrl);

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
